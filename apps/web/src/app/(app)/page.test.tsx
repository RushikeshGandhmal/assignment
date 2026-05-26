import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const insightsMock = vi.hoisted(() => ({
  getSummary: vi.fn(),
  getCountryInsights: vi.fn(),
}));

vi.mock('@/lib/insights', () => ({
  getSummary: insightsMock.getSummary,
  getCountryInsights: insightsMock.getCountryInsights,
}));

import DashboardPage from './page';

const summary = {
  totalHeadcount: 250,
  totalPayrollUsd: 12_500_000_00, // 12.5M USD in cents
  headcountByCountry: [
    { country: 'US', headcount: 120 },
    { country: 'IN', headcount: 80 },
    { country: 'DE', headcount: 50 },
  ],
};

const usDrill = {
  country: 'US',
  headcount: 120,
  salary: { min: 5_000_000, max: 25_000_000, avg: 12_000_000, median: 11_000_000 },
  byJobTitle: [
    {
      jobTitle: 'Software Engineer',
      headcount: 80,
      salary: { min: 5_000_000, max: 20_000_000, avg: 10_000_000, median: 9_500_000 },
    },
    {
      jobTitle: 'Product Manager',
      headcount: 40,
      salary: { min: 8_000_000, max: 25_000_000, avg: 14_000_000, median: 13_000_000 },
    },
  ],
};

describe('DashboardPage', () => {
  beforeEach(() => {
    insightsMock.getSummary.mockReset();
    insightsMock.getCountryInsights.mockReset();
  });

  it('renders summary metrics and headcount-by-country table', async () => {
    insightsMock.getSummary.mockResolvedValue(summary);
    insightsMock.getCountryInsights.mockResolvedValue(usDrill);

    render(<DashboardPage />);

    expect(await screen.findByText('250')).toBeInTheDocument();
    expect(screen.getByText('$12,500,000')).toBeInTheDocument();
    // Country codes are displayed using their full ISO display name.
    expect(screen.getAllByText('United States').length).toBeGreaterThan(0);
    expect(screen.getAllByText('India').length).toBeGreaterThan(0);
    expect(screen.getByText('120')).toBeInTheDocument();
  });

  it('seeds the drilldown with the first country and renders per-title stats', async () => {
    insightsMock.getSummary.mockResolvedValue(summary);
    insightsMock.getCountryInsights.mockResolvedValue(usDrill);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(insightsMock.getCountryInsights).toHaveBeenCalledWith('US');
    });

    expect(await screen.findByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('Product Manager')).toBeInTheDocument();
  });

  it('refetches the drilldown when a different country is chosen via the select', async () => {
    insightsMock.getSummary.mockResolvedValue(summary);
    insightsMock.getCountryInsights.mockResolvedValue(usDrill);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(insightsMock.getCountryInsights).toHaveBeenCalledWith('US');
    });

    const user = userEvent.setup();
    const select = screen.getByLabelText('Country');
    await user.selectOptions(select, 'IN');

    await waitFor(() => {
      expect(insightsMock.getCountryInsights).toHaveBeenCalledWith('IN');
    });
  });

  it('shows a friendly error when the summary endpoint fails', async () => {
    insightsMock.getSummary.mockRejectedValue(new Error('boom'));

    render(<DashboardPage />);

    expect(await screen.findByText('Could not load insights.')).toBeInTheDocument();
  });
});
