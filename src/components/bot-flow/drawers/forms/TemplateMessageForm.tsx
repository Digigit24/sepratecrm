// src/components/bot-flow/drawers/forms/TemplateMessageForm.tsx

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTemplates } from '@/hooks/whatsapp/useTemplates';
import type { BotNode } from '@/types/botFlowTypes';
import { useNodeSave } from './useNodeSave';

const schema = z.object({
  name: z.string().min(1).max(200),
  template_uid: z.string().min(1, 'Please select a template'),
});

type FormValues = z.infer<typeof schema>;

interface Props { node: BotNode; nodeId: string; flowUid: string; }

export function TemplateMessageForm({ node, nodeId, flowUid }: Props) {
  const { saveNode, isSaving } = useNodeSave(flowUid, nodeId);
  const templateData = node.__data?.template_message;

  const { templates, isLoading: templatesLoading } = useTemplates({
    autoFetch: true,
    initialQuery: { skip: 0, limit: 100, status: 'APPROVED' as any },
  });

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: node.name || '',
      template_uid: templateData?.template_uid || '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    await saveNode({
      message_type: 'template',
      name: values.name,
      template_uid: values.template_uid,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Node Name</Label>
        <Input placeholder="e.g. Send Order Confirmation" {...register('name')} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Template</Label>
        <Controller
          name="template_uid"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={templatesLoading}>
              <SelectTrigger>
                <SelectValue placeholder={templatesLoading ? 'Loading templates...' : 'Select a template'} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t: any) => (
                  <SelectItem key={t.id || t._uid} value={t.id || t._uid}>
                    {t.name || t.template_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.template_uid && <p className="text-xs text-destructive">{errors.template_uid.message}</p>}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="submit" disabled={isSaving} size="sm">
          {isSaving ? 'Saving...' : 'Save Node'}
        </Button>
      </div>
    </form>
  );
}
