import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock, updateMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock('@/lib/employees', async () => {
  const actual = await vi.importActual<typeof import('@/lib/employees')>('@/lib/employees');
  return {
    ...actual,
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

import { EmployeeFormDialog } from './employee-form-dialog';
import { ApiError } from '@/lib/api';

const onSaved = vi.fn();
const onOpenChange = vi.fn();

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  const dialog = within(await screen.findByRole('dialog'));
  await user.type(dialog.getByLabelText(/first name/i), 'Ada');
  await user.type(dialog.getByLabelText(/last name/i), 'Lovelace');
  await user.type(dialog.getByLabelText(/email/i), 'ada@example.com');
  await user.type(dialog.getByLabelText(/job title/i), 'Software Engineer');
  await user.type(dialog.getByLabelText(/department/i), 'Engineering');
  await user.type(dialog.getByLabelText(/salary/i), '120000');
  return dialog;
}

beforeEach(() => {
  createMock.mockReset();
  updateMock.mockReset();
  onSaved.mockReset();
  onOpenChange.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('EmployeeFormDialog (create)', () => {
  it('submits a create call with the salary converted to minor units', async () => {
    createMock.mockResolvedValue({ id: 'new-1' });
    const user = userEvent.setup();

    render(<EmployeeFormDialog mode="create" open onOpenChange={onOpenChange} onSaved={onSaved} />);

    const dialog = await fillRequiredFields(user);
    await user.click(dialog.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const payload = createMock.mock.calls[0]![0];
    expect(payload).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      jobTitle: 'Software Engineer',
      department: 'Engineering',
      country: 'US',
      currency: 'USD',
      employmentType: 'FULL_TIME',
      salary: 12000000,
    });
    expect(onSaved).toHaveBeenCalledWith({ id: 'new-1' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows an inline error when the API returns 409 for a duplicate email', async () => {
    createMock.mockRejectedValue(new ApiError(409, { error: 'email_already_exists' }));
    const user = userEvent.setup();

    render(<EmployeeFormDialog mode="create" open onOpenChange={onOpenChange} onSaved={onSaved} />);

    const dialog = await fillRequiredFields(user);
    await user.click(dialog.getByRole('button', { name: /^create$/i }));

    expect(await dialog.findByText(/already uses this email/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe('EmployeeFormDialog (edit)', () => {
  it('pre-fills from the supplied employee and submits via updateEmployee', async () => {
    updateMock.mockResolvedValue({ id: 'emp-1' });
    const user = userEvent.setup();

    render(
      <EmployeeFormDialog
        mode="edit"
        open
        onOpenChange={onOpenChange}
        onSaved={onSaved}
        employee={{
          id: 'emp-1',
          firstName: 'Grace',
          lastName: 'Hopper',
          email: 'grace@example.com',
          jobTitle: 'Engineering Manager',
          department: 'Engineering',
          country: 'US',
          salary: 18000000,
          currency: 'USD',
          employmentType: 'FULL_TIME',
          hireDate: '2024-02-01',
          status: 'ACTIVE',
          createdAt: 1700000000,
          updatedAt: 1700000000,
        }}
      />,
    );

    const dialog = within(await screen.findByRole('dialog'));
    expect((dialog.getByLabelText(/first name/i) as HTMLInputElement).value).toBe('Grace');
    expect((dialog.getByLabelText(/salary/i) as HTMLInputElement).value).toBe('180000');

    await user.clear(dialog.getByLabelText(/job title/i));
    await user.type(dialog.getByLabelText(/job title/i), 'Director of Engineering');
    await user.click(dialog.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0]![0]).toBe('emp-1');
    expect(updateMock.mock.calls[0]![1]).toMatchObject({ jobTitle: 'Director of Engineering' });
  });
});
