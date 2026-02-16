// src/components/TemplatesFormDrawer.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SideDrawer, type DrawerActionButton, type DrawerHeaderAction } from '@/components/SideDrawer';
import { toast } from 'sonner';
import { 
  Template, 
  TemplateCategory, 
  TemplateLanguage, 
  TemplateStatus, 
  CreateTemplatePayload, 
  UpdateTemplatePayload 
} from '@/types/whatsappTypes';
import { useTemplate } from '@/hooks/whatsapp/useTemplates';
import { templatesService } from '@/services/whatsapp/templatesService';
import {
  Eye,
  Pencil,
  Trash2,
  Smartphone,
  Plus,
  MinusCircle,
  Image as ImageIcon,
  FileText,
  Video,
  File,
  ExternalLink,
  AlertCircle,
  Send,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  UserPlus,
  X as XIcon,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

type Mode = 'view' | 'edit' | 'create';

interface TemplatesFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: number | null;
  mode: Mode;
  onSuccess?: () => void;
  onDelete?: (id: number) => void;
  onModeChange?: (mode: Mode) => void;
}

type HeaderType = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
type TemplateType = 'STANDARD' | 'CAROUSEL';

type ButtonRow = {
  type: string; // Can be 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' or other types from backend
  text: string;
  url?: string;
  phone_number?: string;
  copy_code?: string;
  example?: string[];
};

// Type guard to check if button type is valid for creation
const isValidButtonType = (type: string): type is 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' => {
  return ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE'].includes(type);
};

export default function TemplatesFormDrawer({
  open,
  onOpenChange,
  templateId,
  mode,
  onSuccess,
  onDelete,
  onModeChange,
}: TemplatesFormDrawerProps) {
  const [activeTab, setActiveTab] = useState('builder');
  const [currentMode, setCurrentMode] = useState<Mode>(mode);
  const [isSaving, setIsSaving] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Send message state
  const [sendMode, setSendMode] = useState<'single' | 'bulk'>('single');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [sendParameters, setSendParameters] = useState<Record<string, string>>({});
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>(['']);
  const [bulkParameters, setBulkParameters] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);

  // Load when viewing/editing
  const { template, isLoading, error, refetch } = useTemplate(templateId);

  // ===== Form state (for CREATE) =====
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<TemplateLanguage>(TemplateLanguage.ENGLISH_US);
  const [category, setCategory] = useState<TemplateCategory>(TemplateCategory.UTILITY);

  // Template Type: Standard or Carousel
  const [templateType, setTemplateType] = useState<TemplateType>('STANDARD');

  // Header configuration
  const [headerType, setHeaderType] = useState<HeaderType>('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [headerMediaExample, setHeaderMediaExample] = useState('');

  // Body
  const [bodyText, setBodyText] = useState('');
  
  // Footer
  const [footerEnabled, setFooterEnabled] = useState(false);
  const [footerText, setFooterText] = useState('');

  // Buttons
  const [buttonsEnabled, setButtonsEnabled] = useState(false);
  const [buttons, setButtons] = useState<ButtonRow[]>([]);

  // ===== Edit-only fields =====
  const [editStatus, setEditStatus] = useState<TemplateStatus | undefined>(undefined);

  // ===== Preview variables for body {{1}}, {{2}}, ... =====
  const variableNumbers = useMemo(() => {
    if (!bodyText) return [] as string[];
    return templatesService.extractVariables(bodyText);
  }, [bodyText]);

  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});

  const handleVarChange = (indexNumber: string, value: string) => {
    setPreviewVars((prev) => ({ ...prev, [indexNumber]: value }));
  };

  const resolvedPreviewBody = useMemo(() => {
    if (!bodyText) return '';
    return templatesService.replaceVariables(bodyText, previewVars);
  }, [bodyText, previewVars]);

  // ===== Sync mode and data =====
  useEffect(() => setCurrentMode(mode), [mode]);

  useEffect(() => {
    if (currentMode === 'create') {
      // reset form
      setName('');
      setLanguage(TemplateLanguage.ENGLISH_US);
      setCategory(TemplateCategory.UTILITY);
      setTemplateType('STANDARD');
      setHeaderType('NONE');
      setHeaderText('');
      setHeaderMediaUrl('');
      setHeaderMediaExample('');
      setBodyText('');
      setFooterEnabled(false);
      setFooterText('');
      setButtonsEnabled(false);
      setButtons([]);
      setPreviewVars({});
      setEditStatus(undefined);
      setActiveTab('builder');
    } else if (template) {
      setEditStatus(template.status);
      // TODO: Parse template components back into form state if needed
    }
  }, [currentMode, template]);

  // ===== Build components array compatible with backend schema =====
  const buildComponents = () => {
    const comps: any[] = [];

    // Header component
    if (headerType !== 'NONE') {
      if (headerType === 'TEXT' && headerText.trim()) {
        comps.push({
          type: 'HEADER',
          format: 'TEXT',
          text: headerText.trim(),
        });
      } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
        comps.push({
          type: 'HEADER',
          format: headerType,
          example: {
            header_handle: [headerMediaExample || headerMediaUrl]
          }
        });
      }
    }

    // Body
    if (bodyText.trim()) {
      const bodyComp: any = {
        type: 'BODY',
        text: bodyText.trim(),
      };
      
      // Add example variables if present
      if (variableNumbers.length > 0) {
        bodyComp.example = {
          body_text: [variableNumbers.map(num => previewVars[num] || `{{${num}}}`)]
        };
      }
      
      comps.push(bodyComp);
    }

    // Footer
    if (footerEnabled && footerText.trim()) {
      comps.push({
        type: 'FOOTER',
        text: footerText.trim(),
      });
    }

    // Buttons
    if (buttonsEnabled && buttons.length > 0) {
      comps.push({
        type: 'BUTTONS',
        buttons: buttons.map((b) => {
          const btn: any = {
            type: b.type,
            text: b.text,
          };
          
          if (b.type === 'URL' && b.url) btn.url = b.url;
          if (b.type === 'PHONE_NUMBER' && b.phone_number) btn.phone_number = b.phone_number;
          if (b.type === 'COPY_CODE' && b.copy_code) btn.example = [b.copy_code];
          
          return btn;
        }),
      });
    }

    return comps;
  };

  const validateBeforeSave = () => {
    if (currentMode === 'create') {
      if (!name.trim()) return 'Template name is required';
      if (!/^[a-z0-9_]+$/.test(name.trim())) {
        return 'Name must be lowercase letters, numbers, and underscores only';
      }
      if (!bodyText.trim()) return 'Body text is required';
      
      // Header validation
      if (headerType === 'TEXT' && !headerText.trim()) {
        return 'Header text is required when header type is TEXT';
      }
      if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && !headerMediaUrl.trim()) {
        return `${headerType.toLowerCase()} URL is required for header`;
      }
      
      // Button validation
      if (buttonsEnabled && buttons.length === 0) {
        return 'At least one button is required when buttons are enabled';
      }
      
      if (buttons.length > 0) {
        for (let i = 0; i < buttons.length; i++) {
          const btn = buttons[i];
          if (!btn.text.trim()) return `Button ${i + 1} text is required`;
          if (btn.type === 'URL' && !btn.url?.trim()) return `Button ${i + 1} URL is required`;
          if (btn.type === 'PHONE_NUMBER' && !btn.phone_number?.trim()) return `Button ${i + 1} phone number is required`;
        }
      }
      
      const comps = buildComponents();
      const validation = templatesService.validateTemplate(comps);
      if (!validation.valid) {
        return validation.errors.join(', ');
      }
    }
    if (currentMode === 'edit') {
      if (!templateId) return 'Missing template id';
      if (!editStatus) return 'Please select a template status';
    }
    return null;
  };

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSwitchToEdit = useCallback(() => {
    setCurrentMode('edit');
    onModeChange?.('edit');
  }, [onModeChange]);

  const handleSwitchToView = useCallback(() => {
    setCurrentMode('view');
    onModeChange?.('view');
  }, [onModeChange]);

  const handleDelete = useCallback(async () => {
    if (!templateId) return;
    if (!window.confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
      return;
    }

    try {
      setIsSaving(true);
      await templatesService.deleteTemplate(templateId);
      toast.success('Template deleted successfully');
      onDelete?.(templateId);
      handleClose();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete template');
    } finally {
      setIsSaving(false);
    }
  }, [templateId, onDelete, handleClose]);

  const handleSave = useCallback(async () => {
    const errorMessage = validateBeforeSave();
    if (errorMessage) {
      toast.error(errorMessage);
      return;
    }

    try {
      setIsSaving(true);
      if (currentMode === 'create') {
        const payload: CreateTemplatePayload = {
          name: name.trim(),
          language,
          category,
          components: buildComponents(),
        };

        const created = await templatesService.createTemplate(payload);
        toast.success(`Template "${created.name}" created successfully`);
        onSuccess?.();
        handleClose();
      } else if (currentMode === 'edit') {
        if (!templateId) throw new Error('Missing template id');
        const payload: UpdateTemplatePayload = {
          status: editStatus,
        };
        const updated = await templatesService.updateTemplate(templateId, payload);
        toast.success(`Template "${updated.name}" updated successfully`);
        onSuccess?.();
        setCurrentMode('view');
        onModeChange?.('view');
        refetch();
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  }, [
    currentMode,
    name,
    language,
    category,
    headerType,
    headerText,
    headerMediaUrl,
    bodyText,
    footerEnabled,
    footerText,
    buttonsEnabled,
    buttons,
    editStatus,
    templateId,
    previewVars,
    variableNumbers,
    onSuccess,
    onModeChange,
    handleClose,
    refetch,
  ]);

  // ===== Buttons handlers =====
  const addButton = () => {
    if (buttons.length >= 10) {
      toast.error('Maximum 10 buttons allowed');
      return;
    }
    setButtons((prev) => [
      ...prev,
      { type: 'QUICK_REPLY', text: '' },
    ]);
  };

  const updateButton = (index: number, patch: Partial<ButtonRow>) => {
    setButtons((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const removeButton = (index: number) => {
    setButtons((prev) => prev.filter((_, i) => i !== index));
  };

  // ===== Analytics handlers =====
  const fetchAnalytics = useCallback(async () => {
    if (!templateId) return;

    try {
      setIsLoadingAnalytics(true);
      const data = await templatesService.getTemplateAnalytics(templateId);
      setAnalytics(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch analytics');
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [templateId]);

  // Fetch analytics when switching to analytics tab
  useEffect(() => {
    if (activeTab === 'analytics' && templateId && !analytics) {
      fetchAnalytics();
    }
  }, [activeTab, templateId, analytics, fetchAnalytics]);

  // ===== Send message handlers =====
  const handleSendSingle = async () => {
    if (!template) return;

    if (!phoneNumber.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    const vars = templatesService.extractVariables(
      template.components.find(c => c.type === 'BODY')?.text || ''
    );
    const missingParams = vars.filter(v => !sendParameters[v]);
    if (missingParams.length > 0) {
      toast.error(`Please fill in all required parameters: ${missingParams.join(', ')}`);
      return;
    }

    try {
      setIsSending(true);
      await templatesService.sendTemplate({
        to: phoneNumber.trim(),
        template_name: template.name,
        language: template.language as any,
        parameters: sendParameters
      });
      toast.success(`Template sent to ${phoneNumber}`);
      setPhoneNumber('');
      setSendParameters({});
      setActiveTab('builder');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send template');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendBulk = async () => {
    if (!template) return;

    const validPhones = phoneNumbers.filter(p => p.trim());
    if (validPhones.length === 0) {
      toast.error('Please enter at least one phone number');
      return;
    }

    const vars = templatesService.extractVariables(
      template.components.find(c => c.type === 'BODY')?.text || ''
    );
    const missingParams = vars.filter(v => !bulkParameters[v]);
    if (missingParams.length > 0) {
      toast.error(`Please fill in all required parameters: ${missingParams.join(', ')}`);
      return;
    }

    try {
      setIsSending(true);
      const result = await templatesService.sendTemplateBulk({
        template_name: template.name,
        language: template.language as any,
        recipients: validPhones,
        default_parameters: bulkParameters
      });
      toast.success(`Sent to ${result.sent} recipients (${result.failed} failed)`);
      setPhoneNumbers(['']);
      setBulkParameters({});
      setActiveTab('builder');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send template bulk');
    } finally {
      setIsSending(false);
    }
  };

  const addPhoneNumberField = () => {
    setPhoneNumbers([...phoneNumbers, '']);
  };

  const removePhoneNumberField = (index: number) => {
    setPhoneNumbers(phoneNumbers.filter((_, i) => i !== index));
  };

  const updatePhoneNumber = (index: number, value: string) => {
    const updated = [...phoneNumbers];
    updated[index] = value;
    setPhoneNumbers(updated);
  };

  // ===== Mobile-like preview card =====
  const MobilePreview = ({ 
    header, 
    headerType: hType, 
    body, 
    footer, 
    buttonRows 
  }: { 
    header?: string; 
    headerType?: HeaderType;
    body?: string; 
    footer?: string; 
    buttonRows?: ButtonRow[] 
  }) => {
    return (
      <div className="border rounded-[28px] p-3 sm:p-4 w-full max-w-[300px] sm:max-w-[340px] bg-gradient-to-b from-neutral-900 to-neutral-800 text-white shadow-2xl mx-auto">
        <div className="flex items-center justify-center mb-2 sm:mb-3 pb-2 sm:pb-3 border-b border-neutral-700">
          <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
          <span className="ml-2 text-xs sm:text-sm font-medium text-neutral-200">WhatsApp Preview</span>
        </div>
        
        <div className="bg-neutral-800/50 rounded-2xl p-2 sm:p-3 space-y-2 sm:space-y-3">
          {/* Header */}
          {hType && hType !== 'NONE' && (
            <div className="rounded-xl overflow-hidden bg-neutral-700/30">
              {hType === 'TEXT' && header && (
                <div className="text-xs sm:text-sm font-semibold text-neutral-100 p-2 sm:p-3">{header}</div>
              )}
              {hType === 'IMAGE' && (
                <div className="flex items-center justify-center p-6 sm:p-8 bg-neutral-700/50">
                  <ImageIcon className="h-10 w-10 sm:h-12 sm:w-12 text-neutral-500" />
                  <span className="ml-2 text-xs text-neutral-400">Image</span>
                </div>
              )}
              {hType === 'VIDEO' && (
                <div className="flex items-center justify-center p-6 sm:p-8 bg-neutral-700/50">
                  <Video className="h-10 w-10 sm:h-12 sm:w-12 text-neutral-500" />
                  <span className="ml-2 text-xs text-neutral-400">Video</span>
                </div>
              )}
              {hType === 'DOCUMENT' && (
                <div className="flex items-center justify-center p-6 sm:p-8 bg-neutral-700/50">
                  <File className="h-10 w-10 sm:h-12 sm:w-12 text-neutral-500" />
                  <span className="ml-2 text-xs text-neutral-400">Document</span>
                </div>
              )}
            </div>
          )}
          
          {/* Body */}
          {body && (
            <div className="bg-emerald-600 rounded-2xl p-2 sm:p-3 self-end w-fit max-w-[90%] ml-auto shadow-md">
              <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{body}</div>
              <div className="text-[9px] sm:text-[10px] text-emerald-100 mt-1 text-right">12:34 PM</div>
            </div>
          )}
          
          {/* Footer */}
          {footer && (
            <div className="text-[10px] sm:text-[11px] text-neutral-400 italic px-1">{footer}</div>
          )}
          
          {/* Buttons */}
          {buttonRows && buttonRows.length > 0 && (
            <div className="pt-1 sm:pt-2 space-y-1">
              {buttonRows.map((b, i) => (
                <div
                  key={i}
                  className="w-full text-center text-emerald-400 border border-neutral-600 rounded-lg py-2 sm:py-2.5 text-xs sm:text-sm font-medium hover:bg-neutral-700/30 transition-colors flex items-center justify-center gap-2"
                >
                  {b.type === 'URL' && <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                  {b.text || 'Button'}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ===== Drawer Header =====
  const drawerTitle =
    currentMode === 'create'
      ? 'Create New WhatsApp Template'
      : template?.name || 'Template Details';

  const drawerDescription =
    currentMode === 'create'
      ? 'Design a WhatsApp template with header, body, footer and interactive buttons'
      : template
      ? `Language: ${template.language} • Category: ${template.category} • Status: ${template.status}`
      : undefined;

  const headerActions: DrawerHeaderAction[] =
    currentMode === 'view' && template
      ? [
          {
            icon: Eye,
            onClick: () => setActiveTab('preview'),
            label: 'Preview',
            variant: 'ghost',
          },
          {
            icon: Pencil,
            onClick: handleSwitchToEdit,
            label: 'Edit template',
            variant: 'ghost',
          },
          {
            icon: Trash2,
            onClick: handleDelete,
            label: 'Delete template',
            variant: 'ghost',
          },
        ]
      : [];

  const footerButtons: DrawerActionButton[] =
    currentMode === 'view'
      ? [
          {
            label: 'Close',
            onClick: handleClose,
            variant: 'outline',
          },
        ]
      : currentMode === 'edit'
      ? [
          {
            label: 'Cancel',
            onClick: handleSwitchToView,
            variant: 'outline',
            disabled: isSaving,
          },
          {
            label: 'Save Changes',
            onClick: handleSave,
            variant: 'default',
            loading: isSaving,
          },
        ]
      : [
          {
            label: 'Cancel',
            onClick: handleClose,
            variant: 'outline',
            disabled: isSaving,
          },
          {
            label: 'Create Template',
            onClick: handleSave,
            variant: 'default',
            loading: isSaving,
          },
        ];

  // ===== Create Template Editor =====
  const renderCreateEditor = () => (
    <div className="space-y-8">
      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          While Authentication and Flow templates are supported for sending, you need to create/edit those templates on Meta Business Manager.{' '}
          <a 
            href="https://business.facebook.com/wa/manage/message-templates/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            Manage Templates on Meta <ExternalLink className="h-3 w-3" />
          </a>
        </AlertDescription>
      </Alert>

      {/* Basic Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <Label htmlFor="name">
            Template Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="order_confirmation"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Only lowercase letters, numbers, and underscores
          </p>
        </div>

        <div>
          <Label>
            Language <span className="text-destructive">*</span>
          </Label>
          <Select value={language} onValueChange={(v) => setLanguage(v as TemplateLanguage)}>
            <SelectTrigger>
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TemplateLanguage.ENGLISH}>English</SelectItem>
              <SelectItem value={TemplateLanguage.ENGLISH_US}>English (US)</SelectItem>
              <SelectItem value={TemplateLanguage.ENGLISH_UK}>English (UK)</SelectItem>
              <SelectItem value={TemplateLanguage.HINDI}>Hindi</SelectItem>
              <SelectItem value={TemplateLanguage.SPANISH}>Spanish</SelectItem>
              <SelectItem value={TemplateLanguage.FRENCH}>French</SelectItem>
              <SelectItem value={TemplateLanguage.GERMAN}>German</SelectItem>
              <SelectItem value={TemplateLanguage.PORTUGUESE}>Portuguese (BR)</SelectItem>
              <SelectItem value={TemplateLanguage.ARABIC}>Arabic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>
            Category <span className="text-destructive">*</span>
          </Label>
          <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TemplateCategory.UTILITY}>Utility</SelectItem>
              <SelectItem value={TemplateCategory.MARKETING}>Marketing</SelectItem>
              <SelectItem value={TemplateCategory.AUTHENTICATION}>Authentication</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Template Type Selection */}
      <div className="space-y-3">
        <Label className="text-base">Choose Template Type</Label>
        <RadioGroup 
          value={templateType} 
          onValueChange={(v) => setTemplateType(v as TemplateType)}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="STANDARD" id="standard" />
            <Label htmlFor="standard" className="font-normal cursor-pointer">Standard</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="CAROUSEL" id="carousel" />
            <Label htmlFor="carousel" className="font-normal cursor-pointer">Carousel</Label>
          </div>
        </RadioGroup>
        {templateType === 'CAROUSEL' && (
          <p className="text-sm text-muted-foreground">
            Carousel templates allow you to showcase multiple cards with images and buttons.
          </p>
        )}
      </div>

      <Separator />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Builder Panel */}
        <div className="space-y-6">
          {/* Header Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Header (Optional)</Label>
            </div>
            
            <div>
              <Label className="text-sm">Header Type</Label>
              <Select 
                value={headerType} 
                onValueChange={(v) => {
                  setHeaderType(v as HeaderType);
                  if (v === 'NONE') {
                    setHeaderText('');
                    setHeaderMediaUrl('');
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select header type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  <SelectItem value="TEXT">Text</SelectItem>
                  <SelectItem value="IMAGE">Image</SelectItem>
                  <SelectItem value="VIDEO">Video</SelectItem>
                  <SelectItem value="DOCUMENT">Document</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {headerType === 'TEXT' && (
              <div>
                <Label>Header Text</Label>
                <Input
                  placeholder="Order Confirmation"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground mt-1">Max 60 characters</p>
              </div>
            )}

            {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && (
              <>
                <div>
                  <Label>Media URL</Label>
                  <Input
                    placeholder={`https://example.com/${headerType.toLowerCase()}.${
                      headerType === 'IMAGE' ? 'jpg' : headerType === 'VIDEO' ? 'mp4' : 'pdf'
                    }`}
                    value={headerMediaUrl}
                    onChange={(e) => setHeaderMediaUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    URL to your {headerType.toLowerCase()} file
                  </p>
                </div>
                <div>
                  <Label>Example Handle (Optional)</Label>
                  <Input
                    placeholder="Example media handle"
                    value={headerMediaExample}
                    onChange={(e) => setHeaderMediaExample(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          {/* Body Section */}
          <div className="space-y-3 p-4 border rounded-lg">
            <Label className="text-base font-semibold">
              Body <span className="text-destructive">*</span>
            </Label>
            <Textarea
              rows={6}
              placeholder="Hi {{1}}, your order {{2}} has been confirmed and will be delivered by {{3}}."
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="font-mono text-sm"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Use {'{{1}}'}, {'{{2}}'}, etc. for dynamic variables
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const currentVars = variableNumbers.length;
                  const nextVar = currentVars + 1;
                  setBodyText(prev => prev + ` {{${nextVar}}}`);
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Variable
              </Button>
            </div>
          </div>

          {/* Footer Section */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Footer (Optional)</Label>
              <Switch checked={footerEnabled} onCheckedChange={setFooterEnabled} />
            </div>
            {footerEnabled && (
              <>
                <Input
                  placeholder="Thank you for your order!"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground">
                  Add a short line of text to the bottom of your message template.
                </p>
              </>
            )}
          </div>

          {/* Buttons Section */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Buttons (Optional)</Label>
              <Switch checked={buttonsEnabled} onCheckedChange={setButtonsEnabled} />
            </div>
            
            {buttonsEnabled && (
              <>
                <p className="text-sm text-muted-foreground">
                  Create buttons that let customers respond to your message or take action.
                </p>
                
                <div className="space-y-3">
                  {buttons.map((btn, idx) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-3 bg-background">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Button {idx + 1}</Label>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeButton(idx)}
                          className="h-8 w-8"
                        >
                          <MinusCircle className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <Label className="text-sm">Button Type</Label>
                          <Select
                            value={btn.type}
                            onValueChange={(v) => {
                              if (isValidButtonType(v)) {
                                updateButton(idx, { 
                                  type: v, 
                                  url: undefined, 
                                  phone_number: undefined,
                                  copy_code: undefined 
                                });
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select button type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                              <SelectItem value="URL">URL</SelectItem>
                              <SelectItem value="PHONE_NUMBER">Phone Number</SelectItem>
                              <SelectItem value="COPY_CODE">Copy Code</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-2">
                          <Label className="text-sm">Button Text</Label>
                          <Input
                            placeholder="View Order"
                            value={btn.text}
                            maxLength={25}
                            onChange={(e) => updateButton(idx, { text: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground mt-1">Max 25 characters</p>
                        </div>
                      </div>

                      {btn.type === 'URL' && (
                        <div>
                          <Label className="text-sm">URL</Label>
                          <Input
                            placeholder="https://example.com/order/{{1}}"
                            value={btn.url || ''}
                            onChange={(e) => updateButton(idx, { url: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            You can use {'{{1}}'} for dynamic URLs
                          </p>
                        </div>
                      )}

                      {btn.type === 'PHONE_NUMBER' && (
                        <div>
                          <Label className="text-sm">Phone Number</Label>
                          <Input
                            placeholder="+1234567890"
                            value={btn.phone_number || ''}
                            onChange={(e) => updateButton(idx, { phone_number: e.target.value })}
                          />
                        </div>
                      )}

                      {btn.type === 'COPY_CODE' && (
                        <div>
                          <Label className="text-sm">Coupon Code</Label>
                          <Input
                            placeholder="SAVE20"
                            value={btn.copy_code || ''}
                            onChange={(e) => updateButton(idx, { copy_code: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {buttons.length < 10 && (
                    <Button 
                      variant="outline" 
                      onClick={addButton} 
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Button
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6 sticky top-6 self-start">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Template Preview</Label>
          </div>
          
          {/* Variable inputs for preview */}
          {variableNumbers.length > 0 && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
              <Label className="text-sm font-medium">Preview Variables</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Fill in values to see how your template will look with actual data
              </p>
              <div className="grid grid-cols-1 gap-3">
                {variableNumbers.map((num) => (
                  <div key={num}>
                    <Label className="text-xs">Variable {num}</Label>
                    <Input
                      placeholder={`Value for {{${num}}}`}
                      value={previewVars[num] || ''}
                      onChange={(e) => handleVarChange(num, e.target.value)}
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-center">
            <MobilePreview
              headerType={headerType}
              header={headerType === 'TEXT' ? headerText : undefined}
              body={resolvedPreviewBody || 'Your message body will appear here...'}
              footer={footerEnabled ? footerText : undefined}
              buttonRows={buttonsEnabled ? buttons : []}
            />
          </div>
        </div>
      </div>
    </div>
  );

  // ===== View Template =====
  const renderViewer = () => {
    if (!template) return null;
    const bodyComp = template.components.find((c: any) => c.type === 'BODY');
    const headerComp = template.components.find((c: any) => c.type === 'HEADER');
    const footerComp = template.components.find((c: any) => c.type === 'FOOTER');
    const buttonsComp = template.components.find((c: any) => c.type === 'BUTTONS');

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Details */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Name</Label>
              <div className="mt-1 font-medium break-words">{template.name}</div>
            </div>
            <div>
              <Label>Language</Label>
              <div className="mt-1">{template.language}</div>
            </div>
            <div>
              <Label>Category</Label>
              <div className="mt-1">{template.category}</div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <Label className="text-base font-semibold">Content</Label>
            {headerComp && (
              <div>
                <Label className="text-sm text-muted-foreground">Header ({headerComp.format})</Label>
                <div className="mt-1 p-3 border rounded-md bg-muted/30 break-words">
                  {headerComp.text || 'Media content'}
                </div>
              </div>
            )}
            {bodyComp?.text && (
              <div>
                <Label className="text-sm text-muted-foreground">Body</Label>
                <div className="mt-1 p-3 border rounded-md bg-muted/30 whitespace-pre-wrap font-mono text-xs sm:text-sm break-words">
                  {bodyComp.text}
                </div>
              </div>
            )}
            {footerComp?.text && (
              <div>
                <Label className="text-sm text-muted-foreground">Footer</Label>
                <div className="mt-1 p-3 border rounded-md bg-muted/30 break-words">{footerComp.text}</div>
              </div>
            )}
            {Array.isArray(buttonsComp?.buttons) && buttonsComp.buttons.length > 0 && (
              <div>
                <Label className="text-sm text-muted-foreground">Buttons</Label>
                <div className="mt-2 grid gap-2">
                  {buttonsComp.buttons.map((b: any, i: number) => (
                    <div key={i} className="p-3 rounded-md border bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium break-words">{b.text}</div>
                        <div className="text-xs text-muted-foreground mt-1">{b.type}</div>
                      </div>
                      {b.url && <div className="text-xs text-blue-600 break-all">{b.url}</div>}
                      {b.phone_number && <div className="text-xs text-green-600 break-all">{b.phone_number}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4 flex flex-col items-center lg:items-start">
          <Label className="text-base font-semibold self-start">Mobile Preview</Label>
          <div className="w-full flex justify-center">
            <MobilePreview
              headerType={headerComp?.format as HeaderType}
              header={headerComp?.text}
              body={bodyComp?.text}
              footer={footerComp?.text}
              buttonRows={buttonsComp?.buttons as ButtonRow[] | undefined}
            />
          </div>
        </div>
      </div>
    );
  };

  // ===== Edit Template =====
  const renderEditor = () => {
    if (!template) return null;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Label>Template Name</Label>
            <Input value={template.name} disabled />
            <p className="text-xs text-muted-foreground mt-1">Name cannot be changed after creation</p>
          </div>
          <div>
            <Label>Language</Label>
            <Input value={template.language} disabled />
          </div>
          <div>
            <Label>Category</Label>
            <Input value={template.category} disabled />
          </div>
        </div>

        <div className="max-w-md">
          <Label>Status</Label>
          <Select
            value={editStatus || template.status}
            onValueChange={(v) => setEditStatus(v as TemplateStatus)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TemplateStatus.APPROVED}>Approved</SelectItem>
              <SelectItem value={TemplateStatus.PENDING}>Pending</SelectItem>
              <SelectItem value={TemplateStatus.REJECTED}>Rejected</SelectItem>
              <SelectItem value={TemplateStatus.PAUSED}>Paused</SelectItem>
              <SelectItem value={TemplateStatus.DISABLED}>Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {renderViewer()}
      </div>
    );
  };

  // ===== Analytics Tab Content =====
  const renderAnalyticsTab = () => {
    if (!template) return null;

    return (
      <div className="space-y-6">
        {isLoadingAnalytics && !analytics ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading analytics...</p>
            </div>
          </div>
        ) : analytics ? (
          <>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{analytics.template_name}</h3>
                <Badge variant="secondary">{analytics.status}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">Template ID: {analytics.template_id}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Total Sends</span>
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{analytics.total_sends}</div>
              </div>

              <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-900 dark:text-green-100">Successful</span>
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{analytics.successful_sends}</div>
              </div>

              <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-medium text-red-900 dark:text-red-100">Failed</span>
                </div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{analytics.failed_sends}</div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-purple-900 dark:text-purple-100">Success Rate</span>
                </div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{analytics.success_rate.toFixed(1)}%</div>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Usage Count</span>
                </div>
                <span className="text-lg font-semibold">{analytics.usage_count}</span>
              </div>
            </div>

            {analytics.last_used_at && (
              <div className="text-sm text-muted-foreground">
                Last used: {new Date(analytics.last_used_at).toLocaleString()}
              </div>
            )}

            {analytics.total_sends === 0 && (
              <div className="bg-muted/30 rounded-lg p-8 text-center">
                <Send className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-sm font-semibold mb-2">No sends yet</h3>
                <p className="text-sm text-muted-foreground">This template hasn't been used to send any messages yet.</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Button onClick={fetchAnalytics} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Load Analytics
            </Button>
          </div>
        )}
      </div>
    );
  };

  // ===== Send Message Tab Content =====
  const renderSendTab = () => {
    if (!template) return null;

    const extractedVars = templatesService.extractVariables(
      template.components.find(c => c.type === 'BODY')?.text || ''
    );

    const getBodyPreview = () => {
      const bodyComponent = template.components.find(c => c.type === 'BODY');
      if (!bodyComponent?.text) return '';
      const params = sendMode === 'single' ? sendParameters : bulkParameters;
      return templatesService.replaceVariables(bodyComponent.text, params);
    };

    return (
      <div className="space-y-6">
        <Tabs value={sendMode} onValueChange={(v) => setSendMode(v as 'single' | 'bulk')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">
              <UserPlus className="h-4 w-4 mr-2" />
              Single Recipient
            </TabsTrigger>
            <TabsTrigger value="bulk">
              <Users className="h-4 w-4 mr-2" />
              Bulk Send
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                placeholder="e.g., 919876543210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={isSending}
              />
              <p className="text-xs text-muted-foreground">
                Enter phone number with country code
              </p>
            </div>

            {extractedVars.length > 0 && (
              <div className="space-y-3">
                <Label>Template Variables</Label>
                {extractedVars.map((variable) => (
                  <div key={variable} className="space-y-1">
                    <Label htmlFor={`param-${variable}`} className="text-sm">
                      Variable {variable} *
                    </Label>
                    <Input
                      id={`param-${variable}`}
                      placeholder={`Value for {{${variable}}}`}
                      value={sendParameters[variable] || ''}
                      onChange={(e) => setSendParameters({ ...sendParameters, [variable]: e.target.value })}
                      disabled={isSending}
                    />
                  </div>
                ))}
              </div>
            )}

            {extractedVars.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <Label className="text-sm font-medium">Preview</Label>
                <p className="text-sm whitespace-pre-wrap">
                  {getBodyPreview() || 'Fill in the variables to see preview'}
                </p>
              </div>
            )}

            <Button onClick={handleSendSingle} disabled={isSending} className="w-full">
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Phone Numbers *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPhoneNumberField}
                  disabled={isSending}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Number
                </Button>
              </div>

              {phoneNumbers.map((phone, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`Phone ${index + 1} (e.g., 919876543210)`}
                    value={phone}
                    onChange={(e) => updatePhoneNumber(index, e.target.value)}
                    disabled={isSending}
                  />
                  {phoneNumbers.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePhoneNumberField(index)}
                      disabled={isSending}
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {extractedVars.length > 0 && (
              <div className="space-y-3">
                <Label>Template Variables (same for all recipients)</Label>
                {extractedVars.map((variable) => (
                  <div key={variable} className="space-y-1">
                    <Label htmlFor={`bulk-param-${variable}`} className="text-sm">
                      Variable {variable} *
                    </Label>
                    <Input
                      id={`bulk-param-${variable}`}
                      placeholder={`Value for {{${variable}}}`}
                      value={bulkParameters[variable] || ''}
                      onChange={(e) => setBulkParameters({ ...bulkParameters, [variable]: e.target.value })}
                      disabled={isSending}
                    />
                  </div>
                ))}
              </div>
            )}

            {extractedVars.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <Label className="text-sm font-medium">Preview</Label>
                <p className="text-sm whitespace-pre-wrap">
                  {getBodyPreview() || 'Fill in the variables to see preview'}
                </p>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Recipients:</strong> {phoneNumbers.filter(p => p.trim()).length}
              </p>
            </div>

            <Button onClick={handleSendBulk} disabled={isSending} className="w-full">
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send to {phoneNumbers.filter(p => p.trim()).length} Recipients
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  // ===== Main Content =====
  const drawerContent = (
    <div className="space-y-4 sm:space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full h-10 sm:h-11 ${currentMode === 'create' ? 'grid-cols-2' : 'grid-cols-4'}`}>
          <TabsTrigger value="builder" className="text-xs sm:text-sm">
            {currentMode === 'create' ? 'Builder' : currentMode === 'edit' ? 'Edit' : 'Details'}
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-xs sm:text-sm">Preview</TabsTrigger>
          {currentMode !== 'create' && (
            <>
              <TabsTrigger value="analytics" className="text-xs sm:text-sm">
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="send" className="text-xs sm:text-sm" disabled={template?.status !== TemplateStatus.APPROVED}>
                <Send className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Send
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="builder" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
          {currentMode === 'create' ? renderCreateEditor() : currentMode === 'edit' ? renderEditor() : renderViewer()}
        </TabsContent>

        <TabsContent value="preview" className="mt-4 sm:mt-6 flex justify-center px-2 sm:px-0">
          {currentMode === 'create' ? (
            <MobilePreview
              headerType={headerType}
              header={headerType === 'TEXT' ? headerText : undefined}
              body={resolvedPreviewBody || 'Your message will appear here'}
              footer={footerEnabled ? footerText : undefined}
              buttonRows={buttonsEnabled ? buttons : []}
            />
          ) : template ? (
            <div className="space-y-4 flex flex-col items-center w-full">
              <Label className="text-base font-semibold self-start">Mobile Preview</Label>
              <MobilePreview
                headerType={template.components.find((c: any) => c.type === 'HEADER')?.format as HeaderType}
                header={template.components.find((c: any) => c.type === 'HEADER')?.text}
                body={template.components.find((c: any) => c.type === 'BODY')?.text}
                footer={template.components.find((c: any) => c.type === 'FOOTER')?.text}
                buttonRows={template.components.find((c: any) => c.type === 'BUTTONS')?.buttons as ButtonRow[] | undefined}
              />
            </div>
          ) : null}
        </TabsContent>

        {currentMode !== 'create' && (
          <>
            <TabsContent value="analytics" className="mt-4 sm:mt-6">
              {renderAnalyticsTab()}
            </TabsContent>

            <TabsContent value="send" className="mt-4 sm:mt-6">
              {renderSendTab()}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={drawerTitle}
      description={drawerDescription}
      mode={currentMode}
      headerActions={headerActions}
      isLoading={isLoading}
      loadingText="Loading template data..."
      size="xl"
      footerButtons={footerButtons}
      footerAlignment="right"
      showBackButton={true}
      resizable={true}
      storageKey="template-drawer-width"
      onClose={handleClose}
    >
      {drawerContent}
    </SideDrawer>
  );
}