// src/components/ContactDetailPanel.tsx
import { useState } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  Tag,
  Bot,
  Ban,
  UserPlus,
  Clock,
  MessageSquare,
  AlertCircle,
  StickyNote,
  ChevronDown,
  Check,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  useChatContext,
  useTeamMembers,
  useAssignUser,
  useAssignLabels,
  useUpdateNotes,
  useBlockContact,
  useUnblockContact,
  useBotSettings,
  chatKeys,
} from '@/hooks/whatsapp/useChat';
import type { ChatContact, TeamMember, ChatLabel, ReplyWindowStatus } from '@/services/whatsapp/chatService';

interface ContactDetailPanelProps {
  contactUid: string;
  onClose?: () => void;
  className?: string;
}

export function ContactDetailPanel({ contactUid, onClose, className }: ContactDetailPanelProps) {
  const [notesValue, setNotesValue] = useState('');
  const [isNotesEditing, setIsNotesEditing] = useState(false);
  const [isLabelsOpen, setIsLabelsOpen] = useState(true);
  const [isNotesOpen, setIsNotesOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);

  // Fetch chat context
  const {
    contact,
    labels,
    teamMembers,
    replyWindowStatus,
    isLoading,
    isError,
  } = useChatContext({ contactUid });

  // Fetch all team members for assignment dropdown
  const { teamMembers: allTeamMembers } = useTeamMembers();

  // Mutations
  const assignUserMutation = useAssignUser();
  const assignLabelsMutation = useAssignLabels();
  const updateNotesMutation = useUpdateNotes();
  const blockContactMutation = useBlockContact();
  const unblockContactMutation = useUnblockContact();
  const botSettingsMutation = useBotSettings();

  // Derived state
  const isBlocked = contact?.is_blocked ?? false;
  const botEnabled = contact?.bot_enabled ?? true;

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTimeRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const expires = new Date(expiresAt);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  const handleAssignUser = (userUid: string) => {
    if (userUid === 'unassign') {
      // Handle unassignment - might need different API
      return;
    }
    assignUserMutation.mutate({ contactUid, userUid });
  };

  const handleToggleBot = (enabled: boolean) => {
    botSettingsMutation.mutate({ contactUid, botEnabled: enabled });
  };

  const handleToggleBlock = () => {
    if (isBlocked) {
      unblockContactMutation.mutate(contactUid);
    } else {
      blockContactMutation.mutate(contactUid);
    }
  };

  const handleSaveNotes = () => {
    updateNotesMutation.mutate(
      { contactUid, notes: notesValue },
      {
        onSuccess: () => {
          setIsNotesEditing(false);
        },
      }
    );
  };

  const handleStartEditNotes = () => {
    setNotesValue(contact?.notes || '');
    setIsNotesEditing(true);
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center h-full bg-card', className)}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading contact...</p>
        </div>
      </div>
    );
  }

  if (isError || !contact) {
    return (
      <div className={cn('flex items-center justify-center h-full bg-card', className)}>
        <div className="text-center p-4">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-sm text-destructive">Failed to load contact</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full bg-card border-l border-border', className)}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Contact Details</h2>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Contact Info */}
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 mb-3">
              <AvatarImage src={contact.avatar_url} alt={contact.name} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl font-semibold">
                {getInitials(contact.name)}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-base font-semibold">{contact.name || 'Unknown'}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Phone className="h-3 w-3" />
              {contact.phone_number}
            </p>
            {contact.email && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Mail className="h-3 w-3" />
                {contact.email}
              </p>
            )}
          </div>

          <Separator />

          {/* Reply Window Status */}
          {replyWindowStatus && (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4" />
                  <span>Reply Window</span>
                </div>
                <div className={cn(
                  'flex items-center justify-between p-3 rounded-lg border',
                  replyWindowStatus.is_open
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                )}>
                  <div className="flex items-center gap-2">
                    {replyWindowStatus.is_open ? (
                      <MessageSquare className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    )}
                    <span className={cn(
                      'text-sm font-medium',
                      replyWindowStatus.is_open ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                    )}>
                      {replyWindowStatus.is_open ? 'Window Open' : 'Template Required'}
                    </span>
                  </div>
                  {replyWindowStatus.expires_at && (
                    <span className="text-xs text-muted-foreground">
                      {formatTimeRemaining(replyWindowStatus.expires_at)}
                    </span>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Assign Team Member */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserPlus className="h-4 w-4" />
              <span>Assigned To</span>
            </div>
            <Select
              value={contact.assigned_user_uid || 'unassign'}
              onValueChange={handleAssignUser}
              disabled={assignUserMutation.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassign">
                  <span className="text-muted-foreground">Unassigned</span>
                </SelectItem>
                {allTeamMembers.map((member) => (
                  <SelectItem key={member._uid} value={member._uid}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={member.avatar_url} />
                        <AvatarFallback className="text-[10px]">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{member.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Labels */}
          <Collapsible open={isLabelsOpen} onOpenChange={setIsLabelsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Tag className="h-4 w-4" />
                <span>Labels</span>
                {labels.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {labels.length}
                  </Badge>
                )}
              </div>
              <ChevronDown className={cn('h-4 w-4 transition-transform', isLabelsOpen && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              {labels.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {labels.map((label) => (
                    <Badge
                      key={label._uid}
                      variant="outline"
                      className="text-xs"
                      style={{
                        backgroundColor: label.bg_color || undefined,
                        color: label.text_color || undefined,
                        borderColor: label.bg_color || undefined,
                      }}
                    >
                      {label.title}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No labels assigned</p>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Notes */}
          <Collapsible open={isNotesOpen} onOpenChange={setIsNotesOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 text-sm font-medium">
                <StickyNote className="h-4 w-4" />
                <span>Notes</span>
              </div>
              <ChevronDown className={cn('h-4 w-4 transition-transform', isNotesOpen && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {isNotesEditing ? (
                <>
                  <Textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    placeholder="Add notes about this contact..."
                    className="min-h-[80px] text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      disabled={updateNotesMutation.isPending}
                      className="flex-1"
                    >
                      {updateNotesMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsNotesEditing(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div
                  onClick={handleStartEditNotes}
                  className="p-2 rounded-md border border-dashed border-border hover:bg-accent/50 cursor-pointer min-h-[60px]"
                >
                  {contact.notes ? (
                    <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Click to add notes...</p>
                  )}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Settings */}
          <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bot className="h-4 w-4" />
                <span>Settings</span>
              </div>
              <ChevronDown className={cn('h-4 w-4 transition-transform', isSettingsOpen && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-4">
              {/* Bot Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="bot-toggle" className="text-sm cursor-pointer">
                    Bot Enabled
                  </Label>
                </div>
                <Switch
                  id="bot-toggle"
                  checked={botEnabled}
                  onCheckedChange={handleToggleBot}
                  disabled={botSettingsMutation.isPending}
                />
              </div>

              {/* Block Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ban className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="block-toggle" className="text-sm cursor-pointer">
                    Block Contact
                  </Label>
                </div>
                <Switch
                  id="block-toggle"
                  checked={isBlocked}
                  onCheckedChange={handleToggleBlock}
                  disabled={blockContactMutation.isPending || unblockContactMutation.isPending}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
