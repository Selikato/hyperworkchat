export type UserRole = 'student' | 'teacher'

export type WorkDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface Profile {
  id: string
  first_name: string
  last_name: string
  role: UserRole
  class_section?: string
  work_days: WorkDay[]
  daily_work_minutes: number
  total_points: number
  created_at: string
  updated_at: string
}

export interface WorkSession {
  id: string
  user_id: string
  start_time: string
  end_time?: string
  planned_duration: number
  actual_duration: number
  points_earned: number
  is_completed: boolean
  was_paused: boolean
  created_at: string
}

export interface Message {
  id: string
  user_id: string
  content: string
  created_at: string
  profiles?: Profile
}

export interface SelectedStudent {
  id: string
  teacher_id: string
  student_id: string
  class_section: string
  selected_at: string
  student_profile?: Profile
  teacher_profile?: Profile
}

export interface LeaderboardEntry {
  id: string
  first_name: string
  last_name: string
  total_points: number
  class_section?: string
}

export interface WorkStats {
  total_sessions: number
  total_minutes: number
  total_points: number
  average_session_length: number
  completion_rate: number
}
