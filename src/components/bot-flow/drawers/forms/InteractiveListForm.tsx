// src/components/bot-flow/drawers/forms/InteractiveListForm.tsx

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import type { BotNode, ListSection } from '@/types/botFlowTypes';
import { useNodeSave } from './useNodeSave';

const rowSchema = z.object({ id: z.string(), title: z.string().min(1, 'Row title required'), description: z.string().optional() });
const sectionSchema = z.object({ title: z.string().min(1, 'Section title required'), rows: z.array(rowSchema).min(1) });

const schema = z.object({
  name: z.string().min(1).max(200),
  reply_text: z.string().min(1, 'Body text is required'),
  header_text: z.string().optional(),
  footer_text: z.string().optional(),
  list_button_text: z.string().min(1, 'Button label required'),
  sections: z.array(sectionSchema).min(1),
});

type FormValues = z.infer<typeof schema>;

interface Props { node: BotNode; nodeId: string; flowUid: string; }

export function InteractiveListForm({ node, nodeId, flowUid }: Props) {
  const { saveNode, isSaving } = useNodeSave(flowUid, nodeId);
  const interaction = node.__data?.interaction_message;
  const existingSections: ListSection[] = interaction?.list_data?.sections || [{ title: 'Section 1', rows: [{ id: 'row_1', title: '' }] }];

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: node.name || '',
      reply_text: interaction?.body_text || node.reply_text || '',
      header_text: interaction?.header_text || '',
      footer_text: interaction?.footer_text || '',
      list_button_text: interaction?.list_data?.button_text || 'Choose an option',
      sections: existingSections,
    },
  });

  const { fields: sectionFields, append: appendSection, remove: removeSection } = useFieldArray({ control, name: 'sections' });

  const onSubmit = async (values: FormValues) => {
    await saveNode({
      message_type: 'interactive',
      interactive_type: 'list',
      name: values.name,
      reply_text: values.reply_text,
      header_type: 'none',
      header_text: values.header_text,
      footer_text: values.footer_text,
      list_button_text: values.list_button_text,
      sections: values.sections,
    } as any);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Node Name</Label>
        <Input placeholder="e.g. Main Menu" {...register('name')} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Body Text</Label>
        <Textarea placeholder="Message body..." rows={3} {...register('reply_text')} />
        {errors.reply_text && <p className="text-xs text-destructive">{errors.reply_text.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Footer Text (optional)</Label>
        <Input placeholder="Message footer..." {...register('footer_text')} />
      </div>

      <div className="space-y-2">
        <Label>List Button Label</Label>
        <Input placeholder="Choose an option" {...register('list_button_text')} />
        {errors.list_button_text && <p className="text-xs text-destructive">{errors.list_button_text.message}</p>}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Sections</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => appendSection({ title: `Section ${sectionFields.length + 1}`, rows: [{ id: `row_${Date.now()}`, title: '' }] })}>
            <Plus className="h-3 w-3 mr-1" /> Section
          </Button>
        </div>

        {sectionFields.map((sField, sIdx) => (
          <SectionEditor key={sField.id} sectionIndex={sIdx} control={control} register={register} onRemoveSection={() => removeSection(sIdx)} canRemove={sectionFields.length > 1} />
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="submit" disabled={isSaving} size="sm">
          {isSaving ? 'Saving...' : 'Save Node'}
        </Button>
      </div>
    </form>
  );
}

function SectionEditor({ sectionIndex, control, register, onRemoveSection, canRemove }: any) {
  const { fields: rowFields, append: appendRow, remove: removeRow } = useFieldArray({ control, name: `sections.${sectionIndex}.rows` });

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input placeholder="Section title" {...register(`sections.${sectionIndex}.title`)} className="flex-1" />
        {canRemove && (
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onRemoveSection}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        )}
      </div>

      <div className="space-y-1.5 pl-2">
        {rowFields.map((row, rIdx) => (
          <div key={row.id} className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground w-4">{rIdx + 1}.</span>
            <Input
              placeholder={`Row ${rIdx + 1} title`}
              {...register(`sections.${sectionIndex}.rows.${rIdx}.title`)}
              className="flex-1 h-7 text-xs"
            />
            {rowFields.length > 1 && (
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(rIdx)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={() => appendRow({ id: `row_${Date.now()}`, title: '' })}
        >
          <Plus className="h-3 w-3 mr-1" /> Add Row
        </Button>
      </div>
    </div>
  );
}
