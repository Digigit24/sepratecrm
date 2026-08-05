export interface CRMNotification {
  id: number;
  notification_type: string;
  title: string;
  body: string;
  lead: number | null;
  lead_name_snapshot: string;
  action_url: string;
  payload: Record<string, unknown>;
  is_read: boolean;
  seen_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CRMNotification[];
}

