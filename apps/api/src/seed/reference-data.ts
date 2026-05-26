// Reference data for the seed script. Salary ranges are in the country's
// native currency, in minor units (cents, paise, etc.).

export const COUNTRIES = [
  { code: 'US', currency: 'USD', salaryMinMinor: 5_000_000, salaryMaxMinor: 30_000_000 },
  { code: 'IN', currency: 'INR', salaryMinMinor: 60_000_000, salaryMaxMinor: 600_000_000 },
  { code: 'GB', currency: 'GBP', salaryMinMinor: 3_000_000, salaryMaxMinor: 18_000_000 },
  { code: 'DE', currency: 'EUR', salaryMinMinor: 4_000_000, salaryMaxMinor: 20_000_000 },
  { code: 'FR', currency: 'EUR', salaryMinMinor: 3_500_000, salaryMaxMinor: 18_000_000 },
  { code: 'CA', currency: 'CAD', salaryMinMinor: 5_500_000, salaryMaxMinor: 22_000_000 },
  { code: 'AU', currency: 'AUD', salaryMinMinor: 6_500_000, salaryMaxMinor: 22_000_000 },
  { code: 'JP', currency: 'JPY', salaryMinMinor: 4_000_000, salaryMaxMinor: 18_000_000 },
  { code: 'SG', currency: 'SGD', salaryMinMinor: 5_000_000, salaryMaxMinor: 20_000_000 },
  { code: 'BR', currency: 'BRL', salaryMinMinor: 6_000_000, salaryMaxMinor: 30_000_000 },
] as const;

export const JOB_TITLES = [
  'Software Engineer',
  'Senior Software Engineer',
  'Staff Engineer',
  'Engineering Manager',
  'Product Manager',
  'Senior Product Manager',
  'Designer',
  'Senior Designer',
  'Data Analyst',
  'Data Scientist',
  'DevOps Engineer',
  'QA Engineer',
  'Technical Writer',
  'Sales Manager',
  'Account Executive',
  'Customer Success Manager',
  'Marketing Manager',
  'HR Business Partner',
  'Recruiter',
  'Finance Analyst',
] as const;

export const DEPARTMENTS = [
  'Engineering',
  'Product',
  'Design',
  'Data',
  'Sales',
  'Marketing',
  'Customer Success',
  'People',
  'Finance',
] as const;

export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'] as const;

// Static USD conversion rates (point-in-time snapshot). Refresh periodically.
export const CURRENCY_RATES: Array<{ currency: string; usdRate: number }> = [
  { currency: 'USD', usdRate: 1 },
  { currency: 'EUR', usdRate: 1.08 },
  { currency: 'GBP', usdRate: 1.27 },
  { currency: 'CAD', usdRate: 0.74 },
  { currency: 'AUD', usdRate: 0.66 },
  { currency: 'JPY', usdRate: 0.0067 },
  { currency: 'INR', usdRate: 0.012 },
  { currency: 'SGD', usdRate: 0.74 },
  { currency: 'BRL', usdRate: 0.2 },
];
