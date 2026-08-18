// src/components/calendar/AttendeePicker.tsx
import { useMemo, useState } from 'react';
import { Check, Mail, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { memberColor } from '@/lib/calendarColors';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import type { MeetingAttendee } from '@/types/meeting.types';
import { AttendeeResponseBadge } from './AttendeeResponseBadge';

interface AttendeePickerProps {
  value: MeetingAttendee[];
  onChange: (attendees: MeetingAttendee[]) => void;
  disabled?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const attendeeKey = (a: MeetingAttendee): string =>
  a.user_id ? `user:${a.user_id}` : a.email ? `email:${a.email}` : `lead:${a.lead}`;

/**
 * Combobox over the tenant directory plus free-text external emails.
 *
 * The directory comes from `useTeamMembers()`, which is itself gated: a user
 * without `all` scope only ever sees themselves, so this picker cannot be used
 * to enumerate the tenant's users.
 */
export function AttendeePicker({ value, onChange, disabled }: AttendeePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { members } = useTeamMembers({ search: search || undefined });

  const selectedKeys = useMemo(() => new Set(value.map(attendeeKey)), [value]);

  const toggleMember = (userId: string, name: string) => {
    const key = `user:${userId}`;
    if (selectedKeys.has(key)) {
      onChange(value.filter((a) => attendeeKey(a) !== key));
    } else {
      onChange([...value, { user_id: userId, display_name: name, role: 'REQUIRED' }]);
    }
  };

  const addEmail = () => {
    const email = search.trim();
    if (!EMAIL_RE.test(email)) return;
    if (selectedKeys.has(`email:${email}`)) return;
    onChange([...value, { email, display_name: email, role: 'OPTIONAL' }]);
    setSearch('');
  };

  return (
    <div className="space-y-2">
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((attendee) => {
            const member = members.find((m) => m.user_id === attendee.user_id);
            return (
              <li
                key={attendeeKey(attendee)}
                className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[11px] ring-1 ring-inset ring-border"
              >
                {member ? (
                  <span
                    className={cn('h-2 w-2 rounded-full', memberColor(member.color_index).bar)}
                  />
                ) : (
                  <Mail className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="max-w-[140px] truncate">
                  {attendee.display_name || attendee.email || attendee.user_id}
                </span>
                {attendee.response_status ? (
                  <AttendeeResponseBadge
                    response={attendee.response_status}
                    showIcon={false}
                    className="px-1 py-0"
                  />
                ) : null}
                {!disabled ? (
                  <button
                    type="button"
                    aria-label={`Remove ${attendee.display_name || attendee.email}`}
                    onClick={() =>
                      onChange(value.filter((a) => attendeeKey(a) !== attendeeKey(attendee)))
                    }
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No attendees.</p>
      )}

      {!disabled ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-7 px-2 text-xs">
              <Plus className="mr-1 h-3 w-3" />
              Add attendee
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search people or type an email…"
                value={search}
                onValueChange={setSearch}
                className="text-[13px]"
              />
              <CommandList>
                <CommandEmpty className="p-3 text-xs text-muted-foreground">
                  {EMAIL_RE.test(search.trim()) ? (
                    <button
                      type="button"
                      onClick={addEmail}
                      className="flex w-full items-center gap-2 text-left text-foreground"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Invite {search.trim()}
                    </button>
                  ) : (
                    'No people found.'
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {members
                    .filter((m) =>
                      search
                        ? m.name.toLowerCase().includes(search.toLowerCase()) ||
                          (m.email ?? '').toLowerCase().includes(search.toLowerCase())
                        : true
                    )
                    .map((member) => {
                      const selected = selectedKeys.has(`user:${member.user_id}`);
                      return (
                        <CommandItem
                          key={member.user_id}
                          value={member.user_id}
                          onSelect={() => toggleMember(member.user_id, member.name)}
                          className="text-[13px]"
                        >
                          <span
                            className={cn(
                              'mr-2 h-2 w-2 rounded-full',
                              memberColor(member.color_index).bar
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate">{member.name}</span>
                          {selected ? <Check className="ml-2 h-3.5 w-3.5" /> : null}
                        </CommandItem>
                      );
                    })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

export default AttendeePicker;
