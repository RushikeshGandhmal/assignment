'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Employee } from '@salary-management/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  COUNTRY_OPTIONS,
  formatSalary,
  listEmployees,
  type PaginatedEmployees,
} from '@/lib/employees';
import { EmployeeFormDialog } from '@/components/employees/employee-form-dialog';
import { DeleteEmployeeDialog } from '@/components/employees/delete-employee-dialog';
import { formatCountry } from '@/lib/countries';

const PAGE_SIZE = 25;

interface Filters {
  search: string;
  country: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const INITIAL_FILTERS: Filters = { search: '', country: '', status: 'ACTIVE' };

export default function EmployeesPage() {
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<PaginatedEmployees | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(filters.search.trim()), 250);
    return () => clearTimeout(handle);
  }, [filters.search]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    listEmployees({
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch || undefined,
      country: filters.country || undefined,
      status: filters.status,
    })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load employees.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, filters.country, filters.status, refreshKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, filters.country, filters.status]);

  function refetch() {
    setRefreshKey((k) => k + 1);
  }

  function onEmployeeSaved(saved: Employee, mode: 'create' | 'edit') {
    toast.success(
      mode === 'create'
        ? `Added ${saved.firstName} ${saved.lastName}.`
        : `Updated ${saved.firstName} ${saved.lastName}.`,
    );
    refetch();
  }

  function onEmployeeDeleted(deleted: Employee) {
    toast.success(`Deactivated ${deleted.firstName} ${deleted.lastName}.`);
    refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            {data
              ? `${data.total.toLocaleString()} ${filters.status.toLowerCase()} employees`
              : ' '}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Add employee</Button>
      </div>

      <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Name or email"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-country">Country</Label>
          <select
            id="filter-country"
            value={filters.country}
            onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All countries</option>
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-status">Status</Label>
          <select
            id="filter-status"
            value={filters.status}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: e.target.value as Filters['status'] }))
            }
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Job title</th>
              <th className="px-4 py-3 text-left font-medium">Country</th>
              <th className="px-4 py-3 text-right font-medium">Salary</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading employees...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-destructive">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && data && data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No employees match these filters.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              data?.items.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-4 py-3 font-medium">
                    {e.firstName} {e.lastName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.email}</td>
                  <td className="px-4 py-3">{e.jobTitle}</td>
                  <td className="px-4 py-3">{formatCountry(e.country)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatSalary(e.salary, e.currency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(e)}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleting(e)}>
                        Deactivate
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <EmployeeFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(saved) => onEmployeeSaved(saved, 'create')}
      />
      <EmployeeFormDialog
        mode="edit"
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        employee={editing ?? undefined}
        onSaved={(saved) => onEmployeeSaved(saved, 'edit')}
      />
      <DeleteEmployeeDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        employee={deleting}
        onDeleted={onEmployeeDeleted}
      />
    </div>
  );
}
