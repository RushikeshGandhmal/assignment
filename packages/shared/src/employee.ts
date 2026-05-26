import { z } from 'zod';
import { employmentTypeSchema, employeeStatusSchema, currencyCodeSchema } from './enums.js';

/** ISO-3166 alpha-2 country code (two uppercase letters). */
export const countryCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}$/, 'country must be a 2-letter ISO-3166 code');

/** ISO date string YYYY-MM-DD. SQLite has no native date type; lexicographic sort works on this format. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD form');

/** Request body to create an employee. */
export const createEmployeeSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  jobTitle: z.string().min(1).max(120),
  department: z.string().min(1).max(80),
  country: countryCodeSchema,
  salary: z.number().int().nonnegative(),
  currency: currencyCodeSchema,
  employmentType: employmentTypeSchema,
  hireDate: isoDateSchema,
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

/**
 * Request body for PATCH /employees/:id. All fields optional, but at least
 * one mutable field must be present. Immutable fields (id, status, createdAt,
 * updatedAt) are not listed and are stripped by Zod's default behavior.
 */
export const updateEmployeeSchema = createEmployeeSchema
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'at least one field must be provided',
  });
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

/** An employee row as returned by the API. */
export const employeeSchema = createEmployeeSchema.extend({
  id: z.string(),
  status: employeeStatusSchema,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Employee = z.infer<typeof employeeSchema>;

/** Query parameters for GET /employees. All optional. */
export const listEmployeesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().min(1).optional(),
  country: countryCodeSchema.optional(),
  jobTitle: z.string().trim().min(1).optional(),
  status: employeeStatusSchema.optional(),
});
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
