import { z } from 'zod';

/** Employment type for an employee. */
export const employmentTypeSchema = z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']);
export type EmploymentType = z.infer<typeof employmentTypeSchema>;

/** Lifecycle status. Deleting an employee sets status to INACTIVE (soft delete). */
export const employeeStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export type EmployeeStatus = z.infer<typeof employeeStatusSchema>;

/** Supported ISO-4217 currency codes. Keep in sync with the currency_rates table. */
export const currencyCodeSchema = z.enum(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'SGD', 'JPY']);
export type CurrencyCode = z.infer<typeof currencyCodeSchema>;
