import { describe, expect, it } from 'vitest';
import { currencyCodeSchema, paginationQuerySchema } from '@salary-management/shared';

// Verifies the @salary-management/shared workspace dep resolves from apps/api.
describe('shared package wiring', () => {
  it('resolves shared zod schemas', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 25 });
    expect(currencyCodeSchema.parse('USD')).toBe('USD');
  });
});
