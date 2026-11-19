import { db } from './db.ts';

export interface SupabaseStoredConfig {
  id: number;
  supabase_url: string;
  supabase_anon_key: string;
  supabase_service_key: string;
  storage_bucket: string;
  is_enabled: number;
  last_tested_at: string | null;
  last_status: string;
  last_message: string;
  updated_at: string;
}

export interface EffectiveSupabaseConfig {
  supabase_url: string;
  supabase_anon_key: string;
  supabase_service_key: string;
  storage_bucket: string;
  is_enabled: boolean;
  source: 'env' | 'admin_db' | 'mixed' | 'unconfigured';
  last_tested_at: string | null;
  last_status: string;
  last_message: string;
}

export const CBT_TABLES = [
  'institution_settings',
  'exams',
  'participants',
  'questions',
  'exam_sessions',
  'student_answers',
  'exam_results',
] as const;

export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 10) return '••••••••';
  return `${value.slice(0, 6)}••••••••${value.slice(-4)}`;
}

export function getEffectiveSupabaseConfig(): EffectiveSupabaseConfig {
  const row = db.prepare('SELECT * FROM supabase_config WHERE id = 1').get() as
    | SupabaseStoredConfig
    | undefined;

  const envUrl = (process.env.SUPABASE_URL || '').trim();
  const envAnon = (process.env.SUPABASE_ANON_KEY || '').trim();
  const envService = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const envBucket = (process.env.SUPABASE_STORAGE_BUCKET || '').trim();

  const dbUrl = (row?.supabase_url || '').trim();
  const dbAnon = (row?.supabase_anon_key || '').trim();
  const dbService = (row?.supabase_service_key || '').trim();
  const dbBucket = (row?.storage_bucket || 'cbt-assets').trim();

  const supabase_url = (dbUrl || envUrl).replace(/\/+$/, '');
  const supabase_anon_key = dbAnon || envAnon;
  const supabase_service_key = dbService || envService;
  const storage_bucket = dbBucket || envBucket || 'cbt-assets';

  const hasEnv = Boolean(envUrl && (envService || envAnon));
  const hasDb = Boolean(dbUrl && (dbService || dbAnon));

  let source: EffectiveSupabaseConfig['source'] = 'unconfigured';
  if (hasDb && hasEnv) source = 'mixed';
  else if (hasDb) source = 'admin_db';
  else if (hasEnv) source = 'env';

  return {
    supabase_url,
    supabase_anon_key,
    supabase_service_key,
    storage_bucket,
    is_enabled: Boolean(row?.is_enabled) || Boolean(envUrl && envService),
    source,
    last_tested_at: row?.last_tested_at || null,
    last_status: row?.last_status || 'unconfigured',
    last_message: row?.last_message || '',
  };
}

export function getSanitizedSupabaseConfig() {
  const cfg = getEffectiveSupabaseConfig();
  return {
    supabase_url: cfg.supabase_url,
    storage_bucket: cfg.storage_bucket,
    is_enabled: cfg.is_enabled,
    source: cfg.source,
    has_anon_key: Boolean(cfg.supabase_anon_key),
    has_service_key: Boolean(cfg.supabase_service_key),
    anon_key_preview: maskSecret(cfg.supabase_anon_key),
    service_key_preview: maskSecret(cfg.supabase_service_key),
    last_tested_at: cfg.last_tested_at,
    last_status: cfg.last_status,
    last_message: cfg.last_message,
  };
}

export async function testSupabaseConnection(override?: {
  supabase_url?: string;
  supabase_anon_key?: string;
  supabase_service_key?: string;
  storage_bucket?: string;
}) {
  const saved = getEffectiveSupabaseConfig();
  const supabaseUrl = (override?.supabase_url?.trim() || saved.supabase_url).replace(/\/+$/, '');
  const serviceKey = override?.supabase_service_key?.trim() || saved.supabase_service_key;
  const anonKey = override?.supabase_anon_key?.trim() || saved.supabase_anon_key;
  const bucket = override?.storage_bucket?.trim() || saved.storage_bucket || 'cbt-assets';
  const apiKey = serviceKey || anonKey;

  if (!supabaseUrl || !apiKey) {
    return {
      ok: false,
      latency_ms: 0,
      message: 'URL Supabase dan Service Role Key / Anon Key wajib diisi terlebih dahulu.',
      tables: CBT_TABLES.map((name) => ({ name, ready: false, detail: 'Belum diuji' })),
      storage_ready: false,
      storage_detail: 'Belum diuji',
    };
  }

  const startedAt = Date.now();
  const headers = {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    const tableResults = await Promise.all(
      CBT_TABLES.map(async (tableName) => {
        try {
          const res = await fetch(`${supabaseUrl}/rest/v1/${tableName}?select=id&limit=1`, {
            method: 'GET',
            headers,
          });
          if (res.ok) {
            return { name: tableName, ready: true, detail: 'Siap' };
          }
          const errJson = await res.json().catch(() => ({}));
          return {
            name: tableName,
            ready: false,
            detail: errJson?.message || `HTTP ${res.status}`,
          };
        } catch (err: any) {
          return {
            name: tableName,
            ready: false,
            detail: err?.message || 'Gagal menghubungi endpoint',
          };
        }
      })
    );

    let storageReady = false;
    let storageDetail = '';
    try {
      const sRes = await fetch(`${supabaseUrl}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
        method: 'GET',
        headers,
      });
      if (sRes.ok) {
        storageReady = true;
        storageDetail = `Bucket "${bucket}" aktif`;
      } else {
        const errJson = await sRes.json().catch(() => ({}));
        storageDetail = errJson?.message || `HTTP ${sRes.status}`;
      }
    } catch (err: any) {
      storageDetail = err?.message || 'Gagal memeriksa bucket';
    }

    const latencyMs = Date.now() - startedAt;
    const allTablesReady = tableResults.every((t) => t.ready);
    const ok = allTablesReady;

    const message = ok
      ? storageReady
        ? `Terhubung ke Supabase (${latencyMs}ms). Seluruh 7 tabel CBT & bucket "${bucket}" siap digunakan.`
        : `Terhubung ke 7 tabel PostgreSQL (${latencyMs}ms), namun bucket "${bucket}" belum ditemukan.`
      : `Koneksi mencapai server Supabase (${latencyMs}ms), tetapi ${
          tableResults.filter((t) => !t.ready).length
        } tabel belum tersedia. Jalankan skrip SQL DDL di Supabase SQL Editor.`;

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE supabase_config SET last_tested_at = ?, last_status = ?, last_message = ? WHERE id = 1`
    ).run(now, ok ? 'connected' : 'error', message);

    return {
      ok,
      latency_ms: latencyMs,
      message,
      tables: tableResults,
      storage_ready: storageReady,
      storage_detail: storageDetail,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startedAt;
    const message = `Gagal terhubung ke Supabase: ${err?.message || 'Kesalahan jaringan'}`;
    db.prepare(
      `UPDATE supabase_config SET last_tested_at = ?, last_status = 'error', last_message = ? WHERE id = 1`
    ).run(new Date().toISOString(), message);

    return {
      ok: false,
      latency_ms: latencyMs,
      message,
      tables: CBT_TABLES.map((name) => ({ name, ready: false, detail: 'Timeout / Gagal' })),
      storage_ready: false,
      storage_detail: 'Tidak terjangkau',
    };
  }
}

async function upsertSupabaseTable(
  supabaseUrl: string,
  serviceKey: string,
  tableName: string,
  onConflict: string,
  rows: any[]
): Promise<{ table: string; count: number }> {
  if (rows.length === 0) return { table: tableName, count: 0 };

  const res = await fetch(
    `${supabaseUrl}/rest/v1/${tableName}?on_conflict=${encodeURIComponent(onConflict)}`,
    {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Tabel ${tableName}: ${errText || `HTTP ${res.status}`}`);
  }

  return { table: tableName, count: rows.length };
}

export async function pushLocalDataToSupabase() {
  const cfg = getEffectiveSupabaseConfig();
  if (!cfg.supabase_url || !cfg.supabase_service_key) {
    throw new Error(
      'URL Supabase dan Service Role Key wajib dikonfigurasi untuk melakukan Push sinkronisasi tabel.'
    );
  }

  const institutionRows = db.prepare('SELECT * FROM institution_settings').all();
  const examRows = db
    .prepare('SELECT * FROM exams')
    .all()
    .map((e: any) => ({
      ...e,
      is_active: Boolean(e.is_active),
      randomize_questions: Boolean(e.randomize_questions),
      show_result_to_student: Boolean(e.show_result_to_student),
    }));
  const participantRows = db
    .prepare('SELECT * FROM participants')
    .all()
    .map((p: any) => ({
      ...p,
      is_active: Boolean(p.is_active),
    }));
  const questionRows = db.prepare('SELECT * FROM questions').all();
  const sessionRows = db
    .prepare('SELECT * FROM exam_sessions')
    .all()
    .map((s: any) => ({
      ...s,
      question_order: JSON.parse(s.question_order || '[]'),
      violation_logs: JSON.parse(s.violation_logs || '[]'),
    }));
  const answerRows = db
    .prepare('SELECT * FROM student_answers')
    .all()
    .map((a: any) => ({
      ...a,
      is_doubtful: Boolean(a.is_doubtful),
    }));
  const resultRows = db.prepare('SELECT * FROM exam_results').all();

  const summary = [
    await upsertSupabaseTable(
      cfg.supabase_url,
      cfg.supabase_service_key,
      'institution_settings',
      'id',
      institutionRows
    ),
    await upsertSupabaseTable(cfg.supabase_url, cfg.supabase_service_key, 'exams', 'id', examRows),
    await upsertSupabaseTable(
      cfg.supabase_url,
      cfg.supabase_service_key,
      'participants',
      'exam_number',
      participantRows
    ),
    await upsertSupabaseTable(
      cfg.supabase_url,
      cfg.supabase_service_key,
      'questions',
      'id',
      questionRows
    ),
    await upsertSupabaseTable(
      cfg.supabase_url,
      cfg.supabase_service_key,
      'exam_sessions',
      'exam_id,participant_id',
      sessionRows
    ),
    await upsertSupabaseTable(
      cfg.supabase_url,
      cfg.supabase_service_key,
      'student_answers',
      'session_id,question_id',
      answerRows
    ),
    await upsertSupabaseTable(
      cfg.supabase_url,
      cfg.supabase_service_key,
      'exam_results',
      'exam_id,participant_id',
      resultRows
    ),
  ];

  const totalRows = summary.reduce((acc, s) => acc + s.count, 0);
  db.prepare(
    `UPDATE supabase_config SET last_tested_at = ?, last_status = 'connected', last_message = ? WHERE id = 1`
  ).run(
    new Date().toISOString(),
    `Sinkronisasi Push berhasil (${totalRows} baris dikirim ke Supabase).`
  );

  return { ok: true, summary, total_rows: totalRows };
}

export async function pullMasterDataFromSupabase() {
  const cfg = getEffectiveSupabaseConfig();
  if (!cfg.supabase_url || !cfg.supabase_service_key) {
    throw new Error(
      'URL Supabase dan Service Role Key wajib dikonfigurasi untuk menarik data dari Supabase.'
    );
  }

  const headers = {
    apikey: cfg.supabase_service_key,
    Authorization: `Bearer ${cfg.supabase_service_key}`,
  };

  const fetchTable = async (name: string) => {
    const res = await fetch(`${cfg.supabase_url}/rest/v1/${name}?select=*`, { headers });
    if (!res.ok) {
      throw new Error(`Gagal menarik tabel ${name}: HTTP ${res.status}`);
    }
    return (await res.json()) as any[];
  };

  const [institutions, exams, participants, questions] = await Promise.all([
    fetchTable('institution_settings'),
    fetchTable('exams'),
    fetchTable('participants'),
    fetchTable('questions'),
  ]);

  const tx = db.transaction(() => {
    if (institutions.length > 0) {
      const inst = institutions[0];
      db.prepare(`
        UPDATE institution_settings
        SET school_name = ?, logo_url = ?, academic_year = ?, exam_event_name = ?, default_kkm = ?, proctor_pin = ?, updated_at = ?
        WHERE id = (SELECT id FROM institution_settings LIMIT 1)
      `).run(
        inst.school_name,
        inst.logo_url || '',
        inst.academic_year,
        inst.exam_event_name,
        Number(inst.default_kkm ?? 75),
        inst.proctor_pin || '202601',
        new Date().toISOString()
      );
    }

    for (const ex of exams) {
      db.prepare(`
        INSERT INTO exams (id, title, subject_name, exam_token, duration_minutes, kkm, status, is_active, randomize_questions, show_result_to_student, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          subject_name = excluded.subject_name,
          exam_token = excluded.exam_token,
          duration_minutes = excluded.duration_minutes,
          kkm = excluded.kkm,
          status = excluded.status,
          is_active = excluded.is_active,
          randomize_questions = excluded.randomize_questions,
          show_result_to_student = excluded.show_result_to_student
      `).run(
        ex.id,
        ex.title,
        ex.subject_name,
        ex.exam_token || '',
        ex.duration_minutes,
        ex.kkm,
        ex.status || (ex.is_active ? 'Aktif' : 'Draft'),
        ex.is_active ? 1 : 0,
        ex.randomize_questions ? 1 : 0,
        ex.show_result_to_student ? 1 : 0,
        ex.created_at || new Date().toISOString()
      );
    }

    for (const p of participants) {
      db.prepare(`
        INSERT INTO participants (id, exam_number, full_name, class_name, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(exam_number) DO UPDATE SET
          full_name = excluded.full_name,
          class_name = excluded.class_name,
          is_active = excluded.is_active
      `).run(
        p.id,
        p.exam_number,
        p.full_name,
        p.class_name,
        p.is_active ? 1 : 0,
        p.created_at || new Date().toISOString()
      );
    }

    for (const q of questions) {
      db.prepare(`
        INSERT INTO questions (
          id, exam_id, question_number, question_text, image_url,
          option_a, option_b, option_c, option_d, option_e,
          option_a_image, option_b_image, option_c_image, option_d_image, option_e_image,
          correct_answer, score_weight
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          exam_id = excluded.exam_id,
          question_number = excluded.question_number,
          question_text = excluded.question_text,
          image_url = excluded.image_url,
          option_a = excluded.option_a,
          option_b = excluded.option_b,
          option_c = excluded.option_c,
          option_d = excluded.option_d,
          option_e = excluded.option_e,
          option_a_image = excluded.option_a_image,
          option_b_image = excluded.option_b_image,
          option_c_image = excluded.option_c_image,
          option_d_image = excluded.option_d_image,
          option_e_image = excluded.option_e_image,
          correct_answer = excluded.correct_answer,
          score_weight = excluded.score_weight
      `).run(
        q.id,
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
        q.score_weight ?? 1
      );
    }
  });

  tx();

  return {
    ok: true,
    pulled: {
      institution_settings: institutions.length,
      exams: exams.length,
      participants: participants.length,
      questions: questions.length,
    },
  };
}
