// src/components/calendar/RecurrenceScopeDialog.tsx
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { RecurrenceEditScope } from '@/types/calendar.types';

interface RecurrenceScopeDialogProps {
  open: boolean;
  /** `edit` | `delete` | `cancel` — only changes the wording. */
  intent?: 'edit' | 'delete' | 'cancel';
  eventTitle?: string;
  onConfirm: (scope: RecurrenceEditScope) => void;
  onCancel: () => void;
}

const OPTIONS: Array<{ value: RecurrenceEditScope; label: string; hint: string }> = [
  { value: 'this', label: 'This event', hint: 'Only the occurrence you clicked' },
  {
    value: 'this_and_following',
    label: 'This and following events',
    hint: 'Splits the series at this occurrence',
  },
  { value: 'all', label: 'All events', hint: 'Every occurrence in the series' },
];

/**
 * The gate in front of every mutation on a recurring meeting (§B.3).
 *
 * `this` is the DEFAULT, matching the backend's default `edit_scope`, so an
 * accidental confirm never rewrites a whole series. The chosen scope is sent as
 * `edit_scope`, and for anything other than `all` the caller also sends the
 * clicked `occurrence_start` — the backend 400s without it.
 */
export function RecurrenceScopeDialog({
  open,
  intent = 'edit',
  eventTitle,
  onConfirm,
  onCancel,
}: RecurrenceScopeDialogProps) {
  const [scope, setScope] = useState<RecurrenceEditScope>('this');

  // Reset to the safe default every time the dialog is re-opened.
  useEffect(() => {
    if (open) setScope('this');
  }, [open]);

  const verb = intent === 'delete' ? 'Delete' : intent === 'cancel' ? 'Cancel' : 'Edit';

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">
            {verb} recurring event
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            {eventTitle ? `“${eventTitle}” repeats. ` : 'This event repeats. '}
            Which occurrences should this {intent === 'edit' ? 'change' : intent} apply to?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup
          value={scope}
          onValueChange={(value) => setScope(value as RecurrenceEditScope)}
          className="space-y-1 py-1"
        >
          {OPTIONS.map((option) => (
            <label
              key={option.value}
              htmlFor={`scope-${option.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/60"
            >
              <RadioGroupItem value={option.value} id={`scope-${option.value}`} className="mt-0.5" />
              <span className="min-w-0">
                <Label
                  htmlFor={`scope-${option.value}`}
                  className="cursor-pointer text-[13px] font-medium"
                >
                  {option.label}
                </Label>
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          ))}
        </RadioGroup>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} className="h-8 text-xs">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(scope)} className="h-8 text-xs">
            {verb === 'Edit' ? 'Apply' : verb}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default RecurrenceScopeDialog;
