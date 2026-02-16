// src/hooks/whatsapp/useContacts.ts
import useSWR, { mutate } from 'swr';
import { toast } from 'sonner';
import {
  contactsService,
  Label,
  ContactGroup,
  ImportContactsPayload,
  CreateLabelPayload,
  UpdateLabelPayload,
  CreateContactGroupPayload,
  UpdateContactGroupPayload,
} from '@/services/whatsapp/contactsService';
import {
  Contact,
  ContactsListQuery,
  CreateContactPayload,
  UpdateContactPayload,
} from '@/types/whatsappTypes';

// SWR key generators
const getContactsKey = (query?: ContactsListQuery) =>
  query ? ['contacts', query] : ['contacts'];
const getContactKey = (phone: string) => ['contact', phone];
const getLabelsKey = () => ['labels'];
const getContactGroupsKey = () => ['contact-groups'];

/**
 * Hook to fetch all contacts
 */
export const useContacts = (query?: ContactsListQuery) => {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    getContactsKey(query),
    () => contactsService.getContacts(query),
    { revalidateOnFocus: false, revalidateOnReconnect: true }
  );

  return {
    contacts: data?.contacts || [],
    total: data?.total || 0,
    isLoading,
    error,
    revalidate,
  };
};

/**
 * Hook to fetch a single contact
 */
export const useContact = (phone: string | null) => {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    phone ? getContactKey(phone) : null,
    () => (phone ? contactsService.getContact(phone) : null),
    { revalidateOnFocus: false, revalidateOnReconnect: true }
  );

  return {
    contact: data || null,
    isLoading,
    error,
    revalidate,
  };
};

/**
 * Hook for contact mutations (create, update, delete, import)
 */
export const useContactMutations = () => {
  const createContact = async (payload: CreateContactPayload): Promise<Contact | null> => {
    try {
      const newContact = await contactsService.createContact(payload);
      mutate((key) => Array.isArray(key) && key[0] === 'contacts', undefined, { revalidate: true });
      toast.success('Contact created');
      return newContact;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create contact');
      return null;
    }
  };

  const updateContact = async (phone: string, payload: UpdateContactPayload): Promise<Contact | null> => {
    try {
      const updatedContact = await contactsService.updateContact(phone, payload);
      mutate(getContactKey(phone), updatedContact, false);
      mutate((key) => Array.isArray(key) && key[0] === 'contacts', undefined, { revalidate: true });
      toast.success('Contact updated');
      return updatedContact;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update contact');
      return null;
    }
  };

  const deleteContact = async (phone: string): Promise<boolean> => {
    try {
      await contactsService.deleteContact(phone);
      mutate(getContactKey(phone), undefined, false);
      mutate((key) => Array.isArray(key) && key[0] === 'contacts', undefined, { revalidate: true });
      toast.success('Contact deleted');
      return true;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete contact');
      return false;
    }
  };

  const importContacts = async (payload: ImportContactsPayload): Promise<boolean> => {
    try {
      await contactsService.importContacts(payload);
      mutate((key) => Array.isArray(key) && key[0] === 'contacts', undefined, { revalidate: true });
      toast.success(`${payload.contacts.length} contacts imported`);
      return true;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to import contacts');
      return false;
    }
  };

  return { createContact, updateContact, deleteContact, importContacts };
};

/**
 * Hook to search contacts
 */
export const useContactSearch = (searchQuery: string, limit: number = 20) => {
  const { data, error, isLoading } = useSWR(
    searchQuery ? ['contacts', 'search', searchQuery, limit] : null,
    () => (searchQuery ? contactsService.searchContacts(searchQuery, limit) : null),
    { revalidateOnFocus: false, dedupingInterval: 500 }
  );

  return {
    contacts: data?.contacts || [],
    total: data?.total || 0,
    isLoading,
    error,
  };
};

/**
 * Hook to fetch labels
 */
export const useLabels = () => {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    getLabelsKey(),
    () => contactsService.getLabels(),
    { revalidateOnFocus: false }
  );

  return {
    labels: data || [],
    isLoading,
    error,
    revalidate,
  };
};

/**
 * Hook for label mutations
 */
export const useLabelMutations = () => {
  const createLabel = async (payload: CreateLabelPayload): Promise<Label | null> => {
    try {
      const label = await contactsService.createLabel(payload);
      mutate(getLabelsKey(), undefined, { revalidate: true });
      toast.success('Label created');
      return label;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create label');
      return null;
    }
  };

  const updateLabel = async (uid: string, payload: UpdateLabelPayload): Promise<Label | null> => {
    try {
      const label = await contactsService.updateLabel(uid, payload);
      mutate(getLabelsKey(), undefined, { revalidate: true });
      toast.success('Label updated');
      return label;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update label');
      return null;
    }
  };

  const deleteLabel = async (uid: string): Promise<boolean> => {
    try {
      await contactsService.deleteLabel(uid);
      mutate(getLabelsKey(), undefined, { revalidate: true });
      toast.success('Label deleted');
      return true;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete label');
      return false;
    }
  };

  return { createLabel, updateLabel, deleteLabel };
};

/**
 * Hook to fetch contact groups
 */
export const useContactGroups = () => {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    getContactGroupsKey(),
    () => contactsService.getContactGroups(),
    { revalidateOnFocus: false }
  );

  return {
    groups: data || [],
    isLoading,
    error,
    revalidate,
  };
};

/**
 * Hook for contact group mutations
 */
export const useContactGroupMutations = () => {
  const createGroup = async (payload: CreateContactGroupPayload): Promise<ContactGroup | null> => {
    try {
      const group = await contactsService.createContactGroup(payload);
      mutate(getContactGroupsKey(), undefined, { revalidate: true });
      toast.success('Group created');
      return group;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create group');
      return null;
    }
  };

  const updateGroup = async (uid: string, payload: UpdateContactGroupPayload): Promise<ContactGroup | null> => {
    try {
      const group = await contactsService.updateContactGroup(uid, payload);
      mutate(getContactGroupsKey(), undefined, { revalidate: true });
      toast.success('Group updated');
      return group;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update group');
      return null;
    }
  };

  const deleteGroup = async (uid: string): Promise<boolean> => {
    try {
      await contactsService.deleteContactGroup(uid);
      mutate(getContactGroupsKey(), undefined, { revalidate: true });
      toast.success('Group deleted');
      return true;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete group');
      return false;
    }
  };

  const addContactsToGroup = async (groupUid: string, contactUids: string[]): Promise<boolean> => {
    try {
      await contactsService.addContactsToGroup(groupUid, contactUids);
      mutate(getContactGroupsKey(), undefined, { revalidate: true });
      mutate((key) => Array.isArray(key) && key[0] === 'contacts', undefined, { revalidate: true });
      toast.success(`${contactUids.length} contacts added to group`);
      return true;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add contacts to group');
      return false;
    }
  };

  const removeContactsFromGroup = async (groupUid: string, contactUids: string[]): Promise<boolean> => {
    try {
      await contactsService.removeContactsFromGroup(groupUid, contactUids);
      mutate(getContactGroupsKey(), undefined, { revalidate: true });
      mutate((key) => Array.isArray(key) && key[0] === 'contacts', undefined, { revalidate: true });
      toast.success(`${contactUids.length} contacts removed from group`);
      return true;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove contacts from group');
      return false;
    }
  };

  return { createGroup, updateGroup, deleteGroup, addContactsToGroup, removeContactsFromGroup };
};

/**
 * Hook to get contacts by label
 */
export const useContactsByLabel = (label: string | null, limit: number = 100) => {
  const { data, error, isLoading } = useSWR(
    label ? ['contacts', 'label', label, limit] : null,
    () => (label ? contactsService.getContactsByLabel(label, limit) : null),
    { revalidateOnFocus: false }
  );

  return {
    contacts: data?.contacts || [],
    total: data?.total || 0,
    isLoading,
    error,
  };
};

/**
 * Hook to get contacts by group
 */
export const useContactsByGroup = (group: string | null, limit: number = 100) => {
  const { data, error, isLoading } = useSWR(
    group ? ['contacts', 'group', group, limit] : null,
    () => (group ? contactsService.getContactsByGroup(group, limit) : null),
    { revalidateOnFocus: false }
  );

  return {
    contacts: data?.contacts || [],
    total: data?.total || 0,
    isLoading,
    error,
  };
};
