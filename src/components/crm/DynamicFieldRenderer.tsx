// src/components/crm/DynamicFieldRenderer.tsx
import { Controller, Control, FieldValues, Path } from 'react-hook-form';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

import type { LeadFieldConfiguration, FieldTypeEnum } from '@/types/crmTypes';

interface DynamicFieldRendererProps<TFieldValues extends FieldValues> {
  field: LeadFieldConfiguration;
  control: Control<TFieldValues>;
  fieldName: Path<TFieldValues>;
  disabled?: boolean;
  error?: string;
  value?: any;
  onChange?: (value: any) => void;
}

export function DynamicFieldRenderer<TFieldValues extends FieldValues>({
  field,
  control,
  fieldName,
  disabled = false,
  error,
  value,
  onChange,
}: DynamicFieldRendererProps<TFieldValues>) {
  const renderField = () => {
    const fieldType = field.field_type;

    switch (fieldType) {
      case 'TEXT':
      case 'EMAIL':
      case 'PHONE':
      case 'URL':
        return (
          <Controller
            name={fieldName}
            control={control}
            render={({ field: formField }) => (
              <Input
                {...formField}
                type={
                  fieldType === 'EMAIL'
                    ? 'email'
                    : fieldType === 'PHONE'
                    ? 'tel'
                    : fieldType === 'URL'
                    ? 'url'
                    : 'text'
                }
                placeholder={field.placeholder || ''}
                disabled={disabled}
                className={error ? 'border-destructive' : ''}
                onChange={(e) => {
                  formField.onChange(e);
                  onChange?.(e.target.value);
                }}
              />
            )}
          />
        );

      case 'NUMBER':
      case 'DECIMAL':
        return (
          <Controller
            name={fieldName}
            control={control}
            render={({ field: formField }) => (
              <Input
                {...formField}
                type="number"
                step={fieldType === 'DECIMAL' ? '0.01' : '1'}
                placeholder={field.placeholder || ''}
                disabled={disabled}
                className={error ? 'border-destructive' : ''}
                onChange={(e) => {
                  formField.onChange(e);
                  onChange?.(e.target.value);
                }}
              />
            )}
          />
        );

      case 'CURRENCY':
        return (
          <Controller
            name={fieldName}
            control={control}
            render={({ field: formField }) => (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  {...formField}
                  type="number"
                  step="0.01"
                  placeholder={field.placeholder || '0.00'}
                  disabled={disabled}
                  className={cn('pl-7', error ? 'border-destructive' : '')}
                  onChange={(e) => {
                    formField.onChange(e);
                    onChange?.(e.target.value);
                  }}
                />
              </div>
            )}
          />
        );

      case 'TEXTAREA':
        return (
          <Controller
            name={fieldName}
            control={control}
            render={({ field: formField }) => (
              <Textarea
                {...formField}
                placeholder={field.placeholder || ''}
                rows={4}
                disabled={disabled}
                className={error ? 'border-destructive' : ''}
                onChange={(e) => {
                  formField.onChange(e);
                  onChange?.(e.target.value);
                }}
              />
            )}
          />
        );

      case 'DATE':
        return (
          <Controller
            name={fieldName}
            control={control}
            render={({ field: formField }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !formField.value && 'text-muted-foreground',
                      error && 'border-destructive'
                    )}
                    disabled={disabled}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formField.value
                      ? format(new Date(formField.value), 'PPP')
                      : field.placeholder || 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formField.value ? new Date(formField.value) : undefined}
                    onSelect={(date) => {
                      const value = date ? date.toISOString().split('T')[0] : '';
                      formField.onChange(value);
                      onChange?.(value);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}
          />
        );

      case 'DATETIME':
        return (
          <Controller
            name={fieldName}
            control={control}
            render={({ field: formField }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !formField.value && 'text-muted-foreground',
                      error && 'border-destructive'
                    )}
                    disabled={disabled}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formField.value
                      ? format(new Date(formField.value), 'PPP p')
                      : field.placeholder || 'Pick a date & time'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formField.value ? new Date(formField.value) : undefined}
                    onSelect={(date) => {
                      const value = date ? date.toISOString() : '';
                      formField.onChange(value);
                      onChange?.(value);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}
          />
        );

      case 'DROPDOWN':
        return (
          <Controller
            name={fieldName}
            control={control}
            render={({ field: formField }) => (
              <Select
                value={formField.value || ''}
                onValueChange={(value) => {
                  formField.onChange(value);
                  onChange?.(value);
                }}
                disabled={disabled}
              >
                <SelectTrigger className={error ? 'border-destructive' : ''}>
                  <SelectValue placeholder={field.placeholder || 'Select an option'} />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(field.options) &&
                    field.options.map((option: string, index: number) => (
                      <SelectItem key={index} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          />
        );

      case 'MULTISELECT':
        return (
          <Controller
            name={fieldName}
            control={control}
            render={({ field: formField }) => {
              const selectedValues = Array.isArray(formField.value) ? formField.value : [];

              const handleToggle = (option: string) => {
                const newValues = selectedValues.includes(option)
                  ? selectedValues.filter((v) => v !== option)
                  : [...selectedValues, option];
                formField.onChange(newValues);
                onChange?.(newValues);
              };

              const handleRemove = (option: string) => {
                const newValues = selectedValues.filter((v) => v !== option);
                formField.onChange(newValues);
                onChange?.(newValues);
              };

              return (
                <div className="space-y-2">
                  <Select
                    value=""
                    onValueChange={handleToggle}
                    disabled={disabled}
                  >
                    <SelectTrigger className={error ? 'border-destructive' : ''}>
                      <SelectValue placeholder={field.placeholder || 'Select options'} />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(field.options) &&
                        field.options.map((option: string, index: number) => (
                          <SelectItem key={index} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedValues.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedValues.map((value, index) => (
                        <Badge key={index} variant="secondary" className="gap-1">
                          {value}
                          {!disabled && (
                            <button
                              type="button"
                              onClick={() => handleRemove(value)}
                              className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            }}
          />
        );

      case 'CHECKBOX':
        return (
          <Controller
            name={fieldName}
            control={control}
            render={({ field: formField }) => (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={fieldName}
                  checked={!!formField.value}
                  onCheckedChange={(checked) => {
                    formField.onChange(checked);
                    onChange?.(checked);
                  }}
                  disabled={disabled}
                />
                <Label
                  htmlFor={fieldName}
                  className="text-sm font-normal cursor-pointer select-none"
                >
                  {field.help_text || field.field_label}
                </Label>
              </div>
            )}
          />
        );

      default:
        return (
          <Controller
            name={fieldName}
            control={control}
            render={({ field: formField }) => (
              <Input
                {...formField}
                placeholder={field.placeholder || ''}
                disabled={disabled}
                className={error ? 'border-destructive' : ''}
                onChange={(e) => {
                  formField.onChange(e);
                  onChange?.(e.target.value);
                }}
              />
            )}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      {field.field_type !== 'CHECKBOX' && (
        <Label
          htmlFor={fieldName}
          className={cn(
            error && 'text-destructive',
            !field.is_visible && 'opacity-50'
          )}
        >
          {field.field_label}
          {field.is_required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      {renderField()}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {field.help_text && field.field_type !== 'CHECKBOX' && (
        <p className="text-sm text-muted-foreground">{field.help_text}</p>
      )}
    </div>
  );
}
