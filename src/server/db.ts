import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type {
  ExamResult,
  ExamStatus,
  OptionKey,
  SessionStatus,
} from '../types/cbt.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const UPLOAD_DIRECTORY = UPLOADS_DIR;

const db = new Database(path.join(DATA_DIR, 'cbt.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS institution_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_name TEXT NOT NULL,
      logo_url TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      exam_event_name TEXT NOT NULL,
      default_kkm REAL NOT NULL DEFAULT 75,
      proctor_pin TEXT NOT NULL DEFAULT '202601',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      exam_token TEXT NOT NULL DEFAULT '',
      duration_minutes INTEGER NOT NULL,
      kkm REAL NOT NULL DEFAULT 75,
      status TEXT NOT NULL DEFAULT 'Draft',
      is_active INTEGER NOT NULL DEFAULT 0,
      randomize_questions INTEGER NOT NULL DEFAULT 1,
      show_result_to_student INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_number TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      class_name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
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
      correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A','B','C','D','E')),
      score_weight REAL NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS exam_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      question_order TEXT NOT NULL DEFAULT '[]',
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','flagged_cheating')),
      violations_count INTEGER NOT NULL DEFAULT 0,
      violation_logs TEXT NOT NULL DEFAULT '[]',
      last_synced_at TEXT NOT NULL,
      UNIQUE(exam_id, participant_id)
    );

    CREATE TABLE IF NOT EXISTS student_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      selected_option TEXT CHECK (selected_option IN ('A','B','C','D','E') OR selected_option IS NULL),
      is_doubtful INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      UNIQUE(session_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS exam_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      session_id INTEGER NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
      total_correct INTEGER NOT NULL DEFAULT 0,
      total_wrong INTEGER NOT NULL DEFAULT 0,
      total_empty INTEGER NOT NULL DEFAULT 0,
      final_score REAL NOT NULL DEFAULT 0,
      passing_status TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      UNIQUE(exam_id, participant_id)
    );

    CREATE TABLE IF NOT EXISTS supabase_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      supabase_url TEXT NOT NULL DEFAULT '',
      supabase_anon_key TEXT NOT NULL DEFAULT '',
      supabase_service_key TEXT NOT NULL DEFAULT '',
      storage_bucket TEXT NOT NULL DEFAULT 'cbt-assets',
      is_enabled INTEGER NOT NULL DEFAULT 0,
      last_tested_at TEXT,
      last_status TEXT NOT NULL DEFAULT 'unconfigured',
      last_message TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_participants_exam_number ON participants(exam_number);
    CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id, question_number);
    CREATE INDEX IF NOT EXISTS idx_sessions_exam_status ON exam_sessions(exam_id, status);
    CREATE INDEX IF NOT EXISTS idx_answers_session_id ON student_answers(session_id);
    CREATE INDEX IF NOT EXISTS idx_results_exam_participant ON exam_results(exam_id, participant_id);
  `);

  db.prepare(
    `INSERT OR IGNORE INTO supabase_config (id, storage_bucket, last_status) VALUES (1, 'cbt-assets', 'unconfigured')`
  ).run();

  const settingsCount = db.prepare('SELECT COUNT(*) AS count FROM institution_settings').get() as { count: number };
  if (settingsCount.count === 0) {
    seedInitialData();
  } else {
    db.prepare(
      "UPDATE institution_settings SET school_name = 'Sekolah Rakyat Terintegrasi 5 Ponorogo' WHERE school_name = 'MAN 1 Nusantara Cendekia'"
    ).run();
    db.prepare(
      "UPDATE institution_settings SET logo_url = '/src/assets/images/regenerated_image_1794889064827.png' WHERE logo_url = '/src/assets/images/school_emblem_1794888013524.jpg'"
    ).run();
    db.prepare(
      "UPDATE participants SET exam_number = '2026-SMAIPA-001', full_name = 'Agung Prasetya', class_name = 'SMA IPA' WHERE exam_number = '2026-XII-001'"
    ).run();
    db.prepare(
      "UPDATE exams SET exam_token = 'MTKIPA2026' WHERE exam_token = 'MTK2026'"
    ).run();
    db.prepare(
      "UPDATE participants SET exam_number = '2026-SMPA-002', full_name = 'Prasetya Agung', class_name = 'SMP A' WHERE exam_number = '2026-XII-005'"
    ).run();
    db.prepare(
      "UPDATE exams SET exam_token = 'BIND2026' WHERE exam_token = 'FIS2026'"
    ).run();
  }
}

function seedInitialData() {
  const seedTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO institution_settings (
        school_name, logo_url, academic_year, exam_event_name, default_kkm, proctor_pin
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'Sekolah Rakyat Terintegrasi 5 Ponorogo',
      '/src/assets/images/regenerated_image_1794889064827.png',
      '2026/2027',
      'Asesmen Sumatif Akhir Semester (ASAS) 2026',
      75,
      '202601'
    );

    // Exams
    const insertExam = db.prepare(`
      INSERT INTO exams (
        title, subject_name, exam_token, duration_minutes, kkm, status, is_active, randomize_questions, show_result_to_student
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const exam1 = insertExam.run(
      'ASAS Matematika Peminatan Kelas XII',
      'Matematika Peminatan',
      'MTKIPA2026',
      90,
      75,
      'Aktif',
      1,
      1,
      1
    );
    const exam2 = insertExam.run(
      'ASAS Fisika & Kimia Terpadu Kelas XII',
      'Fisika & Kimia',
      'BIND2026',
      60,
      75,
      'Aktif',
      1,
      0,
      1
    );
    const exam3 = insertExam.run(
      'Try Out Literasi Bahasa Indonesia',
      'Bahasa Indonesia',
      'BIN2026',
      60,
      75,
      'Draft',
      0,
      1,
      1
    );

    const exam1Id = Number(exam1.lastInsertRowid);
    const exam2Id = Number(exam2.lastInsertRowid);
    const exam3Id = Number(exam3.lastInsertRowid);

    // Questions
    const insertQuestion = db.prepare(`
      INSERT INTO questions (
        exam_id, question_number, question_text, image_url,
        option_a, option_b, option_c, option_d, option_e,
        correct_answer, score_weight
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Matematika Peminatan (6 soal dengan KaTeX & gambar parabola)
    insertQuestion.run(
      exam1Id,
      1,
      'Perhatikan grafik fungsi kuadrat $f(x) = x^2 - 2x - 3$ pada gambar di bawah ini. Jika daerah di bawah sumbu-$x$ yang dibatasi oleh kurva dan sumbu-$x$ diputar atau dihitung luasnya menggunakan integral tentu $\\int_{-1}^{3} -(x^2 - 2x - 3)\\,dx$, maka luas daerah tertutup tersebut adalah $\\dots$',
      '/src/assets/images/question_geometry_parabola_1794888014248.jpg',
      '$\\frac{16}{3}$ satuan luas',
      '$\\frac{32}{3}$ satuan luas',
      '$\\frac{28}{3}$ satuan luas',
      '$12$ satuan luas',
      '$\\frac{34}{3}$ satuan luas',
      'B',
      20
    );

    insertQuestion.run(
      exam1Id,
      2,
      'Nilai dari limit fungsi aljabar tak tentu berikut:\n$$\\lim_{x \\to 2} \\frac{x^2 - 4}{\\sqrt{x + 2} - 2}$$\nadalah $\\dots$',
      null,
      '$4$',
      '$8$',
      '$12$',
      '$16$',
      '$20$',
      'D',
      15
    );

    insertQuestion.run(
      exam1Id,
      3,
      'Diketahui turunan pertama dari fungsi trigonometri $f(x) = \\sin^2(3x - \\frac{\\pi}{4})$ adalah $f\'(x)$. Nilai dari $f\'(\\frac{\\pi}{4})$ adalah $\\dots$',
      null,
      '$-3$',
      '$-\\frac{3}{2}$',
      '$0$',
      '$\\frac{3}{2}$',
      '$3$',
      'E',
      15
    );

    insertQuestion.run(
      exam1Id,
      4,
      'Jika matriks $A = \\begin{pmatrix} 2 & -1 \\\\ 3 & 4 \\end{pmatrix}$ dan $B = \\begin{pmatrix} 1 & 5 \\\\ -2 & 2 \\end{pmatrix}$, maka determinan dari matriks $C = A \\cdot B$ adalah $\\dots$',
      null,
      '$112$',
      '$120$',
      '$132$',
      '$144$',
      '$156$',
      'C',
      15
    );

    insertQuestion.run(
      exam1Id,
      5,
      'Sebuah populasi bakteri tumbuh mengikuti persamaan eksponensial $P(t) = 500 \\cdot e^{0{,}2t}$ dengan $t$ dalam jam. Apabila $\\ln 2 \\approx 0{,}693$, waktu yang dibutuhkan agar populasi menjadi $2.000$ bakteri adalah $\\dots$',
      null,
      '$3{,}465$ jam',
      '$5{,}120$ jam',
      '$6{,}930$ jam',
      '$8{,}250$ jam',
      '$10{,}395$ jam',
      'C',
      20
    );

    insertQuestion.run(
      exam1Id,
      6,
      'Dalam sebuah kotak terdapat $6$ bola merah dan $4$ bola biru. Jika diambil $3$ bola sekaligus secara acak, peluang terambilnya paling sedikit $2$ bola merah adalah $\\dots$',
      null,
      '$\\frac{1}{3}$',
      '$\\frac{1}{2}$',
      '$\\frac{2}{3}$',
      '$\\frac{3}{4}$',
      '$\\frac{5}{6}$',
      'C',
      15
    );

    // Fisika & Kimia Terpadu (5 soal dengan rangkaian listrik & rumus kesetimbangan)
    insertQuestion.run(
      exam2Id,
      1,
      'Perhatikan skema rangkaian listrik arus searah (DC) berikut. Sumber tegangan bernilai $V = 12\\text{ V}$ dengan hambatan dalam diabaikan. Jika diketahui $R_1 = 6\\,\\Omega$, $R_2 = 3\\,\\Omega$, dan $R_3 = 4\\,\\Omega$, berapakah kuat arus total yang terbaca pada Ammeter $A$?',
      '/src/assets/images/question_physics_circuit_1794888014087.jpg',
      '$1{,}5\\text{ A}$',
      '$2{,}0\\text{ A}$',
      '$2{,}4\\text{ A}$',
      '$3{,}0\\text{ A}$',
      '$4{,}0\\text{ A}$',
      'B',
      20
    );

    insertQuestion.run(
      exam2Id,
      2,
      'Pada reaksi kesetimbangan kimia gas amonia (proses Haber-Bosch):\n$$\\text{N}_2(g) + 3\\text{H}_2(g) \\rightleftharpoons 2\\text{NH}_3(g) \\quad \\Delta H = -92\\text{ kJ}$$\nAgar hasil gas $\\text{NH}_3$ bertambah secara optimal berdasarkan asas Le Chatelier, perlakuan yang tepat adalah $\\dots$',
      null,
      'Menurunkan tekanan dan menaikkan suhu',
      'Memperbesar volume wadah dan menambah katalis',
      'Menaikkan tekanan dan menurunkan suhu',
      'Mengurangi konsentrasi gas $\\text{N}_2$ dan menaikkan suhu',
      'Menambah gas mulia pada volume tetap',
      'C',
      20
    );

    insertQuestion.run(
      exam2Id,
      3,
      'Sebanyak $100\\text{ mL}$ larutan asam lemah $\\text{CH}_3\\text{COOH}$ $0{,}1\\text{ M}$ ($K_a = 10^{-5}$) memiliki nilai $\\text{pH}$ sebesar $\\dots$',
      null,
      '$1$',
      '$2$',
      '$3$',
      '$4$',
      '$5$',
      'C',
      20
    );

    insertQuestion.run(
      exam2Id,
      4,
      'Dua buah muatan titik $q_1 = +4\\,\\mu\\text{C}$ dan $q_2 = -9\\,\\mu\\text{C}$ terpisah pada jarak $r = 30\\text{ cm}$ di udara ($k = 9 \\times 10^9\\text{ N}\\cdot\\text{m}^2/\\text{C}^2$). Besar gaya elektrostatis Coulomb yang bekerja di antara kedua muatan tersebut adalah $\\dots$',
      null,
      '$1{,}8\\text{ N}$',
      '$2{,}4\\text{ N}$',
      '$3{,}6\\text{ N}$',
      '$4{,}5\\text{ N}$',
      '$5{,}4\\text{ N}$',
      'C',
      20
    );

    insertQuestion.run(
      exam2Id,
      5,
      'Efek fotolistrik terjadi ketika cahaya berfrekuensi $f = 8 \\times 10^{14}\\text{ Hz}$ menyinari logam dengan fungsi kerja $W_0 = 2{,}2\\text{ eV}$. Jika konstanta Planck $h = 6{,}63 \\times 10^{-34}\\text{ J}\\cdot\\text{s}$ dan $1\\text{ eV} = 1{,}6 \\times 10^{-19}\\text{ J}$, energi kinetik maksimum elektron yang terlepas adalah sekitar $\\dots$',
      null,
      '$0{,}52\\text{ eV}$',
      '$1{,}12\\text{ eV}$',
      '$1{,}85\\text{ eV}$',
      '$2{,}31\\text{ eV}$',
      '$3{,}32\\text{ eV}$',
      'B',
      20
    );

    // Bahasa Indonesia (Draft)
    insertQuestion.run(
      exam3Id,
      1,
      'Bacalah penggalan paragraf berikut:\n"Transformasi digital di lingkungan madrasah dan sekolah tidak hanya menuntut ketersediaan perangkat keras, melainkan juga kesiapan literasi etika digital bagi seluruh sivitas akademika."\nMakna istilah *sivitas akademika* pada kalimat tersebut adalah $\\dots$',
      null,
      'Seluruh tenaga teknisi laboratorium komputer',
      'Masyarakat akademik yang terdiri atas pendidik dan peserta didik',
      'Komite orang tua dan pengawas yayasan sekolah',
      'Pengembang perangkat lunak pendidikan nasional',
      'Alumni berprestasi yang aktif membina sekolah',
      'B',
      50
    );

    insertQuestion.run(
      exam3Id,
      2,
      'Manakah di antara kalimat berikut yang menggunakan tanda baca dan ejaan PUEBI/EYD V secara tepat?',
      null,
      'Para peserta ujian diharap membawa: kartu peserta, alat tulis dan penggaris.',
      'Oleh karena itu, ketelitian dalam membaca soal sangat diperlukan oleh peserta.',
      'Meskipun hujan turun deras, namun siswa tetap datang tepat waktu.',
      'Hasil ujian tersebut di umumkan pada hari Senin tanggal 14 Desember 2026.',
      'Semua siswa kelas XII-IPA mengikuti praktikum di Laboratorium Fisika.',
      'B',
      50
    );

    // Participants (12 siswa)
    const insertParticipant = db.prepare(`
      INSERT INTO participants (exam_number, full_name, class_name, is_active)
      VALUES (?, ?, ?, ?)
    `);

    const seededParticipants = [
      ['2026-SMAIPA-001', 'Agung Prasetya', 'SMA IPA', 1],
      ['2026-XII-002', 'Siti Aisyah Nurhaliza', 'XII IPA 1', 1],
      ['2026-XII-003', 'Muhammad Rizky Pratama', 'XII IPA 1', 1],
      ['2026-XII-004', 'Nabila Putri Azzahra', 'XII IPA 1', 1],
      ['2026-SMPA-002', 'Prasetya Agung', 'SMP A', 1],
      ['2026-XII-006', 'Fatimah Az-Zahra', 'XII IPA 2', 1],
      ['2026-XII-007', 'Fajar Nugroho Wijaya', 'XII IPA 2', 1],
      ['2026-XII-008', 'Zahra Khairunnisa', 'XII IPA 2', 1],
      ['2026-XII-009', 'Bagas Dwi Kurniawan', 'XII IPA 3', 1],
      ['2026-XII-010', 'Aulia Rahmawati', 'XII IPA 3', 1],
      ['2026-XII-011', 'Hendra Kusuma Putra', 'XII IPA 3', 1],
      ['2026-XII-012', 'Rania Salsabila', 'XII IPA 3', 1],
    ] as const;

    const participantIds: number[] = [];
    for (const p of seededParticipants) {
      const res = insertParticipant.run(p[0], p[1], p[2], p[3]);
      participantIds.push(Number(res.lastInsertRowid));
    }

    // Seed 3 historical/live sessions on Exam 1 (participants 2, 3, 4) so Dashboard & Monitoring are alive,
    // leaving 2026-XII-001 (Ahmad Fauzi Ramadhan) fresh & ready for student testing!
    const now = new Date();
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60_000).toISOString();
    const tenMinsAgo = new Date(now.getTime() - 10 * 60_000).toISOString();
    const sixtyMinsLater = new Date(now.getTime() + 60 * 60_000).toISOString();

    const qIds = db
      .prepare('SELECT id FROM questions WHERE exam_id = ? ORDER BY question_number ASC')
      .all(exam1Id) as { id: number }[];
    const orderJson = JSON.stringify(qIds.map((q) => q.id));

    // Participant 2: completed with score 85
    const s2 = db
      .prepare(`
        INSERT INTO exam_sessions (
          exam_id, participant_id, question_order, start_time, end_time, status, violations_count, violation_logs, last_synced_at
        ) VALUES (?, ?, ?, ?, ?, 'completed', 0, '[]', ?)
      `)
      .run(exam1Id, participantIds[1], orderJson, thirtyMinsAgo, sixtyMinsLater, tenMinsAgo);

    const s2Id = Number(s2.lastInsertRowid);
    const ans2: Array<[number, OptionKey]> = [
      [qIds[0].id, 'B'],
      [qIds[1].id, 'D'],
      [qIds[2].id, 'E'],
      [qIds[3].id, 'C'],
      [qIds[4].id, 'C'],
      [qIds[5].id, 'A'],
    ];
    for (const [qid, opt] of ans2) {
      db.prepare(`
        INSERT INTO student_answers (session_id, question_id, selected_option, is_doubtful, updated_at)
        VALUES (?, ?, ?, 0, ?)
      `).run(s2Id, qid, opt, tenMinsAgo);
    }
    gradeExamSession(s2Id, 'completed');

    // Participant 3: in_progress with 1 warning
    const s3 = db
      .prepare(`
        INSERT INTO exam_sessions (
          exam_id, participant_id, question_order, start_time, end_time, status, violations_count, violation_logs, last_synced_at
        ) VALUES (?, ?, ?, ?, ?, 'in_progress', 1, ?, ?)
      `)
      .run(
        exam1Id,
        participantIds[2],
        orderJson,
        thirtyMinsAgo,
        sixtyMinsLater,
        JSON.stringify([
          {
            timestamp: tenMinsAgo,
            reason: 'Berpindah tab/aplikasi lain',
            duration_seconds: 6,
          },
        ]),
        now.toISOString()
      );
    const s3Id = Number(s3.lastInsertRowid);
    db.prepare(`
      INSERT INTO student_answers (session_id, question_id, selected_option, is_doubtful, updated_at)
      VALUES (?, ?, 'B', 0, ?), (?, ?, 'D', 1, ?)
    `).run(s3Id, qIds[0].id, now.toISOString(), s3Id, qIds[1].id, now.toISOString());

    // Participant 4: flagged_cheating (3 violations)
    const s4 = db
      .prepare(`
        INSERT INTO exam_sessions (
          exam_id, participant_id, question_order, start_time, end_time, status, violations_count, violation_logs, last_synced_at
        ) VALUES (?, ?, ?, ?, ?, 'flagged_cheating', 3, ?, ?)
      `)
      .run(
        exam1Id,
        participantIds[3],
        orderJson,
        thirtyMinsAgo,
        sixtyMinsLater,
        JSON.stringify([
          { timestamp: thirtyMinsAgo, reason: 'Berpindah tab/jendela', duration_seconds: 7 },
          { timestamp: tenMinsAgo, reason: 'Keluar dari mode Layar Penuh', duration_seconds: 6 },
          { timestamp: now.toISOString(), reason: 'Berpindah tab/jendela (Batas Maksimal)', duration_seconds: 8 },
        ]),
        now.toISOString()
      );
    const s4Id = Number(s4.lastInsertRowid);
    db.prepare(`
      INSERT INTO student_answers (session_id, question_id, selected_option, is_doubtful, updated_at)
      VALUES (?, ?, 'B', 0, ?), (?, ?, 'A', 0, ?)
    `).run(s4Id, qIds[0].id, now.toISOString(), s4Id, qIds[1].id, now.toISOString());
    gradeExamSession(s4Id, 'flagged_cheating');
  });

  seedTx();
}

export function gradeExamSession(
  sessionId: number,
  targetStatus: SessionStatus = 'completed'
): ExamResult {
  const session = db
    .prepare('SELECT * FROM exam_sessions WHERE id = ?')
    .get(sessionId) as
    | {
        id: number;
        exam_id: number;
        participant_id: number;
        status: SessionStatus;
      }
    | undefined;

  if (!session) {
    throw new Error('Sesi ujian tidak ditemukan');
  }

  const exam = db
    .prepare('SELECT id, kkm FROM exams WHERE id = ?')
    .get(session.exam_id) as { id: number; kkm: number };

  const questions = db
    .prepare('SELECT id, correct_answer, score_weight FROM questions WHERE exam_id = ?')
    .all(session.exam_id) as Array<{
    id: number;
    correct_answer: OptionKey;
    score_weight: number;
  }>;

  const answers = db
    .prepare('SELECT question_id, selected_option FROM student_answers WHERE session_id = ?')
    .all(sessionId) as Array<{
    question_id: number;
    selected_option: OptionKey | null;
  }>;

  const answerMap = new Map<number, OptionKey | null>();
  for (const ans of answers) {
    answerMap.set(ans.question_id, ans.selected_option);
  }

  let totalCorrect = 0;
  let totalWrong = 0;
  let totalEmpty = 0;
  let earnedWeight = 0;
  let maxWeight = 0;

  for (const q of questions) {
    const weight = Number(q.score_weight) > 0 ? Number(q.score_weight) : 1;
    maxWeight += weight;
    const picked = answerMap.get(q.id) ?? null;
    if (!picked) {
      totalEmpty += 1;
    } else if (picked === q.correct_answer) {
      totalCorrect += 1;
      earnedWeight += weight;
    } else {
      totalWrong += 1;
    }
  }

  const finalScore =
    maxWeight > 0 ? Math.round((earnedWeight / maxWeight) * 10000) / 100 : 0;
  const passingStatus = finalScore >= exam.kkm ? 'LULUS' : 'BELUM LULUS';
  const completedAt = new Date().toISOString();

  const finalSessionStatus: SessionStatus =
    session.status === 'flagged_cheating' ? 'flagged_cheating' : targetStatus;

  const gradeTx = db.transaction(() => {
    db.prepare(
      `UPDATE exam_sessions SET status = ?, last_synced_at = ? WHERE id = ?`
    ).run(finalSessionStatus, completedAt, sessionId);

    db.prepare(`
      INSERT INTO exam_results (
        exam_id, participant_id, session_id, total_correct, total_wrong, total_empty, final_score, passing_status, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(exam_id, participant_id) DO UPDATE SET
        session_id = excluded.session_id,
        total_correct = excluded.total_correct,
        total_wrong = excluded.total_wrong,
        total_empty = excluded.total_empty,
        final_score = excluded.final_score,
        passing_status = excluded.passing_status,
        completed_at = excluded.completed_at
    `).run(
      session.exam_id,
      session.participant_id,
      sessionId,
      totalCorrect,
      totalWrong,
      totalEmpty,
      finalScore,
      passingStatus,
      completedAt
    );
  });

  gradeTx();

  return db
    .prepare('SELECT * FROM exam_results WHERE exam_id = ? AND participant_id = ?')
    .get(session.exam_id, session.participant_id) as ExamResult;
}

export { db };
export type { ExamStatus };
