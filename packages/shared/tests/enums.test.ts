import { describe, expect, it } from 'vitest';
import { currencyCodeSchema, employeeStatusSchema, employmentTypeSchema } from '../src/enums.js';

describe('enums', () => {
  it('accepts all defined employment types', () => {
    for (const value of ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']) {
      expect(employmentTypeSchema.parse(value)).toBe(value);
    }
  });

  it('rejects unknown employment types', () => {
    expect(() => employmentTypeSchema.parse('FREELANCE')).toThrow();
  });

  it('accepts both employee statuses', () => {
    expect(employeeStatusSchema.parse('ACTIVE')).toBe('ACTIVE');
    expect(employeeStatusSchema.parse('INACTIVE')).toBe('INACTIVE');
  });

  it('accepts supported currency codes and rejects unsupported ones', () => {
    expect(currencyCodeSchema.parse('USD')).toBe('USD');
    expect(currencyCodeSchema.parse('INR')).toBe('INR');
    expect(() => currencyCodeSchema.parse('BTC')).toThrow();
  });
});
