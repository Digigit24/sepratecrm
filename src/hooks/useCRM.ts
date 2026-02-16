// src/hooks/useCRM.ts
import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { crmService } from '@/services/crmService';
import {
  Lead,
  LeadStatus,
  LeadActivity,
  LeadOrder,
  Task,
  LeadFieldConfiguration,
  LeadsResponse,
  LeadStatusesResponse,
  LeadActivitiesResponse,
  LeadOrdersResponse,
  TasksResponse,
  LeadFieldConfigurationsResponse,
  FieldSchemaResponse,
  LeadsQueryParams,
  LeadStatusesQueryParams,
  LeadActivitiesQueryParams,
  LeadOrdersQueryParams,
  TasksQueryParams,
  LeadFieldConfigurationsQueryParams,
  CreateLeadPayload,
  UpdateLeadPayload,
  CreateLeadStatusPayload,
  UpdateLeadStatusPayload,
  CreateLeadActivityPayload,
  UpdateLeadActivityPayload,
  CreateLeadOrderPayload,
  UpdateLeadOrderPayload,
  CreateTaskPayload,
  UpdateTaskPayload,
  CreateLeadFieldConfigurationPayload,
  UpdateLeadFieldConfigurationPayload,
  LeadExportQueryParams,
  LeadExportResponse,
  LeadImportResponse,
  LeadImportPayload,
  BulkDeleteResponse,
  BulkStatusUpdateResponse
} from '@/types/crmTypes';
import { useAuth } from './useAuth';

export const useCRM = () => {
  const { hasModuleAccess } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user has CRM access
  const hasCRMAccess = hasModuleAccess('crm');

  // ==================== LEADS HOOKS ====================
  
  // Get leads with SWR caching
  const useLeads = (params?: LeadsQueryParams) => {
    const key = ['leads', params];
    
    return useSWR<LeadsResponse>(
      key,
      () => crmService.getLeads(params),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch leads:', err);
          setError(err.message || 'Failed to fetch leads');
        }
      }
    );
  };

  // Get single lead with SWR caching
  const useLead = (id: number | null) => {
    const key = id ? ['lead', id] : null;
    
    return useSWR<Lead>(
      key,
      () => crmService.getLead(id!),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch lead:', err);
          setError(err.message || 'Failed to fetch lead');
        }
      }
    );
  };

  // Create lead
  const createLead = useCallback(async (leadData: CreateLeadPayload) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const newLead = await crmService.createLead(leadData);
      return newLead;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create lead';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Update lead
  const updateLead = useCallback(async (id: number, leadData: UpdateLeadPayload) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const updatedLead = await crmService.updateLead(id, leadData);
      return updatedLead;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update lead';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Patch lead
  const patchLead = useCallback(async (id: number, leadData: Partial<UpdateLeadPayload>) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const updatedLead = await crmService.patchLead(id, leadData);
      return updatedLead;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update lead';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Delete lead
  const deleteLead = useCallback(async (id: number) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      await crmService.deleteLead(id);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete lead';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Bulk create leads
  const bulkCreateLeads = useCallback(async (leadsData: CreateLeadPayload[]) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await crmService.bulkCreateLeads(leadsData);
      return results;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to bulk create leads';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Export leads
  const exportLeads = useCallback(async (params?: LeadExportQueryParams) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await crmService.exportLeads(params);
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to export leads';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Import leads
  const importLeads = useCallback(async (file?: File, jsonData?: LeadImportPayload) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await crmService.importLeads(file, jsonData);
      return results;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to import leads';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Bulk delete leads
  const bulkDeleteLeads = useCallback(async (leadIds: number[]): Promise<BulkDeleteResponse> => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await crmService.bulkDeleteLeads(leadIds);
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to bulk delete leads';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Bulk update lead status
  const bulkUpdateLeadStatus = useCallback(async (leadIds: number[], statusId: number): Promise<BulkStatusUpdateResponse> => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await crmService.bulkUpdateLeadStatus(leadIds, statusId);
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to bulk update lead status';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // ==================== LEAD STATUSES HOOKS ====================
  
  // Get lead statuses with SWR caching
  const useLeadStatuses = (params?: LeadStatusesQueryParams) => {
    const key = ['lead-statuses', params];
    
    return useSWR<LeadStatusesResponse>(
      key,
      () => crmService.getLeadStatuses(params),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch lead statuses:', err);
          setError(err.message || 'Failed to fetch lead statuses');
        }
      }
    );
  };

  // Get single lead status with SWR caching
  const useLeadStatus = (id: number | null) => {
    const key = id ? ['lead-status', id] : null;
    
    return useSWR<LeadStatus>(
      key,
      () => crmService.getLeadStatus(id!),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch lead status:', err);
          setError(err.message || 'Failed to fetch lead status');
        }
      }
    );
  };

  // Create lead status
  const createLeadStatus = useCallback(async (statusData: CreateLeadStatusPayload) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const newStatus = await crmService.createLeadStatus(statusData);
      return newStatus;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create lead status';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Update lead status
  const updateLeadStatus = useCallback(async (id: number, statusData: UpdateLeadStatusPayload) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const updatedStatus = await crmService.updateLeadStatus(id, statusData);
      return updatedStatus;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update lead status';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Delete lead status
  const deleteLeadStatus = useCallback(async (id: number) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      await crmService.deleteLeadStatus(id);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete lead status';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // ==================== LEAD ACTIVITIES HOOKS ====================
  
  // Get lead activities with SWR caching
  const useLeadActivities = (params?: LeadActivitiesQueryParams) => {
    const key = ['lead-activities', params];
    
    return useSWR<LeadActivitiesResponse>(
      key,
      () => crmService.getLeadActivities(params),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch lead activities:', err);
          setError(err.message || 'Failed to fetch lead activities');
        }
      }
    );
  };

  // Create lead activity
  const createLeadActivity = useCallback(async (activityData: CreateLeadActivityPayload) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const newActivity = await crmService.createLeadActivity(activityData);
      return newActivity;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create lead activity';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Update lead activity
  const updateLeadActivity = useCallback(async (id: number, activityData: UpdateLeadActivityPayload) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const updatedActivity = await crmService.updateLeadActivity(id, activityData);
      return updatedActivity;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update lead activity';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Delete lead activity
  const deleteLeadActivity = useCallback(async (id: number) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      await crmService.deleteLeadActivity(id);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete lead activity';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // ==================== LEAD ORDERS HOOKS ====================
  
  // Get lead orders with SWR caching
  const useLeadOrders = (params?: LeadOrdersQueryParams) => {
    const key = ['lead-orders', params];
    
    return useSWR<LeadOrdersResponse>(
      key,
      () => crmService.getLeadOrders(params),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch lead orders:', err);
          setError(err.message || 'Failed to fetch lead orders');
        }
      }
    );
  };

  // Create lead order
  const createLeadOrder = useCallback(async (orderData: CreateLeadOrderPayload) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const newOrder = await crmService.createLeadOrder(orderData);
      return newOrder;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create lead order';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Update lead order
  const updateLeadOrder = useCallback(async (id: number, orderData: UpdateLeadOrderPayload) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const updatedOrder = await crmService.updateLeadOrder(id, orderData);
      return updatedOrder;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update lead order';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Delete lead order
  const deleteLeadOrder = useCallback(async (id: number) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      await crmService.deleteLeadOrder(id);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete lead order';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // ==================== TASKS HOOKS ====================

  // Get tasks with SWR caching
  const useTasks = (params?: TasksQueryParams) => {
    const key = ['tasks', params];

    return useSWR<TasksResponse>(
      key,
      () => crmService.getTasks(params),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch tasks:', err);
          setError(err.message || 'Failed to fetch tasks');
        }
      }
    );
  };

  // Get single task with SWR caching
  const useTask = (id: number | null) => {
    const key = id ? ['task', id] : null;

    return useSWR<Task>(
      key,
      () => crmService.getTask(id!),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch task:', err);
          setError(err.message || 'Failed to fetch task');
        }
      }
    );
  };

  // Create task
  const createTask = useCallback(async (taskData: CreateTaskPayload) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const newTask = await crmService.createTask(taskData);
      return newTask;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create task';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Update task
  const updateTask = useCallback(async (id: number, taskData: UpdateTaskPayload) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const updatedTask = await crmService.updateTask(id, taskData);
      return updatedTask;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update task';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Patch task
  const patchTask = useCallback(async (id: number, taskData: Partial<UpdateTaskPayload>) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const updatedTask = await crmService.patchTask(id, taskData);
      return updatedTask;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update task';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Delete task
  const deleteTask = useCallback(async (id: number) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      await crmService.deleteTask(id);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete task';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // ==================== FIELD CONFIGURATIONS HOOKS ====================

  // Get field configurations with SWR caching
  const useFieldConfigurations = (params?: LeadFieldConfigurationsQueryParams) => {
    const key = ['field-configurations', params];

    return useSWR<LeadFieldConfigurationsResponse>(
      key,
      () => crmService.getFieldConfigurations(params),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch field configurations:', err);
          setError(err.message || 'Failed to fetch field configurations');
        }
      }
    );
  };

  // Get single field configuration with SWR caching
  const useFieldConfiguration = (id: number | null) => {
    const key = id ? ['field-configuration', id] : null;

    return useSWR<LeadFieldConfiguration>(
      key,
      () => crmService.getFieldConfiguration(id!),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch field configuration:', err);
          setError(err.message || 'Failed to fetch field configuration');
        }
      }
    );
  };

  // Get field schema with SWR caching
  const useFieldSchema = () => {
    const key = ['field-schema'];

    return useSWR<FieldSchemaResponse>(
      key,
      () => crmService.getFieldSchema(),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch field schema:', err);
          setError(err.message || 'Failed to fetch field schema');
        }
      }
    );
  };

  // Create field configuration
  const createFieldConfiguration = useCallback(async (configData: CreateLeadFieldConfigurationPayload) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const newConfig = await crmService.createFieldConfiguration(configData);
      return newConfig;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create field configuration';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Update field configuration
  const updateFieldConfiguration = useCallback(async (id: number, configData: UpdateLeadFieldConfigurationPayload) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const updatedConfig = await crmService.updateFieldConfiguration(id, configData);
      return updatedConfig;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update field configuration';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Patch field configuration
  const patchFieldConfiguration = useCallback(async (id: number, configData: Partial<UpdateLeadFieldConfigurationPayload>) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      const updatedConfig = await crmService.patchFieldConfiguration(id, configData);
      return updatedConfig;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update field configuration';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  // Delete field configuration
  const deleteFieldConfiguration = useCallback(async (id: number) => {
    if (!hasCRMAccess) {
      throw new Error('CRM module not enabled for this user');
    }

    setIsLoading(true);
    setError(null);

    try {
      await crmService.deleteFieldConfiguration(id);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete field configuration';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasCRMAccess]);

  return {
    hasCRMAccess,
    isLoading,
    error,

    // Leads
    useLeads,
    useLead,
    createLead,
    updateLead,
    patchLead,
    deleteLead,
    bulkCreateLeads,
    bulkDeleteLeads,
    bulkUpdateLeadStatus,
    exportLeads,
    importLeads,

    // Lead Statuses
    useLeadStatuses,
    useLeadStatus,
    createLeadStatus,
    updateLeadStatus,
    deleteLeadStatus,

    // Lead Activities
    useLeadActivities,
    createLeadActivity,
    updateLeadActivity,
    deleteLeadActivity,

    // Lead Orders
    useLeadOrders,
    createLeadOrder,
    updateLeadOrder,
    deleteLeadOrder,

    // Tasks
    useTasks,
    useTask,
    createTask,
    updateTask,
    patchTask,
    deleteTask,

    // Field Configurations
    useFieldConfigurations,
    useFieldConfiguration,
    useFieldSchema,
    createFieldConfiguration,
    updateFieldConfiguration,
    patchFieldConfiguration,
    deleteFieldConfiguration,
  };
};