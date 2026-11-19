export type ExamStatus = 'Aktif' | 'Draft' | 'Selesai';
export type SessionStatus = 'in_progress' | 'completed' | 'flagged_cheating';
export type PassingStatus = 'LULUS' | 'BELUM LULUS';
export type OptionKey = 'A' | 'B' | 'C' | 'D' | 'E';

export interface InstitutionSettings {
  id: number;
  school_name: string;
  logo_url: string;
  academic_year: string;
  exam_event_name: string;
  default_kkm: number;
  updated_at: string;
}

export interface AdminInstitutionSettings extends InstitutionSettings {
  proctor_pin: string;
}

export interface Exam {
  id: number;
  title: string;
  subject_name: string;
  exam_token: string;
  duration_minutes: number;
  kkm: number;
  status: ExamStatus;
  is_active: boolean;
  randomize_questions: boolean;
  show_result_to_student: boolean;
  created_at: string;
  question_count?: number;
}

export interface PublicExam {
  id: number;
  title: string;
  subject_name: string;
  duration_minutes: number;
  kkm: number;
  requires_token: boolean;
  question_count: number;
}

export interface Participant {
  id: number;
  exam_number: string;
  full_name: string;
  class_name: string;
  is_active: boolean;
  created_at: string;
}

export interface StudentQuestion {
  id: number;
  exam_id: number;
  question_number: number;
  question_text: string;
  image_url: string | null;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  option_a_image: string | null;
  option_b_image: string | null;
  option_c_image: string | null;
  option_d_image: string | null;
  option_e_image: string | null;
  score_weight: number;
}

export interface AdminQuestion extends StudentQuestion {
  correct_answer: OptionKey;
}

export interface ViolationLogEntry {
  timestamp: string;
  reason: string;
  duration_seconds: number;
}

export interface ExamSession {
  id: number;
  exam_id: number;
  participant_id: number;
  question_order: number[];
  start_time: string;
  end_time: string;
  status: SessionStatus;
  violations_count: number;
  violation_logs: ViolationLogEntry[];
  last_synced_at: string;
}

export interface StudentAnswerPayload {
  question_id: number;
  selected_option: OptionKey | null;
  is_doubtful: boolean;
}

export interface ExamResult {
  id: number;
  exam_id: number;
  participant_id: number;
  session_id: number;
  total_correct: number;
  total_wrong: number;
  total_empty: number;
  final_score: number;
  passing_status: PassingStatus;
  completed_at: string;
}

export interface StudentResultResponse {
  result: ExamResult;
  session_status: SessionStatus;
  violations_count: number;
  show_result_to_student: boolean;
  participant: Participant;
  exam: {
    id: number;
    title: string;
    subject_name: string;
    kkm: number;
  };
  institution: InstitutionSettings;
}

export interface MonitoringEntry {
  session_id: number | null;
  participant_id: number;
  exam_number: string;
  full_name: string;
  class_name: string;
  exam_id: number;
  exam_title: string;
  subject_name: string;
  status: SessionStatus | 'not_started';
  violations_count: number;
  violation_logs: ViolationLogEntry[];
  answered_count: number;
  total_questions: number;
  start_time: string | null;
  last_synced_at: string | null;
  final_score: number | null;
  passing_status: PassingStatus | null;
}

export interface AdminResultRow {
  result_id: number;
  exam_id: number;
  exam_title: string;
  subject_name: string;
  kkm: number;
  participant_id: number;
  exam_number: string;
  full_name: string;
  class_name: string;
  total_correct: number;
  total_wrong: number;
  total_empty: number;
  final_score: number;
  passing_status: PassingStatus;
  session_status: SessionStatus;
  violations_count: number;
  completed_at: string;
}
