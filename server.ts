import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { db, gradeExamSession, initDatabase, UPLOAD_DIRECTORY } from './src/server/db.ts';
import { POSTGRES_SCHEMA_BLUEPRINT } from './src/server/postgresBlueprint.ts';
import {
  getSanitizedSupabaseConfig,
  pullMasterDataFromSupabase,
  pushLocalDataToSupabase,
  testSupabaseConnection,
} from './src/server/supabaseClient.ts';

dotenv.config();
initDatabase();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_SECRET =
  process.env.ADMIN_AUTH_SECRET || 'cbt-madrasah-proktor-secret-key-2026';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sekolah.sch.id';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'proktor2026';

app.use(express.json({ limit: '4mb' }));
app.use('/uploads', express.static(UPLOAD_DIRECTORY));

// Helper: Sign & verify Admin Bearer token
function signAdminToken(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: username,
      role: 'admin',
      exp: Date.now() + 1000 * 60 * 60 * 12,
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', ADMIN_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', ADMIN_SECRET)
    .update(payload)
    .digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return false;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed.role === 'admin' && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sesi Administrator tidak valid atau telah berakhir.' });
    return;
  }
  const token = auth.slice(7);
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Token Administrator kedaluwarsa. Silakan login kembali.' });
    return;
  }
  next();
}

function shuffleIds(ids: number[]): number[] {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ============================================================================
// PUBLIC & STUDENT ROUTES (STRICT ANSWER KEY ISOLATION)
// ============================================================================

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, server_now: new Date().toISOString() });
});

app.get('/api/public/bootstrap', (_req, res) => {
  const institution = db
    .prepare(
      'SELECT id, school_name, logo_url, academic_year, exam_event_name, default_kkm, updated_at FROM institution_settings LIMIT 1'
    )
    .get();

  const exams = db
    .prepare(`
      SELECT e.id, e.title, e.subject_name, e.duration_minutes, e.kkm,
             CASE WHEN LENGTH(TRIM(e.exam_token)) > 0 THEN 1 ELSE 0 END AS requires_token,
             (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS question_count
      FROM exams e
      WHERE e.status = 'Aktif' AND e.is_active = 1
      ORDER BY e.id ASC
    `)
    .all()
    .map((row: any) => ({
      ...row,
      requires_token: Boolean(row.requires_token),
    }));

  res.json({ institution, exams, server_now: new Date().toISOString() });
});

app.get('/api/public/participant-lookup', (req, res) => {
  const examNumber = String(req.query.exam_number || '').trim();
  if (!examNumber) {
    res.json({ found: false });
    return;
  }

  const participant = db
    .prepare(
      'SELECT full_name, class_name FROM participants WHERE UPPER(exam_number) = UPPER(?) AND is_active = 1'
    )
    .get(examNumber) as { full_name: string; class_name: string } | undefined;

  if (!participant) {
    res.json({ found: false });
    return;
  }

  res.json({
    found: true,
    full_name: participant.full_name,
    class_name: participant.class_name,
  });
});

const studentLoginSchema = z.object({
  exam_number: z.string().trim().min(1, 'Nomor peserta wajib diisi'),
  full_name: z.string().trim().optional().default(''),
  exam_id: z.number().int().positive(),
  token: z.string().trim().optional().default(''),
});

app.post('/api/student/login', (req, res) => {
  const parsed = studentLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data login tidak valid' });
    return;
  }

  const { exam_number, full_name, exam_id, token } = parsed.data;

  const participant = db
    .prepare('SELECT id, exam_number, full_name, class_name, is_active, created_at FROM participants WHERE UPPER(exam_number) = UPPER(?)')
    .get(exam_number) as any;

  if (!participant) {
    res.status(404).json({
      code: 'PARTICIPANT_NOT_FOUND',
      title: 'Data Tidak Ditemukan',
      error: 'Nomor Peserta tidak terdaftar pada database ujian.',
    });
    return;
  }

  if (!participant.is_active) {
    res.status(403).json({
      code: 'PARTICIPANT_INACTIVE',
      title: 'Akun Dinonaktifkan',
      error: 'Status kepesertaan Anda sedang nonaktif. Hubungi Proktor/Admin ujian.',
    });
    return;
  }

  if (full_name.length > 0) {
    const normalizedInput = full_name.replace(/\s+/g, ' ').toLowerCase();
    const normalizedDb = String(participant.full_name || '').trim().replace(/\s+/g, ' ').toLowerCase();
    if (normalizedInput !== normalizedDb) {
      res.status(401).json({
        code: 'NAME_MISMATCH',
        title: 'Nama Lengkap Tidak Sesuai',
        error: 'Nama lengkap siswa tidak cocok dengan Nomor Peserta yang terdaftar.',
      });
      return;
    }
  }

  const exam = db
    .prepare('SELECT * FROM exams WHERE id = ? AND status = \'Aktif\' AND is_active = 1')
    .get(exam_id) as any;

  if (!exam) {
    res.status(404).json({
      code: 'EXAM_NOT_ACTIVE',
      title: 'Ujian Tidak Tersedia',
      error: 'Paket ujian yang dipilih belum aktif atau telah ditutup.',
    });
    return;
  }

  if (exam.exam_token && exam.exam_token.trim().length > 0) {
    if (token.toUpperCase() !== exam.exam_token.trim().toUpperCase()) {
      res.status(401).json({
        code: 'INVALID_TOKEN',
        title: 'Token Ujian Salah',
        error: 'Token ujian tidak sesuai. Periksa kembali token yang diberikan oleh Proktor.',
      });
      return;
    }
  }

  const rawQuestions = db
    .prepare(`
      SELECT id, exam_id, question_number, question_text, image_url,
             option_a, option_b, option_c, option_d, option_e,
             option_a_image, option_b_image, option_c_image, option_d_image, option_e_image,
             score_weight
      FROM questions
      WHERE exam_id = ?
      ORDER BY question_number ASC
    `)
    .all(exam_id) as any[];

  if (rawQuestions.length === 0) {
    res.status(400).json({
      code: 'EMPTY_QUESTIONS',
      title: 'Bank Soal Kosong',
      error: 'Paket ujian ini belum memiliki soal. Hubungi Administrator ujian.',
    });
    return;
  }

  let session = db
    .prepare('SELECT * FROM exam_sessions WHERE exam_id = ? AND participant_id = ?')
    .get(exam_id, participant.id) as any;

  if (session && (session.status === 'completed' || session.status === 'flagged_cheating')) {
    res.status(409).json({
      code: 'ALREADY_COMPLETED',
      title: 'Ujian Sudah Selesai',
      error:
        'Anda telah menyelesaikan sesi ujian ini. Hubungi Proktor/Admin jika memerlukan reset sesi.',
      session_id: session.id,
    });
    return;
  }

  const now = new Date();
  if (!session) {
    const orderedIds = exam.randomize_questions
      ? shuffleIds(rawQuestions.map((q) => q.id))
      : rawQuestions.map((q) => q.id);

    const endTime = new Date(now.getTime() + exam.duration_minutes * 60_000).toISOString();
    const startTime = now.toISOString();

    const insertRes = db
      .prepare(`
        INSERT INTO exam_sessions (
          exam_id, participant_id, question_order, start_time, end_time, status, violations_count, violation_logs, last_synced_at
        ) VALUES (?, ?, ?, ?, ?, 'in_progress', 0, '[]', ?)
      `)
      .run(exam_id, participant.id, JSON.stringify(orderedIds), startTime, endTime, startTime);

    session = db
      .prepare('SELECT * FROM exam_sessions WHERE id = ?')
      .get(Number(insertRes.lastInsertRowid));
  }

  // Order questions by session.question_order (NEVER exposing correct_answer)
  const orderIds: number[] = JSON.parse(session.question_order || '[]');
  const qMap = new Map<number, any>(rawQuestions.map((q) => [q.id, q]));
  const orderedQuestions = orderIds
    .map((id) => qMap.get(id))
    .filter(Boolean);
  for (const q of rawQuestions) {
    if (!orderIds.includes(q.id)) orderedQuestions.push(q);
  }

  const savedAnswers = db
    .prepare('SELECT question_id, selected_option, is_doubtful FROM student_answers WHERE session_id = ?')
    .all(session.id)
    .map((a: any) => ({
      question_id: a.question_id,
      selected_option: a.selected_option,
      is_doubtful: Boolean(a.is_doubtful),
    }));

  const institution = db
    .prepare(
      'SELECT id, school_name, logo_url, academic_year, exam_event_name, default_kkm, updated_at FROM institution_settings LIMIT 1'
    )
    .get();

  res.json({
    server_now: now.toISOString(),
    institution,
    participant: {
      ...participant,
      is_active: Boolean(participant.is_active),
    },
    exam: {
      id: exam.id,
      title: exam.title,
      subject_name: exam.subject_name,
      duration_minutes: exam.duration_minutes,
      kkm: exam.kkm,
      randomize_questions: Boolean(exam.randomize_questions),
      show_result_to_student: Boolean(exam.show_result_to_student),
    },
    session: {
      ...session,
      question_order: orderIds,
      violation_logs: JSON.parse(session.violation_logs || '[]'),
    },
    questions: orderedQuestions,
    answers: savedAnswers,
  });
});

const syncSchema = z.object({
  session_id: z.number().int().positive(),
  answers: z.array(
    z.object({
      question_id: z.number().int().positive(),
      selected_option: z.enum(['A', 'B', 'C', 'D', 'E']).nullable(),
      is_doubtful: z.boolean(),
    })
  ),
});

app.post('/api/student/sync', (req, res) => {
  const parsed = syncSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Payload sinkronisasi tidak valid' });
    return;
  }

  const { session_id, answers } = parsed.data;
  const session = db.prepare('SELECT id, status, end_time FROM exam_sessions WHERE id = ?').get(session_id) as any;
  if (!session) {
    res.status(404).json({ code: 'SESSION_RESET', error: 'Sesi ujian telah direset oleh Proktor.' });
    return;
  }

  if (session.status !== 'in_progress') {
    res.status(409).json({
      code: 'SESSION_LOCKED',
      status: session.status,
      error: 'Sesi ujian telah dikunci atau diselesaikan.',
    });
    return;
  }

  const now = new Date().toISOString();
  const upsertStmt = db.prepare(`
    INSERT INTO student_answers (session_id, question_id, selected_option, is_doubtful, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(session_id, question_id) DO UPDATE SET
      selected_option = excluded.selected_option,
      is_doubtful = excluded.is_doubtful,
      updated_at = excluded.updated_at
  `);

  const syncTx = db.transaction(() => {
    for (const ans of answers) {
      upsertStmt.run(session_id, ans.question_id, ans.selected_option, ans.is_doubtful ? 1 : 0, now);
    }
    db.prepare('UPDATE exam_sessions SET last_synced_at = ? WHERE id = ?').run(now, session_id);
  });

  syncTx();
  res.json({ ok: true, synced_at: now, server_now: now, session_status: session.status });
});

const violationSchema = z.object({
  session_id: z.number().int().positive(),
  reason: z.string().trim().min(1).max(200),
  duration_seconds: z.number().min(0).max(36000),
  answers: z
    .array(
      z.object({
        question_id: z.number().int().positive(),
        selected_option: z.enum(['A', 'B', 'C', 'D', 'E']).nullable(),
        is_doubtful: z.boolean(),
      })
    )
    .optional(),
});

app.post('/api/student/violation', (req, res) => {
  const parsed = violationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Payload pelanggaran tidak valid' });
    return;
  }

  const { session_id, reason, duration_seconds, answers } = parsed.data;
  const session = db.prepare('SELECT * FROM exam_sessions WHERE id = ?').get(session_id) as any;
  if (!session) {
    res.status(404).json({ error: 'Sesi tidak ditemukan' });
    return;
  }

  if (session.status !== 'in_progress') {
    const existingResult = db
      .prepare('SELECT * FROM exam_results WHERE session_id = ?')
      .get(session_id);
    res.json({
      violations_count: session.violations_count,
      max_violations: 3,
      forced_submit: true,
      result: existingResult,
    });
    return;
  }

  const now = new Date().toISOString();
  const logs = JSON.parse(session.violation_logs || '[]');
  logs.push({ timestamp: now, reason, duration_seconds });
  const newCount = Number(session.violations_count) + 1;

  const tx = db.transaction(() => {
    if (answers && answers.length > 0) {
      const upsertStmt = db.prepare(`
        INSERT INTO student_answers (session_id, question_id, selected_option, is_doubtful, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(session_id, question_id) DO UPDATE SET
          selected_option = excluded.selected_option,
          is_doubtful = excluded.is_doubtful,
          updated_at = excluded.updated_at
      `);
      for (const ans of answers) {
        upsertStmt.run(session_id, ans.question_id, ans.selected_option, ans.is_doubtful ? 1 : 0, now);
      }
    }

    db.prepare(
      'UPDATE exam_sessions SET violations_count = ?, violation_logs = ?, last_synced_at = ? WHERE id = ?'
    ).run(newCount, JSON.stringify(logs), now, session_id);
  });
  tx();

  if (newCount >= 3) {
    const result = gradeExamSession(session_id, 'flagged_cheating');
    res.json({
      violations_count: newCount,
      max_violations: 3,
      forced_submit: true,
      result,
    });
    return;
  }

  res.json({
    violations_count: newCount,
    max_violations: 3,
    forced_submit: false,
  });
});

const submitSchema = z.object({
  session_id: z.number().int().positive(),
  answers: z
    .array(
      z.object({
        question_id: z.number().int().positive(),
        selected_option: z.enum(['A', 'B', 'C', 'D', 'E']).nullable(),
        is_doubtful: z.boolean(),
      })
    )
    .optional(),
});

app.post('/api/student/submit', (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Payload pengiriman ujian tidak valid' });
    return;
  }

  const { session_id, answers } = parsed.data;
  const session = db.prepare('SELECT * FROM exam_sessions WHERE id = ?').get(session_id) as any;
  if (!session) {
    res.status(404).json({ error: 'Sesi ujian tidak ditemukan' });
    return;
  }

  const now = new Date().toISOString();
  if (session.status === 'in_progress' && answers && answers.length > 0) {
    const upsertStmt = db.prepare(`
      INSERT INTO student_answers (session_id, question_id, selected_option, is_doubtful, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(session_id, question_id) DO UPDATE SET
        selected_option = excluded.selected_option,
        is_doubtful = excluded.is_doubtful,
        updated_at = excluded.updated_at
    `);
    const saveTx = db.transaction(() => {
      for (const ans of answers) {
        upsertStmt.run(session_id, ans.question_id, ans.selected_option, ans.is_doubtful ? 1 : 0, now);
      }
    });
    saveTx();
  }

  const result = gradeExamSession(
    session_id,
    session.status === 'flagged_cheating' ? 'flagged_cheating' : 'completed'
  );

  res.json({ ok: true, result });
});

app.get('/api/student/result/:sessionId', (req, res) => {
  const sessionId = Number(req.params.sessionId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    res.status(400).json({ error: 'ID sesi tidak valid' });
    return;
  }

  const session = db.prepare('SELECT * FROM exam_sessions WHERE id = ?').get(sessionId) as any;
  if (!session) {
    res.status(404).json({ error: 'Sesi ujian tidak ditemukan' });
    return;
  }

  const exam = db
    .prepare('SELECT id, title, subject_name, kkm, show_result_to_student FROM exams WHERE id = ?')
    .get(session.exam_id) as any;
  const participant = db
    .prepare('SELECT id, exam_number, full_name, class_name, is_active, created_at FROM participants WHERE id = ?')
    .get(session.participant_id) as any;
  const institution = db
    .prepare(
      'SELECT id, school_name, logo_url, academic_year, exam_event_name, default_kkm, updated_at FROM institution_settings LIMIT 1'
    )
    .get() as any;

  let result = db.prepare('SELECT * FROM exam_results WHERE session_id = ?').get(sessionId) as any;
  if (!result && session.status !== 'in_progress') {
    result = gradeExamSession(sessionId, session.status);
  }
  if (!result) {
    res.status(400).json({ error: 'Ujian belum diselesaikan' });
    return;
  }

  const showResult = Boolean(exam.show_result_to_student);

  res.json({
    result: showResult
      ? result
      : {
          ...result,
          total_correct: 0,
          total_wrong: 0,
          total_empty: 0,
          final_score: 0,
          passing_status: result.passing_status,
        },
    session_status: session.status,
    violations_count: session.violations_count,
    show_result_to_student: showResult,
    participant: {
      ...participant,
      is_active: Boolean(participant.is_active),
    },
    exam: {
      id: exam.id,
      title: exam.title,
      subject_name: exam.subject_name,
      kkm: exam.kkm,
    },
    institution,
  });
});

// ============================================================================
// ADMIN / PROCTOR ROUTES
// ============================================================================

const adminLoginSchema = z.object({
  mode: z.enum(['credentials', 'pin']),
  email: z.string().trim().optional(),
  password: z.string().optional(),
  pin: z.string().trim().optional(),
});

app.post('/api/admin/login', (req, res) => {
  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Format login tidak valid' });
    return;
  }

  const { mode, email, password, pin } = parsed.data;
  const settings = db
    .prepare('SELECT proctor_pin FROM institution_settings LIMIT 1')
    .get() as { proctor_pin: string };

  if (mode === 'pin') {
    if (!pin || pin !== settings.proctor_pin) {
      res.status(401).json({ error: 'PIN Proktor salah. Periksa kembali PIN keamanan.' });
      return;
    }
    const token = signAdminToken('proktor@sekolah.sch.id');
    res.json({ token, admin: { name: 'Proktor Ujian', role: 'Proktor' } });
    return;
  }

  if (
    !email ||
    !password ||
    email.toLowerCase() !== ADMIN_EMAIL.toLowerCase() ||
    password !== ADMIN_PASSWORD
  ) {
    res.status(401).json({ error: 'Email atau kata sandi Administrator tidak sesuai.' });
    return;
  }

  const token = signAdminToken(email);
  res.json({ token, admin: { name: 'Administrator CBT', email, role: 'Administrator' } });
});

app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
  const institution = db.prepare('SELECT * FROM institution_settings LIMIT 1').get();
  const totalParticipants = (
    db.prepare('SELECT COUNT(*) AS count FROM participants WHERE is_active = 1').get() as any
  ).count;
  const totalExams = (db.prepare('SELECT COUNT(*) AS count FROM exams').get() as any).count;
  const activeExams = (
    db.prepare("SELECT COUNT(*) AS count FROM exams WHERE status = 'Aktif' AND is_active = 1").get() as any
  ).count;
  const totalQuestions = (db.prepare('SELECT COUNT(*) AS count FROM questions').get() as any).count;
  const inProgressCount = (
    db.prepare("SELECT COUNT(*) AS count FROM exam_sessions WHERE status = 'in_progress'").get() as any
  ).count;
  const completedCount = (
    db.prepare("SELECT COUNT(*) AS count FROM exam_sessions WHERE status = 'completed'").get() as any
  ).count;
  const flaggedCount = (
    db.prepare("SELECT COUNT(*) AS count FROM exam_sessions WHERE status = 'flagged_cheating'").get() as any
  ).count;

  const recentAlerts = db
    .prepare(`
      SELECT es.id AS session_id, p.exam_number, p.full_name, p.class_name,
             e.title AS exam_title, es.status, es.violations_count, es.last_synced_at
      FROM exam_sessions es
      JOIN participants p ON p.id = es.participant_id
      JOIN exams e ON e.id = es.exam_id
      WHERE es.violations_count > 0
      ORDER BY es.last_synced_at DESC
      LIMIT 8
    `)
    .all();

  res.json({
    institution,
    stats: {
      total_participants: totalParticipants,
      total_exams: totalExams,
      active_exams: activeExams,
      total_questions: totalQuestions,
      in_progress: inProgressCount,
      completed: completedCount,
      flagged_cheating: flaggedCount,
    },
    recent_alerts: recentAlerts,
  });
});

app.get('/api/admin/schema-sql', requireAdmin, (_req, res) => {
  res.json({ sql: POSTGRES_SCHEMA_BLUEPRINT });
});

app.get('/api/admin/settings', requireAdmin, (_req, res) => {
  const settings = db.prepare('SELECT * FROM institution_settings LIMIT 1').get();
  res.json({ settings });
});

const settingsSchema = z.object({
  school_name: z.string().trim().min(2),
  logo_url: z.string().trim().min(1),
  academic_year: z.string().trim().min(4),
  exam_event_name: z.string().trim().min(2),
  default_kkm: z.number().min(0).max(100),
  proctor_pin: z.string().trim().min(4).max(12),
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Input pengaturan tidak valid' });
    return;
  }

  const { school_name, logo_url, academic_year, exam_event_name, default_kkm, proctor_pin } =
    parsed.data;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE institution_settings
    SET school_name = ?, logo_url = ?, academic_year = ?, exam_event_name = ?,
        default_kkm = ?, proctor_pin = ?, updated_at = ?
    WHERE id = (SELECT id FROM institution_settings LIMIT 1)
  `).run(school_name, logo_url, academic_year, exam_event_name, default_kkm, proctor_pin, now);

  const updated = db.prepare('SELECT * FROM institution_settings LIMIT 1').get();
  res.json({ settings: updated });
});

// Upload compressed image (max ~750KB base64)
const uploadImageSchema = z.object({
  data_url: z.string().startsWith('data:image/'),
  prefix: z.string().trim().optional().default('img'),
});

app.post('/api/admin/upload-image', requireAdmin, (req, res) => {
  const parsed = uploadImageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Format gambar tidak valid' });
    return;
  }

  const matches = parsed.data.data_url.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!matches) {
    res.status(400).json({ error: 'Tipe gambar harus PNG, JPG, atau WEBP' });
    return;
  }

  const ext = matches[1].toLowerCase() === 'jpeg' ? 'jpg' : matches[1].toLowerCase();
  const buffer = Buffer.from(matches[2], 'base64');
  if (buffer.byteLength > 800 * 1024) {
    res.status(400).json({ error: 'Ukuran gambar terkompresi melebihi batas maksimal 800KB' });
    return;
  }

  const safePrefix = parsed.data.prefix.replace(/[^a-z0-9_-]/gi, '').slice(0, 20) || 'img';
  const filename = `${safePrefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIRECTORY, filename), buffer);

  res.json({ url: `/uploads/${filename}`, size_bytes: buffer.byteLength });
});

// Participants CRUD & Bulk Import
app.get('/api/admin/participants', requireAdmin, (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM participants ORDER BY class_name ASC, exam_number ASC')
    .all()
    .map((p: any) => ({ ...p, is_active: Boolean(p.is_active) }));
  res.json({ participants: rows });
});

const participantSchema = z.object({
  exam_number: z.string().trim().min(2, 'Nomor peserta minimal 2 karakter'),
  full_name: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter'),
  class_name: z.string().trim().min(1, 'Kelas wajib diisi'),
  is_active: z.boolean().default(true),
});

app.post('/api/admin/participants', requireAdmin, (req, res) => {
  const parsed = participantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data peserta tidak valid' });
    return;
  }

  try {
    const info = db
      .prepare('INSERT INTO participants (exam_number, full_name, class_name, is_active) VALUES (?, ?, ?, ?)')
      .run(
        parsed.data.exam_number,
        parsed.data.full_name,
        parsed.data.class_name,
        parsed.data.is_active ? 1 : 0
      );
    const created = db
      .prepare('SELECT * FROM participants WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as any;
    res.status(201).json({ participant: { ...created, is_active: Boolean(created.is_active) } });
  } catch (err: any) {
    if (String(err?.message).includes('UNIQUE')) {
      res.status(409).json({ error: `Nomor peserta ${parsed.data.exam_number} sudah terdaftar.` });
      return;
    }
    throw err;
  }
});

app.put('/api/admin/participants/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const parsed = participantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data peserta tidak valid' });
    return;
  }

  try {
    db.prepare(
      'UPDATE participants SET exam_number = ?, full_name = ?, class_name = ?, is_active = ? WHERE id = ?'
    ).run(
      parsed.data.exam_number,
      parsed.data.full_name,
      parsed.data.class_name,
      parsed.data.is_active ? 1 : 0,
      id
    );
    const updated = db.prepare('SELECT * FROM participants WHERE id = ?').get(id) as any;
    res.json({ participant: { ...updated, is_active: Boolean(updated.is_active) } });
  } catch (err: any) {
    if (String(err?.message).includes('UNIQUE')) {
      res.status(409).json({ error: `Nomor peserta ${parsed.data.exam_number} sudah digunakan.` });
      return;
    }
    throw err;
  }
});

app.delete('/api/admin/participants/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM participants WHERE id = ?').run(id);
  res.json({ ok: true });
});

const importParticipantsSchema = z.object({
  rows: z.array(
    z.object({
      exam_number: z.string().trim().min(1),
      full_name: z.string().trim().min(1),
      class_name: z.string().trim().min(1),
      is_active: z.boolean().optional().default(true),
    })
  ),
  skip_duplicates: z.boolean().optional().default(true),
});

app.post('/api/admin/participants/import', requireAdmin, (req, res) => {
  const parsed = importParticipantsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Format data import peserta tidak valid' });
    return;
  }

  let inserted = 0;
  let skipped = 0;
  const duplicates: string[] = [];

  const existingSet = new Set(
    (db.prepare('SELECT UPPER(exam_number) AS num FROM participants').all() as Array<{ num: string }>).map(
      (r) => r.num
    )
  );

  const insertStmt = db.prepare(
    'INSERT INTO participants (exam_number, full_name, class_name, is_active) VALUES (?, ?, ?, ?)'
  );

  const tx = db.transaction(() => {
    for (const row of parsed.data.rows) {
      const norm = row.exam_number.toUpperCase();
      if (existingSet.has(norm)) {
        skipped += 1;
        duplicates.push(row.exam_number);
        continue;
      }
      existingSet.add(norm);
      insertStmt.run(row.exam_number, row.full_name, row.class_name, row.is_active ? 1 : 0);
      inserted += 1;
    }
  });

  tx();
  res.json({ inserted, skipped, duplicates });
});

// Exams CRUD
app.get('/api/admin/exams', requireAdmin, (_req, res) => {
  const rows = db
    .prepare(`
      SELECT e.*, (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS question_count
      FROM exams e
      ORDER BY e.id DESC
    `)
    .all()
    .map((e: any) => ({
      ...e,
      is_active: Boolean(e.is_active),
      randomize_questions: Boolean(e.randomize_questions),
      show_result_to_student: Boolean(e.show_result_to_student),
    }));
  res.json({ exams: rows });
});

const examSchema = z.object({
  title: z.string().trim().min(3),
  subject_name: z.string().trim().min(2),
  exam_token: z.string().trim().max(20).default(''),
  duration_minutes: z.number().int().min(5).max(360),
  kkm: z.number().min(0).max(100),
  status: z.enum(['Aktif', 'Draft', 'Selesai']),
  randomize_questions: z.boolean(),
  show_result_to_student: z.boolean(),
});

app.post('/api/admin/exams', requireAdmin, (req, res) => {
  const parsed = examSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data ujian tidak valid' });
    return;
  }
  const d = parsed.data;
  const isActive = d.status === 'Aktif' ? 1 : 0;
  const info = db
    .prepare(`
      INSERT INTO exams (title, subject_name, exam_token, duration_minutes, kkm, status, is_active, randomize_questions, show_result_to_student)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      d.title,
      d.subject_name,
      d.exam_token.toUpperCase(),
      d.duration_minutes,
      d.kkm,
      d.status,
      isActive,
      d.randomize_questions ? 1 : 0,
      d.show_result_to_student ? 1 : 0
    );

  const created = db.prepare('SELECT * FROM exams WHERE id = ?').get(Number(info.lastInsertRowid)) as any;
  res.status(201).json({
    exam: {
      ...created,
      is_active: Boolean(created.is_active),
      randomize_questions: Boolean(created.randomize_questions),
      show_result_to_student: Boolean(created.show_result_to_student),
      question_count: 0,
    },
  });
});

app.put('/api/admin/exams/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const parsed = examSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data ujian tidak valid' });
    return;
  }
  const d = parsed.data;
  const isActive = d.status === 'Aktif' ? 1 : 0;
  db.prepare(`
    UPDATE exams
    SET title = ?, subject_name = ?, exam_token = ?, duration_minutes = ?, kkm = ?,
        status = ?, is_active = ?, randomize_questions = ?, show_result_to_student = ?
    WHERE id = ?
  `).run(
    d.title,
    d.subject_name,
    d.exam_token.toUpperCase(),
    d.duration_minutes,
    d.kkm,
    d.status,
    isActive,
    d.randomize_questions ? 1 : 0,
    d.show_result_to_student ? 1 : 0,
    id
  );
  const updated = db
    .prepare(
      'SELECT e.*, (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS question_count FROM exams e WHERE e.id = ?'
    )
    .get(id) as any;
  res.json({
    exam: {
      ...updated,
      is_active: Boolean(updated.is_active),
      randomize_questions: Boolean(updated.randomize_questions),
      show_result_to_student: Boolean(updated.show_result_to_student),
    },
  });
});

app.delete('/api/admin/exams/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM exams WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Questions CRUD (Admin gets correct_answer)
app.get('/api/admin/questions', requireAdmin, (req, res) => {
  const examId = Number(req.query.exam_id);
  if (!Number.isInteger(examId) || examId <= 0) {
    res.status(400).json({ error: 'Parameter exam_id wajib disertakan' });
    return;
  }
  const questions = db
    .prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY question_number ASC, id ASC')
    .all(examId);
  res.json({ questions });
});

const questionSchema = z.object({
  exam_id: z.number().int().positive(),
  question_number: z.number().int().min(1),
  question_text: z.string().trim().min(1, 'Teks pertanyaan wajib diisi'),
  image_url: z.string().nullable().optional(),
  option_a: z.string().trim().min(1, 'Opsi A wajib diisi'),
  option_b: z.string().trim().min(1, 'Opsi B wajib diisi'),
  option_c: z.string().trim().min(1, 'Opsi C wajib diisi'),
  option_d: z.string().trim().min(1, 'Opsi D wajib diisi'),
  option_e: z.string().trim().min(1, 'Opsi E wajib diisi'),
  option_a_image: z.string().nullable().optional(),
  option_b_image: z.string().nullable().optional(),
  option_c_image: z.string().nullable().optional(),
  option_d_image: z.string().nullable().optional(),
  option_e_image: z.string().nullable().optional(),
  correct_answer: z.enum(['A', 'B', 'C', 'D', 'E']),
  score_weight: z.number().min(0.1).max(1000).default(1),
});

app.post('/api/admin/questions', requireAdmin, (req, res) => {
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data soal tidak valid' });
    return;
  }
  const q = parsed.data;
  const info = db
    .prepare(`
      INSERT INTO questions (
        exam_id, question_number, question_text, image_url,
        option_a, option_b, option_c, option_d, option_e,
        option_a_image, option_b_image, option_c_image, option_d_image, option_e_image,
        correct_answer, score_weight
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      q.exam_id,
      q.question_number,
      q.question_text,
      q.image_url || null,
      q.option_a,
      q.option_b,
      q.option_c,
      q.option_d,
      q.option_e,
      q.option_a_image || null,
      q.option_b_image || null,
      q.option_c_image || null,
      q.option_d_image || null,
      q.option_e_image || null,
      q.correct_answer,
      q.score_weight
    );
  const created = db.prepare('SELECT * FROM questions WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json({ question: created });
});

app.put('/api/admin/questions/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data soal tidak valid' });
    return;
  }
  const q = parsed.data;
  db.prepare(`
    UPDATE questions
    SET exam_id = ?, question_number = ?, question_text = ?, image_url = ?,
        option_a = ?, option_b = ?, option_c = ?, option_d = ?, option_e = ?,
        option_a_image = ?, option_b_image = ?, option_c_image = ?, option_d_image = ?, option_e_image = ?,
        correct_answer = ?, score_weight = ?
    WHERE id = ?
  `).run(
    q.exam_id,
    q.question_number,
    q.question_text,
    q.image_url || null,
    q.option_a,
    q.option_b,
    q.option_c,
    q.option_d,
    q.option_e,
    q.option_a_image || null,
    q.option_b_image || null,
    q.option_c_image || null,
    q.option_d_image || null,
    q.option_e_image || null,
    q.correct_answer,
    q.score_weight,
    id
  );
  const updated = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
  res.json({ question: updated });
});

app.delete('/api/admin/questions/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM questions WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Live Monitoring & Session Reset
app.get('/api/admin/monitoring', requireAdmin, (req, res) => {
  const examId = Number(req.query.exam_id);
  if (!Number.isInteger(examId) || examId <= 0) {
    res.status(400).json({ error: 'exam_id wajib dipilih' });
    return;
  }

  const exam = db.prepare('SELECT id, title, subject_name FROM exams WHERE id = ?').get(examId) as any;
  if (!exam) {
    res.status(404).json({ error: 'Paket ujian tidak ditemukan' });
    return;
  }

  const totalQuestions = (
    db.prepare('SELECT COUNT(*) AS count FROM questions WHERE exam_id = ?').get(examId) as any
  ).count;

  const rows = db
    .prepare(`
      SELECT
        es.id AS session_id,
        p.id AS participant_id,
        p.exam_number,
        p.full_name,
        p.class_name,
        COALESCE(es.status, 'not_started') AS status,
        COALESCE(es.violations_count, 0) AS violations_count,
        COALESCE(es.violation_logs, '[]') AS violation_logs,
        es.start_time,
        es.last_synced_at,
        (SELECT COUNT(*) FROM student_answers sa WHERE sa.session_id = es.id AND sa.selected_option IS NOT NULL) AS answered_count,
        er.final_score,
        er.passing_status
      FROM participants p
      LEFT JOIN exam_sessions es ON es.participant_id = p.id AND es.exam_id = ?
      LEFT JOIN exam_results er ON er.session_id = es.id
      WHERE p.is_active = 1
      ORDER BY
        CASE COALESCE(es.status, 'not_started')
          WHEN 'flagged_cheating' THEN 0
          WHEN 'in_progress' THEN 1
          WHEN 'completed' THEN 2
          ELSE 3
        END,
        p.class_name ASC,
        p.exam_number ASC
    `)
    .all(examId)
    .map((r: any) => ({
      ...r,
      exam_id: exam.id,
      exam_title: exam.title,
      subject_name: exam.subject_name,
      total_questions: totalQuestions,
      violation_logs: JSON.parse(r.violation_logs || '[]'),
    }));

  const summary = {
    total_registered: rows.length,
    in_progress: rows.filter((r) => r.status === 'in_progress').length,
    completed: rows.filter((r) => r.status === 'completed').length,
    flagged_cheating: rows.filter((r) => r.status === 'flagged_cheating').length,
    not_started: rows.filter((r) => r.status === 'not_started').length,
  };

  res.json({ exam, summary, rows });
});

app.post('/api/admin/sessions/:sessionId/reset', requireAdmin, (req, res) => {
  const sessionId = Number(req.params.sessionId);
  const session = db.prepare('SELECT id FROM exam_sessions WHERE id = ?').get(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Sesi tidak ditemukan' });
    return;
  }

  const resetTx = db.transaction(() => {
    db.prepare('DELETE FROM exam_results WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM student_answers WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM exam_sessions WHERE id = ?').run(sessionId);
  });
  resetTx();
  res.json({ ok: true });
});

app.post('/api/admin/sessions/:sessionId/force-finish', requireAdmin, (req, res) => {
  const sessionId = Number(req.params.sessionId);
  const session = db.prepare('SELECT id, status FROM exam_sessions WHERE id = ?').get(sessionId) as any;
  if (!session) {
    res.status(404).json({ error: 'Sesi tidak ditemukan' });
    return;
  }
  const result = gradeExamSession(sessionId, 'completed');
  res.json({ ok: true, result });
});

// Results Matrix
app.get('/api/admin/results', requireAdmin, (req, res) => {
  const examId = req.query.exam_id ? Number(req.query.exam_id) : null;
  const classFilter = req.query.class_name ? String(req.query.class_name) : null;

  let query = `
    SELECT
      er.id AS result_id,
      er.exam_id,
      e.title AS exam_title,
      e.subject_name,
      e.kkm,
      er.participant_id,
      p.exam_number,
      p.full_name,
      p.class_name,
      er.total_correct,
      er.total_wrong,
      er.total_empty,
      er.final_score,
      er.passing_status,
      es.status AS session_status,
      es.violations_count,
      er.completed_at
    FROM exam_results er
    JOIN exams e ON e.id = er.exam_id
    JOIN participants p ON p.id = er.participant_id
    JOIN exam_sessions es ON es.id = er.session_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (examId) {
    query += ' AND er.exam_id = ?';
    params.push(examId);
  }
  if (classFilter && classFilter !== 'ALL') {
    query += ' AND p.class_name = ?';
    params.push(classFilter);
  }
  query += ' ORDER BY e.id ASC, er.final_score DESC, p.full_name ASC';

  const results = db.prepare(query).all(...params);
  res.json({ results });
});

// ============================================================================
// SUPABASE API CONFIGURATION & SYNC PROXY ROUTES (ADMIN ONLY)
// ============================================================================

app.get('/api/admin/supabase/config', requireAdmin, (_req, res) => {
  res.json({ config: getSanitizedSupabaseConfig() });
});

const supabaseConfigSchema = z.object({
  supabase_url: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(v),
      'URL Supabase harus diawali https:// (contoh: https://xyz.supabase.co)'
    ),
  supabase_anon_key: z.string().trim().optional(),
  supabase_service_key: z.string().trim().optional(),
  storage_bucket: z.string().trim().min(1).default('cbt-assets'),
  is_enabled: z.boolean().default(false),
});

app.put('/api/admin/supabase/config', requireAdmin, (req, res) => {
  const parsed = supabaseConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Konfigurasi tidak valid' });
    return;
  }

  const existing = db.prepare('SELECT * FROM supabase_config WHERE id = 1').get() as any;
  const { supabase_url, supabase_anon_key, supabase_service_key, storage_bucket, is_enabled } =
    parsed.data;

  const nextAnon =
    supabase_anon_key && supabase_anon_key.length > 0
      ? supabase_anon_key
      : existing?.supabase_anon_key || '';
  const nextService =
    supabase_service_key && supabase_service_key.length > 0
      ? supabase_service_key
      : existing?.supabase_service_key || '';

  db.prepare(`
    UPDATE supabase_config
    SET supabase_url = ?, supabase_anon_key = ?, supabase_service_key = ?,
        storage_bucket = ?, is_enabled = ?, updated_at = ?
    WHERE id = 1
  `).run(
    supabase_url.replace(/\/+$/, ''),
    nextAnon,
    nextService,
    storage_bucket,
    is_enabled ? 1 : 0,
    new Date().toISOString()
  );

  res.json({ config: getSanitizedSupabaseConfig() });
});

app.post('/api/admin/supabase/test', requireAdmin, async (req, res) => {
  const body = req.body || {};
  const result = await testSupabaseConnection({
    supabase_url: typeof body.supabase_url === 'string' ? body.supabase_url : undefined,
    supabase_anon_key:
      typeof body.supabase_anon_key === 'string' ? body.supabase_anon_key : undefined,
    supabase_service_key:
      typeof body.supabase_service_key === 'string' ? body.supabase_service_key : undefined,
    storage_bucket: typeof body.storage_bucket === 'string' ? body.storage_bucket : undefined,
  });
  res.json({ ...result, config: getSanitizedSupabaseConfig() });
});

app.post('/api/admin/supabase/sync-push', requireAdmin, async (_req, res) => {
  try {
    const result = await pushLocalDataToSupabase();
    res.json({ ...result, config: getSanitizedSupabaseConfig() });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Gagal mengirim data ke Supabase.' });
  }
});

app.post('/api/admin/supabase/sync-pull', requireAdmin, async (_req, res) => {
  try {
    const result = await pullMasterDataFromSupabase();
    res.json({ ...result, config: getSanitizedSupabaseConfig() });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Gagal menarik data dari Supabase.' });
  }
});

// ============================================================================
// VITE DEV MIDDLEWARE / PRODUCTION STATIC HOSTING
// ============================================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CBT Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
