import { eq, sql } from 'drizzle-orm';
import type { DbConnection } from '../db/client.js';
import { employees, currencyRates } from '../db/schema/index.js';

export interface SummaryInsights {
  totalHeadcount: number;
  totalPayrollUsd: number;
  headcountByCountry: { country: string; headcount: number }[];
}

export class InsightsService {
  constructor(private readonly db: DbConnection) {}

  /**
   * Org-wide dashboard metrics. All metrics exclude soft-deleted (INACTIVE)
   * employees. Payroll is summed in USD minor units using a JOIN against the
   * currency_rates table (salary_native_minor * usd_rate).
   */
  getSummary(): SummaryInsights {
    const totals = this.db
      .select({
        headcount: sql<number>`count(*)`,
        payrollUsd: sql<number>`coalesce(sum(${employees.salary} * ${currencyRates.usdRate}), 0)`,
      })
      .from(employees)
      .leftJoin(currencyRates, eq(currencyRates.currency, employees.currency))
      .where(eq(employees.status, 'ACTIVE'))
      .get();

    const byCountry = this.db
      .select({
        country: employees.country,
        headcount: sql<number>`count(*)`,
      })
      .from(employees)
      .where(eq(employees.status, 'ACTIVE'))
      .groupBy(employees.country)
      .orderBy(sql`count(*) desc`, employees.country)
      .all();

    return {
      totalHeadcount: totals?.headcount ?? 0,
      totalPayrollUsd: Math.round(totals?.payrollUsd ?? 0),
      headcountByCountry: byCountry,
    };
  }
}
