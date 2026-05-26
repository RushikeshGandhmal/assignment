'use client';

import { useState } from 'react';
import type { Employee } from '@salary-management/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { deleteEmployee } from '@/lib/employees';

export interface DeleteEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onDeleted: () => void;
}

export function DeleteEmployeeDialog({
  open,
  onOpenChange,
  employee,
  onDeleted,
}: DeleteEmployeeDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    if (!employee) return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteEmployee(employee.id);
      onDeleted();
      onOpenChange(false);
    } catch {
      setError('Could not delete the employee. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deactivate employee?</DialogTitle>
          <DialogDescription>
            {employee
              ? `${employee.firstName} ${employee.lastName} will be marked inactive. The record is kept for history and can be restored later by changing the status filter.`
              : 'This employee will be marked inactive.'}
          </DialogDescription>
        </DialogHeader>
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
          <Button type="button" onClick={onConfirm} disabled={submitting}>
            {submitting ? 'Deactivating...' : 'Deactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
