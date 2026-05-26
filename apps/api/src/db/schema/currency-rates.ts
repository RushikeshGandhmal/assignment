import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Static exchange rates used to normalize salaries to USD for cross-country
// aggregates. Currency code (ISO-4217) is the natural primary key.
export const currencyRates = sqliteTable('currency_rates', {
  currency: text('currency').primaryKey(),
  usdRate: real('usd_rate').notNull(),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(unixepoch())`),
});

export type CurrencyRate = typeof currencyRates.$inferSelect;
export type NewCurrencyRate = typeof currencyRates.$inferInsert;
