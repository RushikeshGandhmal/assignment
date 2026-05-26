import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { CreateEmployeeInput, Employee } from '@salary-management/shared';
import type { DbConnection } from '../db/client.js';
import { employees } from '../db/schema/index.js';

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
}
