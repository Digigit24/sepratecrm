// src/components/bot-flow/drawers/forms/MediaMessageForm.tsx

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BotNode } from '@/types/botFlowTypes';
import { useNodeSave } from './useNodeSave';

const schema = z.object({
  name: z.string().min(1).max(200),
  media_type: z.enum(['image', 'video', 'audio', 'document']),
  media_url: z.string().url('Must be a valid URL').min(1, 'Media URL is required'),
  caption: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props { node: BotNode; nodeId: string; flowUid: string; }

export function MediaMessageForm({ node, nodeId, flowUid }: Props) {
  const { saveNode, isSaving } = useNodeSave(flowUid, nodeId);
  const media = node.__data?.media_message;

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: node.name || '',
      media_type: (media?.header_type as any) || 'image',
      media_url: media?.media_link || '',
      caption: media?.caption || '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    await saveNode({
      message_type: 'media',
      name: values.name,
      media_type: values.media_type,
      media_url: values.media_url,
      caption: values.caption,
    } as any);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Node Name</Label>
        <Input placeholder="e.g. Product Image" {...register('name')} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Media Type</Label>
        <Controller
          name="media_type"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="document">Document</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-2">
        <Label>Media URL</Label>
        <Input placeholder="https://example.com/image.jpg" {...register('media_url')} />
        <p className="text-xs text-muted-foreground">Enter a publicly accessible URL for the media</p>
        {errors.media_url && <p className="text-xs text-destructive">{errors.media_url.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Caption (optional)</Label>
        <Textarea placeholder="Image caption..." rows={3} {...register('caption')} />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="submit" disabled={isSaving} size="sm">
          {isSaving ? 'Saving...' : 'Save Node'}
        </Button>
      </div>
    </form>
  );
}
