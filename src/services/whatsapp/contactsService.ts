// src/services/whatsapp/contactsService.ts
//
// DATA LAYER migrated to the digicrm adapter (crmClient → /api/whatsapp/...,
// JWT). UI/return shapes unchanged. The adapter's detail routes accept a
// contact UID *or* phone in the path, so the old resolve-UID round-trip is gone.
//   GET  /whatsapp/contacts/?page&limit&search&labels&groups -> {contacts,total,page,limit,total_pages}
//   POST /whatsapp/contacts/  ·  GET|PUT|PATCH|DELETE /whatsapp/contacts/<uid|phone>/
//   POST /whatsapp/contacts/import/  ·  GET /whatsapp/contacts/import/<id>/status/
//   labels/  labels/<uid>/  ·  contact-groups/  contact-groups/<uid>/  contact-groups/<uid>/contacts/
import { crmClient } from '@/lib/client';
// Payload TYPES only (compile-time) — no runtime calls to the old client.
import type {
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
      labels: Array.isArray(data.labels)
        ? data.labels.map((l: any) => typeof l === 'object' ? (l._uid || l.id || '') : l).filter(Boolean)
        : [],
      groups: Array.isArray(data.groups)
        ? data.groups.map((g: any) => typeof g === 'object' ? (g._uid || g.id || '') : g).filter(Boolean)
        : [],
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
    const { data } = await crmClient.get('/whatsapp/contacts/', {
      params: {
        page: query?.page,
        limit: query?.limit,
        search: query?.search,
        labels: query?.labels,
        groups: query?.groups,
      },
    });

    let contacts: any[] = [];
    let total = 0;
    if (Array.isArray(data)) {
      contacts = data;
      total = data.length;
    } else if (data && typeof data === 'object') {
      contacts = data.contacts || data.data || data.results || [];
      total = typeof data.total === 'number' ? data.total : contacts.length;
    }

    const mappedContacts = contacts.map((c: any) => this.mapLaravelContact(c));
    return { total, contacts: mappedContacts };
  }

  async getContact(phoneOrUid: string): Promise<Contact> {
    const id = this.normalizePhoneParam(phoneOrUid);
    const { data } = await crmClient.get(`/whatsapp/contacts/${id}/`);
    return this.mapLaravelContact(data);
  }

  async createContact(payload: CreateContactPayload): Promise<Contact> {
    const body = {
      phone_number: payload.phone,
      first_name: payload.name?.split(' ')[0] || payload.first_name || '',
      last_name: payload.name?.split(' ').slice(1).join(' ') || payload.last_name || '',
      email: payload.email,
      country: payload.country,
      language_code: payload.language_code,
      groups: payload.groups?.join(','),
      custom_fields: payload.custom_fields,
    };
    const { data } = await crmClient.post('/whatsapp/contacts/', body);
    return this.mapLaravelContact(data);
  }

  async updateContact(phone: string, payload: UpdateContactPayload): Promise<Contact> {
    const cleanPhone = this.normalizePhoneParam(phone); // adapter contract: PUT with PHONE
    const body: any = {};

    if (payload.name) {
      body.first_name = payload.name.split(' ')[0];
      body.last_name = payload.name.split(' ').slice(1).join(' ');
    }
    if (payload.first_name !== undefined) body.first_name = payload.first_name;
    if (payload.last_name !== undefined) body.last_name = payload.last_name;
    if (payload.email !== undefined) body.email = payload.email;
    if (payload.country !== undefined) body.country = payload.country;
    if (payload.language_code !== undefined) body.language_code = payload.language_code;
    if (payload.groups !== undefined) {
      body.groups = Array.isArray(payload.groups) ? payload.groups.join(',') : payload.groups;
    }
    if (payload.custom_fields !== undefined) body.custom_fields = payload.custom_fields;

    const { data } = await crmClient.put(`/whatsapp/contacts/${cleanPhone}/`, body);
    return this.mapLaravelContact(data);
  }

  async deleteContact(phone: string): Promise<DeleteContactResponse> {
    const id = this.normalizePhoneParam(phone);
    await crmClient.delete(`/whatsapp/contacts/${id}/`);
    return { phone, deleted: true };
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
    const { data } = await crmClient.post('/whatsapp/contacts/import/', payload);
    return data;
  }

  async getImportStatus(importId: string): Promise<any> {
    const { data } = await crmClient.get(`/whatsapp/contacts/import/${importId}/status/`);
    return data;
  }

  // ==================== LABEL METHODS ====================

  async getLabels(): Promise<Label[]> {
    const { data } = await crmClient.get('/whatsapp/labels/');
    const labels: any[] = Array.isArray(data) ? data : (data?.labels ?? data?.results ?? []);
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
    const { data: response } = await crmClient.post('/whatsapp/labels/', payload);
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
    const { data: response } = await crmClient.put(`/whatsapp/labels/${labelUid}/`, payload);
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
    await crmClient.delete(`/whatsapp/labels/${labelUid}/`);
  }

  // ==================== CONTACT GROUP METHODS ====================

  async getContactGroups(): Promise<ContactGroup[]> {
    const { data } = await crmClient.get('/whatsapp/contact-groups/');
    const groups: any[] = Array.isArray(data) ? data : (data?.groups ?? data?.results ?? []);
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
    const { data: response } = await crmClient.post('/whatsapp/contact-groups/', payload);
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
    const { data: response } = await crmClient.put(`/whatsapp/contact-groups/${groupUid}/`, payload);
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
    await crmClient.delete(`/whatsapp/contact-groups/${groupUid}/`);
  }

  async addContactsToGroup(groupUid: string, contactUids: string[]): Promise<void> {
    await crmClient.post(`/whatsapp/contact-groups/${groupUid}/contacts/`, { contact_uids: contactUids });
  }

  async removeContactsFromGroup(groupUid: string, contactUids: string[]): Promise<void> {
    await crmClient.delete(`/whatsapp/contact-groups/${groupUid}/contacts/`, { data: { contact_uids: contactUids } });
  }
}

export const contactsService = new ContactsService();
