// src/components/admin-settings/WhatsAppDefaultsTab.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { templatesService } from '@/services/whatsapp/templatesService';
import { Template, TemplateStatus } from '@/types/whatsappTypes';
import type { WhatsAppDefaults, TemplateVariableMapping } from '@/types/user.types';

interface WhatsAppDefaultsTabProps {
  whatsappDefaults: WhatsAppDefaults;
  onWhatsAppDefaultsChange: (defaults: WhatsAppDefaults) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

const TEMPLATE_PURPOSES = [
  { key: 'followup', label: 'Followup Reminder', description: 'CRM followup reminders' },
  { key: 'leadNotification', label: 'Lead Notification', description: 'New lead notifications' },
  { key: 'appointmentReminder', label: 'Appointment Reminder', description: 'Appointment reminders' },
  { key: 'welcomeMessage', label: 'Welcome Message', description: 'Welcoming new contacts' },
] as const;

const FIELD_SOURCES = [
  { value: 'patient_name', label: 'Patient Name' },
  { value: 'followup_date', label: 'Follow-up Date' },
  { value: 'followup_time', label: 'Follow-up Time' },
  { value: 'doctor_name', label: 'Doctor Name' },
  { value: 'hospital_name', label: 'Hospital Name' },
  { value: 'patient_phone', label: 'Patient Phone' },
] as const;

export const WhatsAppDefaultsTab: React.FC<WhatsAppDefaultsTabProps> = ({
  whatsappDefaults,
  onWhatsAppDefaultsChange,
  onSave,
  isSaving,
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await templatesService.getTemplates({
        status: TemplateStatus.APPROVED,
        limit: 100,
        skip: 0,
      });
      setTemplates(response.items);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch templates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleTemplateSelect = (purpose: keyof WhatsAppDefaults, templateId: string) => {
    const newDefaults = { ...whatsappDefaults };
    if (templateId === 'none') {
      delete newDefaults[purpose];
    } else {
      newDefaults[purpose] = templateId;
    }
    onWhatsAppDefaultsChange(newDefaults);
  };

  const getTemplatePreview = (templateId: number | string | undefined): string => {
    if (!templateId) return '';
    const template = templates.find(t => String(t.id) === String(templateId));
    if (!template) return '';
    const bodyComponent = template.components?.find(c => c.type === 'BODY');
    return bodyComponent?.text || template.body || '';
  };

  const getTemplateName = (templateId: number | string | undefined): string => {
    if (!templateId) return 'None';
    const template = templates.find(t => String(t.id) === String(templateId));
    return template?.name || 'Unknown';
  };

  const extractVariables = (content: string): string[] => {
    const regex = /\{\{(\d+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    return variables.sort((a, b) => parseInt(a) - parseInt(b));
  };

  const handleVariableMappingChange = (variableNumber: string, fieldSource: string) => {
    const currentMapping = whatsappDefaults.followupVariableMapping || [];
    const existingIndex = currentMapping.findIndex(m => m.variableNumber === variableNumber);

    let newMapping: TemplateVariableMapping[];
    if (existingIndex >= 0) {
      newMapping = [...currentMapping];
      newMapping[existingIndex] = { variableNumber, fieldSource };
    } else {
      newMapping = [...currentMapping, { variableNumber, fieldSource }];
    }

    onWhatsAppDefaultsChange({
      ...whatsappDefaults,
      followupVariableMapping: newMapping,
    });
  };

  const getVariableMapping = (variableNumber: string): string => {
    const mapping = whatsappDefaults.followupVariableMapping?.find(m => m.variableNumber === variableNumber);
    return mapping?.fieldSource || '';
  };

  const followupTemplateId = whatsappDefaults.followup;
  const followupTemplateBody = getTemplatePreview(followupTemplateId);
  const followupVariables = followupTemplateBody ? extractVariables(followupTemplateBody) : [];

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Templates Card */}
        <Card className="border-border/60">
          <CardHeader className="p-3 pb-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Default Templates</CardTitle>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={fetchTemplates}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">Refresh templates</p></TooltipContent>
              </Tooltip>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Pre-selected templates when sending messages</p>
          </CardHeader>
          <CardContent className="p-3 pt-2">
            {error && (
              <div className="flex items-center gap-1.5 p-2 mb-3 border border-destructive/50 rounded-md bg-destructive/5">
                <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            {isLoading && templates.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground ml-2">Loading templates...</span>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No approved templates found</p>
                <p className="text-[10px] mt-0.5">Create and approve templates first</p>
              </div>
            ) : (
              <div className="space-y-2">
                {TEMPLATE_PURPOSES.map((purpose) => {
                  const selectedId = whatsappDefaults[purpose.key as keyof WhatsAppDefaults];
                  const preview = getTemplatePreview(selectedId);

                  return (
                    <div key={purpose.key} className="p-2.5 border rounded-md bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium">{purpose.label}</p>
                          <p className="text-[10px] text-muted-foreground">{purpose.description}</p>
                        </div>
                        {selectedId && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-mono">
                            {String(selectedId).substring(0, 8)}...
                          </Badge>
                        )}
                      </div>

                      <Select
                        value={selectedId?.toString() || 'none'}
                        onValueChange={(value) => handleTemplateSelect(purpose.key as keyof WhatsAppDefaults, value)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">
                            <span className="text-muted-foreground">None</span>
                          </SelectItem>
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id.toString()} className="text-xs">
                              <div className="flex items-center gap-1.5">
                                <span>{template.name}</span>
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                                  {template.language}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {preview && (
                        <div className="p-2 bg-muted/40 rounded text-[10px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {preview}
                        </div>
                      )}

                      {/* Variable Mapping for Followup */}
                      {purpose.key === 'followup' && selectedId && followupVariables.length > 0 && (
                        <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200/50 dark:border-blue-800/50">
                          <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 mb-1.5">Variable Mapping</p>
                          <div className="space-y-1.5">
                            {followupVariables.map((varNum) => (
                              <div key={varNum} className="flex items-center gap-2">
                                <span className="text-[10px] font-mono bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded border min-w-[44px] text-center">
                                  {`{{${varNum}}}`}
                                </span>
                                <Select
                                  value={getVariableMapping(varNum)}
                                  onValueChange={(value) => handleVariableMappingChange(varNum, value)}
                                >
                                  <SelectTrigger className="h-7 text-xs flex-1">
                                    <SelectValue placeholder="Select field" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FIELD_SOURCES.map((source) => (
                                      <SelectItem key={source.value} value={source.value} className="text-xs">
                                        {source.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Defaults Summary */}
        {Object.keys(whatsappDefaults).length > 0 && (
          <Card className="border-border/60">
            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Defaults</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {TEMPLATE_PURPOSES.map((purpose) => {
                  const selectedId = whatsappDefaults[purpose.key as keyof WhatsAppDefaults];
                  return (
                    <div key={purpose.key}>
                      <p className="text-[10px] text-muted-foreground">{purpose.label}</p>
                      <p className="text-xs font-medium truncate">{getTemplateName(selectedId)}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={onSave}
            size="sm"
            className="h-7 text-xs px-3 shadow-sm"
            disabled={isSaving || isLoading}
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3 w-3 mr-1.5" />
            )}
            Save WhatsApp Defaults
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
};
