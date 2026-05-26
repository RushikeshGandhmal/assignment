import { beforeEach, describe, expect, it } from 'vitest';
import { currencyRates } from '../src/db/schema/currency-rates.js';
import { createTestDb } from './helpers/test-db.js';

type Db = ReturnType<typeof createTestDb>;

describe('currency_rates table', () => {
  let db: Db;

  beforeEach(() => {
    db = createTestDb();
  });

  it('stores a rate and reads it back', () => {
    db.insert(currencyRates).values({ currency: 'USD', usdRate: 1 }).run();
    const rows = db.select().from(currencyRates).all();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ currency: 'USD', usdRate: 1 });
    expect(rows[0]?.updatedAt).toBeTypeOf('number');
  });

  it('uses currency code as primary key (rejects duplicates)', () => {
    db.insert(currencyRates).values({ currency: 'INR', usdRate: 0.012 }).run();
    expect(() =>
      db.insert(currencyRates).values({ currency: 'INR', usdRate: 0.013 }).run(),
    ).toThrow(/UNIQUE|PRIMARY/i);
  });

  it('rejects rows missing usd_rate', () => {
    expect(() =>
      db
        .insert(currencyRates)
        // @ts-expect-error intentionally missing usd_rate
        .values({ currency: 'EUR' })
        .run(),
    ).toThrow(/NOT NULL/i);
  });
});
