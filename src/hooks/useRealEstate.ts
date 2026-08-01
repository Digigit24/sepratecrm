// src/hooks/useRealEstate.ts
import useSWR, { mutate as swrMutate } from 'swr';
import { toast } from 'sonner';
import {
  realEstateService,
  RealEstateApiError,
  type ProjectImageUploadOptions,
} from '@/services/realEstateService';
import type {
  Block,
  BlockCreateData,
  BlockUpdateData,
  PaginatedResponse,
  Project,
  ProjectCreateData,
  ProjectInterest,
  ProjectInterestCreateData,
  ProjectInterestUpdateData,
  ProjectSummary,
  ProjectUpdateData,
  Unit,
  UnitCreateData,
  UnitLead,
  UnitLeadCreateData,
  UnitLeadUpdateData,
  UnitUpdateData,
  UnitsQueryParams,
} from '@/types/realEstate.types';

const PROJECTS_KEY = 'real-estate:projects';
const BLOCKS_KEY = 'real-estate:blocks';
const UNITS_KEY = 'real-estate:units';
const PROJECT_INTERESTS_KEY = 'real-estate:project-interests';
const UNIT_LEADS_KEY = 'real-estate:unit-leads';

const READ_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
} as const;

const revalidatePrefix = (prefix: string) => {
  void swrMutate((key: unknown) => key === prefix || (Array.isArray(key) && key[0] === prefix));
};

export const toastRealEstateError = (error: unknown, fallback = 'Something went wrong') => {
  if (error instanceof RealEstateApiError) {
    if (error.status === 401) return;
    if (error.fieldErrors) {
      const first = Object.values(error.fieldErrors)[0]?.[0];
      toast.error(first || error.message || fallback);
      return;
    }
    toast.error(error.backendError || error.message || fallback);
    return;
  }
  toast.error(fallback);
};

export const useRealEstate = () => {
  // ---------- PROJECTS ----------

  const useProjects = () =>
    useSWR<PaginatedResponse<Project>>(
      PROJECTS_KEY,
      () => realEstateService.getProjects(),
      READ_OPTIONS
    );

  const useProject = (id?: number | null) =>
    useSWR<Project>(
      id ? [PROJECTS_KEY, 'detail', id] : null,
      () => realEstateService.getProject(id as number),
      READ_OPTIONS
    );

  const useProjectSummary = (id?: number | null) =>
    useSWR<ProjectSummary>(
      id ? [PROJECTS_KEY, 'summary', id] : null,
      () => realEstateService.getProjectSummary(id as number),
      READ_OPTIONS
    );

  const createProject = async (data: ProjectCreateData): Promise<Project> => {
    try {
      const result = await realEstateService.createProject(data);
      void swrMutate(PROJECTS_KEY);
      toast.success('Project created');
      return result;
    } catch (e) {
      toastRealEstateError(e, 'Failed to create project');
      throw e;
    }
  };

  const updateProject = async (id: number, data: ProjectUpdateData): Promise<Project> => {
    try {
      const result = await realEstateService.updateProject(id, data);
      void swrMutate(PROJECTS_KEY);
      void swrMutate([PROJECTS_KEY, 'detail', id]);
      void swrMutate([PROJECTS_KEY, 'summary', id]);
      toast.success('Project updated');
      return result;
    } catch (e) {
      toastRealEstateError(e, 'Failed to update project');
      throw e;
    }
  };

  const deleteProject = async (id: number): Promise<void> => {
    try {
      await realEstateService.deleteProject(id);
      void swrMutate(PROJECTS_KEY);
      toast.success('Project deleted');
    } catch (e) {
      toastRealEstateError(e, 'Failed to delete project');
      throw e;
    }
  };

  const uploadProjectImage = async (
    id: number,
    file: File,
    options?: ProjectImageUploadOptions
  ): Promise<Project> => {
    try {
      const result = await realEstateService.uploadProjectImage(id, file, options);
      void swrMutate(PROJECTS_KEY);
      void swrMutate([PROJECTS_KEY, 'detail', id]);
      toast.success('Project cover image uploaded');
      return result;
    } catch (e) {
      toastRealEstateError(e, 'Failed to upload project cover image');
      throw e;
    }
  };

  const deleteProjectImage = async (id: number): Promise<void> => {
    try {
      await realEstateService.deleteProjectImage(id);
      void swrMutate(PROJECTS_KEY);
      void swrMutate([PROJECTS_KEY, 'detail', id]);
      toast.success('Project cover image removed');
    } catch (e) {
      toastRealEstateError(e, 'Failed to remove project cover image');
      throw e;
    }
  };

  // ---------- BLOCKS ----------

  const useBlocks = (projectId?: number | null) =>
    useSWR<PaginatedResponse<Block>>(
      projectId === null ? null : projectId ? [BLOCKS_KEY, { project: projectId }] : BLOCKS_KEY,
      () => realEstateService.getBlocks(projectId ? { project: projectId } : undefined),
      READ_OPTIONS
    );

  const createBlock = async (data: BlockCreateData): Promise<Block> => {
    try {
      const result = await realEstateService.createBlock(data);
      void swrMutate(BLOCKS_KEY);
      void swrMutate([BLOCKS_KEY, { project: Number(data.project) }]);
      toast.success('Block created');
      return result;
    } catch (e) {
      toastRealEstateError(e, 'Failed to create block');
      throw e;
    }
  };

  const updateBlock = async (id: number, data: BlockUpdateData): Promise<Block> => {
    try {
      const result = await realEstateService.updateBlock(id, data);
      void swrMutate(BLOCKS_KEY);
      void swrMutate([BLOCKS_KEY, 'detail', id]);
      if (data.project) void swrMutate([BLOCKS_KEY, { project: Number(data.project) }]);
      toast.success('Block updated');
      return result;
    } catch (e) {
      toastRealEstateError(e, 'Failed to update block');
      throw e;
    }
  };

  const deleteBlock = async (id: number): Promise<void> => {
    try {
      await realEstateService.deleteBlock(id);
      void swrMutate(BLOCKS_KEY);
      toast.success('Block deleted');
    } catch (e) {
      toastRealEstateError(e, 'Failed to delete block');
      throw e;
    }
  };

  // ---------- UNITS ----------

  const useUnits = (params?: UnitsQueryParams) =>
    useSWR<PaginatedResponse<Unit>>(
      params ? [UNITS_KEY, params] : UNITS_KEY,
      () => realEstateService.getUnits(params),
      READ_OPTIONS
    );

  const createUnit = async (data: UnitCreateData): Promise<Unit> => {
    try {
      const result = await realEstateService.createUnit(data);
      void swrMutate(UNITS_KEY);
      toast.success('Unit created');
      return result;
    } catch (e) {
      toastRealEstateError(e, 'Failed to create unit');
      throw e;
    }
  };

  const updateUnit = async (id: number, data: UnitUpdateData): Promise<Unit> => {
    try {
      const result = await realEstateService.updateUnit(id, data);
      void swrMutate(UNITS_KEY);
      void swrMutate([UNITS_KEY, 'detail', id]);
      toast.success('Unit updated');
      return result;
    } catch (e) {
      toastRealEstateError(e, 'Failed to update unit');
      throw e;
    }
  };

  const deleteUnit = async (id: number): Promise<void> => {
    try {
      await realEstateService.deleteUnit(id);
      void swrMutate(UNITS_KEY);
      toast.success('Unit deleted');
    } catch (e) {
      toastRealEstateError(e, 'Failed to delete unit');
      throw e;
    }
  };

  // ---------- PROJECT INTERESTS ----------

  const useProjectInterests = (leadId?: number | null) =>
    useSWR<PaginatedResponse<ProjectInterest>>(
      leadId === null
        ? null
        : leadId
          ? [PROJECT_INTERESTS_KEY, { lead: leadId }]
          : PROJECT_INTERESTS_KEY,
      () => realEstateService.getProjectInterests(leadId ? { lead: leadId } : undefined),
      READ_OPTIONS
    );

  const createProjectInterest = async (
    data: ProjectInterestCreateData
  ): Promise<ProjectInterest> => {
    try {
      const result = await realEstateService.createProjectInterest(data);
      revalidatePrefix(PROJECT_INTERESTS_KEY);
      toast.success('Project interest added');
      return result;
    } catch (e) {
      toastRealEstateError(e, 'Failed to add project interest');
      throw e;
    }
  };

  const updateProjectInterest = async (
    id: number,
    data: ProjectInterestUpdateData
  ): Promise<ProjectInterest> => {
    try {
      const result = await realEstateService.updateProjectInterest(id, data);
      revalidatePrefix(PROJECT_INTERESTS_KEY);
      void swrMutate([PROJECT_INTERESTS_KEY, 'detail', id]);
      toast.success('Project interest updated');
      return result;
    } catch (e) {
      toastRealEstateError(e, 'Failed to update project interest');
      throw e;
    }
  };

  const deleteProjectInterest = async (id: number): Promise<void> => {
    try {
      await realEstateService.deleteProjectInterest(id);
      revalidatePrefix(PROJECT_INTERESTS_KEY);
      toast.success('Project interest removed');
    } catch (e) {
      toastRealEstateError(e, 'Failed to remove project interest');
      throw e;
    }
  };

  // ---------- UNIT LEADS ----------

  const useUnitLeads = (leadId?: number | null) =>
    useSWR<PaginatedResponse<UnitLead>>(
      leadId === null
        ? null
        : leadId
          ? [UNIT_LEADS_KEY, { lead: leadId }]
          : UNIT_LEADS_KEY,
      () => realEstateService.getUnitLeads(leadId ? { lead: leadId } : undefined),
      READ_OPTIONS
    );

  const createUnitLead = async (data: UnitLeadCreateData): Promise<UnitLead> => {
    try {
      const result = await realEstateService.createUnitLead(data);
      revalidatePrefix(UNIT_LEADS_KEY);
      toast.success('Unit linked to lead');
      return result;
    } catch (e) {
      toastRealEstateError(e, 'Failed to link unit');
      throw e;
    }
  };

  const updateUnitLead = async (id: number, data: UnitLeadUpdateData): Promise<UnitLead> => {
    try {
      const result = await realEstateService.updateUnitLead(id, data);
      revalidatePrefix(UNIT_LEADS_KEY);
      void swrMutate([UNIT_LEADS_KEY, 'detail', id]);
      toast.success('Unit lead updated');
      return result;
    } catch (e) {
      toastRealEstateError(e, 'Failed to update unit lead');
      throw e;
    }
  };

  const deleteUnitLead = async (id: number): Promise<void> => {
    try {
      await realEstateService.deleteUnitLead(id);
      revalidatePrefix(UNIT_LEADS_KEY);
      toast.success('Unit lead removed');
    } catch (e) {
      toastRealEstateError(e, 'Failed to remove unit lead');
      throw e;
    }
  };

  return {
    useProjects,
    useProject,
    useProjectSummary,
    useBlocks,
    useUnits,
    useProjectInterests,
    useUnitLeads,
    createProject,
    updateProject,
    deleteProject,
    uploadProjectImage,
    deleteProjectImage,
    createBlock,
    updateBlock,
    deleteBlock,
    createUnit,
    updateUnit,
    deleteUnit,
    createProjectInterest,
    updateProjectInterest,
    deleteProjectInterest,
    createUnitLead,
    updateUnitLead,
    deleteUnitLead,
  };
};

export default useRealEstate;
