// src/services/whatsapp/contactsService.ts
import {
  externalWhatsappService,
  ImportContactsPayload,
  ImportContactItem,
  CreateLabelPayload,
  UpdateLabelPayload,
  CreateContactGroupPayload,
  UpdateContactGroupPayload,
  AddContactsToGroupPayload,
} from '@/services/externalWhatsappService';
import {
  Contact,
  ContactsListQuery,
  ContactsListResponse,
  CreateContactPayload,
  UpdateContactPayload,
  DeleteContactResponse,
} from '@/types/whatsappTypes';

// Re-export types for convenience
export type {
  ImportContactsPayload,
  ImportContactItem,
  CreateLabelPayload,
  UpdateLabelPayload,
  CreateContactGroupPayload,
  UpdateContactGroupPayload,
  AddContactsToGroupPayload,
};

// Label type
export interface Label {
  _uid: string;
  title: string;
  text_color?: string;
  bg_color?: string;
  created_at?: string;
  updated_at?: string;
}

// Contact Group type
export interface ContactGroup {
  _uid: string;
  title: string;
  description?: string;
  contacts_count?: number;
  created_at?: string;
  updated_at?: string;
}

class ContactsService {
  private mapLaravelContact(data: any): Contact {
    return {
      id: data._uid || data.id,
      phone: data.phone_number || data.phone || data.wa_id || '',
      name: data.first_name
        ? `${data.first_name} ${data.last_name || ''}`.trim()
        : data.name || '',
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      email: data.email || '',
      country: data.country || '',
      language_code: data.language_code || '',
      labels: data.labels || [],
      groups: data.groups || [],
      custom_fields: data.custom_fields || {},
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
      last_message_at: data.last_message_at,
      is_blocked: data.is_blocked || false,
      avatar_url: data.avatar_url || data.profile_picture,
    } as Contact;
  }

  private normalizePhoneParam(phone: string): string {
    return phone.replace(/^\+/, '');
  }

  // ==================== CONTACT METHODS ====================

  async getContacts(query?: ContactsListQuery): Promise<ContactsListResponse> {
    const response = await externalWhatsappService.getContacts({
      page: query?.page,
      limit: query?.limit,
      search: query?.search,
    });

    let contacts: any[] = [];
    let total = 0;

    if (Array.isArray(response)) {
      contacts = response;
      total = response.length;
    } else if (response && typeof response === 'object') {
      contacts = response.data || response.contacts || [];
      total = response.total || contacts.length;
    }

    const mappedContacts = contacts.map((c: any) => this.mapLaravelContact(c));

    return { total, contacts: mappedContacts };
  }

  async getContact(phoneOrUid: string): Promise<Contact> {
    const cleanPhone = this.normalizePhoneParam(phoneOrUid);
    const response = await externalWhatsappService.getContact(cleanPhone);
    return this.mapLaravelContact(response);
  }

  async createContact(payload: CreateContactPayload): Promise<Contact> {
    const laravelPayload = {
      phone_number: payload.phone,
      first_name: payload.name?.split(' ')[0] || payload.first_name || '',
      last_name: payload.name?.split(' ').slice(1).join(' ') || payload.last_name || '',
      email: payload.email,
      country: payload.country,
      language_code: payload.language_code,
      groups: payload.groups?.join(','),
      custom_fields: payload.custom_fields,
    };

    const response = await externalWhatsappService.createContact(laravelPayload);
    return this.mapLaravelContact(response);
  }

  async updateContact(phone: string, payload: UpdateContactPayload): Promise<Contact> {
    const cleanPhone = this.normalizePhoneParam(phone);
    const laravelPayload: any = {};

    if (payload.name) {
      laravelPayload.first_name = payload.name.split(' ')[0];
      laravelPayload.last_name = payload.name.split(' ').slice(1).join(' ');
    }
    if (payload.first_name !== undefined) laravelPayload.first_name = payload.first_name;
    if (payload.last_name !== undefined) laravelPayload.last_name = payload.last_name;
    if (payload.email !== undefined) laravelPayload.email = payload.email;
    if (payload.country !== undefined) laravelPayload.country = payload.country;
    if (payload.language_code !== undefined) laravelPayload.language_code = payload.language_code;
    if (payload.groups !== undefined) {
      laravelPayload.groups = Array.isArray(payload.groups) ? payload.groups.join(',') : payload.groups;
    }
    if (payload.custom_fields !== undefined) laravelPayload.custom_fields = payload.custom_fields;

    const response = await externalWhatsappService.updateContact(cleanPhone, laravelPayload);
    return this.mapLaravelContact(response);
  }

  async deleteContact(phone: string): Promise<DeleteContactResponse> {
    const cleanPhone = this.normalizePhoneParam(phone);
    await externalWhatsappService.deleteContact(cleanPhone);
    return { phone: cleanPhone, deleted: true };
  }

  async searchContacts(searchQuery: string, limit: number = 20): Promise<ContactsListResponse> {
    return this.getContacts({ search: searchQuery, limit });
  }

  async getContactsByLabel(label: string, limit: number = 100): Promise<ContactsListResponse> {
    const result = await this.getContacts({ limit });
    const filteredContacts = result.contacts.filter((contact) =>
      contact.labels?.includes(label)
    );
    return { total: filteredContacts.length, contacts: filteredContacts };
  }

  async getContactsByGroup(group: string, limit: number = 100): Promise<ContactsListResponse> {
    const result = await this.getContacts({ limit });
    const filteredContacts = result.contacts.filter((contact) =>
      contact.groups?.includes(group)
    );
    return { total: filteredContacts.length, contacts: filteredContacts };
  }

  async importContacts(payload: ImportContactsPayload): Promise<any> {
    return externalWhatsappService.importContacts(payload);
  }

  // ==================== LABEL METHODS ====================

  async getLabels(): Promise<Label[]> {
    const response = await externalWhatsappService.getLabels();
    const labels = Array.isArray(response) ? response : [];
    return labels.map((l: any) => ({
      _uid: l._uid || l.id,
      title: l.title || l.name || '',
      text_color: l.text_color,
      bg_color: l.bg_color,
      created_at: l.created_at,
      updated_at: l.updated_at,
    }));
  }

  async createLabel(payload: CreateLabelPayload): Promise<Label> {
    const response = await externalWhatsappService.createLabel(payload);
    return {
      _uid: response._uid || response.id,
      title: response.title || payload.title,
      text_color: response.text_color || payload.text_color,
      bg_color: response.bg_color || payload.bg_color,
      created_at: response.created_at,
      updated_at: response.updated_at,
    };
  }

  async updateLabel(labelUid: string, payload: UpdateLabelPayload): Promise<Label> {
    const response = await externalWhatsappService.updateLabel(labelUid, payload);
    return {
      _uid: response._uid || labelUid,
      title: response.title || payload.title || '',
      text_color: response.text_color || payload.text_color,
      bg_color: response.bg_color || payload.bg_color,
      created_at: response.created_at,
      updated_at: response.updated_at,
    };
  }

  async deleteLabel(labelUid: string): Promise<void> {
    await externalWhatsappService.deleteLabel(labelUid);
  }

  // ==================== CONTACT GROUP METHODS ====================

  async getContactGroups(): Promise<ContactGroup[]> {
    const response = await externalWhatsappService.getContactGroups();
    const groups = Array.isArray(response) ? response : [];
    return groups.map((g: any) => ({
      _uid: g._uid || g.id,
      title: g.title || g.name || '',
      description: g.description,
      contacts_count: g.contacts_count || g.contactsCount || 0,
      created_at: g.created_at,
      updated_at: g.updated_at,
    }));
  }

  async createContactGroup(payload: CreateContactGroupPayload): Promise<ContactGroup> {
    const response = await externalWhatsappService.createContactGroup(payload);
    return {
      _uid: response._uid || response.id,
      title: response.title || payload.title,
      description: response.description || payload.description,
      contacts_count: response.contacts_count || 0,
      created_at: response.created_at,
      updated_at: response.updated_at,
    };
  }

  async updateContactGroup(groupUid: string, payload: UpdateContactGroupPayload): Promise<ContactGroup> {
    const response = await externalWhatsappService.updateContactGroup(groupUid, payload);
    return {
      _uid: response._uid || groupUid,
      title: response.title || payload.title || '',
      description: response.description || payload.description,
      contacts_count: response.contacts_count || 0,
      created_at: response.created_at,
      updated_at: response.updated_at,
    };
  }

  async deleteContactGroup(groupUid: string): Promise<void> {
    await externalWhatsappService.deleteContactGroup(groupUid);
  }

  async addContactsToGroup(groupUid: string, contactUids: string[]): Promise<void> {
    await externalWhatsappService.addContactsToGroup(groupUid, { contact_uids: contactUids });
  }

  async removeContactsFromGroup(groupUid: string, contactUids: string[]): Promise<void> {
    await externalWhatsappService.removeContactsFromGroup(groupUid, { contact_uids: contactUids });
  }
}

export const contactsService = new ContactsService();
