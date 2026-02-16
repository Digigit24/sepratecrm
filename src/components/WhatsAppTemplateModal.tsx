// src/components/WhatsAppTemplateModal.tsx
import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { templatesService } from '@/services/whatsapp/templatesService';
import { Template, TemplateStatus, TemplateSendRequest, TemplateLanguage } from '@/types/whatsappTypes';
import { toast } from 'sonner';
import { Loader2, MessageSquare, FileText, Send, X } from 'lucide-react';

interface WhatsAppTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber: string;
  leadName: string;
}

export const WhatsAppTemplateModal: React.FC<WhatsAppTemplateModalProps> = ({
  open,
  onOpenChange,
  phoneNumber,
  leadName,
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);

  // Fetch templates when modal opens
  useEffect(() => {
    if (open) {
      fetchTemplates();
    } else {
      // Reset state when modal closes
      setSelectedTemplate(null);
      setVariables({});
    }
  }, [open]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const response = await templatesService.getTemplates({
        status: TemplateStatus.APPROVED,
        limit: 100,
        skip: 0,
      });
      setTemplates(response.items);
      console.log('✅ Fetched templates:', response.items);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch templates');
      console.error('Failed to fetch templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Extract variables from template body
  const extractedVariables = useMemo(() => {
    if (!selectedTemplate) return [];

    const bodyComponent = selectedTemplate.components.find(c => c.type === 'BODY');
    if (!bodyComponent?.text) return [];

    return templatesService.extractVariables(bodyComponent.text);
  }, [selectedTemplate]);

  // Initialize variables when template is selected
  useEffect(() => {
    if (selectedTemplate && extractedVariables.length > 0) {
      const initialVars: Record<string, string> = {};
      extractedVariables.forEach((varNum) => {
        // Pre-fill with lead name for first variable
        if (varNum === '1') {
          initialVars[varNum] = leadName;
        } else {
          initialVars[varNum] = '';
        }
      });
      setVariables(initialVars);
    }
  }, [selectedTemplate, extractedVariables, leadName]);

  // Preview template with variables replaced
  const templatePreview = useMemo(() => {
    if (!selectedTemplate) return '';

    const bodyComponent = selectedTemplate.components.find(c => c.type === 'BODY');
    if (!bodyComponent?.text) return '';

    return templatesService.replaceVariables(bodyComponent.text, variables);
  }, [selectedTemplate, variables]);

  const handleSendTemplate = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    // Validate all variables are filled
    const missingVars = extractedVariables.filter(varNum => !variables[varNum] || variables[varNum].trim() === '');
    if (missingVars.length > 0) {
      toast.error('Please fill all required variables');
      return;
    }

    // Clean phone number - ensure format is 91XXXXXXXXXX
    let cleanPhone = phoneNumber.replace(/[^\d]/g, '');
    if (!cleanPhone.startsWith('91') && cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    setIsSending(true);
    try {
      const payload: TemplateSendRequest = {
        to: cleanPhone,
        template_name: selectedTemplate.name,
        language: selectedTemplate.language as TemplateLanguage,
        parameters: variables,
      };

      const response = await templatesService.sendTemplate(payload);

      toast.success(`Template sent successfully to ${leadName}!`, {
        description: `Message ID: ${response.message_id || 'N/A'}`,
        duration: 3000,
      });

      // Close modal on success
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send template');
      console.error('Failed to send template:', error);
    } finally {
      setIsSending(false);
    }
  };

  const getStatusBadge = (status: TemplateStatus) => {
    const statusColors = {
      [TemplateStatus.APPROVED]: 'bg-green-100 text-green-800 border-green-200',
      [TemplateStatus.PENDING]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      [TemplateStatus.REJECTED]: 'bg-red-100 text-red-800 border-red-200',
      [TemplateStatus.PAUSED]: 'bg-gray-100 text-gray-800 border-gray-200',
      [TemplateStatus.DISABLED]: 'bg-gray-100 text-gray-600 border-gray-200',
    };

    return (
      <Badge variant="outline" className={statusColors[status]}>
        {status}
      </Badge>
    );
  };

  const getCategoryBadge = (category: string) => {
    const categoryColors: Record<string, string> = {
      MARKETING: 'bg-blue-100 text-blue-800 border-blue-200',
      UTILITY: 'bg-purple-100 text-purple-800 border-purple-200',
      AUTHENTICATION: 'bg-orange-100 text-orange-800 border-orange-200',
    };

    return (
      <Badge variant="outline" className={categoryColors[category] || 'bg-gray-100 text-gray-800'}>
        {category}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Send WhatsApp Template Message
          </DialogTitle>
          <DialogDescription>
            Select a template and send it to {leadName} ({phoneNumber})
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 flex-1 overflow-hidden">
          {/* Left Panel: Template Selection */}
          <div className="flex-1 flex flex-col overflow-hidden border-r pr-4">
            <h3 className="font-semibold mb-2 text-sm">Select Template</h3>
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No approved templates found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => {
                    const bodyComponent = template.components.find(c => c.type === 'BODY');
                    const isSelected = selectedTemplate?.id === template.id;

                    return (
                      <div
                        key={template.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-medium text-sm">{template.name}</h4>
                          {getStatusBadge(template.status)}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          {getCategoryBadge(template.category)}
                          <Badge variant="outline" className="text-xs">
                            {template.language}
                          </Badge>
                        </div>
                        {bodyComponent?.text && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {bodyComponent.text}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right Panel: Variable Inputs & Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedTemplate ? (
              <>
                <h3 className="font-semibold mb-2 text-sm">Template Preview</h3>

                {/* Variables Input */}
                {extractedVariables.length > 0 && (
                  <div className="mb-4 space-y-3">
                    <Label className="text-xs text-muted-foreground">Fill Template Variables:</Label>
                    {extractedVariables.map((varNum) => (
                      <div key={varNum}>
                        <Label htmlFor={`var-${varNum}`} className="text-xs">
                          Variable {varNum}
                        </Label>
                        <Input
                          id={`var-${varNum}`}
                          value={variables[varNum] || ''}
                          onChange={(e) =>
                            setVariables({ ...variables, [varNum]: e.target.value })
                          }
                          placeholder={`Enter value for {{${varNum}}}`}
                          className="mt-1"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <Separator className="my-3" />

                {/* Preview */}
                <div className="flex-1 overflow-hidden flex flex-col">
                  <Label className="text-xs text-muted-foreground mb-2">Message Preview:</Label>
                  <ScrollArea className="flex-1 border rounded-lg p-3 bg-gray-50">
                    <div className="space-y-3">
                      {/* Header */}
                      {selectedTemplate.components.find(c => c.type === 'HEADER')?.text && (
                        <div>
                          <p className="font-bold text-sm">
                            {selectedTemplate.components.find(c => c.type === 'HEADER')?.text}
                          </p>
                          <Separator className="my-2" />
                        </div>
                      )}

                      {/* Body */}
                      <p className="text-sm whitespace-pre-wrap">{templatePreview}</p>

                      {/* Footer */}
                      {selectedTemplate.components.find(c => c.type === 'FOOTER')?.text && (
                        <>
                          <Separator className="my-2" />
                          <p className="text-xs text-muted-foreground">
                            {selectedTemplate.components.find(c => c.type === 'FOOTER')?.text}
                          </p>
                        </>
                      )}

                      {/* Buttons */}
                      {selectedTemplate.components.find(c => c.type === 'BUTTONS')?.buttons && (
                        <div className="space-y-2 mt-3">
                          {selectedTemplate.components
                            .find(c => c.type === 'BUTTONS')
                            ?.buttons?.map((button, idx) => (
                              <Button
                                key={idx}
                                variant="outline"
                                size="sm"
                                className="w-full"
                                disabled
                              >
                                {button.text}
                              </Button>
                            ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                <div>
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select a template to preview</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSendTemplate}
            disabled={!selectedTemplate || isSending}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {isSending ? 'Sending...' : 'Send Template'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
