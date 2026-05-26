'use client';

import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  getCountryInsights,
  getSummary,
  type CountryInsights,
  type SummaryInsights,
} from '@/lib/insights';
import { Button } from '@/components/ui/button';

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatUsdCents(cents: number): string {
  return USD_FORMATTER.format(cents / 100);
}

function formatMinor(amount: number): string {
  return (amount / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryInsights | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [country, setCountry] = useState<string>('');
  const [drill, setDrill] = useState<CountryInsights | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSummaryLoading(true);
    setSummaryError(null);
    getSummary()
      .then((res) => {
        if (cancelled) return;
        setSummary(res);
        if (!country && res.headcountByCountry[0]) {
          setCountry(res.headcountByCountry[0].country);
        }
      })
      .catch(() => {
        if (!cancelled) setSummaryError('Could not load insights.');
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // We only want this to run once on mount; country gets seeded from the
    // response. Re-running on country changes is handled by the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!country) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrillLoading(true);
    setDrillError(null);
    getCountryInsights(country)
      .then((res) => {
        if (!cancelled) setDrill(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setDrill(null);
          setDrillError(`No active employees in ${country}.`);
        } else {
          setDrillError('Could not load country insights.');
        }
      })
      .finally(() => {
        if (!cancelled) setDrillLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [country]);

  const countries = useMemo(
    () => summary?.headcountByCountry.map((c) => c.country) ?? [],
    [summary],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Org-wide headcount, payroll, and salary distribution by country and job title.
        </p>
      </div>

      {summaryLoading ? (
        <div className="text-sm text-muted-foreground">Loading insights…</div>
      ) : summaryError ? (
        <div role="alert" className="rounded-md border border-destructive/40 p-4 text-sm">
          {summaryError}
        </div>
      ) : summary ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryCard label="Total headcount" value={summary.totalHeadcount.toLocaleString()} />
            <SummaryCard
              label="Total payroll (USD)"
              value={formatUsdCents(summary.totalPayrollUsd)}
            />
            <SummaryCard label="Countries represented" value={countries.length.toLocaleString()} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Headcount by country</h2>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">Country</th>
                    <th className="px-4 py-2 font-medium text-right">Headcount</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {summary.headcountByCountry.map((row) => (
                    <tr key={row.country} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">{row.country}</td>
                      <td className="px-4 py-2 text-right">{row.headcount.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCountry(row.country)}
                          aria-label={`View insights for ${row.country}`}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-tight">Country drilldown</h2>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="rounded-md border bg-background px-2 py-1 text-sm"
                aria-label="Country"
              >
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {drillLoading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : drillError ? (
              <div role="alert" className="rounded-md border border-destructive/40 p-4 text-sm">
                {drillError}
              </div>
            ) : drill ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryCard
                    label={`Headcount (${drill.country})`}
                    value={drill.headcount.toLocaleString()}
                  />
                  <SummaryCard label="Min salary" value={formatMinor(drill.salary.min)} />
                  <SummaryCard label="Avg salary" value={formatMinor(drill.salary.avg)} />
                  <SummaryCard label="Median salary" value={formatMinor(drill.salary.median)} />
                </div>

                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30 text-left">
                      <tr>
                        <th className="px-4 py-2 font-medium">Job title</th>
                        <th className="px-4 py-2 font-medium text-right">Headcount</th>
                        <th className="px-4 py-2 font-medium text-right">Min</th>
                        <th className="px-4 py-2 font-medium text-right">Avg</th>
                        <th className="px-4 py-2 font-medium text-right">Median</th>
                        <th className="px-4 py-2 font-medium text-right">Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drill.byJobTitle.map((row) => (
                        <tr key={row.jobTitle} className="border-b last:border-0">
                          <td className="px-4 py-2 font-medium">{row.jobTitle}</td>
                          <td className="px-4 py-2 text-right">{row.headcount.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right">{formatMinor(row.salary.min)}</td>
                          <td className="px-4 py-2 text-right">{formatMinor(row.salary.avg)}</td>
                          <td className="px-4 py-2 text-right">{formatMinor(row.salary.median)}</td>
                          <td className="px-4 py-2 text-right">{formatMinor(row.salary.max)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Salaries shown in the country&apos;s native currency.
                </p>
              </>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
