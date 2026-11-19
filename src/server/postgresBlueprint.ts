export const POSTGRES_SCHEMA_BLUEPRINT = `-- ============================================================================
-- SKEMA DATABASE CBT SEKOLAH & MADRASAH (PostgreSQL / Supabase Production DDL)
-- Mencakup Indeks Performa (100+ User Konkuren), Storage Bucket, & RLS
-- Jalankan seluruh skrip ini satu kali di Supabase SQL Editor.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE session_status_enum AS ENUM ('in_progress', 'completed', 'flagged_cheating');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE option_enum AS ENUM ('A', 'B', 'C', 'D', 'E');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1. Pengaturan Satuan Pendidikan
CREATE TABLE IF NOT EXISTS institution_settings (
  id BIGSERIAL PRIMARY KEY,
  school_name TEXT NOT NULL,
  logo_url TEXT,
  academic_year TEXT NOT NULL,
  exam_event_name TEXT NOT NULL,
  default_kkm NUMERIC(5,2) NOT NULL DEFAULT 75.00,
  proctor_pin TEXT NOT NULL DEFAULT '202601',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Paket & Jadwal Ujian
CREATE TABLE IF NOT EXISTS exams (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  exam_token TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  kkm NUMERIC(5,2) NOT NULL DEFAULT 75.00,
  status TEXT NOT NULL DEFAULT 'Draft',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  randomize_questions BOOLEAN NOT NULL DEFAULT TRUE,
  show_result_to_student BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Data Peserta Ujian
CREATE TABLE IF NOT EXISTS participants (
  id BIGSERIAL PRIMARY KEY,
  exam_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Bank Soal Eksakta & Visual
CREATE TABLE IF NOT EXISTS questions (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  image_url TEXT,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  option_e TEXT NOT NULL,
  option_a_image TEXT,
  option_b_image TEXT,
  option_c_image TEXT,
  option_d_image TEXT,
  option_e_image TEXT,
  correct_answer option_enum NOT NULL,
  score_weight NUMERIC(5,2) NOT NULL DEFAULT 1.00
);

-- 5. Sesi Ujian Peserta
CREATE TABLE IF NOT EXISTS exam_sessions (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  participant_id BIGINT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  question_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ NOT NULL,
  status session_status_enum NOT NULL DEFAULT 'in_progress',
  violations_count INTEGER NOT NULL DEFAULT 0,
  violation_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, participant_id)
);

-- 6. Lembar Jawaban Siswa (Sinkronisasi Incremental)
CREATE TABLE IF NOT EXISTS student_answers (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option option_enum,
  is_doubtful BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, question_id)
);

-- 7. Rekapitulasi Hasil & Skor Akhir
CREATE TABLE IF NOT EXISTS exam_results (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  participant_id BIGINT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  session_id BIGINT REFERENCES exam_sessions(id) ON DELETE CASCADE,
  total_correct INTEGER NOT NULL DEFAULT 0,
  total_wrong INTEGER NOT NULL DEFAULT 0,
  total_empty INTEGER NOT NULL DEFAULT 0,
  final_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  passing_status TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, participant_id)
);

-- ============================================================================
-- INDEKS PERFORMA TINGGI (KONKURENSI 100+ USER)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_participants_exam_number ON participants(exam_number);
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id, question_number);
CREATE INDEX IF NOT EXISTS idx_sessions_exam_status ON exam_sessions(exam_id, status);
CREATE INDEX IF NOT EXISTS idx_answers_session_id ON student_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_results_exam_participant ON exam_results(exam_id, participant_id);

-- ============================================================================
-- ISOLASI KUNCI JAWABAN & ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE institution_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;

-- View publik untuk siswa TANPA kolom correct_answer
CREATE OR REPLACE VIEW student_questions_view AS
  SELECT id, exam_id, question_number, question_text, image_url,
         option_a, option_b, option_c, option_d, option_e,
         option_a_image, option_b_image, option_c_image, option_d_image, option_e_image,
         score_weight
  FROM questions;

-- Hanya role service_role / admin yang dapat mengakses langsung tabel sensitif
DROP POLICY IF EXISTS "Service role full access on questions" ON questions;
CREATE POLICY "Service role full access on questions"
  ON questions FOR ALL
  USING (auth.role() = 'service_role' OR (auth.jwt() ->> 'role') = 'admin');

-- ============================================================================
-- STORAGE BUCKET UNTUK LOGO SEKOLAH & GAMBAR STIMULUS SOAL
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('cbt-assets', 'cbt-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read cbt-assets" ON storage.objects;
CREATE POLICY "Public read cbt-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cbt-assets');
`;
