export type UserRole = 'admin' | 'agent'

export type AccountStatus = 'active' | 'inactive' | 'suspended'

export type OutletStatus = 'active' | 'inactive'

export type VisitStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export type AssignmentStatus = 'active' | 'inactive'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  email: string
  phone: string | null
  profile_photo_url: string | null
  employee_id: string | null
  address: string | null
  designation: string | null
  territory: string | null
  joining_date: string | null
  status: AccountStatus
  last_active_at: string | null
  created_at: string
  updated_at: string
}

export interface Outlet {
  id: string
  outlet_code: string
  name: string
  owner_name: string | null
  phone: string | null
  address: string
  city: string | null
  area: string | null
  latitude: number
  longitude: number
  geofence_radius: number
  status: OutletStatus
  created_at: string
  updated_at: string
}

export interface OutletAssignment {
  id: string
  agent_id: string
  outlet_id: string
  assigned_date: string
  active: boolean
  created_at: string
  outlet?: Outlet
  agent?: Profile
}

export interface Visit {
  id: string
  agent_id: string
  outlet_id: string
  check_in_time: string | null
  check_out_time: string | null
  check_in_latitude: number | null
  check_in_longitude: number | null
  check_in_accuracy: number | null
  check_out_latitude: number | null
  check_out_longitude: number | null
  status: VisitStatus
  duration_minutes: number | null
  created_at: string
  updated_at: string
  outlet?: Outlet
  agent?: Profile
  photos?: Photo[]
  comments?: Comment[]
}

export interface LocationLog {
  id: string
  agent_id: string
  visit_id: string | null
  latitude: number
  longitude: number
  accuracy: number | null
  recorded_at: string
}

export interface Photo {
  id: string
  agent_id: string
  outlet_id: string
  visit_id: string
  storage_path: string
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  signed_url?: string
}

export interface Comment {
  id: string
  agent_id: string
  outlet_id: string
  visit_id: string
  comment_text: string
  created_at: string
  updated_at: string
  agent?: Profile
  outlet?: Outlet
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  message_text: string
  is_read: boolean
  created_at: string
  read_at: string | null
  sender?: Profile
  receiver?: Profile
}

export interface AuditLog {
  id: string
  actor_id: string
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  actor?: Profile
}

export interface AppSettings {
  id: string
  key: string
  value: string
  updated_at: string
}

export interface DashboardStats {
  totalAgents: number
  activeAgents: number
  agentsVisiting: number
  totalAssignedOutlets: number
  completedVisits: number
  pendingVisits: number
  totalPhotos: number
  totalComments: number
  unreadMessages: number
}

export interface GeoPosition {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export interface GeofenceResult {
  isWithin: boolean
  distanceMeters: number
  requiredRadius: number
}
