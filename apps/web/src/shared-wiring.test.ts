import { describe, expect, it } from 'vitest';
import { employmentTypeSchema, paginationQuerySchema } from '@salary-management/shared';

// Verifies the @salary-management/shared workspace dep resolves from apps/web.
describe('shared package wiring', () => {
  it('resolves shared zod schemas', () => {
    expect(paginationQuerySchema.parse({ page: '2' }).page).toBe(2);
    expect(employmentTypeSchema.parse('FULL_TIME')).toBe('FULL_TIME');
  });
});
