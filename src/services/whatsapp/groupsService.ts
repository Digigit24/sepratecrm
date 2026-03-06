// src/services/whatsapp/groupsService.ts
import { externalWhatsappService } from '@/services/externalWhatsappService';
import {
  Group,
  GroupsListQuery,
  GroupsListResponse,
  CreateGroupPayload,
  UpdateGroupPayload,
  DeleteGroupResponse,
} from '@/types/whatsappTypes';

class GroupsService {
  /** Map Laravel /contact-groups API response to Group type */
  private mapGroup(raw: any): Group {
    return {
      id: raw._id ?? raw.id ?? 0,
      group_id: raw._uid ?? raw.group_id ?? '',
      name: raw.title ?? raw.name ?? '',
      description: raw.description ?? null,
      participants: Array.isArray(raw.contacts) ? raw.contacts : (raw.participants ?? []),
      admins: raw.admins ?? [],
      created_by: raw.created_by ?? null,
      group_invite_link: raw.group_invite_link ?? null,
      is_active: raw.is_active ?? true,
      participant_count: raw.total_contacts ?? raw.participant_count ?? (Array.isArray(raw.contacts) ? raw.contacts.length : 0),
      created_at: raw.created_at ?? '',
      updated_at: raw.updated_at ?? '',
      tenant_id: raw.tenant_id ?? '',
    };
  }

  async getGroups(query?: GroupsListQuery): Promise<GroupsListResponse> {
    const raw = await externalWhatsappService.getContactGroups();
    const list = Array.isArray(raw) ? raw : [];
    const groups = list.map((g: any) => this.mapGroup(g));
    return { total: groups.length, groups };
  }

  async getGroup(id: string): Promise<Group> {
    // No single-group endpoint in the external service; fetch all and find by uid
    const { groups } = await this.getGroups();
    const found = groups.find((g) => g.group_id === id);
    if (!found) throw new Error('Group not found');
    return found;
  }

  async createGroup(payload: CreateGroupPayload): Promise<Group> {
    const raw = await externalWhatsappService.createContactGroup({
      title: payload.name,
      description: payload.description,
    });
    return this.mapGroup(raw);
  }

  async updateGroup(id: string, payload: UpdateGroupPayload): Promise<Group> {
    const raw = await externalWhatsappService.updateContactGroup(id, {
      title: payload.name,
      description: payload.description,
    });
    return this.mapGroup(raw);
  }

  async deleteGroup(id: string): Promise<DeleteGroupResponse> {
    await externalWhatsappService.deleteContactGroup(id);
    return { message: 'Group deleted', group_id: id };
  }

  async getActiveGroups(limit: number = 100): Promise<GroupsListResponse> {
    return this.getGroups({ limit });
  }

  async searchGroups(searchQuery: string, limit: number = 20): Promise<GroupsListResponse> {
    const result = await this.getGroups({ limit });
    const q = searchQuery.toLowerCase();
    result.groups = result.groups.filter((g) => g.name.toLowerCase().includes(q));
    result.total = result.groups.length;
    return result;
  }

  async addParticipants(id: string, contactUids: string[]): Promise<void> {
    await externalWhatsappService.addContactsToGroup(id, { contact_uids: contactUids });
  }

  async removeParticipants(id: string, contactUids: string[]): Promise<void> {
    await externalWhatsappService.removeContactsFromGroup(id, { contact_uids: contactUids });
  }
}

export const groupsService = new GroupsService();
