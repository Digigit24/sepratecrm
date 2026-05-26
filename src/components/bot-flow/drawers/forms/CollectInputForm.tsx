// src/components/bot-flow/drawers/forms/CollectInputForm.tsx

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Controller } from 'react-hook-form';
import type { BotNode } from '@/types/botFlowTypes';
import { useNodeSave } from './useNodeSave';

const schema = z.object({
  name: z.string().min(1).max(200),
  collect_input_question: z.string().min(1, 'Question is required'),
  variable_name: z.string().min(1, 'Variable name is required').regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores'),
  collect_input_validation: z.enum(['none', 'email', 'phone', 'number']),
  collect_input_error_message: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props { node: BotNode; nodeId: string; flowUid: string; }

export function CollectInputForm({ node, nodeId, flowUid }: Props) {
  const { saveNode, isSaving } = useNodeSave(flowUid, nodeId);
  const input = node.__data?.collect_input;

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: node.name || '',
      collect_input_question: input?.question || node.reply_text || '',
      variable_name: input?.variable_name || 'answer',
      collect_input_validation: (input?.validation as any) || 'none',
      collect_input_error_message: input?.error_message || '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    await saveNode({
      message_type: 'collect_input',
      name: values.name,
      collect_input_question: values.collect_input_question,
      variable_name: values.variable_name,
      collect_input_validation: values.collect_input_validation,
      collect_input_error_message: values.collect_input_error_message,
    } as any);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Node Name</Label>
        <Input placeholder="e.g. Ask for Name" {...register('name')} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Question to Ask</Label>
        <Textarea placeholder="e.g. Please enter your email address:" rows={3} {...register('collect_input_question')} />
        {errors.collect_input_question && <p className="text-xs text-destructive">{errors.collect_input_question.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Variable Name</Label>
        <Input placeholder="e.g. user_email" {...register('variable_name')} />
        <p className="text-xs text-muted-foreground">Stored as {'{variable_name}'} — use in later messages</p>
        {errors.variable_name && <p className="text-xs text-destructive">{errors.variable_name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Validation</Label>
        <Controller
          name="collect_input_validation"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">Phone Number</SelectItem>
                <SelectItem value="number">Number</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-2">
        <Label>Error Message (shown when validation fails)</Label>
        <Input placeholder="e.g. Please enter a valid email" {...register('collect_input_error_message')} />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="submit" disabled={isSaving} size="sm">
          {isSaving ? 'Saving...' : 'Save Node'}
        </Button>
      </div>
    </form>
  );
}
