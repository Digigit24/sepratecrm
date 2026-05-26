// src/components/bot-flow/drawers/forms/SimpleMessageForm.tsx

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
  name: z.string().min(1, 'Name is required').max(200),
  reply_text: z.string().min(1, 'Message text is required'),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  node: BotNode;
  nodeId: string;
  flowUid: string;
}

export function SimpleMessageForm({ node, nodeId, flowUid }: Props) {
  const { saveNode, isSaving } = useNodeSave(flowUid, nodeId);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: node.name || '',
      reply_text: node.reply_text || '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    await saveNode({
      message_type: 'simple',
      name: values.name,
      reply_text: values.reply_text,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Node Name</Label>
        <Input id="name" placeholder="e.g. Welcome Message" {...register('name')} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reply_text">Message Text</Label>
        <Textarea
          id="reply_text"
          placeholder="Type your message here..."
          rows={6}
          {...register('reply_text')}
        />
        {errors.reply_text && <p className="text-xs text-destructive">{errors.reply_text.message}</p>}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="submit" disabled={isSaving} size="sm">
          {isSaving ? 'Saving...' : 'Save Node'}
        </Button>
      </div>
    </form>
  );
}
