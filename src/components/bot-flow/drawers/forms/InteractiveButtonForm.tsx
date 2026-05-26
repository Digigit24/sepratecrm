// src/components/bot-flow/drawers/forms/InteractiveButtonForm.tsx

import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import type { BotNode } from '@/types/botFlowTypes';
import { useNodeSave } from './useNodeSave';

const schema = z.object({
  name: z.string().min(1).max(200),
  reply_text: z.string().min(1, 'Body text is required'),
  header_text: z.string().optional(),
  footer_text: z.string().optional(),
  buttons: z.array(z.object({ title: z.string().min(1, 'Button label required') })).min(1).max(3),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  node: BotNode;
  nodeId: string;
  flowUid: string;
}

export function InteractiveButtonForm({ node, nodeId, flowUid }: Props) {
  const { saveNode, isSaving } = useNodeSave(flowUid, nodeId);
  const interaction = node.__data?.interaction_message;

  const existingButtons = interaction?.buttons
    ? Object.values(interaction.buttons).map((b: any) => ({ title: b.title }))
    : [{ title: '' }];

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: node.name || '',
      reply_text: interaction?.body_text || node.reply_text || '',
      header_text: interaction?.header_text || '',
      footer_text: interaction?.footer_text || '',
      buttons: existingButtons,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'buttons' });

  const onSubmit = async (values: FormValues) => {
    const buttonsRecord: Record<string, { id: string; title: string }> = {};
    values.buttons.forEach((btn, idx) => {
      const key = String(idx + 1);
      buttonsRecord[key] = { id: `btn_${key}`, title: btn.title };
    });

    await saveNode({
      message_type: 'interactive',
      interactive_type: 'button',
      name: values.name,
      reply_text: values.reply_text,
      header_type: 'none',
      header_text: values.header_text,
      footer_text: values.footer_text,
      buttons: buttonsRecord,
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
        <Label>Header Text (optional)</Label>
        <Input placeholder="Message header..." {...register('header_text')} />
      </div>

      <div className="space-y-2">
        <Label>Body Text</Label>
        <Textarea placeholder="Message body..." rows={4} {...register('reply_text')} />
        {errors.reply_text && <p className="text-xs text-destructive">{errors.reply_text.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Footer Text (optional)</Label>
        <Input placeholder="Message footer..." {...register('footer_text')} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Buttons (max 3)</Label>
          {fields.length < 3 && (
            <Button type="button" variant="outline" size="sm" onClick={() => append({ title: '' })}>
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {fields.map((field, idx) => (
            <div key={field.id} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
              <Input
                placeholder={`Button ${idx + 1} label`}
                {...register(`buttons.${idx}.title`)}
                className="flex-1"
              />
              {fields.length > 1 && (
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(idx)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
        {errors.buttons && <p className="text-xs text-destructive">At least 1 button required</p>}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="submit" disabled={isSaving} size="sm">
          {isSaving ? 'Saving...' : 'Save Node'}
        </Button>
      </div>
    </form>
  );
}
