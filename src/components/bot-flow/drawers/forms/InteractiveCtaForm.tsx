// src/components/bot-flow/drawers/forms/InteractiveCtaForm.tsx

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { BotNode } from '@/types/botFlowTypes';
import { useNodeSave } from './useNodeSave';

const schema = z.object({
  name: z.string().min(1).max(200),
  reply_text: z.string().min(1, 'Body text is required'),
  header_text: z.string().optional(),
  footer_text: z.string().optional(),
  button_display_text: z.string().min(1, 'Button label required'),
  button_url: z.string().url('Must be a valid URL'),
});

type FormValues = z.infer<typeof schema>;

interface Props { node: BotNode; nodeId: string; flowUid: string; }

export function InteractiveCtaForm({ node, nodeId, flowUid }: Props) {
  const { saveNode, isSaving } = useNodeSave(flowUid, nodeId);
  const interaction = node.__data?.interaction_message;

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: node.name || '',
      reply_text: interaction?.body_text || node.reply_text || '',
      header_text: interaction?.header_text || '',
      footer_text: interaction?.footer_text || '',
      button_display_text: interaction?.cta_url?.display_text || '',
      button_url: interaction?.cta_url?.url || '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    await saveNode({
      message_type: 'interactive',
      interactive_type: 'cta_url',
      name: values.name,
      reply_text: values.reply_text,
      header_type: 'none',
      header_text: values.header_text,
      footer_text: values.footer_text,
      button_display_text: values.button_display_text,
      button_url: values.button_url,
    } as any);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Node Name</Label>
        <Input placeholder="e.g. Visit Website" {...register('name')} />
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

      <div className="space-y-4 border rounded-lg p-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">CTA Button</p>
        <div className="space-y-2">
          <Label>Button Label</Label>
          <Input placeholder="e.g. Visit our website" {...register('button_display_text')} />
          {errors.button_display_text && <p className="text-xs text-destructive">{errors.button_display_text.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>URL</Label>
          <Input placeholder="https://example.com" {...register('button_url')} />
          {errors.button_url && <p className="text-xs text-destructive">{errors.button_url.message}</p>}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="submit" disabled={isSaving} size="sm">
          {isSaving ? 'Saving...' : 'Save Node'}
        </Button>
      </div>
    </form>
  );
}
