import { apiGet } from './api';

export interface SalaryStats {
  min: number;
  max: number;
  avg: number;
  median: number;
}

export interface SummaryInsights {
  totalHeadcount: number;
  totalPayrollUsd: number;
  headcountByCountry: { country: string; headcount: number }[];
}

export interface CountryInsights {
  country: string;
  headcount: number;
  salary: SalaryStats;
  byJobTitle: { jobTitle: string; headcount: number; salary: SalaryStats }[];
}

export function getSummary(): Promise<SummaryInsights> {
  return apiGet<SummaryInsights>('/insights/summary');
}

export function getCountryInsights(country: string): Promise<CountryInsights> {
  return apiGet<CountryInsights>(`/insights/countries/${encodeURIComponent(country)}`);
}
