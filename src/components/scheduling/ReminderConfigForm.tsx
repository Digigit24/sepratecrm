// ==================== REMINDER CONFIG FORM ====================
// Component for managing reminder configurations per event type

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useScheduling } from '@/hooks/useScheduling';
import {
  EVENT_TYPE_OPTIONS,
  REMINDER_OFFSET_OPTIONS,
  DEFAULT_TEMPLATE_LANGUAGE,
} from '@/constants/scheduling';
import { formatReminderOffset } from '@/utils/scheduleHelpers';
import type { ReminderConfig, SaveReminderConfigRequest } from '@/types/scheduling.types';
import { Plus, Trash2, RefreshCw, Bell, Settings } from 'lucide-react';

// ==================== LOADING SKELETON ====================

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

// ==================== EMPTY STATE ====================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Settings className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No reminder configs</h3>
      <p className="text-muted-foreground">
        Create reminder configurations to automatically send messages before events.
      </p>
    </div>
  );
}

// ==================== ADD/EDIT FORM ====================

interface ReminderConfigFormDialogProps {
  onSubmit: (config: SaveReminderConfigRequest) => Promise<void>;
  loading: boolean;
  trigger: React.ReactNode;
  initialValues?: Partial<ReminderConfig>;
  title?: string;
}

function ReminderConfigFormDialog({
  onSubmit,
  loading,
  trigger,
  initialValues,
  title = 'Add Reminder Config',
}: ReminderConfigFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<SaveReminderConfigRequest>({
    event_type: initialValues?.event_type || '',
    reminder_offset_minutes: initialValues?.reminder_offset_minutes || -60,
    template_name: initialValues?.template_name || '',
    template_language: initialValues?.template_language || DEFAULT_TEMPLATE_LANGUAGE,
    is_active: initialValues?.is_active ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
    setOpen(false);
    // Reset form
    setFormData({
      event_type: '',
      reminder_offset_minutes: -60,
      template_name: '',
      template_language: DEFAULT_TEMPLATE_LANGUAGE,
      is_active: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Configure when reminder messages should be sent relative to the event time.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="event_type">Event Type</Label>
              <Select
                value={formData.event_type}
                onValueChange={(value) => setFormData({ ...formData, event_type: value })}
              >
                <SelectTrigger id="event_type">
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reminder_offset">Reminder Timing</Label>
              <Select
                value={String(formData.reminder_offset_minutes)}
                onValueChange={(value) =>
                  setFormData({ ...formData, reminder_offset_minutes: parseInt(value, 10) })
                }
              >
                <SelectTrigger id="reminder_offset">
                  <SelectValue placeholder="Select timing" />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_OFFSET_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template_name">Template Name</Label>
              <Input
                id="template_name"
                value={formData.template_name}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                placeholder="e.g., appointment_reminder"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template_language">Template Language</Label>
              <Input
                id="template_language"
                value={formData.template_language}
                onChange={(e) => setFormData({ ...formData, template_language: e.target.value })}
                placeholder="e.g., en"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Active</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.event_type || !formData.template_name}>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Config
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== CONFIG ROW ====================

interface ConfigRowProps {
  config: ReminderConfig;
  onDelete: (uid: string) => void;
  deleting: string | null;
}

function ConfigRow({ config, onDelete, deleting }: ConfigRowProps) {
  const isDeleting = deleting === config._uid;

  const eventTypeLabel =
    EVENT_TYPE_OPTIONS.find((opt) => opt.value === config.event_type)?.label ||
    config.event_type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <TableRow>
      <TableCell>
        <span className="font-medium">{eventTypeLabel}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {formatReminderOffset(config.reminder_offset_minutes)}
        </div>
      </TableCell>
      <TableCell>
        <code className="text-sm bg-muted px-2 py-1 rounded">{config.template_name}</code>
      </TableCell>
      <TableCell>
        <Badge variant={config.is_active ? 'default' : 'outline'}>
          {config.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isDeleting}
              className="text-destructive hover:text-destructive"
            >
              {isDeleting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Reminder Config</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this reminder configuration? This will not affect
                already scheduled messages, but new events will not create this reminder.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => config._uid && onDelete(config._uid)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}

// ==================== MAIN COMPONENT ====================

interface ReminderConfigManagerProps {
  showHeader?: boolean;
  className?: string;
}

export function ReminderConfigManager({
  showHeader = true,
  className,
}: ReminderConfigManagerProps) {
  const {
    getReminderConfigs,
    saveReminderConfig,
    deleteReminderConfig,
    reminderConfigs,
    loading,
    error,
  } = useScheduling();

  const [deleting, setDeleting] = useState<string | null>(null);

  // Fetch configs on mount
  useEffect(() => {
    getReminderConfigs();
  }, [getReminderConfigs]);

  // Handle save
  const handleSave = useCallback(async (config: SaveReminderConfigRequest) => {
    await saveReminderConfig(config);
  }, [saveReminderConfig]);

  // Handle delete
  const handleDelete = useCallback(async (configUid: string) => {
    setDeleting(configUid);
    await deleteReminderConfig(configUid);
    setDeleting(null);
  }, [deleteReminderConfig]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    getReminderConfigs();
  }, [getReminderConfigs]);

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Reminder Configurations</CardTitle>
              <CardDescription>
                Configure automatic reminders for different event types
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <ReminderConfigFormDialog
                onSubmit={handleSave}
                loading={loading}
                trigger={
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Config
                  </Button>
                }
              />
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent>
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {loading && reminderConfigs.length === 0 ? (
          <LoadingSkeleton />
        ) : reminderConfigs.length === 0 ? (
          <EmptyState />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Type</TableHead>
                <TableHead>Timing</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reminderConfigs.map((config) => (
                <ConfigRow
                  key={config._uid || `${config.event_type}-${config.reminder_offset_minutes}`}
                  config={config}
                  onDelete={handleDelete}
                  deleting={deleting}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default ReminderConfigManager;
