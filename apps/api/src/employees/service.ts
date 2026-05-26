import { randomUUID } from 'node:crypto';
import { and, asc, eq, like, or, sql, type SQL } from 'drizzle-orm';
import type {
  CreateEmployeeInput,
  Employee,
  ListEmployeesQuery,
  UpdateEmployeeInput,
} from '@salary-management/shared';
import type { DbConnection } from '../db/client.js';
import { employees } from '../db/schema/index.js';

export interface PaginatedEmployees {
  items: Employee[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Thrown when an attempted insert/update would violate the unique email constraint. */
export class EmployeeEmailConflictError extends Error {
  constructor(email: string) {
    super(`employee with email ${email} already exists`);
    this.name = 'EmployeeEmailConflictError';
  }
}

interface SqliteError extends Error {
  code?: string;
}

function isUniqueConstraintError(err: unknown): boolean {
  const e = err as SqliteError | undefined;
  return !!e && typeof e.code === 'string' && e.code.startsWith('SQLITE_CONSTRAINT');
}

export class EmployeeService {
  constructor(private readonly db: DbConnection) {}

  createEmployee(input: CreateEmployeeInput): Employee {
    const row = {
      id: randomUUID(),
      ...input,
      status: 'ACTIVE' as const,
    };

    try {
      this.db.insert(employees).values(row).run();
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new EmployeeEmailConflictError(input.email);
      }
      throw err;
    }

    const inserted = this.db.select().from(employees).where(eq(employees.id, row.id)).get();
    if (!inserted) {
      throw new Error('employee insert succeeded but row was not retrievable');
    }
    return inserted as Employee;
  }

  getEmployeeById(id: string): Employee | null {
    const row = this.db.select().from(employees).where(eq(employees.id, id)).get();
    return (row as Employee | undefined) ?? null;
  }

  /**
   * Applies a partial update. Returns the updated row, or null when no
   * employee with that id exists. Throws EmployeeEmailConflictError when
   * the new email collides with another employee.
   */
  updateEmployee(id: string, input: UpdateEmployeeInput): Employee | null {
    const existing = this.getEmployeeById(id);
    if (!existing) return null;

    const patch = { ...input, updatedAt: Math.floor(Date.now() / 1000) };

    try {
      this.db.update(employees).set(patch).where(eq(employees.id, id)).run();
    } catch (err) {
      if (isUniqueConstraintError(err) && input.email !== undefined) {
        throw new EmployeeEmailConflictError(input.email);
      }
      throw err;
    }

    return this.getEmployeeById(id);
  }

  listEmployees(query: ListEmployeesQuery): PaginatedEmployees {
    const { page, pageSize } = query;
    const where = buildListWhereClause(query);

    const totalRow = this.db
      .select({ count: sql<number>`count(*)` })
      .from(employees)
      .where(where)
      .get();
    const total = totalRow?.count ?? 0;

    const items = this.db
      .select()
      .from(employees)
      .where(where)
      .orderBy(asc(employees.lastName), asc(employees.firstName))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all() as Employee[];

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }
}

// Soft-deleted rows (INACTIVE) are hidden unless the caller explicitly asks
// for them via the status filter. Search matches firstName, lastName, or
// email case-insensitively via LOWER() comparison.
function buildListWhereClause(query: ListEmployeesQuery): SQL | undefined {
  const conditions: SQL[] = [];

  conditions.push(eq(employees.status, query.status ?? 'ACTIVE'));

  if (query.country) {
    conditions.push(eq(employees.country, query.country));
  }
  if (query.jobTitle) {
    conditions.push(eq(employees.jobTitle, query.jobTitle));
  }
  if (query.search) {
    const needle = `%${query.search.toLowerCase()}%`;
    const searchClause = or(
      like(sql`lower(${employees.firstName})`, needle),
      like(sql`lower(${employees.lastName})`, needle),
      like(sql`lower(${employees.email})`, needle),
    );
    if (searchClause) {
      conditions.push(searchClause);
    }
  }

  return conditions.length === 1 ? conditions[0] : and(...conditions);
}
