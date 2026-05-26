'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { createEmployeeSchema, type Employee } from '@salary-management/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import {
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  createEmployee,
  updateEmployee,
} from '@/lib/employees';

type Mode = 'create' | 'edit';

export interface EmployeeFormDialogProps {
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee;
  onSaved: (employee: Employee) => void;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  country: string;
  salary: string;
  currency: string;
  employmentType: string;
  hireDate: string;
}

function emptyForm(): FormState {
  return {
    firstName: '',
    lastName: '',
    email: '',
    jobTitle: '',
    department: '',
    country: 'US',
    salary: '',
    currency: 'USD',
    employmentType: 'FULL_TIME',
    hireDate: new Date().toISOString().slice(0, 10),
  };
}

function fromEmployee(e: Employee): FormState {
  return {
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    jobTitle: e.jobTitle,
    department: e.department,
    country: e.country,
    salary: String(Math.round(e.salary / 100)),
    currency: e.currency,
    employmentType: e.employmentType,
    hireDate: e.hireDate,
  };
}

export function EmployeeFormDialog({
  mode,
  open,
  onOpenChange,
  employee,
  onSaved,
}: EmployeeFormDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(mode === 'edit' && employee ? fromEmployee(employee) : emptyForm());
      setError(null);
    }
  }, [open, mode, employee]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const salaryMinor = Math.round(Number(form.salary) * 100);
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      jobTitle: form.jobTitle.trim(),
      department: form.department.trim(),
      country: form.country,
      salary: salaryMinor,
      currency: form.currency,
      employmentType: form.employmentType,
      hireDate: form.hireDate,
    };

    const parsed = createEmployeeSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form for errors.');
      setSubmitting(false);
      return;
    }

    try {
      const saved =
        mode === 'create'
          ? await createEmployee(parsed.data)
          : await updateEmployee(employee!.id, parsed.data);
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Another employee already uses this email.');
      } else if (err instanceof ApiError && err.status === 400) {
        setError('The server rejected the submission. Please review the fields.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add employee' : 'Edit employee'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Capture the core details for the new hire.'
              : 'Update the employee record. Only changed fields will be saved.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => update('firstName', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => update('lastName', e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input
                id="jobTitle"
                value={form.jobTitle}
                onChange={(e) => update('jobTitle', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={form.department}
                onChange={(e) => update('department', e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <select
                id="country"
                value={form.country}
                onChange={(e) => {
                  const next = e.target.value;
                  update('country', next);
                  const opt = COUNTRY_OPTIONS.find((c) => c.code === next);
                  if (opt) update('currency', opt.currency);
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                value={form.currency}
                onChange={(e) => update('currency', e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salary">Salary (annual)</Label>
              <Input
                id="salary"
                type="number"
                min={0}
                step={1}
                value={form.salary}
                onChange={(e) => update('salary', e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="employmentType">Employment type</Label>
              <select
                id="employmentType"
                value={form.employmentType}
                onChange={(e) => update('employmentType', e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {EMPLOYMENT_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hireDate">Hire date</Label>
              <Input
                id="hireDate"
                type="date"
                value={form.hireDate}
                onChange={(e) => update('hireDate', e.target.value)}
                required
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : mode === 'create' ? 'Create' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
