import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Salary is stored in the minor unit of the listed currency (e.g. cents for USD,
// paise for INR). Storing money as integers avoids floating-point rounding errors.
//
// Country uses ISO-3166 alpha-2 codes; currency uses ISO-4217.
// hireDate is an ISO date string (YYYY-MM-DD) — SQLite has no native date type,
// and ISO strings sort correctly lexicographically.
export const employees = sqliteTable(
  'employees',
  {
    id: text('id').primaryKey(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull().unique(),
    jobTitle: text('job_title').notNull(),
    department: text('department').notNull(),
    country: text('country').notNull(),
    salary: integer('salary').notNull(),
    currency: text('currency').notNull(),
    employmentType: text('employment_type', {
      enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'],
    }).notNull(),
    hireDate: text('hire_date').notNull(),
    status: text('status', { enum: ['ACTIVE', 'INACTIVE'] })
      .notNull()
      .default('ACTIVE'),
    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at')
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('employees_country_idx').on(table.country),
    index('employees_job_title_idx').on(table.jobTitle),
    index('employees_status_idx').on(table.status),
    // Composite index supports the JD's required "avg salary for a job title in a country" query.
    index('employees_country_job_title_idx').on(table.country, table.jobTitle),
  ],
);

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
