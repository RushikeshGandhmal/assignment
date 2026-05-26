import type {
  CreateEmployeeInput,
  Employee,
  ListEmployeesQuery,
  UpdateEmployeeInput,
} from '@salary-management/shared';
import { apiDelete, apiGet, apiPatch, apiPost } from './api';

export interface PaginatedEmployees {
  items: Employee[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function listEmployees(query: Partial<ListEmployeesQuery>): Promise<PaginatedEmployees> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '' || value === null) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return apiGet<PaginatedEmployees>(`/employees${qs ? `?${qs}` : ''}`);
}

export function getEmployee(id: string): Promise<Employee> {
  return apiGet<Employee>(`/employees/${id}`);
}

export function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  return apiPost<Employee>('/employees', input);
}

export function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<Employee> {
  return apiPatch<Employee>(`/employees/${id}`, input);
}

export function deleteEmployee(id: string): Promise<void> {
  return apiDelete<void>(`/employees/${id}`);
}

/** Countries and their default currency. Kept in sync with the seed reference data. */
export const COUNTRY_OPTIONS: { code: string; name: string; currency: string }[] = [
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'IN', name: 'India', currency: 'INR' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'FR', name: 'France', currency: 'EUR' },
  { code: 'CA', name: 'Canada', currency: 'CAD' },
  { code: 'AU', name: 'Australia', currency: 'AUD' },
  { code: 'JP', name: 'Japan', currency: 'JPY' },
  { code: 'SG', name: 'Singapore', currency: 'SGD' },
  { code: 'BR', name: 'Brazil', currency: 'BRL' },
];

export const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'SGD', 'BRL'];

export const EMPLOYMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Intern' },
];

/** Format an integer salary stored in minor units as a localized currency string. */
export function formatSalary(minorUnits: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(minorUnits / 100);
  } catch {
    return `${currency} ${(minorUnits / 100).toLocaleString()}`;
  }
}
