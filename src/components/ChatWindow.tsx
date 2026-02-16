import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  Send,
  ArrowLeft,
  MoreVertical,
  Smile,
  Paperclip,
  Mic,
  Phone,
  Video,
  Search,
  Check,
  CheckCheck,
  Clock,
  XCircle,
  Image as ImageIcon,
  FileText,
  Music,
  MapPin,
  User,
  Camera,
  X,
  Reply,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useMessages } from "@/hooks/whatsapp/useMessages";
import { useClearChatHistory } from "@/hooks/whatsapp/useChat";
import { useTemplates } from "@/hooks/whatsapp/useTemplates";
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import MediaWithAuth from './MediaWithAuth';
import DocumentWithAuth from './DocumentWithAuth';
import { getMediaUrl } from "@/services/whatsapp";
import { API_CONFIG } from "@/lib/apiConfig";
import type { Template } from "@/types/whatsappTypes";

type Props = {
  conversationId: string;
  selectedConversation?: {
    phone: string;
    name: string;
    last_message: string;
    last_timestamp: string;
    message_count: number;
    direction: 'incoming' | 'outgoing';
  };
  isMobile?: boolean;
  onBack?: () => void;
};

type AttachmentType = 'image' | 'video' | 'document' | 'audio' | 'camera' | 'contact' | 'location';

const attachmentOptions = [
  {
    type: 'image' as AttachmentType,
    label: 'Photos',
    icon: ImageIcon,
    accept: 'image/*',
    color: 'from-pink-500 to-rose-600',
  },
  {
    type: 'video' as AttachmentType,
    label: 'Videos',
    icon: Video,
    accept: 'video/*',
    color: 'from-purple-500 to-indigo-600',
  },
  {
    type: 'document' as AttachmentType,
    label: 'Document',
    icon: FileText,
    accept: '.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx',
    color: 'from-blue-500 to-cyan-600',
  },
  {
    type: 'audio' as AttachmentType,
    label: 'Audio',
    icon: Music,
    accept: 'audio/*',
    color: 'from-orange-500 to-amber-600',
  },
  {
    type: 'camera' as AttachmentType,
    label: 'Camera',
    icon: Camera,
    accept: 'image/*',
    color: 'from-red-500 to-pink-600',
  },
  {
    type: 'contact' as AttachmentType,
    label: 'Contact',
    icon: User,
    accept: '',
    color: 'from-green-500 to-emerald-600',
  },
  {
    type: 'location' as AttachmentType,
    label: 'Location',
    icon: MapPin,
    accept: '',
    color: 'from-teal-500 to-cyan-600',
  },
];

// Helper function to get date label
const getDateLabel = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';

  // Format as "Dec 15, 2024"
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Helper to get ordinal suffix (1st, 2nd, 3rd, etc.)
const getOrdinalSuffix = (day: number): string => {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

// Format full timestamp like "Saturday 31st January 2026 7:27:29 am"
const formatFullTimestamp = (date: Date): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;

  return `${dayName} ${day}${getOrdinalSuffix(day)} ${month} ${year} ${hours}:${minutes}:${seconds} ${ampm}`;
};

// Helper function to check if two dates are on the same day
const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.toDateString() === date2.toDateString();
};

export const ChatWindow = ({ conversationId, selectedConversation, isMobile, onBack }: Props) => {
  const { messages, isLoading, error, sendMessage, sendMediaMessage, sendTemplateMessage } = useMessages(selectedConversation?.phone || null);
  const clearChatMutation = useClearChatHistory();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Sort messages by timestamp (oldest first) then transform
  const sortedMessages = [...messages].sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return dateA - dateB; // Ascending order (oldest first)
  });

  const transformedMessages = sortedMessages.map(msg => ({
    from: msg.direction === 'outgoing' ? 'me' : 'them',
    text: msg.text,
    time: formatFullTimestamp(new Date(msg.timestamp)),
    status: msg.status,
    type: msg.type,
    metadata: msg.metadata,
    timestamp: msg.timestamp,
    date: new Date(msg.timestamp),
    // Template message fields
    template_proforma: msg.template_proforma,
    template_component_values: msg.template_component_values,
    template_components: msg.template_components,
    media_values: msg.media_values,
    interaction_message_data: msg.interaction_message_data,
  }));

  // Check if message is a template message (requires actual template data, not just HTML)
  const isTemplateMessage = (msg: typeof transformedMessages[0]) => {
    return msg.type === 'template' ||
           msg.template_proforma ||
           msg.template_components ||
           (msg.metadata as any)?.template_name;
  };

  // Check if message has media from media_values
  const hasMediaValues = (msg: typeof transformedMessages[0]) => {
    return msg.media_values && ['image', 'video', 'audio', 'document'].includes(msg.media_values.type);
  };

  // Helper to extract parameter values from template_component_values array
  const getTemplateParameterValues = (componentValues: any[]): Record<string, string> => {
    const paramValues: Record<string, string> = {};
    if (!Array.isArray(componentValues)) return paramValues;

    // Find the body component which contains the parameters
    const bodyComponent = componentValues.find(c => c.type === 'body');
    if (bodyComponent?.parameters) {
      // Parameters is an object with keys like "{{1}}", "{{2}}", etc.
      Object.entries(bodyComponent.parameters).forEach(([key, value]: [string, any]) => {
        // Extract the number from "{{1}}" format
        const match = key.match(/\{\{(\d+)\}\}/);
        if (match) {
          paramValues[match[1]] = value?.text || value || '';
        }
      });
    }
    return paramValues;
  };

  // Helper to render template message content
  const renderTemplateContent = (msg: typeof transformedMessages[0]) => {
    // Build content from template_proforma and component values
    if (msg.template_proforma) {
      const components = msg.template_proforma.components || [];
      const bodyComponent = components.find((c: any) => c.type === 'BODY');
      if (bodyComponent?.text) {
        let text = bodyComponent.text;
        // Replace {{1}}, {{2}}, etc. with actual values from template_component_values
        if (msg.template_component_values && Array.isArray(msg.template_component_values)) {
          const paramValues = getTemplateParameterValues(msg.template_component_values);
          Object.entries(paramValues).forEach(([key, value]) => {
            text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
          });
        }
        return text;
      }
    }

    // Fallback to template_components with variable substitution
    if (msg.template_components) {
      const bodyComponent = msg.template_components.find((c: any) => c.type === 'BODY');
      if (bodyComponent?.text) {
        let text = bodyComponent.text;
        // Try to substitute from template_component_values
        if (msg.template_component_values && Array.isArray(msg.template_component_values)) {
          const paramValues = getTemplateParameterValues(msg.template_component_values);
          Object.entries(paramValues).forEach(([key, value]) => {
            text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
          });
        }
        return text;
      }
    }

    // Interactive message
    if (msg.interaction_message_data?.body?.text) {
      return msg.interaction_message_data.body.text;
    }

    // If has text, use it as fallback
    if (msg.text) return msg.text;

    // Show template name if available
    if ((msg.metadata as any)?.template_name) {
      return `[Template: ${(msg.metadata as any).template_name}]`;
    }

    return '[Template Message]';
  };

  // Helper to get template header text
  const getTemplateHeader = (msg: typeof transformedMessages[0]): string | null => {
    if (msg.template_proforma?.components) {
      const headerComponent = msg.template_proforma.components.find((c: any) => c.type === 'HEADER' && c.format === 'TEXT');
      if (headerComponent?.text) return headerComponent.text;
    }
    if (msg.template_components) {
      const headerComponent = msg.template_components.find((c: any) => c.type === 'HEADER' && c.format === 'TEXT');
      if (headerComponent?.text) return headerComponent.text;
    }
    return null;
  };

  // Helper to get template footer text
  const getTemplateFooter = (msg: typeof transformedMessages[0]): string | null => {
    if (msg.template_proforma?.components) {
      const footerComponent = msg.template_proforma.components.find((c: any) => c.type === 'FOOTER');
      if (footerComponent?.text) return footerComponent.text;
    }
    if (msg.template_components) {
      const footerComponent = msg.template_components.find((c: any) => c.type === 'FOOTER');
      if (footerComponent?.text) return footerComponent.text;
    }
    return null;
  };

  // Helper to get template buttons from either template_proforma or template_components
  const getTemplateButtons = (msg: typeof transformedMessages[0]): Array<{ type: string; text: string }> | null => {
    // Check template_proforma.components first
    if (msg.template_proforma?.components) {
      const buttonsComponent = msg.template_proforma.components.find((c: any) => c.type === 'BUTTONS');
      if (buttonsComponent?.buttons && buttonsComponent.buttons.length > 0) {
        return buttonsComponent.buttons;
      }
    }
    // Fallback to template_components
    if (msg.template_components) {
      const buttonsComponent = msg.template_components.find((c: any) => c.type === 'BUTTONS');
      if (buttonsComponent?.buttons && buttonsComponent.buttons.length > 0) {
        return buttonsComponent.buttons;
      }
    }
    return null;
  };

  // Log messages for debugging
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      console.log('💬 ChatWindow messages updated:', {
        count: messages.length,
        lastMessage: {
          id: String(lastMsg.id).substring(0, 10),
          text: String(lastMsg.text).substring(0, 30),
          status: lastMsg.status,
          direction: lastMsg.direction
        },
        allStatuses: messages.map(m => ({
          id: String(m.id).substring(0, 10),
          status: m.status,
          dir: m.direction
        }))
      });
    }
  }, [messages]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const [input, setInput] = useState("");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);

  // Location dialog state
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Contact dialog state
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // File preview state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [selectedFileType, setSelectedFileType] = useState<AttachmentType | null>(null);
  const [isFilePreviewOpen, setIsFilePreviewOpen] = useState(false);
  const [fileCaption, setFileCaption] = useState("");

  // Template slash command state
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  // Close template dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showTemplateDropdown &&
        templateDropdownRef.current &&
        !templateDropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowTemplateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTemplateDropdown]);

  // Fetch templates (only when needed)
  const { templates, isLoading: isLoadingTemplates, fetchTemplates } = useTemplates({ autoFetch: false });

  // Filter templates based on search query (status is uppercase from API)
  const filteredTemplates = useMemo(() => {
    const isApproved = (t: Template) => t.status?.toUpperCase() === 'APPROVED';
    if (!templateSearchQuery) return templates.filter(isApproved);
    const query = templateSearchQuery.toLowerCase();
    return templates.filter(t =>
      isApproved(t) && t.name.toLowerCase().includes(query)
    );
  }, [templates, templateSearchQuery]);

  // Extract variables from template body ({{1}}, {{2}}, etc.)
  const extractTemplateVariables = (template: Template): string[] => {
    const variables: string[] = [];
    const bodyComponent = template.components?.find(c => c.type === 'BODY');
    if (bodyComponent?.text) {
      const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g);
      if (matches) {
        matches.forEach(match => {
          if (!variables.includes(match)) {
            variables.push(match);
          }
        });
      }
    }
    return variables;
  };

  // Get template preview with variables filled in
  const getTemplatePreview = (template: Template, variables: Record<string, string>): string => {
    const bodyComponent = template.components?.find(c => c.type === 'BODY');
    if (!bodyComponent?.text) return '';
    let text = bodyComponent.text;
    Object.entries(variables).forEach(([key, value]) => {
      text = text.replace(key, value || key);
    });
    return text;
  };

  // Handle input change for slash command detection
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    // Detect "/" at start or after space
    if (value === '/' || value.endsWith(' /')) {
      setShowTemplateDropdown(true);
      setTemplateSearchQuery("");
      fetchTemplates({ limit: 50 });
    } else if (showTemplateDropdown) {
      // If dropdown is open, update search query
      const slashIndex = value.lastIndexOf('/');
      if (slashIndex !== -1) {
        setTemplateSearchQuery(value.substring(slashIndex + 1));
      } else {
        setShowTemplateDropdown(false);
      }
    }
  };

  // Handle template selection
  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setShowTemplateDropdown(false);
    setInput("");

    // Extract variables and initialize state
    const vars = extractTemplateVariables(template);
    const initialVars: Record<string, string> = {};
    vars.forEach(v => {
      initialVars[v] = "";
    });
    setTemplateVariables(initialVars);
    setIsTemplateDialogOpen(true);
  };

  // Handle sending template message
  const handleSendTemplate = async () => {
    if (!selectedTemplate || !selectedConversation?.phone) return;

    try {
      await sendTemplateMessage(selectedTemplate, templateVariables);

      setIsTemplateDialogOpen(false);
      setSelectedTemplate(null);
      setTemplateVariables({});
    } catch (error) {
      console.error('Failed to send template:', error);
    }
  };

  const handleEmojiSelect = (emoji: any) => {
    setInput((prevInput) => prevInput + emoji.native);
    setIsEmojiPickerOpen(false);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationLoading(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to retrieve your location');
        setLocationLoading(false);
      }
    );
  };

  const handleSendLocation = async () => {
    if (currentLocation) {
      const locationMessage = `📍 Location: https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lng}`;
      try {
        await sendMessage(locationMessage);
        setIsLocationDialogOpen(false);
        setCurrentLocation(null);
      } catch (error) {
        console.error('Failed to send location:', error);
      }
    }
  };

  const handleSendContact = async () => {
    if (contactName.trim() && contactPhone.trim()) {
      const contactMessage = `👤 Contact:\nName: ${contactName}\nPhone: ${contactPhone}`;
      try {
        await sendMessage(contactMessage);
        setIsContactDialogOpen(false);
        setContactName("");
        setContactPhone("");
      } catch (error) {
        console.error('Failed to send contact:', error);
      }
    }
  };

  const handleAttachmentClick = (type: AttachmentType) => {
    console.log('🎯 Attachment clicked:', type);

    if (type === 'contact') {
      console.log('🎯 Opening contact dialog');
      setIsContactDialogOpen(true);
      setIsAttachmentMenuOpen(false);
      return;
    }

    if (type === 'location') {
      console.log('🎯 Opening location dialog');
      setIsLocationDialogOpen(true);
      handleGetLocation();
      setIsAttachmentMenuOpen(false);
      return;
    }

    // For file types, trigger the corresponding file input
    console.log('🎯 Looking for file input ref for type:', type);
    const inputRef = fileInputRefs.current[type];
    console.log('🎯 Input ref found:', !!inputRef);

    if (inputRef) {
      console.log('🎯 Clicking file input...');
      inputRef.click();
      setIsAttachmentMenuOpen(false);
    } else {
      console.error('🎯 ❌ No input ref found for type:', type);
      console.log('🎯 Available refs:', Object.keys(fileInputRefs.current));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: AttachmentType) => {
    console.log('📎 File selected, type:', type);
    const files = e.target.files;
    console.log('📎 Files:', files?.length);

    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      console.log('📎 Opening preview dialog for:', fileArray[0].name);

      // Set files and type first
      setSelectedFiles(fileArray);
      setSelectedFileType(type);

      // Open dialog immediately
      console.log('📎 Setting isFilePreviewOpen to:', true);
      setIsFilePreviewOpen(true);

      // Create preview for images and videos (async)
      if (type === 'image' || type === 'camera' || type === 'video') {
        const reader = new FileReader();
        reader.onloadend = () => {
          console.log('📎 Preview URL created, length:', (reader.result as string)?.length);
          setFilePreviewUrl(reader.result as string);
        };
        reader.onerror = (error) => {
          console.error('📎 Failed to read file:', error);
          setFilePreviewUrl(null);
        };
        reader.readAsDataURL(fileArray[0]);
      } else {
        setFilePreviewUrl(null);
      }
    } else {
      console.log('📎 No files selected');
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const handleSendFile = async () => {
    if (selectedFiles.length === 0 || !selectedFileType) return;

    try {
      // Close preview immediately on send
      setIsFilePreviewOpen(false);

      const file = selectedFiles[0];
      const media_type = selectedFileType === 'camera' ? 'image' : selectedFileType;

      if (media_type === 'contact' || media_type === 'location') {
        console.error('Contact and location are not sent as files');
        return;
      }

      await sendMediaMessage(file, media_type, fileCaption);
    } catch (error) {
      console.error('Failed to send file:', error);
    } finally {
      // Reset state
      setSelectedFiles([]);
      setFilePreviewUrl(null);
      setSelectedFileType(null);
      setFileCaption("");
      setIsFilePreviewOpen(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const messageText = input.trim();
    setInput("");

    try {
      await sendMessage(messageText);
    } catch (error) {
      setInput(messageText);
    }
  };

  // Scroll to bottom on initial load (instant) and when new messages arrive
  const prevLastMessageIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    const lastMessage = transformedMessages[transformedMessages.length - 1];
    const lastMessageId = lastMessage?.timestamp ?? null;

    if (transformedMessages.length > 0) {
      if (isInitialLoadRef.current) {
        // Initial load: scroll instantly without animation
        console.log('📜 Initial load: Scrolling to bottom instantly');
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        isInitialLoadRef.current = false;
      } else if (lastMessageId !== prevLastMessageIdRef.current) {
        // New or different last message: scroll instantly
        console.log('📜 New message: Scrolling to bottom instantly');
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }
    }

    prevLastMessageIdRef.current = lastMessageId;
  }, [transformedMessages]);

  // Reset initial load flag when conversation changes
  useEffect(() => {
    isInitialLoadRef.current = true;
    prevLastMessageIdRef.current = null;
  }, [conversationId]);

  useEffect(() => {
    console.log('📎 isFilePreviewOpen changed:', isFilePreviewOpen);
    console.log('📎 selectedFiles:', selectedFiles.length);
    console.log('📎 selectedFileType:', selectedFileType);

    // Alert for debugging
    if (isFilePreviewOpen && selectedFiles.length > 0) {
      console.log('📎 ✅ DIALOG SHOULD BE VISIBLE NOW!');
    }
  }, [isFilePreviewOpen, selectedFiles, selectedFileType]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'sent':
        return <Check className="h-3 w-3" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3" />;
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'failed':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        // Default for outgoing messages without status: show single check (sent)
        return <Check className="h-3 w-3 opacity-50" />;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* Fixed Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={onBack}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}

          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src="" alt={selectedConversation?.name} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-semibold">
              {selectedConversation?.name ? getInitials(selectedConversation.name) : 'U'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate">
              {selectedConversation?.name || conversationId}
            </h2>
            <p className="text-xs text-muted-foreground">Online</p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreVertical className="h-[18px] w-[18px]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="cursor-pointer">
                Contact info
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                Select messages
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                Mute notifications
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => setShowClearConfirm(true)}
              >
                Clear messages
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer">
                Delete chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages Area - Scrollable with messages at bottom */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4"
        style={{
          backgroundImage: `url('https://hms.thedigitechsolutions.com/imgs/wa-message-bg-faded.png')`,
          backgroundSize: 'cover',
          backgroundRepeat: 'repeat',
          backgroundColor: '#e5ddd5',
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
              <p className="text-sm text-muted-foreground">Loading messages...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center bg-card rounded-lg p-6 border border-destructive/20">
              <div className="text-destructive mb-2 text-2xl">⚠️</div>
              <p className="text-sm font-medium text-destructive mb-1">Failed to load messages</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : transformedMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-4">
                <Send className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Start a conversation</h3>
              <p className="text-sm text-muted-foreground">Send a message to begin chatting</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col min-h-full justify-end space-y-3">
            {/* Load earlier messages button */}
            <div className="flex justify-center py-2">
              <button
                type="button"
                className="bg-white/90 hover:bg-white text-gray-600 hover:text-gray-800 text-xs font-medium px-4 py-2 rounded-full shadow-sm border border-gray-200 transition-all hover:shadow-md"
                onClick={() => {
                  console.log('Load earlier messages clicked');
                  // TODO: Implement pagination/load more
                }}
              >
                ↑ Load earlier messages
              </button>
            </div>
            {transformedMessages.map((msg, idx) => {
              // Check if we need to show a date separator
              const showDateSeparator =
                idx === 0 ||
                !isSameDay(msg.date, transformedMessages[idx - 1].date);

              return (
                <React.Fragment key={idx}>
                  {/* Date Separator */}
                  {showDateSeparator && (
                    <div className="flex justify-center my-4">
                      <div className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-gray-200">
                        <span className="text-xs font-medium text-gray-600">
                          {getDateLabel(msg.date)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={cn(
                      "flex animate-in fade-in slide-in-from-bottom-2 duration-200",
                      msg.from === "me" ? "justify-end" : "justify-start"
                    )}
                  >
                <div
                  className={cn(
                    "relative max-w-[85%] sm:max-w-[70%] md:max-w-[65%] rounded-lg shadow-sm",
                    // Template messages get white background with no padding (padding added inside)
                    isTemplateMessage(msg)
                      ? "bg-white text-[#0b141a] rounded-br-none border border-gray-200 overflow-hidden"
                      : msg.from === "me"
                        ? "bg-[#dcf8c6] text-[#0b141a] rounded-br-none border border-emerald-100 px-3 py-2"
                        : "bg-white text-[#0b141a] rounded-bl-none border border-gray-200 px-3 py-2"
                  )}
                >
                  {/* Render media from media_values (API response) or metadata (local upload) */}
                  {(msg.type === 'image' || msg.media_values?.type === 'image') && !isTemplateMessage(msg) && (
                    <div className="relative mb-1">
                      <MediaWithAuth
                        type="image"
                        src={msg.media_values?.link || getMediaUrl(msg.metadata?.media_id)}
                        previewSrc={msg.metadata?.file_preview_url}
                        alt="sent image"
                        className="rounded-md max-w-[240px] w-full h-auto"
                      />
                      {msg.metadata?.is_uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        </div>
                      )}
                    </div>
                  )}
                  {(msg.type === 'video' || msg.media_values?.type === 'video') && !isTemplateMessage(msg) && (
                    <div className="relative mb-1">
                      <MediaWithAuth
                        type="video"
                        src={msg.media_values?.link || getMediaUrl(msg.metadata?.media_id)}
                        previewSrc={msg.metadata?.file_preview_url}
                        alt="sent video"
                        className="rounded-md max-w-[240px] w-full h-auto"
                      />
                      {msg.metadata?.is_uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        </div>
                      )}
                    </div>
                  )}
                  {(msg.type === 'audio' || msg.media_values?.type === 'audio') && !isTemplateMessage(msg) && (
                    <div className="relative mb-1">
                      <MediaWithAuth
                        type="audio"
                        src={msg.media_values?.link || getMediaUrl(msg.metadata?.media_id)}
                        previewSrc={msg.metadata?.file_preview_url}
                        alt="sent audio"
                        className="rounded-md max-w-[240px] w-full h-auto"
                      />
                      {msg.metadata?.is_uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        </div>
                      )}
                    </div>
                  )}
                  {(msg.type === 'document' || msg.media_values?.type === 'document') && !isTemplateMessage(msg) && (
                    <div className="relative mb-1">
                      <DocumentWithAuth
                        src={msg.media_values?.link || getMediaUrl(msg.metadata?.media_id)}
                        filename={msg.media_values?.file_name || msg.media_values?.original_filename || msg.text || 'Document'}
                        className="rounded-md max-w-full"
                      />
                      {msg.metadata?.is_uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Template message with header media */}
                  {isTemplateMessage(msg) && msg.media_values && (
                    <div className="mb-2">
                      {msg.media_values.type === 'image' && (
                        <MediaWithAuth
                          type="image"
                          src={msg.media_values.link}
                          alt="template media"
                          className="rounded-md max-w-[240px] w-full h-auto"
                        />
                      )}
                      {msg.media_values.type === 'video' && (
                        <MediaWithAuth
                          type="video"
                          src={msg.media_values.link}
                          alt="template video"
                          className="rounded-md max-w-[240px] w-full h-auto"
                        />
                      )}
                      {msg.media_values.type === 'audio' && (
                        <MediaWithAuth
                          type="audio"
                          src={msg.media_values.link}
                          alt="template audio"
                          className="rounded-md max-w-[240px] w-full h-auto"
                        />
                      )}
                      {msg.media_values.type === 'document' && (
                        <DocumentWithAuth
                          src={msg.media_values.link}
                          filename={msg.media_values.file_name || msg.media_values.original_filename || 'Document'}
                          className="rounded-md max-w-full"
                        />
                      )}
                    </div>
                  )}
                  {/* Template message content */}
                  {isTemplateMessage(msg) ? (
                    <>
                      {/* Template content with padding */}
                      <div className="px-3 pt-3 pb-2">
                        {/* Template header - bold title */}
                        {getTemplateHeader(msg) && (
                          <p className="font-bold text-[15px] text-[#0b141a] mb-3">{getTemplateHeader(msg)}</p>
                        )}
                        {/* Template body */}
                        <p className="text-[14px] leading-[1.5] text-[#0b141a] break-words whitespace-pre-wrap">
                          {renderTemplateContent(msg)}
                        </p>
                        {/* Template footer */}
                        {getTemplateFooter(msg) && (
                          <p className="text-xs text-gray-500 mt-3">{getTemplateFooter(msg)}</p>
                        )}
                      </div>
                      {/* Template buttons - outside padding area */}
                      {getTemplateButtons(msg) && (
                        <div className="flex flex-col">
                          {getTemplateButtons(msg)!.map((btn: any, i: number) => (
                            <button
                              key={i}
                              type="button"
                              className="w-full py-3 px-3 text-[14px] font-normal text-[#00a5f4] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 border-t border-gray-200"
                              onClick={() => console.log('Template button clicked:', btn.text)}
                            >
                              <Reply className="h-4 w-4 rotate-180 scale-x-[-1]" />
                              {btn.text}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Timestamp for template */}
                      <div className="flex items-center justify-end px-3 pb-2 text-[11px] text-[#667781]">
                        <span>{msg.time}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Regular message body - show text or media caption */}
                      {(msg.text || msg.media_values?.caption) && (
                        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                          {msg.text || msg.media_values?.caption}
                        </p>
                      )}
                      {/* Interactive message buttons */}
                      {msg.interaction_message_data?.action?.buttons && (
                        <div className="mt-3 flex flex-col">
                          {msg.interaction_message_data.action.buttons.map((btn, i) => (
                            <button
                              key={i}
                              type="button"
                              className="w-full py-2.5 px-3 text-sm font-medium text-[#00a5f4] hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 border-t border-gray-200"
                              onClick={() => console.log('Button clicked:', btn.reply?.title)}
                            >
                              <Reply className="h-4 w-4 rotate-180 scale-x-[-1]" />
                              {btn.reply?.title}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Timestamp for regular messages */}
                      <div className={cn(
                        "flex items-center justify-end gap-1 mt-1 text-[11px]",
                        msg.from === "me" ? "text-[#667781]" : "text-[#667781]"
                      )}>
                        <span>{msg.time}</span>
                        {msg.from === "me" && (
                          <span className="flex items-center">
                            {getStatusIcon(msg.status)}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Hidden file inputs - OUTSIDE popover to persist across renders */}
      {attachmentOptions.map((option) => (
        option.accept && (
          <input
            key={option.type}
            ref={(el) => {
              fileInputRefs.current[option.type] = el;
              if (el) {
                console.log('🔧 File input registered for:', option.type);
              }
            }}
            type="file"
            accept={option.accept}
            className="hidden"
            onChange={(e) => {
              console.log('⚡ onChange fired!', option.type, e.target.files?.length);
              handleFileChange(e, option.type);
            }}
            multiple={option.type === 'image' || option.type === 'video'}
            capture={option.type === 'camera' ? 'environment' : undefined}
            onClick={(e) => {
              console.log('🖱️ Input clicked');
            }}
          />
        )
      ))}

      {/* Fixed Input Area */}
      <div className="flex-shrink-0 px-4 py-3 bg-card border-t border-border">
        {/* Debug indicator */}
        {isFilePreviewOpen && (
          <div className="mb-2 p-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 text-xs rounded">
            🐛 DEBUG: Dialog state is OPEN. Selected files: {selectedFiles.length}
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          {/* Attachment Menu */}
          <Popover open={isAttachmentMenuOpen} onOpenChange={setIsAttachmentMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full hover:bg-accent"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-80 p-4"
              align="start"
              side="top"
              sideOffset={10}
            >
              <div className="grid grid-cols-3 gap-4">
                {attachmentOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.type}
                      type="button"
                      onClick={() => handleAttachmentClick(option.type)}
                      className="flex flex-col items-center gap-2 w-full group"
                    >
                      <div className={cn(
                        "w-14 h-14 rounded-full bg-gradient-to-br flex items-center justify-center shadow-lg transition-transform group-hover:scale-110",
                        option.color
                      )}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* Input Container */}
          <div className="flex-1 relative flex items-center bg-background rounded-full border border-border min-h-[44px]">
            {/* Template Dropdown */}
            {showTemplateDropdown && (
              <div
                ref={templateDropdownRef}
                className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto z-50"
              >
                {isLoadingTemplates ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto mb-2"></div>
                    Loading templates...
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No templates found
                  </div>
                ) : (
                  <div className="py-1">
                    <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                      Select a template
                    </div>
                    {filteredTemplates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-accent transition-colors flex items-start gap-2"
                        onClick={() => handleTemplateSelect(template)}
                      >
                        <Hash className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{template.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {template.components?.find(c => c.type === 'BODY')?.text?.substring(0, 50)}...
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Input
              ref={inputRef}
              placeholder="Type a message or / for templates..."
              className="flex-1 bg-transparent border-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 px-4 py-2.5 text-sm h-auto"
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && showTemplateDropdown) {
                  setShowTemplateDropdown(false);
                  setInput("");
                }
              }}
            />

            {/* Emoji Picker */}
            <Popover open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 rounded-full mr-1 h-8 w-8 hover:bg-accent"
                >
                  <Smile className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-full p-0 border-0 bg-transparent shadow-2xl"
                align="end"
                side="top"
                sideOffset={10}
              >
                <Picker
                  data={data}
                  onEmojiSelect={handleEmojiSelect}
                  theme="dark"
                  previewPosition="none"
                  skinTonePosition="none"
                  searchPosition="top"
                  perLine={8}
                  maxFrequentRows={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Send/Mic Button */}
          <Button
            type={input.trim() ? "submit" : "button"}
            size="icon"
            className={cn(
              "shrink-0 rounded-full h-11 w-11 shadow-lg transition-all",
              input.trim()
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
          >
            {input.trim() ? (
              <Send className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>
        </form>
      </div>

      {/* Location Dialog */}
      <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
        <DialogContent className="z-[100]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-teal-500" />
              Share Location
            </DialogTitle>
            <DialogDescription>
              Share your current location with this contact
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {locationLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                <span className="ml-3 text-muted-foreground">Getting your location...</span>
              </div>
            ) : currentLocation ? (
              <div className="bg-background rounded-lg p-4 border border-border">
                <p className="text-sm text-foreground mb-2">📍 Current Location:</p>
                <p className="text-xs text-muted-foreground font-mono">
                  Lat: {currentLocation.lat.toFixed(6)}<br />
                  Lng: {currentLocation.lng.toFixed(6)}
                </p>

                  <a
                    href={`https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:text-primary/80 underline mt-2 inline-block"
                  >
                    View on Google Maps
                  </a>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Unable to get location</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsLocationDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendLocation}
              disabled={!currentLocation}
              className="bg-gradient-to-br from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800"
            >
              Send Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Dialog */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent className="z-[100]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-green-500" />
              Share Contact
            </DialogTitle>
            <DialogDescription>
              Share a contact with this conversation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-foreground mb-2 block">Contact Name</label>
              <Input
                placeholder="John Doe"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-foreground mb-2 block">Phone Number</label>
              <Input
                placeholder="+1 234 567 8900"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsContactDialogOpen(false);
                setContactName("");
                setContactPhone("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendContact}
              disabled={!contactName.trim() || !contactPhone.trim()}
              className="bg-gradient-to-br from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800"
            >
              Send Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Preview Dialog */}
      <Dialog open={isFilePreviewOpen} onOpenChange={setIsFilePreviewOpen} modal={true}>
        <DialogContent className="max-w-2xl z-[100]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedFileType === 'image' || selectedFileType === 'camera' ? (
                <ImageIcon className="h-5 w-5 text-blue-500" />
              ) : selectedFileType === 'video' ? (
                <Video className="h-5 w-5 text-purple-500" />
              ) : selectedFileType === 'document' ? (
                <FileText className="h-5 w-5 text-orange-500" />
              ) : (
                <Music className="h-5 w-5 text-green-500" />
              )}
              Send {selectedFileType === 'camera' ? 'Image' : selectedFileType}
            </DialogTitle>
            <DialogDescription>
              {selectedFiles.length > 0 && `Selected: ${selectedFiles[0].name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* File Preview */}
            {(selectedFileType === 'image' || selectedFileType === 'camera') && (
              <div className="rounded-lg overflow-hidden border border-border bg-muted">
                {filePreviewUrl ? (
                  <img
                    src={filePreviewUrl}
                    alt="Preview"
                    className="w-full h-auto max-h-96 object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                )}
              </div>
            )}
            {selectedFileType === 'video' && (
              <div className="rounded-lg overflow-hidden border border-border bg-muted">
                {filePreviewUrl ? (
                  <video
                    src={filePreviewUrl}
                    controls
                    className="w-full h-auto max-h-96"
                  />
                ) : (
                  <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                )}
              </div>
            )}
            {(selectedFileType === 'document' || selectedFileType === 'audio') && (
              <div className="rounded-lg border border-border bg-muted p-8 text-center">
                <div className="mx-auto w-20 h-20 rounded-full bg-background flex items-center justify-center mb-4">
                  {selectedFileType === 'document' ? (
                    <FileText className="h-10 w-10 text-muted-foreground" />
                  ) : (
                    <Music className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">{selectedFiles[0]?.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedFiles[0] && (selectedFiles[0].size / 1024).toFixed(2)} KB
                </p>
              </div>
            )}

            {/* Caption Input */}
            <div>
              <label className="text-sm text-foreground mb-2 block">
                Caption (optional)
              </label>
              <Input
                placeholder="Add a caption..."
                value={fileCaption}
                onChange={(e) => setFileCaption(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsFilePreviewOpen(false);
                setSelectedFiles([]);
                setFilePreviewUrl(null);
                setSelectedFileType(null);
                setFileCaption("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendFile}
              disabled={selectedFiles.length === 0}
              className="bg-primary hover:bg-primary/90"
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Chat Confirmation Dialog */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Clear Chat History</DialogTitle>
            <DialogDescription>
              Are you sure you want to clear all messages in this chat? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowClearConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearChatMutation.mutate(conversationId);
                setShowClearConfirm(false);
              }}
              disabled={clearChatMutation.isPending}
            >
              {clearChatMutation.isPending ? 'Clearing...' : 'Clear Chat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Variables Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              Send Template: {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Fill in the variables below and preview your message before sending.
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4 py-4">
              {/* Template Preview */}
              <div className="bg-[#dcf8c6] rounded-lg p-3 border border-emerald-100">
                <p className="text-sm text-[#0b141a] whitespace-pre-wrap">
                  {getTemplatePreview(selectedTemplate, templateVariables)}
                </p>
              </div>

              {/* Variable Inputs */}
              {Object.keys(templateVariables).length > 0 && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Variables</label>
                  {Object.keys(templateVariables).map((variable, index) => (
                    <div key={variable} className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-muted px-2 py-1 rounded shrink-0">
                        {variable}
                      </span>
                      <Input
                        placeholder={`Enter value for ${variable}`}
                        value={templateVariables[variable]}
                        onChange={(e) => setTemplateVariables(prev => ({
                          ...prev,
                          [variable]: e.target.value
                        }))}
                        className="flex-1"
                        autoFocus={index === 0}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* No variables message */}
              {Object.keys(templateVariables).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  This template has no variables to fill in.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsTemplateDialogOpen(false);
                setSelectedTemplate(null);
                setTemplateVariables({});
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendTemplate}
              className="bg-primary hover:bg-primary/90"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
