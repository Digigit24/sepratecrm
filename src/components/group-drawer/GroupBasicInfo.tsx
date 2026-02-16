// src/components/group-drawer/GroupBasicInfo.tsx
import { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { X, Plus, Users, Crown } from 'lucide-react';
import type { Group, CreateGroupPayload } from '@/types/whatsappTypes';

export interface GroupBasicInfoHandle {
  getFormValues: () => Promise<CreateGroupPayload | null>;
}

interface GroupBasicInfoProps {
  group?: Group | null;
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
}

const GroupBasicInfo = forwardRef<GroupBasicInfoHandle, GroupBasicInfoProps>(
  ({ group, mode, onSuccess }, ref) => {
    // Form state
    const [formData, setFormData] = useState({
      group_id: '',
      name: '',
      description: '',
      participants: [] as string[],
      admins: [] as string[],
      group_invite_link: '',
      created_by: '',
      is_active: true,
    });

    // Input states for adding participants/admins
    const [newParticipant, setNewParticipant] = useState('');
    const [newAdmin, setNewAdmin] = useState('');

    // Validation errors
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Initialize form data when group changes
    useEffect(() => {
      if (group) {
        setFormData({
          group_id: group.group_id || '',
          name: group.name || '',
          description: group.description || '',
          participants: group.participants || [],
          admins: group.admins || [],
          group_invite_link: group.group_invite_link || '',
          created_by: group.created_by || '',
          is_active: group.is_active ?? true,
        });
      } else if (mode === 'create') {
        // Reset for create mode
        setFormData({
          group_id: '',
          name: '',
          description: '',
          participants: [],
          admins: [],
          group_invite_link: '',
          created_by: '',
          is_active: true,
        });
      }
      setErrors({});
    }, [group, mode]);

    // Validation function
    const validateForm = (): boolean => {
      const newErrors: Record<string, string> = {};

      if (!formData.group_id.trim()) {
        newErrors.group_id = 'WhatsApp Group ID is required';
      }

      if (!formData.name.trim()) {
        newErrors.name = 'Group name is required';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    // Expose form methods to parent
    useImperativeHandle(ref, () => ({
      getFormValues: async (): Promise<CreateGroupPayload | null> => {
        if (!validateForm()) {
          return null;
        }

        return {
          group_id: formData.group_id.trim(),
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          participants: formData.participants,
          admins: formData.admins,
          group_invite_link: formData.group_invite_link.trim() || undefined,
          created_by: formData.created_by.trim() || undefined,
        };
      },
    }));

    const handleInputChange = (field: string, value: any) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      // Clear error when user starts typing
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: '' }));
      }
    };

    const addParticipant = () => {
      const phone = newParticipant.trim();
      if (phone && !formData.participants.includes(phone)) {
        setFormData(prev => ({
          ...prev,
          participants: [...prev.participants, phone]
        }));
        setNewParticipant('');
      }
    };

    const removeParticipant = (phone: string) => {
      setFormData(prev => ({
        ...prev,
        participants: prev.participants.filter(p => p !== phone),
        admins: prev.admins.filter(a => a !== phone) // Remove from admins too
      }));
    };

    const addAdmin = () => {
      const phone = newAdmin.trim();
      if (phone) {
        // Add to participants if not already there
        const updatedParticipants = formData.participants.includes(phone) 
          ? formData.participants 
          : [...formData.participants, phone];
        
        // Add to admins if not already there
        const updatedAdmins = formData.admins.includes(phone)
          ? formData.admins
          : [...formData.admins, phone];

        setFormData(prev => ({
          ...prev,
          participants: updatedParticipants,
          admins: updatedAdmins
        }));
        setNewAdmin('');
      }
    };

    const removeAdmin = (phone: string) => {
      setFormData(prev => ({
        ...prev,
        admins: prev.admins.filter(a => a !== phone)
      }));
    };

    const isReadOnly = mode === 'view';

    return (
      <div className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Basic Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="group_id">WhatsApp Group ID *</Label>
              <Input
                id="group_id"
                value={formData.group_id}
                onChange={(e) => handleInputChange('group_id', e.target.value)}
                placeholder="Enter WhatsApp Group ID (e.g., 120363123456789012@g.us)"
                disabled={isReadOnly}
                className={errors.group_id ? 'border-destructive' : ''}
              />
              <p className="text-xs text-muted-foreground">
                The unique WhatsApp Group ID from WhatsApp (usually ends with @g.us)
              </p>
              {errors.group_id && (
                <p className="text-sm text-destructive">{errors.group_id}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Group Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter group name"
                disabled={isReadOnly}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter group description (optional)"
              disabled={isReadOnly}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="group_invite_link">Invite Link</Label>
              <Input
                id="group_invite_link"
                value={formData.group_invite_link}
                onChange={(e) => handleInputChange('group_invite_link', e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="created_by">Created By</Label>
              <Input
                id="created_by"
                value={formData.created_by}
                onChange={(e) => handleInputChange('created_by', e.target.value)}
                placeholder="Creator phone number"
                disabled={isReadOnly}
              />
            </div>
          </div>

          {mode !== 'create' && (
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
                disabled={isReadOnly}
              />
              <Label htmlFor="is_active">Active Group</Label>
            </div>
          )}
        </div>

        <Separator />

        {/* Participants */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <h3 className="text-lg font-medium">Participants ({formData.participants.length})</h3>
          </div>

          {!isReadOnly && (
            <div className="flex gap-2">
              <Input
                value={newParticipant}
                onChange={(e) => setNewParticipant(e.target.value)}
                placeholder="Enter phone number"
                onKeyPress={(e) => e.key === 'Enter' && addParticipant()}
              />
              <Button onClick={addParticipant} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {formData.participants.map((phone) => (
              <Badge key={phone} variant="secondary" className="flex items-center gap-1">
                {phone}
                {!isReadOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeParticipant(phone)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Admins */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-600" />
            <h3 className="text-lg font-medium">Admins ({formData.admins.length})</h3>
          </div>

          {!isReadOnly && (
            <div className="flex gap-2">
              <Input
                value={newAdmin}
                onChange={(e) => setNewAdmin(e.target.value)}
                placeholder="Enter phone number"
                onKeyPress={(e) => e.key === 'Enter' && addAdmin()}
              />
              <Button onClick={addAdmin} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Admin
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {formData.admins.map((phone) => (
              <Badge key={phone} variant="default" className="flex items-center gap-1">
                <Crown className="h-3 w-3" />
                {phone}
                {!isReadOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeAdmin(phone)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    );
  }
);

GroupBasicInfo.displayName = 'GroupBasicInfo';

export default GroupBasicInfo;