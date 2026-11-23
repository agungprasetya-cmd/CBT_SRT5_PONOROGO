import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import mammoth from 'mammoth/mammoth.browser';
import type { OptionKey } from '../types/cbt';
import { normalizeMathText, preprocessDocxMath } from './omml-to-latex';

export interface ParsedWordQuestion {
  temp_id: string;
  question_number: number;
  question_text: string;
  image_data_url: string | null;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  option_a_image_data_url: string | null;
  option_b_image_data_url: string | null;
  option_c_image_data_url: string | null;
  option_d_image_data_url: string | null;
  option_e_image_data_url: string | null;
  correct_answer: OptionKey;
  answer_detected: boolean;
  score_weight: number;
  warnings: string[];
}

export interface WordParseResult {
  questions: ParsedWordQuestion[];
  format_detected: 'table' | 'text' | 'mixed' | 'none';
  raw_messages: string[];
}

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  'n': 'ⁿ',
  'i': 'ⁱ',
};

const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
};

function toMappedScript(text: string, map: Record<string, string>, texPrefix: '^' | '_'): string {
  const clean = text.trim();
  if (!clean) return '';
  if ([...clean].every((ch) => Boolean(map[ch]))) {
    return [...clean].map((ch) => map[ch]).join('');
  }
  return `$${texPrefix}{${clean}}$`;
}

function isSupportedImageDataUrl(src: string | null): src is string {
  if (!src) return false;
  return /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(src);
}

interface ExtractedCell {
  text: string;
  images: string[];
  hasBold: boolean;
}

function extractNodeContent(node: Node): ExtractedCell {
  const images: string[] = [];
  let hasBold = false;

  const walk = (current: Node): string => {
    if (current.nodeType === Node.TEXT_NODE) {
      return current.textContent || '';
    }
    if (current.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = current as HTMLElement;
    const tag = el.tagName.toUpperCase();

    if (tag === 'IMG') {
      const src = el.getAttribute('src');
      if (isSupportedImageDataUrl(src)) {
        images.push(src);
      }
      return '';
    }

    if (tag === 'BR') {
      return '\n';
    }

    if (tag === 'STRONG' || tag === 'B') {
      const inner = Array.from(el.childNodes).map(walk).join('');
      if (inner.trim()) {
        hasBold = true;
      }
      return inner;
    }

    if (tag === 'SUP') {
      const inner = Array.from(el.childNodes).map(walk).join('');
      return toMappedScript(inner, SUPERSCRIPT_MAP, '^');
    }

    if (tag === 'SUB') {
      const inner = Array.from(el.childNodes).map(walk).join('');
      return toMappedScript(inner, SUBSCRIPT_MAP, '_');
    }

    const inner = Array.from(el.childNodes).map(walk).join('');
    if (tag === 'P' || tag === 'DIV' || tag === 'LI' || /^H[1-6]$/.test(tag)) {
      return `${inner}\n`;
    }

    return inner;
  };

  const rawText = walk(node)
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text: rawText, images, hasBold };
}

function normalizeHeader(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeOptionKey(raw: string): OptionKey | null {
  const match = raw.trim().toUpperCase().match(/^([A-E])/);
  return match ? (match[1] as OptionKey) : null;
}

function finalizeQuestion(partial: {
  question_number: number;
  question_text: string;
  image_data_url: string | null;
  options: Record<OptionKey, string>;
  optionImages: Record<OptionKey, string | null>;
  correct_answer: OptionKey | null;
  score_weight: number;
}): ParsedWordQuestion {
  const warnings: string[] = [];
  const answerDetected = partial.correct_answer !== null;
  if (!answerDetected) {
    warnings.push('Kunci jawaban belum terdeteksi (default A — silakan cek).');
  }

  const optA = normalizeMathText(partial.options.A.trim()) || (partial.optionImages.A ? '(Gambar Opsi A)' : '');
  const optB = normalizeMathText(partial.options.B.trim()) || (partial.optionImages.B ? '(Gambar Opsi B)' : '');
  const optC = normalizeMathText(partial.options.C.trim()) || (partial.optionImages.C ? '(Gambar Opsi C)' : '');
  const optD = normalizeMathText(partial.options.D.trim()) || (partial.optionImages.D ? '(Gambar Opsi D)' : '');
  const optE = normalizeMathText(partial.options.E.trim()) || (partial.optionImages.E ? '(Gambar Opsi E)' : '-');

  if (!optA || !optB || !optC || !optD) {
    warnings.push('Sebagian opsi A–D kosong.');
  }
  const normalizedQuestion = normalizeMathText(partial.question_text.trim());
  if (!normalizedQuestion && partial.image_data_url) {
    // Allow image-driven question with fallback text
  } else if (!normalizedQuestion) {
    warnings.push('Teks pertanyaan kosong.');
  }

  return {
    temp_id: `wq_${partial.question_number}_${Math.random().toString(36).slice(2, 8)}`,
    question_number: partial.question_number,
    question_text: normalizedQuestion || 'Perhatikan gambar berikut!',
    image_data_url: partial.image_data_url,
    option_a: optA || '-',
    option_b: optB || '-',
    option_c: optC || '-',
    option_d: optD || '-',
    option_e: optE,
    option_a_image_data_url: partial.optionImages.A,
    option_b_image_data_url: partial.optionImages.B,
    option_c_image_data_url: partial.optionImages.C,
    option_d_image_data_url: partial.optionImages.D,
    option_e_image_data_url: partial.optionImages.E,
    correct_answer: partial.correct_answer || 'A',
    answer_detected: answerDetected,
    score_weight: Number.isFinite(partial.score_weight) && partial.score_weight > 0 ? partial.score_weight : 1,
    warnings,
  };
}

function parseTableElement(table: HTMLTableElement, startNumber: number): ParsedWordQuestion[] {
  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length < 2) return [];

  const headerCells = Array.from(rows[0].querySelectorAll('th, td')).map((cell) =>
    normalizeHeader(cell.textContent || '')
  );

  const findCol = (candidates: string[], exactFallback?: string) => {
    const idx = headerCells.findIndex((h) => candidates.some((c) => h.includes(c)));
    if (idx !== -1) return idx;
    if (exactFallback) {
      return headerCells.findIndex((h) => h === exactFallback);
    }
    return -1;
  };

  const colNo = findCol(['nomor', 'nosoal'], 'no');
  const colSoal = findCol(['pertanyaan', 'soal', 'butirsoal', 'question']);
  const colA = findCol(['opsia', 'pilihana', 'jawabana'], 'a');
  const colB = findCol(['opsib', 'pilihanb', 'jawabanb'], 'b');
  const colC = findCol(['opsic', 'pilihanc', 'jawabanc'], 'c');
  const colD = findCol(['opsid', 'pilihand', 'jawaband'], 'd');
  const colE = findCol(['opsie', 'pilihane', 'jawabane'], 'e');
  const colKunci = findCol(['kunci', 'kuncijawaban', 'jawabanbenar', 'kj', 'answer']);
  const colBobot = findCol(['bobot', 'skor', 'nilai', 'poin', 'weight']);

  if (colSoal === -1 || colA === -1 || colB === -1) {
    return [];
  }

  const results: ParsedWordQuestion[] = [];
  let seq = startNumber;

  for (let r = 1; r < rows.length; r++) {
    const cells = Array.from(rows[r].querySelectorAll('td, th'));
    if (cells.length === 0) continue;

    const getCell = (idx: number): ExtractedCell =>
      idx >= 0 && idx < cells.length
        ? extractNodeContent(cells[idx])
        : { text: '', images: [], hasBold: false };

    const soalCell = getCell(colSoal);
    const aCell = getCell(colA);
    const bCell = getCell(colB);
    const cCell = getCell(colC);
    const dCell = getCell(colD);
    const eCell = getCell(colE);

    if (!soalCell.text && soalCell.images.length === 0 && !aCell.text && !bCell.text) {
      continue;
    }

    const noText = colNo >= 0 ? getCell(colNo).text : '';
    const parsedNo = Number.parseInt(noText.replace(/[^\d]/g, ''), 10);
    const qNo = Number.isFinite(parsedNo) && parsedNo > 0 ? parsedNo : seq;
    seq = qNo + 1;

    const kunciCell = getCell(colKunci);
    const detectedKey = normalizeOptionKey(kunciCell.text);

    const bobotCell = getCell(colBobot);
    const parsedBobot = Number.parseFloat(bobotCell.text.replace(',', '.'));

    results.push(
      finalizeQuestion({
        question_number: qNo,
        question_text: soalCell.text,
        image_data_url: soalCell.images[0] || null,
        options: {
          A: aCell.text,
          B: bCell.text,
          C: cCell.text,
          D: dCell.text,
          E: eCell.text,
        },
        optionImages: {
          A: aCell.images[0] || null,
          B: bCell.images[0] || null,
          C: cCell.images[0] || null,
          D: dCell.images[0] || null,
          E: eCell.images[0] || null,
        },
        correct_answer: detectedKey,
        score_weight: Number.isFinite(parsedBobot) && parsedBobot > 0 ? parsedBobot : 1,
      })
    );
  }

  return results;
}

interface TextLineItem {
  text: string;
  images: string[];
  hasBold: boolean;
  forcedType?: 'question' | 'option';
  forcedNumber?: number;
  forcedOptionKey?: OptionKey;
}

function collectLinearItems(body: HTMLElement): {
  lines: TextLineItem[];
  tableQuestions: ParsedWordQuestion[];
} {
  const lines: TextLineItem[] = [];
  const tableQuestions: ParsedWordQuestion[] = [];
  let seqForTable = 1;

  const pushExtracted = (
    extracted: ExtractedCell,
    extra?: Partial<TextLineItem>
  ) => {
    const splitLines = extracted.text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (splitLines.length === 0 && extracted.images.length > 0) {
      lines.push({
        text: '',
        images: extracted.images,
        hasBold: false,
        ...extra,
      });
      return;
    }

    splitLines.forEach((lineText, idx) => {
      lines.push({
        text: lineText,
        images: idx === 0 ? extracted.images : [],
        hasBold: extracted.hasBold,
        ...(idx === 0 ? extra : undefined),
      });
    });
  };

  const processList = (listEl: HTMLElement, depth: number) => {
    const isOrdered = listEl.tagName.toUpperCase() === 'OL';
    const listType = (listEl.getAttribute('type') || '').toLowerCase();
    const liNodes = Array.from(listEl.children).filter(
      (c) => c.tagName.toUpperCase() === 'LI'
    ) as HTMLElement[];

    liNodes.forEach((li, index) => {
      const nestedLists = Array.from(li.children).filter((c) => {
        const t = c.tagName.toUpperCase();
        return t === 'OL' || t === 'UL';
      }) as HTMLElement[];

      // Extract only content outside nested lists
      const clone = li.cloneNode(true) as HTMLElement;
      Array.from(clone.children).forEach((c) => {
        const t = c.tagName.toUpperCase();
        if (t === 'OL' || t === 'UL') c.remove();
      });

      const extracted = extractNodeContent(clone);

      if (depth === 0 && isOrdered && listType !== 'a' && listType !== 'A') {
        const startsExplicitOpt = /^\(?[A-Ea-e]\)?\s*[\.\)]\s+/.test(extracted.text);
        const startsExplicitNum = /^(?:No\.?\s*|Soal\s*)?\d{1,3}\s*[\.\)]\s+/.test(extracted.text);
        if (!startsExplicitOpt && !startsExplicitNum && extracted.text) {
          pushExtracted(extracted, {
            forcedType: 'question',
            forcedNumber: index + 1,
          });
        } else {
          pushExtracted(extracted);
        }
      } else if ((depth >= 1 || listType === 'a' || listType === 'A') && index < 5) {
        const keys: OptionKey[] = ['A', 'B', 'C', 'D', 'E'];
        const startsExplicitOpt = /^\(?[A-Ea-e]\)?\s*[\.\)]\s+/.test(extracted.text);
        const isMeta = /^(?:Kunci|Jawaban|KJ|Bobot|Skor)/i.test(extracted.text);
        if (!startsExplicitOpt && !isMeta && extracted.text) {
          pushExtracted(extracted, {
            forcedType: 'option',
            forcedOptionKey: keys[index],
          });
        } else {
          pushExtracted(extracted);
        }
      } else {
        pushExtracted(extracted);
      }

      nestedLists.forEach((nested) => processList(nested, depth + 1));
    });
  };

  for (const child of Array.from(body.children)) {
    const tag = child.tagName.toUpperCase();
    if (tag === 'TABLE') {
      const parsedTable = parseTableElement(child as HTMLTableElement, seqForTable);
      if (parsedTable.length > 0) {
        tableQuestions.push(...parsedTable);
        seqForTable = parsedTable[parsedTable.length - 1].question_number + 1;
        continue;
      }
      // Fallback: extract text inside non-standard layout table
      const cells = Array.from(child.querySelectorAll('p, td, th'));
      cells.forEach((cell) => {
        if (cell.tagName.toUpperCase() === 'P' || cell.querySelectorAll('p').length === 0) {
          pushExtracted(extractNodeContent(cell));
        }
      });
      continue;
    }

    if (tag === 'OL' || tag === 'UL') {
      processList(child as HTMLElement, 0);
      continue;
    }

    pushExtracted(extractNodeContent(child));
  }

  return { lines, tableQuestions };
}

function trySplitInlineOptions(text: string): Array<{ key: OptionKey; value: string }> | null {
  if (!/^\(?[Aa]\)?\s*[\.\)]\s+/.test(text)) return null;
  if (!/\s+\(?[B-Eb-e]\)?\s*[\.\)]\s+/.test(text)) return null;

  const matches = [...text.matchAll(/(?:^|\s+)\(?([A-Ea-e])\)?\s*[\.\)]\s+/g)];
  if (matches.length < 2) return null;

  const items: Array<{ key: OptionKey; value: string }> = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const key = m[1].toUpperCase() as OptionKey;
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    items.push({ key, value: text.slice(start, end).trim() });
  }
  return items;
}

function parseLinearQuestions(lines: TextLineItem[]): ParsedWordQuestion[] {
  interface WorkingQuestion {
    question_number: number;
    question_lines: string[];
    image_data_url: string | null;
    options: Record<OptionKey, string>;
    optionImages: Record<OptionKey, string | null>;
    correct_answer: OptionKey | null;
    bold_option_hint: OptionKey | null;
    score_weight: number;
    has_started_options: boolean;
    last_option_key: OptionKey | null;
  }

  const parsedList: ParsedWordQuestion[] = [];
  let current: WorkingQuestion | null = null;
  let autoSeq = 1;

  const flushQuestion = (item: WorkingQuestion | null) => {
    if (!item) return;
    const hasSomeOptions =
      Boolean(item.options.A.trim()) ||
      Boolean(item.options.B.trim()) ||
      Boolean(item.optionImages.A);
    if (!hasSomeOptions && item.question_lines.join('').trim().length === 0) {
      return;
    }
    if (!hasSomeOptions) {
      // Ignore preamble instructions before question 1 (e.g. "1. Petunjuk pengerjaan...")
      return;
    }

    parsedList.push(
      finalizeQuestion({
        question_number: item.question_number,
        question_text: item.question_lines.join('\n'),
        image_data_url: item.image_data_url,
        options: item.options,
        optionImages: item.optionImages,
        correct_answer: item.correct_answer || item.bold_option_hint,
        score_weight: item.score_weight,
      })
    );
  };

  const createQuestion = (
    qNum: number,
    initialText: string,
    img: string | null
  ): WorkingQuestion => {
    autoSeq = qNum + 1;
    return {
      question_number: qNum,
      question_lines: initialText ? [initialText] : [],
      image_data_url: img,
      options: { A: '', B: '', C: '', D: '', E: '' },
      optionImages: { A: null, B: null, C: null, D: null, E: null },
      correct_answer: null,
      bold_option_hint: null,
      score_weight: 1,
      has_started_options: false,
      last_option_key: null,
    };
  };

  for (const item of lines) {
    const trimmed = item.text.trim();

    // Pure image line (attached to current question or current option)
    if (!trimmed && item.images.length > 0) {
      if (current) {
        if (!current.has_started_options && !current.image_data_url) {
          current.image_data_url = item.images[0];
        } else if (current.last_option_key && !current.optionImages[current.last_option_key]) {
          current.optionImages[current.last_option_key] = item.images[0];
        }
      }
      continue;
    }

    if (!trimmed) continue;

    // 1. Answer key line: Kunci: A / Jawaban: B / KJ: C
    const keyMatch = trimmed.match(
      /^(?:Kunci(?:\s*Jawaban)?|Jawaban(?:\s*Benar)?|KJ|Answer)\s*[:=\-]\s*\(?([A-Ea-e])\)?\b/i
    );
    if (keyMatch && current) {
      current.correct_answer = keyMatch[1].toUpperCase() as OptionKey;
      continue;
    }

    // 2. Score weight line: Bobot: 2 / Skor: 2.5
    const weightMatch = trimmed.match(
      /^(?:Bobot(?:\s*Soal)?|Skor|Nilai|Poin)\s*[:=\-]\s*(\d+(?:[.,]\d+)?)\b/i
    );
    if (weightMatch && current) {
      const val = Number.parseFloat(weightMatch[1].replace(',', '.'));
      if (Number.isFinite(val) && val > 0) {
        current.score_weight = val;
      }
      continue;
    }

    // 3. Forced option from nested Word list
    if (item.forcedType === 'option' && item.forcedOptionKey && current) {
      const key = item.forcedOptionKey;
      current.has_started_options = true;
      current.last_option_key = key;
      current.options[key] = trimmed;
      if (item.images[0] && !current.optionImages[key]) {
        current.optionImages[key] = item.images[0];
      }
      if (item.hasBold && !current.bold_option_hint) {
        current.bold_option_hint = key;
      }
      continue;
    }

    // 4. Inline multi-option line (e.g. "A. 10   B. 20   C. 30")
    if (current) {
      const inlineOpts = trySplitInlineOptions(trimmed);
      if (inlineOpts) {
        current.has_started_options = true;
        for (const opt of inlineOpts) {
          current.options[opt.key] = opt.value;
          current.last_option_key = opt.key;
        }
        continue;
      }
    }

    // 5. Explicit option line: A. / a. / A) / (A)
    const optionMatch = trimmed.match(/^\(?([A-Ea-e])\)?\s*[\.\)]\s*(.*)$/);
    if (optionMatch && current) {
      const key = optionMatch[1].toUpperCase() as OptionKey;
      const bodyText = optionMatch[2].trim();
      // Guard: if we haven't seen A yet and this starts with B/C/D/E inside question stem, treat carefully
      if (key === 'A' || current.has_started_options) {
        current.has_started_options = true;
        current.last_option_key = key;
        current.options[key] = bodyText;
        if (item.images[0] && !current.optionImages[key]) {
          current.optionImages[key] = item.images[0];
        }
        if (item.hasBold && !current.bold_option_hint) {
          current.bold_option_hint = key;
        }
        continue;
      }
    }

    // 6. Question start: "1. ..." / "No. 1 ..." / "Soal 1. ..." or forced <ol> item
    const explicitQuestionMatch = trimmed.match(
      /^(?:(?:No\.?|Soal(?:\s*No\.?)?)\s*(\d{1,3})\s*[:\.\)]?\s*(.*)|(\d{1,3})\s*[\.\)]\s+(.*))$/i
    );
    if (explicitQuestionMatch) {
      const numRaw = explicitQuestionMatch[1] || explicitQuestionMatch[3];
      const textRaw = (explicitQuestionMatch[2] ?? explicitQuestionMatch[4] ?? '').trim();
      const qNum = Number.parseInt(numRaw, 10);
      if (Number.isFinite(qNum) && qNum >= 1 && qNum <= 500) {
        flushQuestion(current);
        current = createQuestion(qNum, textRaw, item.images[0] || null);
        continue;
      }
    }

    if (item.forcedType === 'question') {
      flushQuestion(current);
      current = createQuestion(item.forcedNumber || autoSeq, trimmed, item.images[0] || null);
      continue;
    }

    // 7. Continuation line (multi-paragraph question stem or multi-line option)
    if (current) {
      if (!current.has_started_options) {
        current.question_lines.push(trimmed);
        if (item.images[0] && !current.image_data_url) {
          current.image_data_url = item.images[0];
        }
      } else if (current.last_option_key) {
        current.options[current.last_option_key] = [
          current.options[current.last_option_key],
          trimmed,
        ]
          .filter(Boolean)
          .join('\n');
      }
    }
  }

  flushQuestion(current);
  return parsedList;
}

export async function parseWordQuestionsFile(file: File): Promise<WordParseResult> {
  const rawBuffer = await file.arrayBuffer();
  const arrayBuffer = await preprocessDocxMath(rawBuffer);
  const result = await mammoth.convertToHtml({ arrayBuffer });

  const parser = new DOMParser();
  const doc = parser.parseFromString(result.value, 'text/html');
  const { lines, tableQuestions } = collectLinearItems(doc.body);
  const textQuestions = parseLinearQuestions(lines);

  const combined = [...tableQuestions, ...textQuestions];
  let formatDetected: WordParseResult['format_detected'] = 'none';
  if (tableQuestions.length > 0 && textQuestions.length > 0) {
    formatDetected = 'mixed';
  } else if (tableQuestions.length > 0) {
    formatDetected = 'table';
  } else if (textQuestions.length > 0) {
    formatDetected = 'text';
  }

  return {
    questions: combined,
    format_detected: formatDetected,
    raw_messages: result.messages.map((m) => m.message),
  };
}

export function parseMathRawTextQuestions(rawText: string): ParsedWordQuestion[] {
  const lines: TextLineItem[] = rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({
      text: line,
      images: [],
      hasBold: false,
    }));

  return parseLinearQuestions(lines);
}

export async function downloadQuestionTemplateWord(): Promise<void> {
  const tableHeaderCell = (text: string) =>
    new TableCell({
      shading: { fill: 'EFF6FF' },
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: true, size: 20 })],
        }),
      ],
    });

  const tableDataCell = (text: string) =>
    new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text, size: 20 })],
        }),
      ],
    });

  const sampleTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    },
    rows: [
      new TableRow({
        children: [
          tableHeaderCell('No'),
          tableHeaderCell('Pertanyaan'),
          tableHeaderCell('Opsi A'),
          tableHeaderCell('Opsi B'),
          tableHeaderCell('Opsi C'),
          tableHeaderCell('Opsi D'),
          tableHeaderCell('Opsi E'),
          tableHeaderCell('Kunci'),
          tableHeaderCell('Bobot'),
        ],
      }),
      new TableRow({
        children: [
          tableDataCell('1'),
          tableDataCell('Jika $f(x) = 3x - 5$, maka nilai dari $f(4)$ adalah ...'),
          tableDataCell('5'),
          tableDataCell('7'),
          tableDataCell('9'),
          tableDataCell('12'),
          tableDataCell('17'),
          tableDataCell('B'),
          tableDataCell('2'),
        ],
      }),
      new TableRow({
        children: [
          tableDataCell('2'),
          tableDataCell('Rumus kimia air adalah ... (Untuk SMP opsi E boleh diisi tanda - atau dikosongkan)'),
          tableDataCell('CO₂'),
          tableDataCell('H₂O'),
          tableDataCell('NaCl'),
          tableDataCell('O₂'),
          tableDataCell('-'),
          tableDataCell('B'),
          tableDataCell('2'),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({
                text: 'TEMPLATE IMPORT SOAL KOLEKTIF CBT (.DOCX)',
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Anda dapat memakai FORMAT TABEL (di bawah) ATAU FORMAT TEKS BIASA. Pilih salah satu format saja per file agar nomor soal berurutan rapi.',
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 120, after: 120 },
            children: [new TextRun({ text: 'PILIHAN 1: FORMAT TABEL WORD', bold: true })],
          }),
          sampleTable,
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 320, after: 120 },
            children: [
              new TextRun({
                text: 'PILIHAN 2: FORMAT TEKS STANDAR (Contoh — hapus bagian ini jika memakai tabel di atas)',
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '3. Ibu kota Provinsi Jawa Timur adalah ...',
                size: 21,
              }),
            ],
          }),
          new Paragraph({ children: [new TextRun({ text: 'A. Malang', size: 21 })] }),
          new Paragraph({ children: [new TextRun({ text: 'B. Ponorogo', size: 21 })] }),
          new Paragraph({ children: [new TextRun({ text: 'C. Surabaya', size: 21 })] }),
          new Paragraph({ children: [new TextRun({ text: 'D. Madiun', size: 21 })] }),
          new Paragraph({ children: [new TextRun({ text: 'E. Kediri', size: 21 })] }),
          new Paragraph({ children: [new TextRun({ text: 'Kunci: C', bold: true, size: 21 })] }),
          new Paragraph({
            spacing: { after: 180 },
            children: [new TextRun({ text: 'Bobot: 2', size: 21 })],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Template_Bank_Soal_CBT.docx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
