// src/services/crmService.ts
import { crmClient } from '@/lib/client';
import { API_CONFIG, buildQueryString } from '@/lib/apiConfig';
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
  BulkDeletePayload,
  BulkDeleteResponse,
  BulkStatusUpdatePayload,
  BulkStatusUpdateResponse
} from '@/types/crmTypes';

class CRMService {
  // ==================== LEADS ====================
  
  // Get leads with optional query parameters
  async getLeads(params?: LeadsQueryParams): Promise<LeadsResponse> {
    try {
      const queryString = buildQueryString(params);
      const response = await crmClient.get<LeadsResponse>(
        `${API_CONFIG.CRM.LEADS}${queryString}`
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to fetch leads';
      throw new Error(message);
    }
  }

  // Get single lead by ID
  async getLead(id: number): Promise<Lead> {
    try {
      const response = await crmClient.get<Lead>(
        API_CONFIG.CRM.LEAD_DETAIL.replace(':id', id.toString())
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to fetch lead';
      throw new Error(message);
    }
  }

  // Create new lead
  async createLead(leadData: CreateLeadPayload): Promise<Lead> {
    try {
      const response = await crmClient.post<Lead>(
        API_CONFIG.CRM.LEAD_CREATE,
        leadData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to create lead';
      throw new Error(message);
    }
  }

  // Update lead (full update)
  async updateLead(id: number, leadData: UpdateLeadPayload): Promise<Lead> {
    try {
      const response = await crmClient.put<Lead>(
        API_CONFIG.CRM.LEAD_UPDATE.replace(':id', id.toString()),
        leadData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to update lead';
      throw new Error(message);
    }
  }

  // Partially update lead
  async patchLead(id: number, leadData: Partial<UpdateLeadPayload>): Promise<Lead> {
    try {
      const response = await crmClient.patch<Lead>(
        API_CONFIG.CRM.LEAD_UPDATE.replace(':id', id.toString()),
        leadData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to update lead';
      throw new Error(message);
    }
  }

  // Delete lead
  async deleteLead(id: number): Promise<void> {
    try {
      await crmClient.delete(
        API_CONFIG.CRM.LEAD_DELETE.replace(':id', id.toString())
      );
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to delete lead';
      throw new Error(message);
    }
  }

  // Bulk create leads
  async bulkCreateLeads(leadsData: CreateLeadPayload[]): Promise<{ created: Lead[]; errors: any[] }> {
    try {
      const results = {
        created: [] as Lead[],
        errors: [] as any[]
      };

      // Process leads one by one to capture individual errors
      for (let i = 0; i < leadsData.length; i++) {
        try {
          const lead = await this.createLead(leadsData[i]);
          results.created.push(lead);
        } catch (error: any) {
          results.errors.push({
            index: i,
            data: leadsData[i],
            error: error.message || 'Failed to create lead'
          });
        }
      }

      return results;
    } catch (error: any) {
      throw new Error('Failed to bulk create leads');
    }
  }

  // Export leads (CSV or JSON)
  async exportLeads(params?: LeadExportQueryParams): Promise<Blob | LeadExportResponse> {
    try {
      const queryString = buildQueryString(params);
      const format = params?.format || 'csv';

      if (format === 'csv') {
        // For CSV, we need to handle blob response
        const response = await crmClient.get(
          `${API_CONFIG.CRM.LEAD_EXPORT}${queryString}`,
          {
            responseType: 'blob',
            headers: {
              'Accept': 'text/csv'
            }
          }
        );
        return response.data as Blob;
      } else {
        // For JSON, return the parsed response
        const response = await crmClient.get<LeadExportResponse>(
          `${API_CONFIG.CRM.LEAD_EXPORT}${queryString}`,
          {
            headers: {
              'Accept': 'application/json'
            }
          }
        );
        return response.data;
      }
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to export leads';
      throw new Error(message);
    }
  }

  // Import leads from CSV file or JSON data
  async importLeads(file?: File, jsonData?: LeadImportPayload): Promise<LeadImportResponse> {
    try {
      if (file) {
        // Import from CSV file
        const formData = new FormData();
        formData.append('file', file);

        const response = await crmClient.post<LeadImportResponse>(
          API_CONFIG.CRM.LEAD_IMPORT,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
        );
        return response.data;
      } else if (jsonData) {
        // Import from JSON data
        const response = await crmClient.post<LeadImportResponse>(
          API_CONFIG.CRM.LEAD_IMPORT,
          jsonData
        );
        return response.data;
      } else {
        throw new Error('Either file or jsonData must be provided');
      }
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to import leads';
      throw new Error(message);
    }
  }

  // Bulk delete leads
  async bulkDeleteLeads(leadIds: number[]): Promise<BulkDeleteResponse> {
    try {
      const payload: BulkDeletePayload = { lead_ids: leadIds };
      const response = await crmClient.post<BulkDeleteResponse>(
        API_CONFIG.CRM.LEAD_BULK_DELETE,
        payload
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to bulk delete leads';
      throw new Error(message);
    }
  }

  // Bulk update lead status
  async bulkUpdateLeadStatus(leadIds: number[], statusId: number): Promise<BulkStatusUpdateResponse> {
    try {
      const payload: BulkStatusUpdatePayload = { lead_ids: leadIds, status_id: statusId };
      const response = await crmClient.post<BulkStatusUpdateResponse>(
        API_CONFIG.CRM.LEAD_BULK_STATUS_UPDATE,
        payload
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to bulk update lead status';
      throw new Error(message);
    }
  }

  // ==================== LEAD STATUSES ====================
  
  // Get lead statuses
  async getLeadStatuses(params?: LeadStatusesQueryParams): Promise<LeadStatusesResponse> {
    try {
      const queryString = buildQueryString(params);
      const response = await crmClient.get<LeadStatusesResponse>(
        `${API_CONFIG.CRM.LEAD_STATUSES}${queryString}`
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to fetch lead statuses';
      throw new Error(message);
    }
  }

  // Get single lead status by ID
  async getLeadStatus(id: number): Promise<LeadStatus> {
    try {
      const response = await crmClient.get<LeadStatus>(
        API_CONFIG.CRM.LEAD_STATUS_DETAIL.replace(':id', id.toString())
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to fetch lead status';
      throw new Error(message);
    }
  }

  // Create new lead status
  async createLeadStatus(statusData: CreateLeadStatusPayload): Promise<LeadStatus> {
    try {
      const response = await crmClient.post<LeadStatus>(
        API_CONFIG.CRM.LEAD_STATUS_CREATE,
        statusData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to create lead status';
      throw new Error(message);
    }
  }

  // Update lead status
  async updateLeadStatus(id: number, statusData: UpdateLeadStatusPayload): Promise<LeadStatus> {
    try {
      const response = await crmClient.put<LeadStatus>(
        API_CONFIG.CRM.LEAD_STATUS_UPDATE.replace(':id', id.toString()),
        statusData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to update lead status';
      throw new Error(message);
    }
  }

  // Partially update lead status
  async patchLeadStatus(id: number, statusData: Partial<UpdateLeadStatusPayload>): Promise<LeadStatus> {
    try {
      const response = await crmClient.patch<LeadStatus>(
        API_CONFIG.CRM.LEAD_STATUS_UPDATE.replace(':id', id.toString()),
        statusData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to update lead status';
      throw new Error(message);
    }
  }

  // Delete lead status
  async deleteLeadStatus(id: number): Promise<void> {
    try {
      await crmClient.delete(
        API_CONFIG.CRM.LEAD_STATUS_DELETE.replace(':id', id.toString())
      );
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to delete lead status';
      throw new Error(message);
    }
  }

  // ==================== LEAD ACTIVITIES ====================
  
  // Get lead activities
  async getLeadActivities(params?: LeadActivitiesQueryParams): Promise<LeadActivitiesResponse> {
    try {
      const queryString = buildQueryString(params);
      const response = await crmClient.get<LeadActivitiesResponse>(
        `${API_CONFIG.CRM.LEAD_ACTIVITIES}${queryString}`
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to fetch lead activities';
      throw new Error(message);
    }
  }

  // Get single lead activity by ID
  async getLeadActivity(id: number): Promise<LeadActivity> {
    try {
      const response = await crmClient.get<LeadActivity>(
        API_CONFIG.CRM.LEAD_ACTIVITY_DETAIL.replace(':id', id.toString())
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to fetch lead activity';
      throw new Error(message);
    }
  }

  // Create new lead activity
  async createLeadActivity(activityData: CreateLeadActivityPayload): Promise<LeadActivity> {
    try {
      const response = await crmClient.post<LeadActivity>(
        API_CONFIG.CRM.LEAD_ACTIVITY_CREATE,
        activityData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to create lead activity';
      throw new Error(message);
    }
  }

  // Update lead activity
  async updateLeadActivity(id: number, activityData: UpdateLeadActivityPayload): Promise<LeadActivity> {
    try {
      const response = await crmClient.put<LeadActivity>(
        API_CONFIG.CRM.LEAD_ACTIVITY_UPDATE.replace(':id', id.toString()),
        activityData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to update lead activity';
      throw new Error(message);
    }
  }

  // Partially update lead activity
  async patchLeadActivity(id: number, activityData: Partial<UpdateLeadActivityPayload>): Promise<LeadActivity> {
    try {
      const response = await crmClient.patch<LeadActivity>(
        API_CONFIG.CRM.LEAD_ACTIVITY_UPDATE.replace(':id', id.toString()),
        activityData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to update lead activity';
      throw new Error(message);
    }
  }

  // Delete lead activity
  async deleteLeadActivity(id: number): Promise<void> {
    try {
      await crmClient.delete(
        API_CONFIG.CRM.LEAD_ACTIVITY_DELETE.replace(':id', id.toString())
      );
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to delete lead activity';
      throw new Error(message);
    }
  }

  // ==================== LEAD ORDERS ====================
  
  // Get lead orders
  async getLeadOrders(params?: LeadOrdersQueryParams): Promise<LeadOrdersResponse> {
    try {
      const queryString = buildQueryString(params);
      const response = await crmClient.get<LeadOrdersResponse>(
        `${API_CONFIG.CRM.LEAD_ORDERS}${queryString}`
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to fetch lead orders';
      throw new Error(message);
    }
  }

  // Get single lead order by ID
  async getLeadOrder(id: number): Promise<LeadOrder> {
    try {
      const response = await crmClient.get<LeadOrder>(
        API_CONFIG.CRM.LEAD_ORDER_DETAIL.replace(':id', id.toString())
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to fetch lead order';
      throw new Error(message);
    }
  }

  // Create new lead order
  async createLeadOrder(orderData: CreateLeadOrderPayload): Promise<LeadOrder> {
    try {
      const response = await crmClient.post<LeadOrder>(
        API_CONFIG.CRM.LEAD_ORDER_CREATE,
        orderData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to create lead order';
      throw new Error(message);
    }
  }

  // Update lead order
  async updateLeadOrder(id: number, orderData: UpdateLeadOrderPayload): Promise<LeadOrder> {
    try {
      const response = await crmClient.put<LeadOrder>(
        API_CONFIG.CRM.LEAD_ORDER_UPDATE.replace(':id', id.toString()),
        orderData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to update lead order';
      throw new Error(message);
    }
  }

  // Partially update lead order
  async patchLeadOrder(id: number, orderData: Partial<UpdateLeadOrderPayload>): Promise<LeadOrder> {
    try {
      const response = await crmClient.patch<LeadOrder>(
        API_CONFIG.CRM.LEAD_ORDER_UPDATE.replace(':id', id.toString()),
        orderData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 
                     error.response?.data?.message || 
                     'Failed to update lead order';
      throw new Error(message);
    }
  }

  // Delete lead order
  async deleteLeadOrder(id: number): Promise<void> {
    try {
      await crmClient.delete(
        API_CONFIG.CRM.LEAD_ORDER_DELETE.replace(':id', id.toString())
      );
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to delete lead order';
      throw new Error(message);
    }
  }

  // ==================== TASKS ====================

  // Get tasks
  async getTasks(params?: TasksQueryParams): Promise<TasksResponse> {
    try {
      const queryString = buildQueryString(params);
      const response = await crmClient.get<TasksResponse>(
        `${API_CONFIG.CRM.TASKS}${queryString}`
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to fetch tasks';
      throw new Error(message);
    }
  }

  // Get single task by ID
  async getTask(id: number): Promise<Task> {
    try {
      const response = await crmClient.get<Task>(
        API_CONFIG.CRM.TASK_DETAIL.replace(':id', id.toString())
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to fetch task';
      throw new Error(message);
    }
  }

  // Create new task
  async createTask(taskData: CreateTaskPayload): Promise<Task> {
    try {
      const response = await crmClient.post<Task>(
        API_CONFIG.CRM.TASK_CREATE,
        taskData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to create task';
      throw new Error(message);
    }
  }

  // Update task (full update)
  async updateTask(id: number, taskData: UpdateTaskPayload): Promise<Task> {
    try {
      const response = await crmClient.put<Task>(
        API_CONFIG.CRM.TASK_UPDATE.replace(':id', id.toString()),
        taskData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to update task';
      throw new Error(message);
    }
  }

  // Partially update task
  async patchTask(id: number, taskData: Partial<UpdateTaskPayload>): Promise<Task> {
    try {
      const response = await crmClient.patch<Task>(
        API_CONFIG.CRM.TASK_UPDATE.replace(':id', id.toString()),
        taskData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to update task';
      throw new Error(message);
    }
  }

  // Delete task
  async deleteTask(id: number): Promise<void> {
    try {
      await crmClient.delete(
        API_CONFIG.CRM.TASK_DELETE.replace(':id', id.toString())
      );
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to delete task';
      throw new Error(message);
    }
  }

  // ==================== FIELD CONFIGURATIONS ====================

  // Get field configurations
  async getFieldConfigurations(params?: LeadFieldConfigurationsQueryParams): Promise<LeadFieldConfigurationsResponse> {
    try {
      const queryString = buildQueryString(params);
      const response = await crmClient.get<LeadFieldConfigurationsResponse>(
        `${API_CONFIG.CRM.FIELD_CONFIGURATIONS}${queryString}`
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to fetch field configurations';
      throw new Error(message);
    }
  }

  // Get single field configuration by ID
  async getFieldConfiguration(id: number): Promise<LeadFieldConfiguration> {
    try {
      const response = await crmClient.get<LeadFieldConfiguration>(
        API_CONFIG.CRM.FIELD_CONFIGURATION_DETAIL.replace(':id', id.toString())
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to fetch field configuration';
      throw new Error(message);
    }
  }

  // Get field schema organized by standard and custom fields
  async getFieldSchema(): Promise<FieldSchemaResponse> {
    try {
      const response = await crmClient.get<FieldSchemaResponse>(
        API_CONFIG.CRM.FIELD_SCHEMA
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to fetch field schema';
      throw new Error(message);
    }
  }

  // Create new field configuration
  async createFieldConfiguration(configData: CreateLeadFieldConfigurationPayload): Promise<LeadFieldConfiguration> {
    try {
      const response = await crmClient.post<LeadFieldConfiguration>(
        API_CONFIG.CRM.FIELD_CONFIGURATION_CREATE,
        configData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to create field configuration';
      throw new Error(message);
    }
  }

  // Update field configuration (full update)
  async updateFieldConfiguration(id: number, configData: UpdateLeadFieldConfigurationPayload): Promise<LeadFieldConfiguration> {
    try {
      const response = await crmClient.put<LeadFieldConfiguration>(
        API_CONFIG.CRM.FIELD_CONFIGURATION_UPDATE.replace(':id', id.toString()),
        configData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to update field configuration';
      throw new Error(message);
    }
  }

  // Partially update field configuration
  async patchFieldConfiguration(id: number, configData: Partial<UpdateLeadFieldConfigurationPayload>): Promise<LeadFieldConfiguration> {
    try {
      const response = await crmClient.patch<LeadFieldConfiguration>(
        API_CONFIG.CRM.FIELD_CONFIGURATION_UPDATE.replace(':id', id.toString()),
        configData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to update field configuration';
      throw new Error(message);
    }
  }

  // Delete field configuration
  async deleteFieldConfiguration(id: number): Promise<void> {
    try {
      await crmClient.delete(
        API_CONFIG.CRM.FIELD_CONFIGURATION_DELETE.replace(':id', id.toString())
      );
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to delete field configuration';
      throw new Error(message);
    }
  }
}

export const crmService = new CRMService();