// src/components/admin-settings/WhatsAppDefaultsTab.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { templatesService } from '@/services/whatsapp/templatesService';
import { Template, TemplateStatus } from '@/types/whatsappTypes';
import type { WhatsAppDefaults, TemplateVariableMapping } from '@/types/user.types';

interface WhatsAppDefaultsTabProps {
  whatsappDefaults: WhatsAppDefaults;
  onWhatsAppDefaultsChange: (defaults: WhatsAppDefaults) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

// Template purpose options
const TEMPLATE_PURPOSES = [
  { key: 'followup', label: 'Followup Reminder', description: 'Default template for CRM followup reminders' },
  { key: 'leadNotification', label: 'Lead Notification', description: 'Default template for new lead notifications' },
  { key: 'appointmentReminder', label: 'Appointment Reminder', description: 'Default template for appointment reminders' },
  { key: 'welcomeMessage', label: 'Welcome Message', description: 'Default template for welcoming new contacts' },
] as const;

// Field sources for variable mapping
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

  // Fetch approved templates
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

  // Handle template selection for a purpose
  const handleTemplateSelect = (purpose: keyof WhatsAppDefaults, templateId: string) => {
    const newDefaults = { ...whatsappDefaults };
    if (templateId === 'none') {
      delete newDefaults[purpose];
    } else {
      // Always store as string to preserve UUIDs like "858d35c1-..."
      // parseInt("858d35c1-...") incorrectly returns 858, not the full UUID
      newDefaults[purpose] = templateId;
    }
    onWhatsAppDefaultsChange(newDefaults);
  };

  // Get template preview text
  const getTemplatePreview = (templateId: number | string | undefined): string => {
    if (!templateId) return '';
    // Compare as strings to handle both number and string IDs
    const template = templates.find(t => String(t.id) === String(templateId));
    if (!template) return '';
    const bodyComponent = template.components?.find(c => c.type === 'BODY');
    return bodyComponent?.text || template.body || '';
  };

  // Get template name by ID
  const getTemplateName = (templateId: number | string | undefined): string => {
    if (!templateId) return 'None selected';
    // Compare as strings to handle both number and string IDs
    const template = templates.find(t => String(t.id) === String(templateId));
    return template?.name || 'Unknown template';
  };

  // Extract variables from template body
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

  // Handle variable mapping change
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

  // Get current mapping for a variable
  const getVariableMapping = (variableNumber: string): string => {
    const mapping = whatsappDefaults.followupVariableMapping?.find(m => m.variableNumber === variableNumber);
    return mapping?.fieldSource || '';
  };

  // Get followup template variables
  const followupTemplateId = whatsappDefaults.followup;
  const followupTemplateBody = getTemplatePreview(followupTemplateId);
  const followupVariables = followupTemplateBody ? extractVariables(followupTemplateBody) : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <CardTitle>WhatsApp Default Templates</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchTemplates}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh Templates
              </Button>
            </div>
          </div>
          <CardDescription>
            Configure default WhatsApp templates for different purposes. These templates will be pre-selected when sending messages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-center gap-2 p-4 mb-4 border border-destructive rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {isLoading && templates.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-sm text-muted-foreground">Loading templates...</p>
              </div>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No approved templates found</p>
              <p className="text-xs mt-1">Create and approve templates in WhatsApp settings first</p>
            </div>
          ) : (
            <div className="space-y-6">
              {TEMPLATE_PURPOSES.map((purpose) => {
                const selectedId = whatsappDefaults[purpose.key as keyof WhatsAppDefaults];
                const preview = getTemplatePreview(selectedId);

                return (
                  <div key={purpose.key} className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <Label className="text-base font-medium">{purpose.label}</Label>
                        <p className="text-sm text-muted-foreground">{purpose.description}</p>
                      </div>
                      {selectedId && (
                        <Badge variant="secondary">
                          ID: {selectedId}
                        </Badge>
                      )}
                    </div>

                    <Select
                      value={selectedId?.toString() || 'none'}
                      onValueChange={(value) => handleTemplateSelect(purpose.key as keyof WhatsAppDefaults, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">None (no default)</span>
                        </SelectItem>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id.toString()}>
                            <div className="flex items-center gap-2">
                              <span>{template.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {template.language}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {template.category}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {preview && (
                      <div className="p-3 bg-muted/50 rounded-md">
                        <Label className="text-xs text-muted-foreground">Preview:</Label>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{preview}</p>
                      </div>
                    )}

                    {/* Variable Mapping UI for Followup Template */}
                    {purpose.key === 'followup' && selectedId && followupVariables.length > 0 && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
                        <Label className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                          Variable Mapping (Auto-fill fields)
                        </Label>
                        <p className="text-xs text-muted-foreground mb-3">
                          Configure which data fields map to template variables
                        </p>
                        <div className="space-y-2">
                          {followupVariables.map((varNum) => (
                            <div key={varNum} className="flex items-center gap-3">
                              <span className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border min-w-[60px] text-center">
                                {`{{${varNum}}}`}
                              </span>
                              <Select
                                value={getVariableMapping(varNum)}
                                onValueChange={(value) => handleVariableMappingChange(varNum, value)}
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Select field source" />
                                </SelectTrigger>
                                <SelectContent>
                                  {FIELD_SOURCES.map((source) => (
                                    <SelectItem key={source.value} value={source.value}>
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

      {/* Current Defaults Summary */}
      {Object.keys(whatsappDefaults).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Defaults Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {TEMPLATE_PURPOSES.map((purpose) => {
                const selectedId = whatsappDefaults[purpose.key as keyof WhatsAppDefaults];
                return (
                  <div key={purpose.key} className="space-y-1">
                    <p className="text-muted-foreground">{purpose.label}:</p>
                    <p className="font-medium">{getTemplateName(selectedId)}</p>
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
          disabled={isSaving || isLoading}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save WhatsApp Defaults
        </Button>
      </div>
    </div>
  );
};
