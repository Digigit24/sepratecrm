// src/components/lead-drawer/LeadCustomFields.tsx
import { forwardRef, useImperativeHandle, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';

import { DynamicFieldRenderer } from '@/components/crm/DynamicFieldRenderer';
import type { Lead, LeadFieldConfiguration } from '@/types/crmTypes';
import type { PartialLeadFormHandle } from '../LeadsFormDrawer';
import { useCRM } from '@/hooks/useCRM';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface LeadCustomFieldsProps {
  lead?: Lead | null;
  mode: 'view' | 'edit' | 'create';
}

const LeadCustomFields = forwardRef<PartialLeadFormHandle, LeadCustomFieldsProps>(
  ({ lead, mode }, ref) => {
    const { useFieldConfigurations } = useCRM();

    // Fetch custom field configurations
    const { data: configurationsData, isLoading, error } = useFieldConfigurations({
      is_standard: false,
      is_active: true,
      is_visible: true,
      ordering: 'display_order',
      page_size: 100,
    });

    const customFields = configurationsData?.results || [];

    const isReadOnly = mode === 'view';

    // Build dynamic schema based on custom field configurations
    const customFieldSchema = useMemo(() => {
      const schemaObject: Record<string, z.ZodTypeAny> = {};

      customFields.forEach((field) => {
        let fieldSchema: z.ZodTypeAny = z.any().optional();

        // Apply validation based on field type
        switch (field.field_type) {
          case 'EMAIL':
            fieldSchema = z.string().email('Invalid email').optional().or(z.literal(''));
            break;
          case 'URL':
            fieldSchema = z.string().url('Invalid URL').optional().or(z.literal(''));
            break;
          case 'NUMBER':
          case 'DECIMAL':
          case 'CURRENCY':
            fieldSchema = z.string().optional();
            break;
          case 'CHECKBOX':
            fieldSchema = z.boolean().optional();
            break;
          case 'MULTISELECT':
            fieldSchema = z.array(z.string()).optional();
            break;
          default:
            fieldSchema = z.string().optional();
        }

        // Make field required if is_required is true
        if (field.is_required) {
          if (field.field_type === 'CHECKBOX') {
            fieldSchema = z.boolean({
              required_error: `${field.field_label} is required`,
            }).refine((val) => val === true, {
              message: `${field.field_label} must be checked`,
            });
          } else if (field.field_type === 'MULTISELECT') {
            fieldSchema = z
              .array(z.string())
              .min(1, `${field.field_label} - at least one option is required`);
          } else if (field.field_type === 'EMAIL') {
            fieldSchema = z
              .string()
              .min(1, `${field.field_label} is required`)
              .email('Invalid email address');
          } else if (field.field_type === 'URL') {
            fieldSchema = z
              .string()
              .min(1, `${field.field_label} is required`)
              .url('Invalid URL');
          } else {
            fieldSchema = z
              .string()
              .min(1, `${field.field_label} is required`);
          }
        }

        schemaObject[field.field_name] = fieldSchema;
      });

      return z.object(schemaObject);
    }, [customFields]);

    type CustomFieldsFormData = z.infer<typeof customFieldSchema>;

    const {
      control,
      reset,
      handleSubmit,
      formState: { errors },
    } = useForm<CustomFieldsFormData>({
      resolver: zodResolver(customFieldSchema),
      defaultValues: {},
    });

    // Initialize form with lead metadata
    useEffect(() => {
      if (customFields.length === 0) return;

      const formValues: Record<string, any> = {};
      customFields.forEach((field) => {
        // Get value from lead metadata or use default
        let value = field.default_value || '';

        if (lead?.metadata?.[field.field_name] !== undefined) {
          value = lead.metadata[field.field_name];
        }

        // Handle different field types
        if (field.field_type === 'CHECKBOX') {
          formValues[field.field_name] = value === true || value === 'true';
        } else if (field.field_type === 'MULTISELECT') {
          formValues[field.field_name] = Array.isArray(value) ? value : [];
        } else {
          formValues[field.field_name] = value || '';
        }
      });

      reset(formValues);
    }, [lead?.metadata, customFields, mode, reset]);

    // Expose getFormValues to parent
    useImperativeHandle(ref, () => ({
      getFormValues: async () => {
        return new Promise((resolve) => {
          handleSubmit(
            (data) => {
              // Clean up empty values and format for backend
              const cleanedData: Record<string, any> = {};
              Object.entries(data).forEach(([key, value]) => {
                if (value !== '' && value !== null && value !== undefined) {
                  cleanedData[key] = value;
                }
              });

              // Return custom fields as metadata
              resolve({ metadata: cleanedData });
            },
            (errors) => {
              console.error('Custom fields validation errors:', errors);
              resolve(null);
            }
          )();
        });
      },
    }));

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading custom fields...</span>
        </div>
      );
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load custom fields. Please try again.
          </AlertDescription>
        </Alert>
      );
    }

    if (customFields.length === 0) {
      return (
        <Alert>
          <AlertDescription>
            No custom fields configured. You can add custom fields in the CRM settings.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-6">
        {customFields.map((field) => (
          <DynamicFieldRenderer
            key={field.id}
            field={field}
            control={control}
            fieldName={field.field_name as any}
            disabled={isReadOnly}
            error={errors[field.field_name]?.message as string | undefined}
          />
        ))}
      </div>
    );
  }
);

LeadCustomFields.displayName = 'LeadCustomFields';

export default LeadCustomFields;
