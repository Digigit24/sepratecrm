// src/services/realEstateService.ts
import type { AxiosProgressEvent } from 'axios';
import { AxiosError } from 'axios';
import { crmClient } from '@/lib/client';
import { API_CONFIG, buildQueryString } from '@/lib/apiConfig';
import type {
  Block,
  BlockCreateData,
  BlockUpdateData,
  BlocksQueryParams,
  PaginatedResponse,
  Project,
  ProjectCreateData,
  ProjectInterest,
  ProjectInterestCreateData,
  ProjectInterestUpdateData,
  ProjectInterestsQueryParams,
  ProjectSummary,
  ProjectUpdateData,
  ProjectsQueryParams,
  Unit,
  UnitCreateData,
  UnitLead,
  UnitLeadCreateData,
  UnitLeadUpdateData,
  UnitLeadsQueryParams,
  UnitUpdateData,
  UnitsQueryParams,
} from '@/types/realEstate.types';

const R = API_CONFIG.CRM.REAL_ESTATE;
type QueryParams = Record<string, string | number | boolean | undefined>;

export interface ProjectImageUploadOptions {
  workspaceBucket?: string;
  zataFolderId?: string;
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void;
}

export class RealEstateApiError extends Error {
  readonly status?: number;
  readonly backendError?: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly data?: unknown;

  constructor(error: unknown) {
    const axiosError = error as AxiosError<Record<string, unknown>>;
    const status = axiosError?.response?.status;
    const data = axiosError?.response?.data;

    const backendError: string | undefined =
      (data && typeof data === 'object' && typeof data.error === 'string' && data.error) ||
      (data && typeof data === 'object' && typeof data.detail === 'string' && data.detail) ||
      undefined;

    super(backendError || axiosError?.message || 'Real estate request failed');
    this.name = 'RealEstateApiError';
    this.status = status;
    this.backendError = backendError;
    this.data = data;

    if (status === 400 && data && typeof data === 'object') {
      const fieldErrors: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) fieldErrors[key] = value as string[];
      }
      if (Object.keys(fieldErrors).length > 0) this.fieldErrors = fieldErrors;
    }
  }
}

const wrap = (error: unknown): never => {
  throw new RealEstateApiError(error);
};

const withQuery = (path: string, params?: QueryParams): string =>
  `${path}${buildQueryString(params)}`;

const detail = (path: string, id: number): string => path.replace(':id', String(id));

class RealEstateService {
  // ==================== PROJECTS ====================

  async getProjects(params?: ProjectsQueryParams): Promise<PaginatedResponse<Project>> {
    try {
      const res = await crmClient.get<PaginatedResponse<Project>>(
        withQuery(R.PROJECTS, params as QueryParams)
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async getProject(id: number): Promise<Project> {
    try {
      const res = await crmClient.get<Project>(detail(R.PROJECT_DETAIL, id));
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async createProject(data: ProjectCreateData): Promise<Project> {
    try {
      const res = await crmClient.post<Project>(R.PROJECTS, data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async updateProject(id: number, data: ProjectUpdateData): Promise<Project> {
    try {
      const res = await crmClient.patch<Project>(detail(R.PROJECT_DETAIL, id), data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async deleteProject(id: number): Promise<void> {
    try {
      await crmClient.delete(detail(R.PROJECT_DETAIL, id));
    } catch (e) {
      wrap(e);
    }
  }

  async uploadProjectImage(
    id: number,
    file: File,
    options?: ProjectImageUploadOptions
  ): Promise<Project> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await crmClient.post<Project>(detail(R.PROJECT_IMAGE, id), formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Zata-Bucket': options?.workspaceBucket || '',
          'X-Zata-Folder-ID': options?.zataFolderId || '',
        },
        onUploadProgress: options?.onUploadProgress,
      });
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async deleteProjectImage(id: number): Promise<void> {
    try {
      await crmClient.delete(detail(R.PROJECT_IMAGE, id));
    } catch (e) {
      wrap(e);
    }
  }

  async getProjectSummary(id: number): Promise<ProjectSummary> {
    try {
      const res = await crmClient.get<ProjectSummary>(detail(R.PROJECT_SUMMARY, id));
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  // ==================== BLOCKS ====================

  async getBlocks(params?: BlocksQueryParams): Promise<PaginatedResponse<Block>> {
    try {
      const res = await crmClient.get<PaginatedResponse<Block>>(
        withQuery(R.BLOCKS, params as QueryParams)
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async getBlock(id: number): Promise<Block> {
    try {
      const res = await crmClient.get<Block>(detail(R.BLOCK_DETAIL, id));
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async createBlock(data: BlockCreateData): Promise<Block> {
    try {
      const res = await crmClient.post<Block>(R.BLOCKS, data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async updateBlock(id: number, data: BlockUpdateData): Promise<Block> {
    try {
      const res = await crmClient.patch<Block>(detail(R.BLOCK_DETAIL, id), data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async deleteBlock(id: number): Promise<void> {
    try {
      await crmClient.delete(detail(R.BLOCK_DETAIL, id));
    } catch (e) {
      wrap(e);
    }
  }

  // ==================== UNITS ====================

  async getUnits(params?: UnitsQueryParams): Promise<PaginatedResponse<Unit>> {
    try {
      const res = await crmClient.get<PaginatedResponse<Unit>>(
        withQuery(R.UNITS, params as QueryParams)
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async getUnit(id: number): Promise<Unit> {
    try {
      const res = await crmClient.get<Unit>(detail(R.UNIT_DETAIL, id));
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async createUnit(data: UnitCreateData): Promise<Unit> {
    try {
      const res = await crmClient.post<Unit>(R.UNITS, data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async updateUnit(id: number, data: UnitUpdateData): Promise<Unit> {
    try {
      const res = await crmClient.patch<Unit>(detail(R.UNIT_DETAIL, id), data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async deleteUnit(id: number): Promise<void> {
    try {
      await crmClient.delete(detail(R.UNIT_DETAIL, id));
    } catch (e) {
      wrap(e);
    }
  }

  // ==================== PROJECT INTERESTS ====================

  async getProjectInterests(
    params?: ProjectInterestsQueryParams
  ): Promise<PaginatedResponse<ProjectInterest>> {
    try {
      const res = await crmClient.get<PaginatedResponse<ProjectInterest>>(
        withQuery(R.PROJECT_INTERESTS, params as QueryParams)
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async getProjectInterest(id: number): Promise<ProjectInterest> {
    try {
      const res = await crmClient.get<ProjectInterest>(detail(R.PROJECT_INTEREST_DETAIL, id));
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async createProjectInterest(data: ProjectInterestCreateData): Promise<ProjectInterest> {
    try {
      const res = await crmClient.post<ProjectInterest>(R.PROJECT_INTERESTS, data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async updateProjectInterest(
    id: number,
    data: ProjectInterestUpdateData
  ): Promise<ProjectInterest> {
    try {
      const res = await crmClient.patch<ProjectInterest>(detail(R.PROJECT_INTEREST_DETAIL, id), data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async deleteProjectInterest(id: number): Promise<void> {
    try {
      await crmClient.delete(detail(R.PROJECT_INTEREST_DETAIL, id));
    } catch (e) {
      wrap(e);
    }
  }

  // ==================== UNIT LEADS ====================

  async getUnitLeads(params?: UnitLeadsQueryParams): Promise<PaginatedResponse<UnitLead>> {
    try {
      const res = await crmClient.get<PaginatedResponse<UnitLead>>(
        withQuery(R.UNIT_LEADS, params as QueryParams)
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async getUnitLead(id: number): Promise<UnitLead> {
    try {
      const res = await crmClient.get<UnitLead>(detail(R.UNIT_LEAD_DETAIL, id));
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async createUnitLead(data: UnitLeadCreateData): Promise<UnitLead> {
    try {
      const res = await crmClient.post<UnitLead>(R.UNIT_LEADS, data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async updateUnitLead(id: number, data: UnitLeadUpdateData): Promise<UnitLead> {
    try {
      const res = await crmClient.patch<UnitLead>(detail(R.UNIT_LEAD_DETAIL, id), data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async deleteUnitLead(id: number): Promise<void> {
    try {
      await crmClient.delete(detail(R.UNIT_LEAD_DETAIL, id));
    } catch (e) {
      wrap(e);
    }
  }
}

export const realEstateService = new RealEstateService();
export default realEstateService;
