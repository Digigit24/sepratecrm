// src/components/admin-settings/CallingProfilesCard.tsx
//
// THE admin-side answer to "my softphone says I have no TeleCMI extension and
// there is nowhere to fix it". `MyTelephonyCard` is self-service — it can only
// ever write the logged-in user's own agent record — so before this card there
// was no surface anywhere in the app for an admin to type an extension USERNAME
// and PASSWORD on someone else's behalf.
//
// A "calling profile" is one TeleCMI extension (label + username + password +
// caller ID) stored once by an admin and then handed to one or more users. Two
// profiles is the normal shape of a team here, not an exotic edge case, so the
// table is built for 1–5 rows rather than for a single hidden record.
//
// TWO INVARIANTS THIS FILE MUST NEVER BREAK
//  1. The password is write-only. It is sent on create/update and NEVER comes
//     back from the API; `has_password` is the only signal one is stored. No
//     code path here may render, log, or round-trip a password value.
//  2. The backend is being built in parallel. A 404/501/502/503 means "not
//     shipped yet" and must render as a calm panel — never a white screen and
//     never a red crash toast. Mirrors the isComposioUnavailable precedent.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Users,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  PlugZap,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTelephony } from '@/hooks/useTelephony';
import { useUserDirectory } from '@/hooks/useUserDirectory';
import { useTelephonyPhone } from '@/context/TelephonyProvider';
import { isTelephonyEndpointUnavailable } from '@/services/telephonyService';
import { isAdminUser, hasPermissionForResource } from '@/lib/permissions';
import {
  CALLING_PROFILE_PASSWORD_HELP,
  webrtcConfigSourceLabel,
  isSharedTelephonyIdentity,
} from '@/types/telephony.types';
import type {
  CallingProfile,
  CallingProfileCreateData,
  CallingProfileUpdateData,
  CallingProfileVerifyResponse,
} from '@/types/telephony.types';
import type { User } from '@/types/authTypes';

const TELEPHONY_MODULE = 'telephony';

/**
 * The same gate the softphone already uses for its "configure the workspace"
 * link (Softphone.tsx: `isAdminLike() || hasPermission('telephony.settings.edit')`),
 * expressed through the canonical permission helpers. No new role concept.
 */
const canManageCallingProfiles = (user: User | null | undefined): boolean =>
  isAdminUser(user) || hasPermissionForResource(user, 'telephony.settings.edit');

/** Sentinel for "no personal assignment" — radix Select rejects an empty value. */
const NO_PROFILE = '__none__';

const PASSWORD_STORED_PLACEHOLDER = 'Password saved — enter a new one to replace it';

interface ProfileFormState {
  /** null => creating a new profile. */
  id: number | null;
  label: string;
  telecmiUserId: string;
  /** Local only. Never populated from the API — the API never returns it. */
  password: string;
  callerId: string;
  isDefault: boolean;
  /** Mirrors `has_password` so the form can say "already stored". */
  hasPassword: boolean;
}

const emptyForm = (): ProfileFormState => ({
  id: null,
  label: '',
  telecmiUserId: '',
  password: '',
  callerId: '',
  isDefault: false,
  hasPassword: false,
});

const formFromProfile = (p: CallingProfile): ProfileFormState => ({
  id: p.id,
  label: p.label ?? '',
  telecmiUserId: p.telecmi_user_id ?? '',
  password: '', // never prefilled — the value does not exist client-side
  callerId: p.caller_id ?? '',
  isDefault: !!p.is_default,
  hasPassword: !!p.has_password,
});

// ==================== gate ====================

/**
 * Module + permission gate. Kept as a separate component from the body for the
 * same reason MyTelephonyCard does it: `useTelephonyPhone()` throws when
 * TelephonyProvider is not mounted, and the provider is only mounted when the
 * telephony module is enabled. Calling a telephony hook before this check would
 * blank the entire settings page for tenants without telephony.
 */
export const CallingProfilesSection: React.FC = () => {
  const { user, hasModuleAccess } = useAuth();
  if (!hasModuleAccess(TELEPHONY_MODULE)) return null;
  if (!canManageCallingProfiles(user)) return null;
  return <CallingProfilesSectionBody />;
};

// ==================== body ====================

const CallingProfilesSectionBody: React.FC = () => {
  const {
    useCallingProfiles,
    useCallingProfileAssignments,
    createCallingProfile,
    updateCallingProfile,
    deleteCallingProfile,
    verifyCallingProfile,
    assignCallingProfile,
    unassignCallingProfile,
  } = useTelephony();
  const { reconnect } = useTelephonyPhone();

  const {
    data: profilesData,
    error: profilesError,
    isLoading: profilesLoading,
    mutate: mutateProfiles,
  } = useCallingProfiles();
  const {
    data: assignmentsData,
    error: assignmentsError,
    mutate: mutateAssignments,
  } = useCallingProfileAssignments();

  const profiles = useMemo<CallingProfile[]>(
    () => (Array.isArray(profilesData) ? profilesData : []),
    [profilesData],
  );

  /** userId -> profileId, from the backend's assignment list. */
  const assignedProfileByUser = useMemo(() => {
    const map = new Map<string, number>();
    (Array.isArray(assignmentsData) ? assignmentsData : []).forEach((a) => {
      if (a && typeof a.user_id === 'string') map.set(a.user_id, a.profile_id);
    });
    return map;
  }, [assignmentsData]);

  /** profileId -> number of users personally assigned to it. */
  const assignedCountByProfile = useMemo(() => {
    const counts = new Map<number, number>();
    assignedProfileByUser.forEach((profileId) => {
      counts.set(profileId, (counts.get(profileId) ?? 0) + 1);
    });
    return counts;
  }, [assignedProfileByUser]);

  // Live verify results, keyed by profile id. Takes precedence over the stored
  // verified_at/verify_error until the list is refetched.
  const [verifyResults, setVerifyResults] = useState<
    Record<number, CallingProfileVerifyResponse>
  >({});
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CallingProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const unavailable = isTelephonyEndpointUnavailable(profilesError);

  /**
   * Verify + surface the result inline. NEVER blocks or reverts a save: a bad
   * extension password is stored and warned about, because the admin usually
   * needs to fix it in the TeleCMI dashboard, not here.
   */
  const runVerify = useCallback(
    async (id: number) => {
      setVerifyingId(id);
      try {
        const result = await verifyCallingProfile(id);
        setVerifyResults((prev) => ({ ...prev, [id]: result }));
        if (result.ok) toast.success('Extension verified with TeleCMI');
        else toast.warning(result.error || 'TeleCMI rejected this extension');
        return result;
      } finally {
        setVerifyingId(null);
      }
    },
    [verifyCallingProfile],
  );

  const handleSave = async () => {
    if (!form) return;
    const label = form.label.trim();
    const telecmiUserId = form.telecmiUserId.trim();
    const password = form.password.trim();

    if (!label) {
      toast.error('Give the profile a label so people can tell them apart');
      return;
    }
    if (!telecmiUserId) {
      toast.error('Extension (TeleCMI username) is required');
      return;
    }
    if (form.id === null && !password) {
      toast.error('The TeleCMI extension password is required to create a profile');
      return;
    }

    setIsSaving(true);
    try {
      let savedId: number;
      if (form.id === null) {
        const payload: CallingProfileCreateData = {
          label,
          telecmi_user_id: telecmiUserId,
          password,
          caller_id: form.callerId.trim() || null,
          is_default: form.isDefault,
        };
        const created = await createCallingProfile(payload);
        savedId = created.id;
      } else {
        const payload: CallingProfileUpdateData = {
          label,
          telecmi_user_id: telecmiUserId,
          caller_id: form.callerId.trim() || null,
          is_default: form.isDefault,
        };
        // A blank password means "keep the stored one" — never send an empty string.
        if (password) payload.password = password;
        const updated = await updateCallingProfile(form.id, payload);
        savedId = updated?.id ?? form.id;
      }

      setForm(null);
      await mutateProfiles();
      // Saving changes who calls as whom, so the live softphone has to
      // re-resolve webrtc-config — no logout/login, no page reload.
      await reconnect();
      await runVerify(savedId);
    } catch {
      // The hook already toasted (and downgraded "endpoint not shipped" to info).
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteCallingProfile(pendingDelete.id);
      setPendingDelete(null);
      await mutateProfiles();
      await mutateAssignments();
      await reconnect();
    } catch {
      // already toasted
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAssign = async (userId: string, nextProfileId: number | null) => {
    const current = assignedProfileByUser.get(userId) ?? null;
    if (current === nextProfileId) return;
    try {
      if (nextProfileId === null) {
        if (current !== null) await unassignCallingProfile(current, userId);
      } else {
        // Assigning replaces any previous profile server-side; unassign first
        // only when we are switching away from a different one.
        if (current !== null && current !== nextProfileId) {
          await unassignCallingProfile(current, userId);
        }
        await assignCallingProfile(nextProfileId, userId);
      }
      await mutateAssignments();
      // If the admin re-pointed their OWN account, the running softphone must
      // pick it up immediately.
      await reconnect();
    } catch {
      // already toasted
    }
  };

  return (
    <div className="space-y-6">
      <SoftphoneConnectionCard profiles={profiles} />

      {unavailable ? (
        <CallingProfilesUnavailableCard />
      ) : (
        <>
          <Card data-testid="calling-profiles-card">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <CardTitle>Calling Profiles</CardTitle>
                  </div>
                  <CardDescription className="mt-1.5">
                    Extensions you configure centrally, so people do not have to register
                    their own. Most teams run two — one per outbound number. Anyone without
                    a personal assignment calls on the profile marked <em>Default</em>.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => setForm(emptyForm())}
                  data-testid="calling-profile-add"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add profile
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {profilesLoading && profiles.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : profiles.length === 0 ? (
                <EmptyProfilesState onAdd={() => setForm(emptyForm())} />
              ) : (
                <>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Label</TableHead>
                          <TableHead>Extension</TableHead>
                          <TableHead>Caller ID</TableHead>
                          <TableHead>Users</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profiles.map((profile) => (
                          <TableRow key={profile.id} data-testid={`calling-profile-row-${profile.id}`}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {profile.label || 'Untitled profile'}
                                {profile.is_default && (
                                  <Badge variant="default" className="text-[10px]">
                                    Default
                                  </Badge>
                                )}
                                {profile.is_active === false && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Inactive
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {profile.telecmi_user_id || '—'}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {profile.caller_id || '—'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {assignedCountByProfile.get(profile.id) ?? 0}
                            </TableCell>
                            <TableCell>
                              <VerifyStatus
                                profile={profile}
                                live={verifyResults[profile.id]}
                              />
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => void runVerify(profile.id)}
                                disabled={verifyingId === profile.id}
                                aria-label={`Verify ${profile.label}`}
                              >
                                {verifyingId === profile.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => setForm(formFromProfile(profile))}
                                aria-label={`Edit ${profile.label}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-destructive"
                                onClick={() => setPendingDelete(profile)}
                                aria-label={`Delete ${profile.label}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <SharedIdentityWarning
                    profiles={profiles}
                    assignedCountByProfile={assignedCountByProfile}
                  />
                  <NoDefaultWarning profiles={profiles} />
                </>
              )}
            </CardContent>
          </Card>

          <CallingProfileAssignmentsCard
            profiles={profiles}
            assignedProfileByUser={assignedProfileByUser}
            assignmentsUnavailable={isTelephonyEndpointUnavailable(assignmentsError)}
            onAssign={handleAssign}
          />
        </>
      )}

      <ProfileFormDialog
        form={form}
        isSaving={isSaving}
        onChange={setForm}
        onClose={() => setForm(null)}
        onSave={handleSave}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {(assignedCountByProfile.get(pendingDelete?.id ?? -1) ?? 0) > 0
                ? 'Users assigned to this profile will fall back to the workspace default extension, or lose calling entirely if there is no default.'
                : 'The stored extension and password are removed. Call logs are kept.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ==================== not-available-yet panel ====================

/**
 * The calm degradation surface. A backend without the calling-profiles routes
 * must look unfinished, not broken.
 */
const CallingProfilesUnavailableCard: React.FC = () => (
  <Card data-testid="calling-profiles-unavailable">
    <CardHeader>
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5" />
        <CardTitle>Calling Profiles</CardTitle>
      </div>
      <CardDescription>
        Shared extensions an admin configures once and hands to the team.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Not available on this server yet</p>
          <p className="text-xs mt-0.5">
            This workspace&apos;s backend does not serve calling profiles yet. Until it
            does, each person registers their own extension under Settings → User
            Preferences → My Telephony, and the workspace connection above still powers
            click-to-call.
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);

// ==================== empty state ====================

const EmptyProfilesState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <div
    data-testid="calling-profiles-empty"
    className="rounded-lg border border-dashed p-6 text-center space-y-3"
  >
    <p className="text-sm font-medium">No calling profiles yet</p>
    <p className="text-xs text-muted-foreground max-w-md mx-auto">
      Add one profile per TeleCMI extension your team calls from. This is where the
      extension username and password go — nobody has to register their own.
    </p>
    <Button size="sm" variant="outline" onClick={onAdd}>
      <Plus className="h-4 w-4 mr-2" />
      Add your first profile
    </Button>
  </div>
);

// ==================== verify status ====================

const VerifyStatus: React.FC<{
  profile: CallingProfile;
  live?: CallingProfileVerifyResponse;
}> = ({ profile, live }) => {
  const ok = live ? live.ok : !!profile.verified_at && !profile.verify_error;
  const error = live ? live.error : profile.verify_error || null;

  if (ok) {
    return (
      <span
        data-testid={`calling-profile-status-${profile.id}`}
        data-state="verified"
        className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Verified
      </span>
    );
  }

  if (error) {
    return (
      <span
        data-testid={`calling-profile-status-${profile.id}`}
        data-state="failed"
        className="inline-flex items-start gap-1.5 text-xs text-destructive max-w-[16rem]"
        title={error}
      >
        <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span className="line-clamp-2">{error}</span>
      </span>
    );
  }

  return (
    <span
      data-testid={`calling-profile-status-${profile.id}`}
      data-state={profile.has_password ? 'unverified' : 'no-password'}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      <ShieldAlert className="h-3.5 w-3.5" />
      {profile.has_password ? 'Not verified yet' : 'No password stored'}
    </span>
  );
};

// ==================== warnings ====================

/**
 * Two people on one profile is legitimate (that is the point of a shared line),
 * but it has consequences they should hear about once, plainly.
 */
const SharedIdentityWarning: React.FC<{
  profiles: CallingProfile[];
  assignedCountByProfile: Map<number, number>;
}> = ({ profiles, assignedCountByProfile }) => {
  const shared = profiles.filter((p) => (assignedCountByProfile.get(p.id) ?? 0) > 1);
  if (shared.length === 0) return null;

  return (
    <div
      data-testid="calling-profiles-shared-warning"
      className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
    >
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="text-sm">
        <p className="font-medium">
          {shared.map((p) => p.label || `#${p.id}`).join(', ')}{' '}
          {shared.length === 1 ? 'is' : 'are'} shared by more than one person
        </p>
        <p className="text-xs mt-0.5">
          Everyone on a shared profile calls out with the same caller ID and registers
          the same TeleCMI session identity. Inbound calls to that extension can land on
          whoever answers first, and per-agent call stats blur together. Give people
          their own profile when you need to tell them apart.
        </p>
      </div>
    </div>
  );
};

const NoDefaultWarning: React.FC<{ profiles: CallingProfile[] }> = ({ profiles }) => {
  if (profiles.length === 0 || profiles.some((p) => p.is_default)) return null;
  return (
    <div
      data-testid="calling-profiles-no-default"
      className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
    >
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <p className="text-xs">
        No profile is marked as the workspace default. Anyone without a personal
        assignment below will still see &ldquo;your account has no TeleCMI
        extension&rdquo;.
      </p>
    </div>
  );
};

// ==================== add / edit form ====================

interface ProfileFormDialogProps {
  form: ProfileFormState | null;
  isSaving: boolean;
  onChange: (next: ProfileFormState) => void;
  onClose: () => void;
  onSave: () => void;
}

const ProfileFormDialog: React.FC<ProfileFormDialogProps> = ({
  form,
  isSaving,
  onChange,
  onClose,
  onSave,
}) => {
  const isEdit = form?.id != null;

  return (
    <Dialog open={!!form} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit calling profile' : 'Add calling profile'}</DialogTitle>
          <DialogDescription>
            One TeleCMI extension. The username and password come from the TeleCMI
            dashboard, not from Celiyo.
          </DialogDescription>
        </DialogHeader>

        {form && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="calling-profile-label">Label</Label>
              <Input
                id="calling-profile-label"
                placeholder="e.g. Sales line"
                value={form.label}
                onChange={(e) => onChange({ ...form, label: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                What your team calls this line. Shown in the table and when assigning.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calling-profile-extension">Extension (TeleCMI username)</Label>
              <Input
                id="calling-profile-extension"
                placeholder="e.g. 103_1111112"
                value={form.telecmiUserId}
                onChange={(e) => onChange({ ...form, telecmiUserId: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Format: <span className="font-mono">{'<extension>_<appid>'}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calling-profile-password">Extension password</Label>
              <Input
                id="calling-profile-password"
                type="password"
                autoComplete="new-password"
                placeholder={
                  form.hasPassword ? PASSWORD_STORED_PLACEHOLDER : 'TeleCMI extension password'
                }
                value={form.password}
                onChange={(e) => onChange({ ...form, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {CALLING_PROFILE_PASSWORD_HELP}
              </p>
              <p className="text-xs text-muted-foreground">
                {form.hasPassword
                  ? 'A password is already stored for this profile. Leave this blank to keep it — it is write-only and can never be shown again.'
                  : 'Stored encrypted and write-only: it is never sent back to the browser once saved.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calling-profile-caller-id">Caller ID</Label>
              <Input
                id="calling-profile-caller-id"
                placeholder="+918000000000"
                value={form.callerId}
                onChange={(e) => onChange({ ...form, callerId: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                The number recipients see. Optional — falls back to the workspace default
                caller ID.
              </p>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="calling-profile-default">Workspace default</Label>
                <p className="text-xs text-muted-foreground">
                  Used by everyone who has no profile assigned to them personally.
                </p>
              </div>
              <Switch
                id="calling-profile-default"
                checked={form.isDefault}
                onCheckedChange={(checked) => onChange({ ...form, isDefault: checked })}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? 'Save profile' : 'Create profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ==================== user assignment ====================

interface AssignmentsCardProps {
  profiles: CallingProfile[];
  assignedProfileByUser: Map<string, number>;
  assignmentsUnavailable: boolean;
  onAssign: (userId: string, profileId: number | null) => void | Promise<void>;
}

/**
 * Who calls on what. Users come from the ONE canonical user directory hook —
 * building a second user-fetching path here is exactly the drift useUserDirectory
 * was created to end.
 */
const CallingProfileAssignmentsCard: React.FC<AssignmentsCardProps> = ({
  profiles,
  assignedProfileByUser,
  assignmentsUnavailable,
  onAssign,
}) => {
  const { users, isLoading, isForbidden } = useUserDirectory();
  const defaultProfile = profiles.find((p) => p.is_default) ?? null;
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const handleChange = async (userId: string, value: string) => {
    setBusyUserId(userId);
    try {
      await onAssign(userId, value === NO_PROFILE ? null : Number(value));
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <Card data-testid="calling-profile-assignments-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <CardTitle>Who calls on what</CardTitle>
        </div>
        <CardDescription>
          Assign a calling profile to each person. Anyone left on{' '}
          <em>Workspace default</em> calls on{' '}
          {defaultProfile ? (
            <span className="font-medium">{defaultProfile.label}</span>
          ) : (
            <span className="font-medium">nothing — no default profile is set</span>
          )}
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        {assignmentsUnavailable ? (
          <div
            data-testid="calling-profile-assignments-unavailable"
            className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
          >
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-xs">
              Assignments are not available on this server yet.
            </p>
          </div>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a calling profile above before assigning anyone.
          </p>
        ) : isForbidden ? (
          <p className="text-sm text-muted-foreground">
            Your account cannot read the user directory, so people cannot be listed here.
          </p>
        ) : isLoading && users.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users in this workspace yet.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Calls as</TableHead>
                  <TableHead className="w-[16rem]">Assignment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const assignedId = assignedProfileByUser.get(u.id) ?? null;
                  const assigned = assignedId
                    ? profiles.find((p) => p.id === assignedId) ?? null
                    : null;
                  const effective = assigned ?? defaultProfile;
                  return (
                    <TableRow key={u.id} data-testid={`calling-profile-user-${u.id}`}>
                      <TableCell>
                        <div className="text-sm font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {effective ? (
                          <span className="font-mono">{effective.telecmi_user_id}</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">
                            No extension
                          </span>
                        )}
                        {!assigned && effective && (
                          <span className="ml-1 text-muted-foreground">(default)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={assignedId === null ? NO_PROFILE : String(assignedId)}
                          onValueChange={(v) => void handleChange(u.id, v)}
                          disabled={busyUserId === u.id}
                        >
                          <SelectTrigger aria-label={`Calling profile for ${u.name}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_PROFILE}>Workspace default</SelectItem>
                            {profiles.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.label || `Profile #${p.id}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ==================== connection re-test ====================

/**
 * The "did that actually work?" control. Changing a profile is pointless if the
 * running softphone keeps its old registration, so this both shows what identity
 * the SDK resolved and re-runs the whole resolve + login cycle on demand.
 */
/**
 * Which stored profile the live SDK session actually resolved to, when we can
 * tell. `webrtc-config` names the source but not the profile id, so match on the
 * extension it handed us — that is the field both sides agree on.
 *
 * Returns null (=> the row falls back to the plain source label) rather than
 * guessing, and never narrows exhaustively on `source`: an unknown value from a
 * newer backend must degrade, not blank the card.
 */
const resolveLiveProfile = (
  profiles: CallingProfile[],
  telecmiUserId: string | null,
): CallingProfile | null => {
  if (telecmiUserId) {
    const match = profiles.find((p) => p.telecmi_user_id === telecmiUserId);
    if (match) return match;
  }
  return null;
};

export const SoftphoneConnectionCard: React.FC<{ profiles?: CallingProfile[] }> = ({
  profiles = [],
}) => {
  const {
    status,
    isTelephonyConfigured,
    isTelephonyLoading,
    telephonyConfigurationError,
    configSource,
    telecmiUserId,
    sbcHost,
    defaultCallerId,
    reconnect,
  } = useTelephonyPhone();

  const [isReconnecting, setIsReconnecting] = useState(false);
  // A ref, not state: reconnect() can outlive the tab if the admin navigates
  // away mid-flight, and a setState on an unmounted component would be a bug
  // report with no cause. Refs also survive the unmount cleanup cleanly.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      // reconnect() never throws — it resolves into a retryable state.
      await reconnect();
      toast.info('Re-checking the softphone connection…');
    } finally {
      if (mountedRef.current) setIsReconnecting(false);
    }
  };

  const liveProfile = resolveLiveProfile(profiles, telecmiUserId);

  const connected =
    isTelephonyConfigured &&
    status !== 'needs-password' &&
    status !== 'connecting' &&
    status !== 'not-configured' &&
    status !== 'loading';

  return (
    <Card data-testid="softphone-connection-card">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PlugZap className="h-5 w-5" />
            <CardTitle>Softphone Connection</CardTitle>
          </div>
          <Badge
            variant={connected ? 'default' : 'secondary'}
            data-testid="softphone-connection-badge"
            className={connected ? 'bg-green-600 hover:bg-green-600' : undefined}
          >
            {isTelephonyLoading ? 'Checking…' : connected ? 'Connected' : 'Not connected'}
          </Badge>
        </div>
        <CardDescription>
          What the in-browser softphone resolved for your own account. Re-test after
          changing a profile — it re-reads the config and logs the SDK back in without a
          page reload or a re-login.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Identity</dt>
            <dd className="font-medium text-right" data-testid="softphone-connection-source">
              {liveProfile ? (
                <>
                  {liveProfile.label}{' '}
                  <span className="font-normal text-muted-foreground">
                    ({webrtcConfigSourceLabel(configSource)})
                  </span>
                </>
              ) : (
                webrtcConfigSourceLabel(configSource)
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Extension</dt>
            <dd className="font-mono text-right">{telecmiUserId || '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">SBC host</dt>
            <dd className="font-mono text-right">{sbcHost || '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Caller ID</dt>
            <dd className="font-mono text-right">{defaultCallerId || '—'}</dd>
          </div>
        </dl>

        {isSharedTelephonyIdentity(configSource) && (
          <p
            data-testid="softphone-connection-shared-note"
            className="text-xs text-muted-foreground"
          >
            You are calling on a shared workspace extension — the same caller ID and the
            same TeleCMI session identity as everyone else without a personal assignment.
          </p>
        )}

        {!isTelephonyConfigured && telephonyConfigurationError && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {telephonyConfigurationError}
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleReconnect}
          disabled={isReconnecting}
          data-testid="softphone-reconnect"
        >
          {isReconnecting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Re-test connection
        </Button>
      </CardContent>
    </Card>
  );
};

export default CallingProfilesSection;
