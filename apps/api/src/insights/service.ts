import { and, asc, eq, sql } from 'drizzle-orm';
import type { DbConnection } from '../db/client.js';
import { employees, currencyRates } from '../db/schema/index.js';

export interface SalaryStats {
  min: number;
  max: number;
  avg: number;
  median: number;
}

export interface CountryInsights {
  country: string;
  headcount: number;
  salary: SalaryStats;
  byJobTitle: { jobTitle: string; headcount: number; salary: SalaryStats }[];
}

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

  /**
   * Per-country drilldown: min, max, avg, median for the country overall and
   * per job title. Returns null when no ACTIVE employees exist in the country.
   *
   * Pulls the raw (salary, jobTitle) tuples once and computes stats in JS.
   * The country index keeps the read cheap, and the per-country slice is
   * bounded (in our 10K seed the largest country has ~1.5K rows), so the
   * O(N log N) sort here is comfortably faster than running several aggregate
   * queries plus a window-function pass for the median.
   */
  getCountryInsights(country: string): CountryInsights | null {
    const rows = this.db
      .select({ salary: employees.salary, jobTitle: employees.jobTitle })
      .from(employees)
      .where(and(eq(employees.country, country), eq(employees.status, 'ACTIVE')))
      .orderBy(asc(employees.salary))
      .all();

    if (rows.length === 0) return null;

    const overallSalaries = rows.map((r) => r.salary);
    const salary = computeStats(overallSalaries);

    const byTitle = new Map<string, number[]>();
    for (const r of rows) {
      const list = byTitle.get(r.jobTitle);
      if (list) list.push(r.salary);
      else byTitle.set(r.jobTitle, [r.salary]);
    }

    const byJobTitle = Array.from(byTitle.entries())
      .map(([jobTitle, salaries]) => ({
        jobTitle,
        headcount: salaries.length,
        salary: computeStats(salaries),
      }))
      .sort((a, b) =>
        b.headcount !== a.headcount
          ? b.headcount - a.headcount
          : a.jobTitle.localeCompare(b.jobTitle),
      );

    return {
      country,
      headcount: rows.length,
      salary,
      byJobTitle,
    };
  }
}

/**
 * Computes min, max, avg, median for a non-empty list of integer salaries.
 * Assumes the input is sorted ascending (caller is responsible). Returns
 * rounded integers to keep the money-as-minor-units invariant.
 */
function computeStats(sortedAsc: number[]): SalaryStats {
  const n = sortedAsc.length;
  if (n === 0) throw new Error('computeStats requires a non-empty list');

  const min = sortedAsc[0]!;
  const max = sortedAsc[n - 1]!;

  let sum = 0;
  for (const v of sortedAsc) sum += v;
  const avg = Math.round(sum / n);

  let median: number;
  if (n % 2 === 1) {
    median = sortedAsc[(n - 1) / 2]!;
  } else {
    const lo = sortedAsc[n / 2 - 1]!;
    const hi = sortedAsc[n / 2]!;
    median = Math.round((lo + hi) / 2);
  }

  return { min, max, avg, median };
}
