// ==================== REAL ESTATE TYPES ====================
// TypeScript types for the real_estate module. These mirror the backend API
// field names directly, so request/response objects intentionally use snake_case.

// ==================== ENUMS ====================

export enum ProjectType {
  RESIDENTIAL = 'residential',
  COMMERCIAL = 'commercial',
  MIXED = 'mixed',
  PLOTTED = 'plotted',
}

export enum ProjectStatus {
  PLANNING = 'planning',
  UNDER_CONSTRUCTION = 'under_construction',
  READY_TO_MOVE = 'ready_to_move',
  COMPLETED = 'completed',
  ON_HOLD = 'on_hold',
}

export enum BlockType {
  TOWER = 'tower',
  WING = 'wing',
  PHASE = 'phase',
  SECTOR = 'sector',
  BLOCK = 'block',
}

export enum UnitType {
  FLAT = 'flat',
  VILLA = 'villa',
  ROW_HOUSE = 'row_house',
  PLOT = 'plot',
  COMMERCIAL_SHOP = 'commercial_shop',
  COMMERCIAL_OFFICE = 'commercial_office',
  OTHER = 'other',
}

export enum UnitStatus {
  AVAILABLE = 'available',
  HELD = 'held',
  BOOKED = 'booked',
  SOLD = 'sold',
  BLOCKED = 'blocked',
}

export enum UnitFacing {
  NORTH = 'north',
  NORTH_EAST = 'north_east',
  EAST = 'east',
  SOUTH_EAST = 'south_east',
  SOUTH = 'south',
  SOUTH_WEST = 'south_west',
  WEST = 'west',
  NORTH_WEST = 'north_west',
}

export enum LeadUnitRelation {
  INTERESTED = 'interested',
  SITE_VISIT_SCHEDULED = 'site_visit_scheduled',
  SITE_VISIT_DONE = 'site_visit_done',
  NEGOTIATING = 'negotiating',
  BOOKED = 'booked',
  SOLD = 'sold',
  CANCELLED = 'cancelled',
}

// ==================== SHARED ====================

export interface PaginatedResponse<T> {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

export type Related<T> = number | T;
export type JsonObject = Record<string, unknown>;

// ==================== RESOURCES ====================

export interface Project {
  id: number;
  tenant_id: number | string;
  name: string;
  image_url: string | null;
  project_type: ProjectType;
  status: ProjectStatus;
  description: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  latitude: string | number | null;
  longitude: string | number | null;
  rera_number: string | null;
  possession_date: string | null;
  created_by_user_id: number | string | null;
  created_at: string;
  updated_at: string;
}

export interface Block {
  id: number;
  project: Related<Project>;
  name: string;
  block_type: BlockType;
  total_floors: number;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: number;
  project: Related<Project>;
  block: Related<Block> | null;
  unit_type: UnitType;
  unit_number: string;
  floor_number: number | null;
  facing: UnitFacing | null;
  configuration: string | null;
  carpet_area_sqft: string | number | null;
  built_up_area_sqft: string | number | null;
  super_built_up_area_sqft: string | number | null;
  plot_dimensions: string | null;
  rate_per_sqft: string | number | null;
  base_price: string | number | null;
  total_price: string | number | null;
  status: UnitStatus;
  amenities: string[] | JsonObject | null;
  metadata: JsonObject | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectInterest {
  id: number;
  project: Related<Project>;
  lead: number;
  budget_min: string | number | null;
  budget_max: string | number | null;
  preferred_unit_type: UnitType | null;
  preferred_configuration: string | null;
  notes: string | null;
  assigned_to: number | string | null;
  created_at: string;
  updated_at: string;
}

export interface UnitLead {
  id: number;
  unit: Related<Unit>;
  lead: number;
  relation_type: LeadUnitRelation;
  booking_amount: string | number | null;
  booking_date: string | null;
  notes: string | null;
  assigned_to: number | string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectSummary {
  project: Related<Project>;
  unit_counts_by_status: Partial<Record<UnitStatus, number>>;
  unit_counts_by_type: Partial<Record<UnitType, number>>;
  unit_counts_by_floor: Record<string, number>;
}

// ==================== REQUESTS / FILTERS ====================

export type ProjectCreateData = Omit<Project, 'id' | 'tenant_id' | 'image_url' | 'created_by_user_id' | 'created_at' | 'updated_at'>;
export type ProjectUpdateData = Partial<ProjectCreateData>;

export interface BlockCreateData {
  project: number;
  name: string;
  block_type: BlockType;
  total_floors: number;
}
export type BlockUpdateData = Partial<BlockCreateData>;

export interface UnitCreateData {
  project: number;
  block?: number | null;
  unit_type: UnitType;
  unit_number: string;
  floor_number?: number | null;
  facing?: UnitFacing | null;
  configuration?: string | null;
  carpet_area_sqft?: string | number | null;
  built_up_area_sqft?: string | number | null;
  super_built_up_area_sqft?: string | number | null;
  plot_dimensions?: string | null;
  rate_per_sqft?: string | number | null;
  base_price?: string | number | null;
  total_price?: string | number | null;
  status?: UnitStatus;
  amenities?: string[] | JsonObject | null;
  metadata?: JsonObject | null;
}
export type UnitUpdateData = Partial<UnitCreateData>;

export interface ProjectInterestCreateData {
  project: number;
  lead: number;
  budget_min?: string | number | null;
  budget_max?: string | number | null;
  preferred_unit_type?: UnitType | null;
  preferred_configuration?: string | null;
  notes?: string | null;
  assigned_to?: number | string | null;
}
export type ProjectInterestUpdateData = Partial<ProjectInterestCreateData>;

export interface UnitLeadCreateData {
  unit: number;
  lead: number;
  relation_type: LeadUnitRelation;
  booking_amount?: string | number | null;
  booking_date?: string | null;
  notes?: string | null;
  assigned_to?: number | string | null;
}
export type UnitLeadUpdateData = Partial<UnitLeadCreateData>;

export interface ProjectsQueryParams {
  project_type?: ProjectType;
  status?: ProjectStatus;
  city?: string;
  state?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export interface BlocksQueryParams {
  project?: number;
  page?: number;
  page_size?: number;
}

export interface UnitsQueryParams {
  project?: number;
  block?: number;
  status?: UnitStatus;
  unit_type?: UnitType;
  floor_number?: number;
  page?: number;
  page_size?: number;
}

export interface ProjectInterestsQueryParams {
  project?: number;
  lead?: number;
  page?: number;
  page_size?: number;
}

export interface UnitLeadsQueryParams {
  unit?: number;
  lead?: number;
  relation_type?: LeadUnitRelation;
  page?: number;
  page_size?: number;
}
