// src/components/crm/LeadWhatsAppDrawer.tsx
// WhatsApp drawer on Lead detail page — full-height chat UI
// Data: adapter APIs via whatsAppCrmService (NOT the direct whatsappapi.celiyo.com hooks)
// UI:   mirrors the WhatsApp module's ChatWindow style
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';

import {
  Loader2, Zap, Plus, X, CheckCircle2, Clock, PauseCircle,
  PanelRightOpen, PanelRightClose, MoreVertical, Info, Trash2,
  Phone, Send, Smile, Paperclip, Mic, Check, CheckCheck,
  XCircle, Hash, ImageIcon, Video, FileText,
  Music, MapPin, User, Camera,
} from 'lucide-react';

import { SideDrawer } from '@/components/SideDrawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// Media components re-used from the WhatsApp module
import MediaWithAuth from '@/components/MediaWithAuth';
import VoiceMessagePlayer from '@/components/VoiceMessagePlayer';
import DocumentWithAuth from '@/components/DocumentWithAuth';
import { getMediaUrl } from '@/services/whatsapp';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

import {
  whatsAppCrmService,
  type ChatMessage,
  type WhatsAppTemplate,
  type TemplateComponent,
  type LeadSequenceEnrollment,
  type EnrollmentStatus,
} from '@/services/whatsappCrmService';

// ─── WhatsApp SVG icon ───────────────────────────────────────────────────────

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ─── 24h window hook (uses adapter chat API) ─────────────────────────────────

export function useLeadWhatsAppWindow(leadId: number | null, enabled = true) {
  const { data, isLoading } = useSWR(
    enabled && leadId ? `/whatsapp/leads/${leadId}/chat/window` : null,
    () => whatsAppCrmService.getLeadChat(leadId!, 1),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const messages = data?.messages ?? [];
  const lastInbound = [...messages]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .find(m => m.direction === 'inbound');

  const windowOpen = lastInbound
    ? new Date(lastInbound.timestamp).getTime() > Date.now() - 24 * 3600 * 1000
    : false;

  const expiresAt = lastInbound && windowOpen
    ? new Date(new Date(lastInbound.timestamp).getTime() + 24 * 3600 * 1000)
    : null;

  return { windowOpen, expiresAt, isLoading: isLoading && !data };
}

// ─── Message helpers ──────────────────────────────────────────────────────────

const getStatusIcon = (status?: string) => {
  switch (status) {
    case 'sent':      return <Check className="h-3 w-3" />;
    case 'delivered': return <CheckCheck className="h-3 w-3" />;
    case 'read':      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    case 'failed':    return <XCircle className="h-3 w-3 text-red-500" />;
    default:          return <Check className="h-3 w-3 opacity-50" />;
  }
};

const getDateLabel = (date: Date): string => {
  if (isToday(date))     return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
};

const formatMsgTime = (date: Date) => {
  const h = date.getHours(), m = date.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${m} ${ampm}`;
};

// ─── Parse message field (adapter returns JSON string or plain text) ──────────

function parseMessage(msg: ChatMessage): {
  text: string | null;
  isTemplate: boolean;
  templateName: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  caption: string | null;
} {
  // The adapter stores `message` as a JSON string: {"type":"text","text":"..."} or {"type":"template",...}
  let parsed: any = null;
  try {
    if (typeof msg.message === 'string' && msg.message.startsWith('{')) {
      parsed = JSON.parse(msg.message);
    }
  } catch { /* not JSON, treat as plain text */ }

  const meta = msg.meta ?? {};

  // Template message
  const isTemplate = parsed?.type === 'template'
    || !!meta.template_proforma
    || !!meta.template_components;

  const templateName = meta.template_proforma?.name
    || parsed?.template
    || null;

  const templateBodyText = (() => {
    const comps = meta.template_proforma?.components || meta.template_components || [];
    const body = comps.find((c: any) => c.type === 'BODY' || c.type === 'body');
    return body?.text || null;
  })();

  // Media (stored in meta or parsed JSON)
  const mediaType = parsed?.media_type || parsed?.type === 'image' || parsed?.type === 'video'
    || parsed?.type === 'audio' || parsed?.type === 'document'
    ? (parsed?.type !== 'text' && parsed?.type !== 'template' ? parsed?.type : null)
    : null;

  const mediaUrl = parsed?.url || parsed?.media_url || null;
  const caption = parsed?.caption || null;

  // Plain text
  const text = isTemplate
    ? (templateBodyText || `[Template: ${templateName || 'unknown'}]`)
    : parsed?.text || (typeof msg.message === 'string' && !msg.message.startsWith('{') ? msg.message : null);

  return { text, isTemplate, templateName, mediaType, mediaUrl, caption };
}

// ─── Single message bubble ────────────────────────────────────────────────────

function MsgBubble({ msg }: { msg: ChatMessage }) {
  const isOut = msg.direction === 'outbound';
  const { text, isTemplate, templateName, mediaType, mediaUrl, caption } = parseMessage(msg);

  const bubbleCls = cn(
    'relative max-w-[80%] rounded-2xl shadow-sm text-[14px]',
    isOut
      ? 'bg-[#dcf8c6] text-gray-800 rounded-tr-sm ml-auto'
      : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
  );

  return (
    <div className={cn('flex mb-1', isOut ? 'justify-end' : 'justify-start')}>
      <div className={bubbleCls}>
        {/* Template badge */}
        {isTemplate && templateName && (
          <div className={cn(
            'text-[10px] font-medium px-2.5 pt-2 pb-0.5 inline-block w-full',
            isOut ? 'text-green-700' : 'text-blue-600'
          )}>
            📋 {templateName}
          </div>
        )}

        {/* Audio */}
        {mediaType === 'audio' && mediaUrl && (
          <div className="px-3 pt-2 pb-1">
            <VoiceMessagePlayer src={getMediaUrl(mediaUrl)} isOutgoing={isOut} />
          </div>
        )}

        {/* Image / video */}
        {(mediaType === 'image' || mediaType === 'video') && mediaUrl && (
          <div className="overflow-hidden rounded-xl m-1">
            <MediaWithAuth
              src={getMediaUrl(mediaUrl)}
              alt={caption || 'media'}
              type={mediaType as 'image' | 'video'}
              className="max-w-[240px] rounded-xl"
            />
          </div>
        )}

        {/* Document */}
        {mediaType === 'document' && mediaUrl && (
          <div className="px-3 pt-2 pb-1">
            <DocumentWithAuth src={getMediaUrl(mediaUrl)} filename={caption || 'document'} />
          </div>
        )}

        {/* Text / caption */}
        {(text || caption) && (
          <p className={cn(
            'leading-snug whitespace-pre-wrap break-words px-3',
            isTemplate ? 'pb-1 pt-1' : 'pt-2.5 pb-1',
          )}>
            {caption || text}
          </p>
        )}

        {/* Timestamp + status */}
        <div className={cn(
          'flex items-center gap-1 px-3 pb-1.5 justify-end text-[11px]',
          isOut ? 'text-green-700/60' : 'text-gray-400'
        )}>
          <span>{formatMsgTime(new Date(msg.timestamp))}</span>
          {isOut && getStatusIcon(msg.status)}
        </div>
      </div>
    </div>
  );
}

// ─── Attachment options ───────────────────────────────────────────────────────

type AttachmentType = 'image' | 'video' | 'document' | 'audio' | 'camera' | 'contact' | 'location';

const ATTACHMENT_OPTIONS = [
  { type: 'image'    as AttachmentType, label: 'Photos',   icon: ImageIcon, accept: 'image/*',  color: 'from-pink-500 to-rose-600' },
  { type: 'video'    as AttachmentType, label: 'Videos',   icon: Video,     accept: 'video/*',  color: 'from-purple-500 to-indigo-600' },
  { type: 'document' as AttachmentType, label: 'Document', icon: FileText,  accept: '.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx', color: 'from-blue-500 to-cyan-600' },
  { type: 'audio'    as AttachmentType, label: 'Audio',    icon: Music,     accept: 'audio/*',  color: 'from-orange-500 to-amber-600' },
  { type: 'camera'   as AttachmentType, label: 'Camera',   icon: Camera,    accept: 'image/*',  color: 'from-red-500 to-pink-600' },
  { type: 'contact'  as AttachmentType, label: 'Contact',  icon: User,      accept: '',         color: 'from-green-500 to-emerald-600' },
  { type: 'location' as AttachmentType, label: 'Location', icon: MapPin,    accept: '',         color: 'from-teal-500 to-cyan-600' },
];

// ─── useChatMessages — adapter-backed message list for a lead ─────────────────

function useChatMessages(leadId: number, enabled: boolean) {
  const [page, setPage] = useState(1);
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data, isLoading, mutate } = useSWR(
    enabled ? `/whatsapp/leads/${leadId}/chat/?page=${page}` : null,
    () => whatsAppCrmService.getLeadChat(leadId, page),
    { revalidateOnFocus: false, dedupingInterval: 5_000 }
  );

  // Merge pages: newest page returns newest messages (desc order from adapter)
  // We keep a flat map by id to avoid duplicates
  useEffect(() => {
    if (!data) return;
    setTotal(data.total);
    setAllMessages(prev => {
      // Drop any optimistic placeholders — the real server messages replace them
      const withoutOptimistic = prev.filter(m => !m.id.startsWith('opt-'));
      const byId = new Map(withoutOptimistic.map(m => [m.id, m]));
      for (const m of data.messages) byId.set(m.id, m);
      return Array.from(byId.values());
    });
  }, [data]);

  // Sort oldest→newest for display
  const messages = useMemo(() =>
    [...allMessages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [allMessages]
  );

  const hasMore = allMessages.length < total;

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    setPage(p => p + 1);
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore]);

  // Optimistically append a sent message so the UI updates immediately
  const appendOptimistic = useCallback((msg: ChatMessage) => {
    setAllMessages(prev => {
      const byId = new Map(prev.map(m => [m.id, m]));
      byId.set(msg.id, msg);
      return Array.from(byId.values());
    });
  }, []);

  // Refresh after send
  const refresh = useCallback(() => { mutate(); }, [mutate]);

  return { messages, isLoading: isLoading && allMessages.length === 0, hasMore, loadMore, appendOptimistic, refresh };
}

// ─── useLeadTemplates — fetch templates via CRM service ──────────────────────

function useLeadTemplates() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (templates.length > 0 || isLoading) return;
    setIsLoading(true);
    try {
      const list = await whatsAppCrmService.getTemplates();
      setTemplates(list.filter(t => t.status?.toUpperCase() === 'APPROVED'));
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  }, [templates.length, isLoading]);

  return { templates, isLoadingTemplates: isLoading, fetchTemplates: fetch };
}

// ─── Chat Tab ────────────────────────────────────────────────────────────────

interface ChatTabProps {
  leadId: number;
  leadName?: string;
  leadPhone?: string;
}

function ChatTab({ leadId, leadName, leadPhone }: ChatTabProps) {

  // ── Data via adapter APIs ──────────────────────────────────────────
  const { messages, isLoading, hasMore, loadMore, appendOptimistic, refresh } =
    useChatMessages(leadId, !!leadPhone);

  const { templates, isLoadingTemplates, fetchTemplates } = useLeadTemplates();

  // ── 24h window ─────────────────────────────────────────────────────
  const { windowOpen, expiresAt } = useLeadWhatsAppWindow(leadId, !!leadPhone);

  // ── Reply bar state ────────────────────────────────────────────────
  const [input, setInput]                             = useState('');
  const [isSending, setIsSending]                     = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen]     = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);

  // Template slash state
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery]   = useState('');
  const [selectedTemplate, setSelectedTemplate]         = useState<WhatsAppTemplate | null>(null);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [templateVariables, setTemplateVariables]       = useState<Record<string, string>>({});

  // File state
  const [selectedFiles, setSelectedFiles]       = useState<File[]>([]);
  const [selectedFileType, setSelectedFileType] = useState<AttachmentType | null>(null);
  const [isFilePreviewOpen, setIsFilePreviewOpen] = useState(false);
  const [fileCaption, setFileCaption]           = useState('');

  // Voice recording state
  const [isRecording, setIsRecording]           = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Contact / location
  const [isContactDialogOpen, setIsContactDialogOpen]   = useState(false);
  const [contactName, setContactName]                   = useState('');
  const [contactPhone, setContactPhone]                 = useState('');
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [currentLocation, setCurrentLocation]           = useState<{lat:number;lng:number}|null>(null);
  const [locationLoading, setLocationLoading]           = useState(false);

  const inputRef             = useRef<HTMLInputElement>(null);
  const templateDropdownRef  = useRef<HTMLDivElement>(null);
  const messagesEndRef       = useRef<HTMLDivElement>(null);
  const fileInputRefs        = useRef<Record<string, HTMLInputElement | null>>({});

  // Auto-scroll to newest
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Close template dropdown on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (showTemplateDropdown
        && templateDropdownRef.current
        && !templateDropdownRef.current.contains(e.target as Node)
        && inputRef.current
        && !inputRef.current.contains(e.target as Node)
      ) setShowTemplateDropdown(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showTemplateDropdown]);

  // ── Handlers ───────────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    if (value === '/' || value.endsWith(' /')) {
      setShowTemplateDropdown(true);
      setTemplateSearchQuery('');
      fetchTemplates();
    } else if (showTemplateDropdown) {
      const idx = value.lastIndexOf('/');
      if (idx !== -1) setTemplateSearchQuery(value.substring(idx + 1));
      else setShowTemplateDropdown(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    if (!templateSearchQuery) return templates;
    const q = templateSearchQuery.toLowerCase();
    return templates.filter(t => t.name.toLowerCase().includes(q));
  }, [templates, templateSearchQuery]);

  const extractVars = (t: WhatsAppTemplate) => {
    const body = t.components?.find(c => c.type === 'BODY');
    const matches = body?.text?.match(/\{\{(\d+)\}\}/g) ?? [];
    return [...new Set(matches)];
  };

  const handleTemplateSelect = (t: WhatsAppTemplate) => {
    setSelectedTemplate(t);
    setShowTemplateDropdown(false);
    setInput('');
    const vars = extractVars(t);
    const init: Record<string, string> = {};
    vars.forEach(v => { init[v] = ''; });
    setTemplateVariables(init);
    setIsTemplateDialogOpen(true);
  };

  // Send template via adapter POST /leads/{id}/send/
  const handleSendTemplate = async () => {
    if (!selectedTemplate) return;
    setIsSending(true);
    try {
      // Build template_components with variable values filled in
      const components: TemplateComponent[] = (selectedTemplate.components || []).map(comp => {
        if (comp.type === 'BODY' && comp.text) {
          // Replace {{N}} with user-supplied values
          const params: { type: string; text: string }[] = [];
          comp.text.replace(/\{\{(\d+)\}\}/g, (_match, n) => {
            params.push({ type: 'text', text: templateVariables[`{{${n}}}`] || '' });
            return '';
          });
          return { ...comp, parameters: params };
        }
        return comp;
      });

      await whatsAppCrmService.sendLeadMessage(leadId, {
        template_uid: selectedTemplate.uid,
        template_components: components,
      });

      // Optimistic message
      appendOptimistic({
        id: `opt-${Date.now()}`,
        phone: leadPhone || '',
        direction: 'outbound',
        status: 'sent',
        message: JSON.stringify({ type: 'template', template: selectedTemplate.name }),
        timestamp: new Date().toISOString(),
        meta: {
          template_proforma: {
            name: selectedTemplate.name,
            components: selectedTemplate.components,
          },
        },
      });

      setIsTemplateDialogOpen(false);
      setSelectedTemplate(null);
      setTemplateVariables({});
      setTimeout(refresh, 2000); // refresh to get server-assigned id
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to send template');
    } finally { setIsSending(false); }
  };

  // Send plain text via adapter POST /leads/{id}/send_text/
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;
    setInput('');
    setIsSending(true);

    // Optimistic
    const optId = `opt-${Date.now()}`;
    appendOptimistic({
      id: optId,
      phone: leadPhone || '',
      direction: 'outbound',
      status: 'sent',
      message: JSON.stringify({ type: 'text', text }),
      timestamp: new Date().toISOString(),
    });

    try {
      await whatsAppCrmService.sendLeadTextMessage(leadId, text);
      setTimeout(refresh, 2000);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to send message');
      // Remove optimistic on failure
      setInput(text);
    } finally { setIsSending(false); }
  };

  const handleEmojiSelect = (emoji: any) => {
    setInput(p => p + emoji.native);
    setIsEmojiPickerOpen(false);
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        toast.info('Voice messages not yet supported via adapter — use the WhatsApp inbox');
        setIsRecording(false);
        setRecordingSeconds(0);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch { toast.error('Microphone access denied'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  const handleAttachmentClick = (type: AttachmentType) => {
    setIsAttachmentMenuOpen(false);
    if (type === 'contact') { setIsContactDialogOpen(true); return; }
    if (type === 'location') { setIsLocationDialogOpen(true); return; }
    fileInputRefs.current[type]?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: AttachmentType) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSelectedFiles(files);
    setSelectedFileType(type);
    setFileCaption('');
    setIsFilePreviewOpen(true);
    e.target.value = '';
  };

  const handleSendFile = async () => {
    // Media send via adapter not yet implemented — show helpful message
    toast.info('Media send via Lead drawer coming soon — use the WhatsApp inbox for now');
    setIsFilePreviewOpen(false);
    setSelectedFiles([]);
    setSelectedFileType(null);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocationLoading(false); },
      () => { toast.error('Could not get location'); setLocationLoading(false); }
    );
  };

  const handleSendLocation = async () => {
    if (!currentLocation || isSending) return;
    const text = `📍 Location: https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lng}`;
    setIsSending(true);
    try {
      await whatsAppCrmService.sendLeadTextMessage(leadId, text);
      appendOptimistic({
        id: `opt-${Date.now()}`, phone: leadPhone || '',
        direction: 'outbound', status: 'sent',
        message: JSON.stringify({ type: 'text', text }),
        timestamp: new Date().toISOString(),
      });
      setIsLocationDialogOpen(false);
      setCurrentLocation(null);
    } catch { toast.error('Failed to send location'); }
    finally { setIsSending(false); }
  };

  const handleSendContact = async () => {
    if (!contactName.trim() || !contactPhone.trim() || isSending) return;
    const text = `👤 Contact:\nName: ${contactName}\nPhone: ${contactPhone}`;
    setIsSending(true);
    try {
      await whatsAppCrmService.sendLeadTextMessage(leadId, text);
      appendOptimistic({
        id: `opt-${Date.now()}`, phone: leadPhone || '',
        direction: 'outbound', status: 'sent',
        message: JSON.stringify({ type: 'text', text }),
        timestamp: new Date().toISOString(),
      });
      setIsContactDialogOpen(false);
      setContactName(''); setContactPhone('');
    } catch { toast.error('Failed to send contact'); }
    finally { setIsSending(false); }
  };

  // ── Template preview ───────────────────────────────────────────────
  const getTemplatePreview = () => {
    if (!selectedTemplate) return '';
    const body = selectedTemplate.components?.find(c => c.type === 'BODY');
    if (!body?.text) return '';
    let text = body.text;
    Object.entries(templateVariables).forEach(([k, v]) => { text = text.replace(k, v || k); });
    return text;
  };

  // ── No phone guard ─────────────────────────────────────────────────
  if (!leadPhone) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-3">
          <WhatsAppIcon className="h-7 w-7 text-green-500" />
        </div>
        <p className="text-sm font-medium text-gray-600">No phone number</p>
        <p className="text-xs text-gray-400 mt-1">Add a phone number to this lead to chat</p>
      </div>
    );
  }

  // Group by date for separators
  const grouped = messages.map((msg, i) => ({
    showSeparator: i === 0 || !isSameDay(new Date(msg.timestamp), new Date(messages[i - 1].timestamp)),
    msg,
  }));

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* 24h window banner */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-1.5 text-xs border-b flex-shrink-0',
        windowOpen
          ? 'bg-green-50 border-green-200/80 text-green-700'
          : 'bg-amber-50 border-amber-200/80 text-amber-700'
      )}>
        <span className={cn(
          'w-1.5 h-1.5 rounded-full flex-shrink-0',
          windowOpen ? 'bg-green-500 animate-pulse' : 'bg-amber-500'
        )} />
        {windowOpen ? (
          <>
            <strong>24h window open</strong>
            {expiresAt && <span className="opacity-70">· expires {format(expiresAt, 'h:mm a, MMM d')}</span>}
          </>
        ) : (
          <>
            <strong>Window closed</strong>
            <span className="opacity-70">· use / to send a template</span>
          </>
        )}
      </div>

      {/* Message area */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-0.5 min-h-0"
        style={{
          backgroundImage: `url('https://hms.thedigitechsolutions.com/imgs/wa-message-bg-faded.png')`,
          backgroundSize: 'cover',
          backgroundRepeat: 'repeat',
          backgroundColor: '#e5ddd5',
        }}
      >
        {hasMore && (
          <div className="flex justify-center pb-2">
            <button type="button"
              className="text-xs text-green-700 bg-white/80 px-3 py-1 rounded-full shadow-sm hover:bg-white transition-colors"
              onClick={loadMore}
            >
              Load earlier messages
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-green-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-3">
              <WhatsAppIcon className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-sm font-medium text-gray-600">No messages yet</p>
            <p className="text-xs text-gray-400 mt-1">
              {windowOpen ? 'Type a message below to start' : 'Use / to send a template message'}
            </p>
          </div>
        ) : (
          <>
            {grouped.map(({ showSeparator, msg }, i) => (
              <React.Fragment key={msg.id ?? i}>
                {showSeparator && (
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-gray-300/50" />
                    <span className="text-[11px] text-gray-500 font-medium px-2.5 py-1 bg-white/70 rounded-full shadow-sm">
                      {getDateLabel(new Date(msg.timestamp))}
                    </span>
                    <div className="flex-1 h-px bg-gray-300/50" />
                  </div>
                )}
                <MsgBubble msg={msg} />
              </React.Fragment>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Reply bar */}
      <div className="flex-shrink-0 bg-[#f0f2f5] border-t border-gray-200">
        {isRecording && (
          <div className="flex items-center gap-3 mx-3 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span className="text-sm font-medium text-red-600 flex-1">
              Recording… {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}
            </span>
            <button type="button" onClick={cancelRecording}
              className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-0.5 rounded hover:bg-red-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-end gap-2 px-3 py-2.5">
          {/* Attachment */}
          <Popover open={isAttachmentMenuOpen} onOpenChange={setIsAttachmentMenuOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon"
                className="h-10 w-10 shrink-0 rounded-full hover:bg-gray-200 text-gray-500"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start" side="top" sideOffset={8}>
              <div className="grid grid-cols-3 gap-3">
                {ATTACHMENT_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button key={opt.type} type="button"
                      onClick={() => handleAttachmentClick(opt.type)}
                      className="flex flex-col items-center gap-1.5 group"
                    >
                      <div className={cn(
                        'w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center shadow transition-transform group-hover:scale-110',
                        opt.color
                      )}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <span className="text-[11px] text-muted-foreground group-hover:text-foreground">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* Input */}
          <div className="flex-1 relative flex items-center bg-white rounded-full border border-gray-200 min-h-[42px] shadow-sm">
            {/* Template slash dropdown */}
            {showTemplateDropdown && (
              <div ref={templateDropdownRef}
                className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-xl shadow-xl max-h-56 overflow-y-auto z-50"
              >
                {isLoadingTemplates ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading templates…</span>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-4">No templates found</p>
                ) : (
                  <div className="py-1">
                    <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground border-b border-border uppercase tracking-wide">
                      Templates · type to filter
                    </div>
                    {filteredTemplates.map(t => (
                      <button key={t.uid} type="button"
                        className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-accent transition-colors"
                        onClick={() => handleTemplateSelect(t)}
                      >
                        <Hash className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{t.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {t.components?.find(c => c.type === 'BODY')?.text?.substring(0, 55)}…
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Input
              ref={inputRef}
              placeholder={windowOpen ? 'Type a message or / for templates…' : '/ for templates (window closed)'}
              className="flex-1 bg-transparent border-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 px-4 py-2.5 h-auto placeholder:text-gray-400"
              value={input}
              onChange={handleInputChange}
              onKeyDown={e => {
                if (e.key === 'Escape' && showTemplateDropdown) {
                  setShowTemplateDropdown(false);
                  setInput('');
                }
              }}
            />

            {/* Emoji picker */}
            <Popover open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="icon"
                  className="shrink-0 rounded-full mr-1 h-8 w-8 hover:bg-gray-100 text-gray-400"
                >
                  <Smile className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 border-0 bg-transparent shadow-2xl" align="end" side="top" sideOffset={8}>
                <Picker data={data} onEmojiSelect={handleEmojiSelect}
                  theme="light" previewPosition="none" skinTonePosition="none"
                  searchPosition="top" perLine={8} maxFrequentRows={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Send / Mic / Stop */}
          {isRecording ? (
            <Button type="button" size="icon"
              className="shrink-0 rounded-full h-11 w-11 bg-red-500 hover:bg-red-600 text-white shadow-md animate-pulse"
              onClick={stopRecording}
            >
              <Send className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              type={input.trim() ? 'submit' : 'button'}
              size="icon"
              disabled={isSending}
              className={cn(
                'shrink-0 rounded-full h-11 w-11 shadow-md transition-all',
                'bg-[#25d366] hover:bg-[#1da851] text-white'
              )}
              onClick={!input.trim() ? startRecording : undefined}
            >
              {isSending
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : input.trim() ? <Send className="h-5 w-5" /> : <Mic className="h-5 w-5" />
              }
            </Button>
          )}
        </form>
      </div>

      {/* Hidden file inputs */}
      {ATTACHMENT_OPTIONS.filter(o => o.accept).map(opt => (
        <input key={opt.type} type="file"
          ref={el => { fileInputRefs.current[opt.type] = el; }}
          accept={opt.accept} className="hidden"
          multiple={opt.type === 'image' || opt.type === 'video'}
          capture={opt.type === 'camera' ? 'environment' : undefined}
          onChange={e => handleFileChange(e, opt.type)}
        />
      ))}

      {/* File preview dialog */}
      <Dialog open={isFilePreviewOpen} onOpenChange={setIsFilePreviewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Send {selectedFileType}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {selectedFiles[0] && selectedFileType === 'image' && (
              <img src={URL.createObjectURL(selectedFiles[0])} alt="preview"
                className="w-full max-h-48 object-contain rounded-lg border" />
            )}
            <p className="text-sm text-muted-foreground">{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected</p>
            <Input placeholder="Caption (optional)…" value={fileCaption} onChange={e => setFileCaption(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFilePreviewOpen(false)}>Cancel</Button>
            <Button onClick={handleSendFile} className="bg-[#25d366] hover:bg-[#1da851] text-white">
              <Send className="h-4 w-4 mr-1.5" /> Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template variables dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">📋 {selectedTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {getTemplatePreview() && (
              <div className="bg-[#dcf8c6] rounded-xl px-3 py-2.5 text-sm text-gray-800 leading-snug">
                {getTemplatePreview()}
              </div>
            )}
            {Object.keys(templateVariables).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fill variables</p>
                {Object.keys(templateVariables).map(varKey => (
                  <div key={varKey} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-10 shrink-0">{varKey}</span>
                    <Input className="h-8 text-sm" placeholder={`Value for ${varKey}…`}
                      value={templateVariables[varKey]}
                      onChange={e => setTemplateVariables(p => ({ ...p, [varKey]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendTemplate} disabled={isSending}
              className="bg-[#25d366] hover:bg-[#1da851] text-white"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
              Send Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location dialog */}
      <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Share Location</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {currentLocation ? (
              <p className="text-sm text-muted-foreground">
                📍 {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
              </p>
            ) : (
              <Button variant="outline" className="w-full" onClick={handleGetLocation} disabled={locationLoading}>
                {locationLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
                Get my location
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsLocationDialogOpen(false); setCurrentLocation(null); }}>Cancel</Button>
            <Button onClick={handleSendLocation} disabled={!currentLocation || isSending}
              className="bg-[#25d366] hover:bg-[#1da851] text-white"
            >Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact dialog */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Share Contact</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name…" value={contactName} onChange={e => setContactName(e.target.value)} />
            <Input placeholder="Phone…" value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsContactDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendContact} disabled={!contactName.trim() || !contactPhone.trim() || isSending}
              className="bg-[#25d366] hover:bg-[#1da851] text-white"
            >Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sequences Tab ────────────────────────────────────────────────────────────

const ENROLLMENT_STATUS_ICONS: Record<EnrollmentStatus, React.ReactNode> = {
  ACTIVE:    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  PAUSED:    <PauseCircle  className="h-3.5 w-3.5 text-yellow-500" />,
  COMPLETED: <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />,
  OPTED_OUT: <X            className="h-3.5 w-3.5 text-muted-foreground" />,
  REPLIED:   <WhatsAppIcon className="h-3.5 w-3.5 text-purple-500" />,
};

const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  ACTIVE: 'Active', PAUSED: 'Paused', COMPLETED: 'Completed',
  OPTED_OUT: 'Opted Out', REPLIED: 'Replied',
};

function SequencesTab({ leadId }: { leadId: number }) {
  const [enrolling, setEnrolling]         = useState(false);
  const [selectedSeqId, setSelectedSeqId] = useState('');
  const [isEnrolling, setIsEnrolling]     = useState(false);

  const { data: enrollmentsData, isLoading, mutate } = useSWR(
    `/whatsapp/leads/${leadId}/enrollments`,
    () => whatsAppCrmService.getLeadEnrollments(leadId),
    { revalidateOnFocus: false }
  );

  const { data: sequencesData } = useSWR(
    enrolling ? '/whatsapp/sequences' : null,
    () => whatsAppCrmService.getSequences({ page_size: 100 } as any),
    { revalidateOnFocus: false }
  );

  const enrollments = enrollmentsData?.results ?? [];
  const sequences   = sequencesData?.results  ?? [];

  const handleEnroll = async () => {
    if (!selectedSeqId) { toast.error('Select a sequence'); return; }
    setIsEnrolling(true);
    try {
      await whatsAppCrmService.enrollLead(leadId, parseInt(selectedSeqId));
      toast.success('Lead enrolled in sequence');
      setEnrolling(false); setSelectedSeqId(''); mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to enroll');
    } finally { setIsEnrolling(false); }
  };

  const handleUnenroll = async (e: LeadSequenceEnrollment) => {
    if (!confirm(`Stop "${e.sequence_name}" for this lead?`)) return;
    try { await whatsAppCrmService.unenrollLead(leadId, e.id); toast.success('Unenrolled'); mutate(); }
    catch { toast.error('Failed to unenroll'); }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      {enrollments.length === 0 ? (
        <div className="text-center py-10">
          <Zap className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Not enrolled in any sequence</p>
        </div>
      ) : (
        <div className="space-y-2">
          {enrollments.map(e => (
            <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-muted/10">
              <div className="mt-0.5">{ENROLLMENT_STATUS_ICONS[e.status]}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{e.sequence_name}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{ENROLLMENT_STATUS_LABEL[e.status]}</span>
                  {e.current_step_number != null && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Step {e.current_step_number}</span>}
                  {e.next_step_at && e.status === 'ACTIVE' && <span>Next: {format(new Date(e.next_step_at), 'MMM d')}</span>}
                </div>
              </div>
              {e.status === 'ACTIVE' && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleUnenroll(e)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {enrolling ? (
        <div className="p-3 rounded-lg border border-dashed border-border space-y-3">
          <Label className="text-sm">Enroll in Sequence</Label>
          <Select value={selectedSeqId} onValueChange={setSelectedSeqId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select sequence…" /></SelectTrigger>
            <SelectContent>
              {sequences.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" className="h-8" disabled={isEnrolling} onClick={handleEnroll}>
              {isEnrolling && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Enroll
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setEnrolling(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setEnrolling(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Enroll in Sequence
        </Button>
      )}
    </div>
  );
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

interface LeadWhatsAppDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  leadName?: string;
  leadPhone?: string;
}

export function LeadWhatsAppDrawer({ open, onOpenChange, leadId, leadName, leadPhone }: LeadWhatsAppDrawerProps) {
  const [activeTab, setActiveTab]               = useState('chat');
  const [showContactPanel, setShowContactPanel] = useState(false);
  const initials = (leadName ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={leadName || 'Lead'}
      description={leadPhone}
      size="lg"
      rawContent
      headerActions={[{
        icon: showContactPanel ? PanelRightClose : PanelRightOpen,
        onClick: () => setShowContactPanel(v => !v),
        label: showContactPanel ? 'Hide contact info' : 'Show contact info',
      }]}
    >
      <div className="flex flex-col h-full overflow-hidden">

        {/* More options */}
        <div className="flex items-center justify-end px-3 pt-1 pb-0 flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setShowContactPanel(v => !v)}>
                <Info className="h-4 w-4 mr-2" /> Contact info
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Contact panel */}
        {showContactPanel && (
          <div className="mx-3 mb-2 rounded-xl border border-green-100 bg-green-50/50 p-3 flex items-center gap-3 flex-shrink-0">
            <div className="relative shrink-0">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-green-100 text-green-700 text-sm font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{leadName || 'Lead'}</p>
              {leadPhone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Phone className="h-2.5 w-2.5" />{leadPhone}
                </p>
              )}
            </div>
            <Badge variant="outline" className="text-[10px] border-green-300 text-green-700 bg-green-50 shrink-0">
              WhatsApp
            </Badge>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <TabsList className="mx-3 mb-1 shrink-0 bg-muted/40">
            <TabsTrigger value="chat" className="flex-1 gap-1.5">
              <WhatsAppIcon className="h-3.5 w-3.5" /> Chat
            </TabsTrigger>
            <TabsTrigger value="sequences" className="flex-1 gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Sequences
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="chat"
            className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col min-h-0"
          >
            {open && <ChatTab leadId={leadId} leadName={leadName} leadPhone={leadPhone} />}
          </TabsContent>

          <TabsContent value="sequences" className="flex-1 overflow-auto mt-0 min-h-0">
            {open && <SequencesTab leadId={leadId} />}
          </TabsContent>
        </Tabs>
      </div>
    </SideDrawer>
  );
}
