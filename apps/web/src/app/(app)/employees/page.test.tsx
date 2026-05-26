import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listMock, deleteMock, createMock, updateMock, pushMock, pathnameMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  deleteMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  pushMock: vi.fn(),
  pathnameMock: vi.fn(() => '/employees'),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  usePathname: () => pathnameMock(),
}));

vi.mock('@/lib/employees', async () => {
  const actual = await vi.importActual<typeof import('@/lib/employees')>('@/lib/employees');
  return {
    ...actual,
    listEmployees: listMock,
    deleteEmployee: deleteMock,
    createEmployee: createMock,
    updateEmployee: updateMock,
  };
});

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown) {
      super(`API request failed with status ${status}`);
      this.status = status;
      this.body = body;
    }
  },
}));

import EmployeesPage from './page';

const sampleEmployee = {
  id: 'emp-1',
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice.smith@example.com',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  country: 'US',
  salary: 12000000,
  currency: 'USD',
  employmentType: 'FULL_TIME' as const,
  hireDate: '2023-01-15',
  status: 'ACTIVE' as const,
  createdAt: 1700000000,
  updatedAt: 1700000000,
};

function paginated(items: (typeof sampleEmployee)[]) {
  return {
    items,
    page: 1,
    pageSize: 25,
    total: items.length,
    totalPages: 1,
  };
}

beforeEach(() => {
  listMock.mockReset();
  deleteMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('EmployeesPage', () => {
  it('lists employees returned by the API and shows the total count', async () => {
    listMock.mockResolvedValue(paginated([sampleEmployee]));

    render(<EmployeesPage />);

    expect(await screen.findByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('alice.smith@example.com')).toBeInTheDocument();
    expect(screen.getByText(/1 active employees/i)).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 25, status: 'ACTIVE' }),
    );
  });

  it('shows an empty state when there are no matching rows', async () => {
    listMock.mockResolvedValue(paginated([]));

    render(<EmployeesPage />);

    expect(await screen.findByText(/no employees match/i)).toBeInTheDocument();
  });

  it('debounces the search input and re-fetches with the trimmed term', async () => {
    listMock.mockResolvedValue(paginated([sampleEmployee]));
    const user = userEvent.setup();

    render(<EmployeesPage />);
    await screen.findByText('Alice Smith');
    listMock.mockClear();

    await user.type(screen.getByLabelText(/search/i), 'alice');

    await waitFor(
      () => {
        expect(listMock).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'alice', page: 1 }),
        );
      },
      { timeout: 1000 },
    );
  });

  it('re-fetches with the chosen country filter', async () => {
    listMock.mockResolvedValue(paginated([sampleEmployee]));
    const user = userEvent.setup();

    render(<EmployeesPage />);
    await screen.findByText('Alice Smith');
    listMock.mockClear();

    await user.selectOptions(screen.getByLabelText(/^country$/i), 'US');

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ country: 'US' })),
    );
  });

  it('hides edit and deactivate buttons on inactive rows', async () => {
    const inactive = {
      ...sampleEmployee,
      id: 'emp-2',
      status: 'INACTIVE' as 'ACTIVE' | 'INACTIVE',
    };
    listMock.mockResolvedValue(paginated([sampleEmployee, inactive] as (typeof sampleEmployee)[]));

    render(<EmployeesPage />);
    await waitFor(() => expect(screen.getAllByText('Alice Smith')).toHaveLength(2));

    const rows = screen.getAllByRole('row');
    // header + 2 data rows
    expect(rows).toHaveLength(3);

    const activeRow = rows[1]!;
    const inactiveRow = rows[2]!;

    expect(within(activeRow).getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
    expect(within(activeRow).getByRole('button', { name: /^deactivate$/i })).toBeInTheDocument();

    expect(within(inactiveRow).queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
    expect(
      within(inactiveRow).queryByRole('button', { name: /^deactivate$/i }),
    ).not.toBeInTheDocument();
  });

  it('opens a confirmation dialog and soft-deletes the row on confirm', async () => {
    listMock.mockResolvedValue(paginated([sampleEmployee]));
    deleteMock.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<EmployeesPage />);
    await screen.findByText('Alice Smith');

    await user.click(screen.getByRole('button', { name: /deactivate$/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/alice smith will be marked inactive/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /^deactivate$/i }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('emp-1'));
  });
});
