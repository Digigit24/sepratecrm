// src/hooks/whatsapp/useTemplates.ts
import { useState, useEffect, useCallback } from 'react';
import { templatesService } from '@/services/whatsapp/templatesService';
import {
  Template,
  TemplatesListQuery,
  TemplatesListResponse,
  CreateTemplatePayload,
  UpdateTemplatePayload,
  TemplateSendRequest,
  TemplateBulkSendRequest,
  TemplateStatus,
  TemplateCategory,
  TemplateLanguage
} from '@/types/whatsappTypes';
import { toast } from 'sonner';

export interface UseTemplatesOptions {
  initialQuery?: TemplatesListQuery;
  autoFetch?: boolean;
}

export interface UseTemplatesReturn {
  // Data
  templates: Template[];
  total: number;
  page: number;
  pageSize: number;

  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isSending: boolean;

  // Error states
  error: string | null;

  // Query state
  query: TemplatesListQuery;

  // Actions
  fetchTemplates: (newQuery?: TemplatesListQuery) => Promise<void>;
  createTemplate: (payload: CreateTemplatePayload) => Promise<Template | null>;
  updateTemplate: (id: number, payload: UpdateTemplatePayload) => Promise<Template | null>;
  deleteTemplate: (id: number) => Promise<boolean>;
  sendTemplate: (payload: TemplateSendRequest) => Promise<boolean>;
  sendTemplateBulk: (payload: TemplateBulkSendRequest) => Promise<boolean>;
  syncAllTemplates: () => Promise<any>;
  syncTemplate: (id: number) => Promise<any>;

  // Utility actions
  setQuery: (newQuery: TemplatesListQuery) => void;
  resetQuery: () => void;
  refetch: () => Promise<void>;

  // Filter helpers
  filterByStatus: (status: TemplateStatus) => void;
  filterByCategory: (category: TemplateCategory) => void;
  filterByLanguage: (language: string) => void;
  clearFilters: () => void;
}

const defaultQuery: TemplatesListQuery = {
  skip: 0,
  limit: 50
};

export function useTemplates(options: UseTemplatesOptions = {}): UseTemplatesReturn {
  const { initialQuery = defaultQuery, autoFetch = true } = options;
  
  // State
  const [templates, setTemplates] = useState<Template[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [query, setQueryState] = useState<TemplatesListQuery>(initialQuery);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);

  // Fetch templates
  const fetchTemplates = useCallback(async (newQuery?: TemplatesListQuery) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const queryToUse = newQuery || query;
      const response = await templatesService.getTemplates(queryToUse);
      
      setTemplates(response.items);
      setTotal(response.total);
      setPage(response.page);
      setPageSize(response.page_size);
      
      if (newQuery) {
        setQueryState(newQuery);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch templates';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  // Create template
  const createTemplate = useCallback(async (payload: CreateTemplatePayload): Promise<Template | null> => {
    try {
      setIsCreating(true);
      setError(null);
      
      const newTemplate = await templatesService.createTemplate(payload);
      
      // Add to local state
      setTemplates(prev => [newTemplate, ...prev]);
      setTotal(prev => prev + 1);
      
      toast.success(`Template "${newTemplate.name}" created successfully`);
      return newTemplate;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create template';
      setError(errorMessage);
      toast.error(errorMessage);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  // Update template
  const updateTemplate = useCallback(async (id: number, payload: UpdateTemplatePayload): Promise<Template | null> => {
    try {
      setIsUpdating(true);
      setError(null);
      
      const updatedTemplate = await templatesService.updateTemplate(id, payload);
      
      // Update local state
      setTemplates(prev => 
        prev.map(template => 
          template.id === id ? updatedTemplate : template
        )
      );
      
      toast.success(`Template "${updatedTemplate.name}" updated successfully`);
      return updatedTemplate;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update template';
      setError(errorMessage);
      toast.error(errorMessage);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  // Delete template
  const deleteTemplate = useCallback(async (id: number): Promise<boolean> => {
    try {
      setIsDeleting(true);
      setError(null);

      const templateToDelete = templates.find(t => t.id === id);
      await templatesService.deleteTemplate(id);

      // Remove from local state
      setTemplates(prev => prev.filter(template => template.id !== id));
      setTotal(prev => prev - 1);

      toast.success(`Template "${templateToDelete?.name || id}" deleted successfully`);
      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete template';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [templates]);

  // Sync all templates
  const syncAllTemplates = useCallback(async (): Promise<any> => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await templatesService.syncAllTemplates();

      // Refresh templates after sync
      await fetchTemplates();

      toast.success(`Synced ${result.updated} template(s)`);
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sync templates';
      setError(errorMessage);
      toast.error(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchTemplates]);

  // Sync single template
  const syncTemplate = useCallback(async (id: number): Promise<any> => {
    try {
      setIsUpdating(true);
      setError(null);

      const result = await templatesService.syncTemplate(id);

      // Update local state if status changed
      if (result.updated) {
        setTemplates(prev =>
          prev.map(template =>
            template.id === id
              ? { ...template, status: result.new_status }
              : template
          )
        );
        toast.success(`Template status updated: ${result.old_status} → ${result.new_status}`);
      } else {
        toast.info(`Template status unchanged: ${result.old_status}`);
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sync template';
      setError(errorMessage);
      toast.error(errorMessage);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  // Send template
  const sendTemplate = useCallback(async (payload: TemplateSendRequest): Promise<boolean> => {
    try {
      setIsSending(true);
      setError(null);
      
      const response = await templatesService.sendTemplate(payload);
      
      if (response.ok) {
        toast.success(`Template sent to ${payload.to}`);
        return true;
      } else {
        throw new Error('Failed to send template');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send template';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setIsSending(false);
    }
  }, []);

  // Send template bulk
  const sendTemplateBulk = useCallback(async (payload: TemplateBulkSendRequest): Promise<boolean> => {
    try {
      setIsSending(true);
      setError(null);
      
      const response = await templatesService.sendTemplateBulk(payload);
      
      toast.success(`Template sent to ${response.sent} recipients (${response.failed} failed)`);
      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send template bulk';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setIsSending(false);
    }
  }, []);

  // Set query
  const setQuery = useCallback((newQuery: TemplatesListQuery) => {
    setQueryState(newQuery);
  }, []);

  // Reset query
  const resetQuery = useCallback(() => {
    setQueryState(defaultQuery);
  }, []);

  // Refetch
  const refetch = useCallback(() => {
    return fetchTemplates();
  }, [fetchTemplates]);

  // Filter helpers
  const filterByStatus = useCallback((status: TemplateStatus) => {
    const newQuery = { ...query, status, skip: 0 };
    setQuery(newQuery);
    fetchTemplates(newQuery);
  }, [query, fetchTemplates]);

  const filterByCategory = useCallback((category: TemplateCategory) => {
    const newQuery = { ...query, category, skip: 0 };
    setQuery(newQuery);
    fetchTemplates(newQuery);
  }, [query, fetchTemplates]);

  const filterByLanguage = useCallback((language: string) => {
    const newQuery = { ...query, language, skip: 0 };
    setQuery(newQuery);
    fetchTemplates(newQuery);
  }, [query, fetchTemplates]);

  const clearFilters = useCallback(() => {
    const newQuery = { skip: 0, limit: query.limit || 50 };
    setQuery(newQuery);
    fetchTemplates(newQuery);
  }, [query.limit, fetchTemplates]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchTemplates();
    }
  }, [autoFetch, fetchTemplates]);

  return {
    // Data
    templates,
    total,
    page,
    pageSize,

    // Loading states
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    isSending,

    // Error state
    error,

    // Query state
    query,

    // Actions
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    sendTemplate,
    sendTemplateBulk,
    syncAllTemplates,
    syncTemplate,

    // Utility actions
    setQuery,
    resetQuery,
    refetch,

    // Filter helpers
    filterByStatus,
    filterByCategory,
    filterByLanguage,
    clearFilters
  };
}

// Hook for single template
export function useTemplate(id: number | null) {
  const [template, setTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplate = useCallback(async () => {
    if (!id) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const fetchedTemplate = await templatesService.getTemplate(id);
      setTemplate(fetchedTemplate);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch template';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  return {
    template,
    isLoading,
    error,
    refetch: fetchTemplate
  };
}

// Hook for template analytics
export function useTemplateAnalytics(id: number | null) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!id) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await templatesService.getTemplateAnalytics(id);
      setAnalytics(data);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch template analytics';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    analytics,
    isLoading,
    error,
    refetch: fetchAnalytics
  };
}