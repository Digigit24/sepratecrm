// src/pages/Campaigns.tsx
import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Phone, Send, AlertTriangle, Calendar, Clock, Users, FileText, ChevronRight, ChevronLeft, Search, X, CheckCircle, XCircle, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { toast } from 'sonner';

import { useCampaigns } from '@/hooks/whatsapp/useCampaigns';
import { useTemplates } from '@/hooks/whatsapp/useTemplates';
import { useContacts } from '@/hooks/whatsapp/useContacts';
import { useGroups } from '@/hooks/whatsapp/useGroups';
import type { WACampaign, Template, TemplateStatus, Contact, Group } from '@/types/whatsappTypes';
import CampaignsTable from '@/components/CampaignsTable';
import { SideDrawer } from '@/components/SideDrawer';

function rate(c?: WACampaign | null) {
  if (!c || !c.total_recipients) return 0;
  const sent = c.sent_count ?? 0;
  return Math.round((sent / c.total_recipients) * 100);
}

function formatDate(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return iso;
  }
}

type CampaignStep = 'template' | 'contacts' | 'review';

// Helper to get template body text
function getTemplateBody(template: Template): string {
  const bodyComponent = template.components.find(c => c.type === 'BODY');
  return bodyComponent?.text || '';
}

// Helper to get template header text
function getTemplateHeader(template: Template): string | undefined {
  const headerComponent = template.components.find(c => c.type === 'HEADER');
  return headerComponent?.text;
}

// Helper to get template footer text
function getTemplateFooter(template: Template): string | undefined {
  const footerComponent = template.components.find(c => c.type === 'FOOTER');
  return footerComponent?.text;
}

export default function Campaigns() {
  const isMobile = useIsMobile();

  // Data hook (backend-aligned)
  const {
    campaigns,
    isLoading,
    error,
    refetch,
    sendTemplateBroadcastBulk,
    getCampaign,
    stats,
  } = useCampaigns({ autoFetch: true });

  // Templates hook - fetch approved templates for campaigns
  const {
    templates,
    isLoading: templatesLoading,
    error: templatesError,
  } = useTemplates({
    autoFetch: true,
    initialQuery: { skip: 0, limit: 100, status: 'APPROVED' as TemplateStatus }
  });

  // Contacts hook - fetch all contacts for selection
  const {
    contacts,
    isLoading: contactsLoading,
    error: contactsError,
  } = useContacts({ limit: 500, offset: 0 });

  // Groups hook - fetch all groups for selection
  const {
    groups,
    isLoading: groupsLoading,
    error: groupsError,
  } = useGroups({ limit: 500, offset: 0 });

  // Header actions
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<WACampaign | null>(null);

  // Multi-step campaign creation
  const [currentStep, setCurrentStep] = useState<CampaignStep>('template');
  const [creating, setCreating] = useState(false);

  // Template selector dialog
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');

  // Step 1: Template Selection
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [campaignTitle, setCampaignTitle] = useState('');

  // Step 2: Recipients - three methods
  const [recipientMethod, setRecipientMethod] = useState<'phone' | 'contacts' | 'groups'>('phone');
  const [recipientsText, setRecipientsText] = useState(''); // For direct phone numbers
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]); // For contact IDs
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]); // For group IDs

  // Scheduling
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const total = campaigns.length;

  const handleRefresh = async () => {
    await refetch();
    toast.success('Campaigns refreshed');
  };

  const openCreate = () => {
    // Reset form
    setCurrentStep('template');
    setSelectedTemplate(null);
    setCampaignTitle('');
    setRecipientMethod('phone');
    setRecipientsText('');
    setSelectedContactIds([]);
    setSelectedGroupIds([]);
    setTemplateSearchQuery('');
    setIsScheduled(false);
    setScheduleDate('');
    setScheduleTime('');
    setCreateOpen(true);
  };

  const onView = async (row: WACampaign) => {
    const fresh = await getCampaign(row.campaign_id);
    setViewItem(fresh || row);
    setViewOpen(true);
  };

  const parseRecipients = (input: string): string[] => {
    const parts = input
      .split(/[\n,;\s]+/g)
      .map((x) => x.trim())
      .filter(Boolean);
    const unique = Array.from(new Set(parts));
    return unique;
  };

  const handleNextStep = () => {
    if (currentStep === 'template') {
      if (!selectedTemplate) {
        toast.error('Please select a template');
        return;
      }
      setCurrentStep('contacts');
    } else if (currentStep === 'contacts') {
      // Validate based on selected method
      if (recipientMethod === 'phone') {
        if (!recipientsText.trim()) {
          toast.error('Please enter at least one recipient phone number');
          return;
        }
        const recipients = parseRecipients(recipientsText);
        if (recipients.length === 0) {
          toast.error('Please enter valid phone numbers');
          return;
        }
      } else if (recipientMethod === 'contacts') {
        if (selectedContactIds.length === 0) {
          toast.error('Please select at least one contact');
          return;
        }
      } else if (recipientMethod === 'groups') {
        if (selectedGroupIds.length === 0) {
          toast.error('Please select at least one group');
          return;
        }
      }
      setCurrentStep('review');
    }
  };

  const handlePreviousStep = () => {
    if (currentStep === 'contacts') {
      setCurrentStep('template');
    } else if (currentStep === 'review') {
      setCurrentStep('contacts');
    }
  };

  const handleCreate = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    // Validate scheduling if enabled
    if (isScheduled) {
      if (!scheduleDate || !scheduleTime) {
        toast.error('Please select both date and time for scheduling');
        return;
      }
      const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
      if (scheduledDateTime <= new Date()) {
        toast.error('Scheduled time must be in the future');
        return;
      }
    }

    // Collect all phone numbers based on selected method
    let allPhoneNumbers: string[] = [];

    if (recipientMethod === 'phone' && recipientsText.trim()) {
      // Direct phone numbers
      const phoneNumbers = parseRecipients(recipientsText);
      allPhoneNumbers.push(...phoneNumbers);
    } else if (recipientMethod === 'contacts' && selectedContactIds.length > 0) {
      // Resolve contact IDs to phone numbers
      const selectedContacts = contacts.filter(c => selectedContactIds.includes(String(c.id)));
      const phoneNumbers = selectedContacts.map(c => c.phone);
      allPhoneNumbers.push(...phoneNumbers);
      console.log(`Resolved ${phoneNumbers.length} phone numbers from ${selectedContactIds.length} contacts`);
    } else if (recipientMethod === 'groups' && selectedGroupIds.length > 0) {
      // Resolve group IDs to participant phone numbers
      const selectedGroups = groups.filter(g => selectedGroupIds.includes(String(g.id)));
      selectedGroups.forEach(group => {
        if (Array.isArray(group.participants)) {
          allPhoneNumbers.push(...group.participants);
        }
      });
      console.log(`Resolved ${allPhoneNumbers.length} phone numbers from ${selectedGroups.length} groups`);
    }

    // Remove duplicates
    const uniquePhoneNumbers = Array.from(new Set(allPhoneNumbers));

    // Validate we have recipients
    if (uniquePhoneNumbers.length === 0) {
      toast.error('No recipients found. Please select at least one contact or group.');
      return;
    }

    // Build payload for template broadcast bulk send
    const payload: any = {
      template_name: selectedTemplate.name,
      language: selectedTemplate.language,
      recipients: uniquePhoneNumbers,
      campaign_name: campaignTitle.trim() || selectedTemplate.name,
    };

    // Add scheduling if enabled
    if (isScheduled && scheduleDate && scheduleTime) {
      payload.schedule_at = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    }

    try {
      setCreating(true);
      const isScheduledSend = isScheduled && scheduleDate && scheduleTime;
      console.log(`${isScheduledSend ? 'Scheduling' : 'Sending'} campaign to ${uniquePhoneNumbers.length} unique recipients`);
      const result = await sendTemplateBroadcastBulk(payload);
      if (result) {
        if (isScheduledSend) {
          toast.success(`Campaign scheduled for ${new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString()}`, {
            duration: 5000
          });
        } else {
          toast.success(`Campaign sent! ${result.sent}/${result.total} messages delivered successfully`, {
            duration: 5000
          });
        }
        setCreateOpen(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const viewStats = useMemo(() => (viewItem ? stats(viewItem) : null), [viewItem, stats]);

  // Filter templates by search query
  const filteredTemplates = useMemo(() => {
    if (!templateSearchQuery.trim()) return templates;
    const query = templateSearchQuery.toLowerCase();
    return templates.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.language.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query)
    );
  }, [templates, templateSearchQuery]);

  // Step indicator
  const steps = [
    { key: 'template', label: 'Template', icon: FileText },
    { key: 'contacts', label: 'Recipients', icon: Users },
    { key: 'review', label: 'Review', icon: Send },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  // Message preview with template variables replaced
  const getPreviewMessage = () => {
    if (!selectedTemplate) return '';
    // Show template body as-is (variables like {{1}}, {{2}} will be replaced at send time)
    return getTemplateBody(selectedTemplate);
  };

  // Handle template selection from dialog
  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setTemplateSelectorOpen(false);
    setTemplateSearchQuery('');
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'template':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base font-semibold">Select Template</Label>
                  {selectedTemplate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTemplateSelectorOpen(true)}
                    >
                      Change
                    </Button>
                  )}
                </div>

                {selectedTemplate ? (
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-lg">{selectedTemplate.name}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Language: <span className="font-medium">{selectedTemplate.language}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Category: <Badge variant="secondary" className="mt-1">{selectedTemplate.category}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">
                          Status: <Badge variant="secondary" className="bg-green-100 text-green-800">{selectedTemplate.status}</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Preview */}
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Preview</Label>
                      <div className="bg-white border rounded-lg p-3 text-sm">
                        {getTemplateHeader(selectedTemplate) && (
                          <div className="font-semibold mb-2">{getTemplateHeader(selectedTemplate)}</div>
                        )}
                        <div className="whitespace-pre-wrap">{getTemplateBody(selectedTemplate)}</div>
                        {getTemplateFooter(selectedTemplate) && (
                          <div className="text-xs text-muted-foreground mt-2">{getTemplateFooter(selectedTemplate)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-lg p-8 text-center bg-muted/20">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">
                      {templatesLoading ? 'Loading templates...' : 'No template selected'}
                    </p>
                    {templatesError && (
                      <p className="text-xs text-destructive mb-4">{templatesError}</p>
                    )}
                    <Button
                      onClick={() => setTemplateSelectorOpen(true)}
                      disabled={templatesLoading || templates.length === 0}
                    >
                      {templates.length === 0 ? 'No Approved Templates' : 'Select Template'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'contacts':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="campaign-title">Campaign Title</Label>
                <Input
                  id="campaign-title"
                  placeholder="Enter campaign title (optional)"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  If empty, template name will be used
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-base font-semibold">
                  Recipient Method <span className="text-destructive">*</span>
                </Label>

                <RadioGroup value={recipientMethod} onValueChange={(value: any) => setRecipientMethod(value)}>
                  <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="phone" id="method-phone" />
                    <Label htmlFor="method-phone" className="flex-1 cursor-pointer">
                      <div className="font-medium">Direct Phone Numbers</div>
                      <div className="text-xs text-muted-foreground">Enter phone numbers directly</div>
                    </Label>
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="contacts" id="method-contacts" />
                    <Label htmlFor="method-contacts" className="flex-1 cursor-pointer">
                      <div className="font-medium">Select from Contacts</div>
                      <div className="text-xs text-muted-foreground">Choose saved contacts from database</div>
                    </Label>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="groups" id="method-groups" />
                    <Label htmlFor="method-groups" className="flex-1 cursor-pointer">
                      <div className="font-medium">Select Groups</div>
                      <div className="text-xs text-muted-foreground">Send to all members of selected groups</div>
                    </Label>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              {/* Direct Phone Numbers Method */}
              {recipientMethod === 'phone' && (
                <div className="space-y-3">
                  <Label htmlFor="recipients" className="text-base font-semibold">
                    Recipients <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="recipients"
                    placeholder="Enter phone numbers (one per line or comma-separated)&#10;Example:&#10;919876543210&#10;918765432109&#10;917654321098"
                    value={recipientsText}
                    onChange={(e) => setRecipientsText(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter phone numbers in international format without + sign.
                    You can separate numbers with new lines, commas, or spaces.
                  </p>
                  {recipientsText && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{parseRecipients(recipientsText).length} recipients</span>
                    </div>
                  )}
                </div>
              )}

              {/* Contacts Selection Method */}
              {recipientMethod === 'contacts' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">
                      Select Contacts <span className="text-destructive">*</span>
                    </Label>
                    {!contactsLoading && contacts.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedContactIds.length === contacts.length) {
                            // Deselect all
                            setSelectedContactIds([]);
                            toast.info('All contacts deselected');
                          } else {
                            // Select all
                            setSelectedContactIds(contacts.map(c => String(c.id)));
                            toast.success(`All ${contacts.length} contacts selected`);
                          }
                        }}
                      >
                        {selectedContactIds.length === contacts.length ? 'Deselect All' : 'Select All'}
                      </Button>
                    )}
                  </div>
                  {contactsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Loading contacts...</p>
                      </div>
                    </div>
                  ) : contactsError ? (
                    <div className="border rounded-lg p-4 bg-destructive/10 text-destructive text-sm">
                      Error loading contacts: {contactsError.message || 'Unknown error'}
                    </div>
                  ) : contacts.length === 0 ? (
                    <div className="border rounded-lg p-8 text-center">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No contacts available</p>
                      <p className="text-xs text-muted-foreground mt-1">Add contacts first to use this feature</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                      {contacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center space-x-3 p-3 border-b last:border-b-0 hover:bg-muted/50"
                        >
                          <Checkbox
                            id={`contact-${contact.id}`}
                            checked={selectedContactIds.includes(String(contact.id))}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedContactIds([...selectedContactIds, String(contact.id)]);
                              } else {
                                setSelectedContactIds(selectedContactIds.filter(id => id !== String(contact.id)));
                              }
                            }}
                          />
                          <Label htmlFor={`contact-${contact.id}`} className="flex-1 cursor-pointer">
                            <div className="font-medium">{contact.name || 'Unnamed'}</div>
                            <div className="text-xs text-muted-foreground font-mono">{contact.phone}</div>
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedContactIds.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{selectedContactIds.length} contact{selectedContactIds.length !== 1 ? 's' : ''} selected</span>
                    </div>
                  )}
                </div>
              )}

              {/* Groups Selection Method */}
              {recipientMethod === 'groups' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">
                      Select Groups <span className="text-destructive">*</span>
                    </Label>
                    {!groupsLoading && groups.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedGroupIds.length === groups.length) {
                            // Deselect all
                            setSelectedGroupIds([]);
                            toast.info('All groups deselected');
                          } else {
                            // Select all
                            setSelectedGroupIds(groups.map(g => String(g.id)));
                            toast.success(`All ${groups.length} groups selected`);
                          }
                        }}
                      >
                        {selectedGroupIds.length === groups.length ? 'Deselect All' : 'Select All'}
                      </Button>
                    )}
                  </div>
                  {groupsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Loading groups...</p>
                      </div>
                    </div>
                  ) : groupsError ? (
                    <div className="border rounded-lg p-4 bg-destructive/10 text-destructive text-sm">
                      Error loading groups: {groupsError.message || 'Unknown error'}
                    </div>
                  ) : groups.length === 0 ? (
                    <div className="border rounded-lg p-8 text-center">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No groups available</p>
                      <p className="text-xs text-muted-foreground mt-1">Create groups first to use this feature</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                      {groups.map((group) => (
                        <div
                          key={group.id}
                          className="flex items-center space-x-3 p-3 border-b last:border-b-0 hover:bg-muted/50"
                        >
                          <Checkbox
                            id={`group-${group.id}`}
                            checked={selectedGroupIds.includes(String(group.id))}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedGroupIds([...selectedGroupIds, String(group.id)]);
                              } else {
                                setSelectedGroupIds(selectedGroupIds.filter(id => id !== String(group.id)));
                              }
                            }}
                          />
                          <Label htmlFor={`group-${group.id}`} className="flex-1 cursor-pointer">
                            <div className="font-medium">{group.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {group.participant_count} participant{group.participant_count !== 1 ? 's' : ''}
                            </div>
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedGroupIds.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{selectedGroupIds.length} group{selectedGroupIds.length !== 1 ? 's' : ''} selected</span>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Scheduling Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">Schedule Campaign</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Send later at a specific date and time
                    </p>
                  </div>
                  <Switch
                    checked={isScheduled}
                    onCheckedChange={setIsScheduled}
                  />
                </div>

                {isScheduled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="schedule-date">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        Date
                      </Label>
                      <Input
                        id="schedule-date"
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="schedule-time">
                        <Clock className="h-3 w-3 inline mr-1" />
                        Time
                      </Label>
                      <Input
                        id="schedule-time"
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'review':
        const recipientsList = parseRecipients(recipientsText);

        // Calculate total recipients by resolving phone numbers
        let totalRecipientCount = 0;
        if (recipientMethod === 'phone') {
          totalRecipientCount = recipientsList.length;
        } else if (recipientMethod === 'contacts') {
          totalRecipientCount = selectedContactIds.length;
        } else if (recipientMethod === 'groups') {
          // Count participants from selected groups
          const selectedGroups = groups.filter(g => selectedGroupIds.includes(String(g.id)));
          const allParticipants: string[] = [];
          selectedGroups.forEach(group => {
            if (Array.isArray(group.participants)) {
              allParticipants.push(...group.participants);
            }
          });
          // Remove duplicates
          totalRecipientCount = Array.from(new Set(allParticipants)).length;
        }

        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Campaign Summary</Label>
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-muted-foreground">Template:</span>
                    <span className="col-span-2 font-medium">{selectedTemplate?.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-muted-foreground">Campaign Title:</span>
                    <span className="col-span-2 font-medium">
                      {campaignTitle.trim() || selectedTemplate?.name || 'Untitled'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-muted-foreground">Recipient Method:</span>
                    <span className="col-span-2">
                      <Badge variant="secondary">
                        {recipientMethod === 'phone' && 'Direct Phone Numbers'}
                        {recipientMethod === 'contacts' && 'Saved Contacts'}
                        {recipientMethod === 'groups' && 'Groups'}
                      </Badge>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-muted-foreground">Recipients:</span>
                    <span className="col-span-2 font-medium flex items-center gap-2">
                      <Users className="h-3 w-3" />
                      {totalRecipientCount} unique {totalRecipientCount === 1 ? 'recipient' : 'recipients'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-muted-foreground">Language:</span>
                    <span className="col-span-2 font-medium">{selectedTemplate?.language}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-muted-foreground">Category:</span>
                    <span className="col-span-2">
                      <Badge variant="secondary">{selectedTemplate?.category}</Badge>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-muted-foreground">Delivery:</span>
                    <span className="col-span-2">
                      {isScheduled && scheduleDate && scheduleTime ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          <Calendar className="h-3 w-3 mr-1" />
                          Scheduled: {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString()}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Send Immediately
                        </Badge>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-base font-semibold mb-3">Message Preview</Label>
                <div className="mt-3 border rounded-lg p-4 bg-white">
                  {selectedTemplate && getTemplateHeader(selectedTemplate) && (
                    <div className="font-semibold mb-2">{getTemplateHeader(selectedTemplate)}</div>
                  )}
                  <div className="whitespace-pre-wrap text-sm">{getPreviewMessage()}</div>
                  {selectedTemplate && getTemplateFooter(selectedTemplate) && (
                    <div className="text-xs text-muted-foreground mt-2">{getTemplateFooter(selectedTemplate)}</div>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Template variables like {'{{1}}, {{2}}'} will be replaced with actual values when sending.
                  Campaign will be sent immediately to all selected contacts, bypassing the 24-hour messaging window restriction.
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Calculate stats
  const totalSent = campaigns.reduce((sum, c) => sum + (c.sent_count ?? 0), 0);
  const totalFailed = campaigns.reduce((sum, c) => sum + (c.failed_count ?? 0), 0);
  const totalRecipients = campaigns.reduce((sum, c) => sum + (c.total_recipients ?? 0), 0);

  // Loading state
  if (isLoading && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Campaigns</h3>
          <p className="text-sm text-destructive/80">{error}</p>
          <Button onClick={handleRefresh} variant="outline" className="mt-4 w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-8xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">WhatsApp Campaigns</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage your WhatsApp broadcast campaigns
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={openCreate} size="default" className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Megaphone className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Campaigns</p>
                <p className="text-xl sm:text-2xl font-bold">{total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Recipients</p>
                <p className="text-xl sm:text-2xl font-bold">{totalRecipients}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Sent</p>
                <p className="text-xl sm:text-2xl font-bold">{totalSent}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Failed</p>
                <p className="text-xl sm:text-2xl font-bold">{totalFailed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 text-destructive px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table Card */}
      <Card>
        <CardContent className="p-0">
          <CampaignsTable campaigns={campaigns} isLoading={isLoading} onView={onView} />

          {!isLoading && total > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Campaign Drawer with Steps */}
      <SideDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Campaign"
        mode="create"
        isLoading={false}
        size="xl"
        resizable
      >
        <div className="space-y-6">
          {/* Step Indicator */}
          <div className="border rounded-lg p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = currentStepIndex === index;
                const isCompleted = currentStepIndex > index;

                return (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`
                          w-10 h-10 rounded-full flex items-center justify-center mb-2
                          ${isActive ? 'bg-primary text-primary-foreground' : ''}
                          ${isCompleted ? 'bg-green-500 text-white' : ''}
                          ${!isActive && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
                        `}
                      >
                        <StepIcon className="h-5 w-5" />
                      </div>
                      <span className={`text-xs sm:text-sm font-medium text-center ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <ChevronRight className="h-5 w-5 text-muted-foreground mx-2 hidden sm:block" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Step Title */}
          <div className="border-l-4 border-primary pl-4">
            <h3 className="text-lg font-semibold text-primary">
              Step {currentStepIndex + 1}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {currentStep === 'template' && 'Select a template for your campaign'}
              {currentStep === 'contacts' && 'Configure contacts and schedule'}
              {currentStep === 'review' && 'Review and send your campaign'}
            </p>
          </div>

          <Separator />

          {/* Step Content */}
          <div className="min-h-[400px]">
            {renderStepContent()}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={handlePreviousStep}
              disabled={currentStep === 'template'}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>

              {currentStep !== 'review' ? (
                <Button onClick={handleNextStep}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleCreate} disabled={creating}>
                  {isScheduled && scheduleDate && scheduleTime ? (
                    <>
                      <Calendar className="h-4 w-4 mr-2" />
                      {creating ? 'Scheduling...' : 'Schedule Campaign'}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {creating ? 'Sending...' : 'Send Campaign'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </SideDrawer>

      {/* View Campaign Drawer */}
      <SideDrawer
        open={viewOpen}
        onOpenChange={setViewOpen}
        title={viewItem?.campaign_name || 'Campaign Details'}
        mode="view"
        isLoading={false}
        size="xl"
        resizable
      >
        {!viewItem ? (
          <div className="text-sm text-muted-foreground">No campaign selected.</div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-2">
              <div className="text-xs text-muted-foreground">Campaign ID</div>
              <div className="text-sm font-mono break-all">{viewItem.campaign_id}</div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded border p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Created</div>
                <div className="text-xs sm:text-sm font-medium mt-1 break-words">{formatDate(viewItem.created_at)}</div>
              </div>
              <div className="rounded border p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Recipients</div>
                <div className="text-sm font-medium mt-1">{viewItem.total_recipients}</div>
              </div>
              <div className="rounded border p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Sent</div>
                <div className="text-sm font-medium mt-1">{viewItem.sent_count}</div>
              </div>
              <div className="rounded border p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Failed</div>
                <div className={`text-sm font-medium mt-1 ${viewItem.failed_count ? 'text-red-600' : ''}`}>
                  {viewItem.failed_count}
                </div>
              </div>
            </div>

            {/* Success Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Success Rate</div>
                <Badge variant="secondary">{rate(viewItem)}%</Badge>
              </div>
              <Progress value={rate(viewItem)} className="h-2" />
            </div>

            {/* Results */}
            {Array.isArray(viewItem.results) && viewItem.results.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-medium">Delivery Results</div>
                <div className="rounded border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 whitespace-nowrap">Phone</th>
                          <th className="text-left px-3 py-2 whitespace-nowrap">Status</th>
                          <th className="text-left px-3 py-2 whitespace-nowrap">Message ID</th>
                          <th className="text-left px-3 py-2 whitespace-nowrap">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewItem.results.slice(0, 50).map((r: any, idx: number) => (
                          <tr key={`${r.phone}-${idx}`} className="border-t">
                            <td className="px-3 py-2 font-mono text-xs">{r.phone}</td>
                            <td className="px-3 py-2">
                              <Badge
                                variant="secondary"
                                className={
                                  r.status === 'sent'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }
                              >
                                {r.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 font-mono text-xs break-all">{r.message_id || '-'}</td>
                            <td className="px-3 py-2 text-xs text-red-700 break-words max-w-xs">{r.error || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {viewItem.results.length > 50 && (
                  <div className="text-xs text-muted-foreground">
                    Showing first 50 of {viewItem.results.length} results.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SideDrawer>

      {/* Template Selector Dialog */}
      <Dialog open={templateSelectorOpen} onOpenChange={setTemplateSelectorOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Template</DialogTitle>
            <DialogDescription>
              Choose an approved WhatsApp template for your campaign
            </DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates by name, language, or category..."
              value={templateSearchQuery}
              onChange={(e) => setTemplateSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {templateSearchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setTemplateSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Templates List */}
          <div className="flex-1 overflow-y-auto border rounded-lg">
            {templatesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-2">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading templates...</p>
                </div>
              </div>
            ) : templatesError ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-2">
                  <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
                  <p className="text-sm text-destructive">{templatesError}</p>
                </div>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-2">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {templateSearchQuery ? 'No templates found matching your search' : 'No approved templates available'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate">{template.name}</h4>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              {template.language}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {template.category}
                            </Badge>
                            <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                              {template.status}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>

                      {/* Preview */}
                      <div className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 rounded p-2 mt-2">
                        {getTemplateBody(template)}
                      </div>

                      {template.usage_count !== undefined && (
                        <div className="text-xs text-muted-foreground">
                          Used {template.usage_count} times
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
            </div>
            <Button variant="outline" onClick={() => setTemplateSelectorOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}