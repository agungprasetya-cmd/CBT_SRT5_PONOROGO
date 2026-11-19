import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type {
  AdminResultRow,
  InstitutionSettings,
  Participant,
  StudentResultResponse,
} from '../types/cbt';

export function exportResultsToExcel(results: AdminResultRow[], filename = 'Rekap_Nilai_CBT.xlsx') {
  const sheetRows = results.map((row, index) => ({
    No: index + 1,
    'Nomor Peserta': row.exam_number,
    'Nama Lengkap': row.full_name,
    'Kelas / Rombel': row.class_name,
    'Paket Ujian': row.exam_title,
    'Mata Pelajaran': row.subject_name,
    Benar: row.total_correct,
    Salah: row.total_wrong,
    Kosong: row.total_empty,
    'Skor Akhir': row.final_score,
    KKM: row.kkm,
    'Status Kelulusan': row.passing_status,
    'Pelanggaran Tab': row.violations_count,
    'Status Sesi':
      row.session_status === 'flagged_cheating'
        ? 'Dicurigai Curang (Pelanggaran Batas)'
        : 'Selesai Normal',
    'Waktu Selesai': new Date(row.completed_at).toLocaleString('id-ID'),
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  worksheet['!cols'] = [
    { wch: 5 },
    { wch: 16 },
    { wch: 28 },
    { wch: 14 },
    { wch: 30 },
    { wch: 22 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
    { wch: 8 },
    { wch: 16 },
    { wch: 15 },
    { wch: 32 },
    { wch: 22 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Nilai');
  XLSX.writeFile(workbook, filename);
}

export function downloadParticipantTemplateExcel() {
  const sampleRows = [
    {
      'Nomor Peserta': '2026-XII-013',
      'Nama Lengkap': 'Budi Santoso',
      'Kelas / Rombel': 'XII IPA 1',
      'Status Aktif': 'AKTIF',
    },
    {
      'Nomor Peserta': '2026-XII-014',
      'Nama Lengkap': 'Citra Dewi Lestari',
      'Kelas / Rombel': 'XII IPA 2',
      'Status Aktif': 'AKTIF',
    },
  ];
  const worksheet = XLSX.utils.json_to_sheet(sampleRows);
  worksheet['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 14 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Peserta');
  XLSX.writeFile(workbook, 'Template_Import_Peserta_CBT.xlsx');
}

export function exportResultsToPdf(
  results: AdminResultRow[],
  institution: InstitutionSettings | null,
  examLabel = 'Semua Paket Ujian'
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const schoolName = institution?.school_name || 'SATUAN PENDIDIKAN';
  const eventName = institution?.exam_event_name || 'Asesmen Berbasis Komputer';
  const academicYear = institution?.academic_year || '2026/2027';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(schoolName.toUpperCase(), 148.5, 15, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${eventName} · Tahun Pelajaran ${academicYear}`, 148.5, 21, { align: 'center' });

  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.6);
  doc.line(14, 25, 283, 25);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`LAPORAN REKAPITULASI NILAI PESERTA — ${examLabel}`, 14, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 283, 32, { align: 'right' });

  autoTable(doc, {
    startY: 36,
    head: [
      [
        'No',
        'No. Peserta',
        'Nama Lengkap',
        'Kelas',
        'Mata Pelajaran',
        'B',
        'S',
        'K',
        'Nilai',
        'Status',
        'Pelanggaran',
      ],
    ],
    body: results.map((r, idx) => [
      idx + 1,
      r.exam_number,
      r.full_name,
      r.class_name,
      r.subject_name,
      r.total_correct,
      r.total_wrong,
      r.total_empty,
      r.final_score.toFixed(2),
      r.passing_status,
      r.session_status === 'flagged_cheating'
        ? `Curang (${r.violations_count}x)`
        : `${r.violations_count}x`,
    ]),
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      5: { halign: 'center', cellWidth: 10 },
      6: { halign: 'center', cellWidth: 10 },
      7: { halign: 'center', cellWidth: 10 },
      8: { halign: 'right', cellWidth: 16, fontStyle: 'bold' },
      9: { halign: 'center', cellWidth: 26 },
      10: { halign: 'center', cellWidth: 26 },
    },
  });

  doc.save(`Rekap_Nilai_${examLabel.replace(/\s+/g, '_')}.pdf`);
}

export function exportParticipantCardsPdf(
  participants: Participant[],
  institution: InstitutionSettings | null
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const schoolName = institution?.school_name || 'Sekolah / Madrasah';
  const eventName = institution?.exam_event_name || 'Ujian Berbasis Komputer';

  const cardWidth = 88;
  const cardHeight = 48;
  const marginX = 14;
  const marginY = 14;
  const gapX = 6;
  const gapY = 6;

  participants.forEach((p, idx) => {
    const indexOnPage = idx % 10;
    if (idx > 0 && indexOnPage === 0) {
      doc.addPage();
    }
    const col = indexOnPage % 2;
    const row = Math.floor(indexOnPage / 2);
    const x = marginX + col * (cardWidth + gapX);
    const y = marginY + row * (cardHeight + gapY);

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2);

    doc.setFillColor(15, 23, 42);
    doc.rect(x, y, cardWidth, 12, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('KARTU PESERTA UJIAN CBT', x + 4, y + 5.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.text(`${schoolName} · ${eventName}`.slice(0, 52), x + 4, y + 9.5);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.text('Nomor Peserta', x + 4, y + 19);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(p.exam_number, x + 32, y + 19);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Nama Lengkap', x + 4, y + 26);
    doc.setFont('helvetica', 'bold');
    doc.text(p.full_name.slice(0, 28), x + 32, y + 26);

    doc.setFont('helvetica', 'normal');
    doc.text('Kelas / Rombel', x + 4, y + 33);
    doc.setFont('helvetica', 'bold');
    doc.text(p.class_name, x + 32, y + 33);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Gunakan Nomor Peserta & Token Ujian saat login ruang CBT.', x + 4, y + 43);
  });

  doc.save('Kartu_Peserta_CBT.pdf');
}

export function exportStudentProofPdf(data: StudentResultResponse) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(data.institution.school_name.toUpperCase(), 74, 15, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(data.institution.exam_event_name, 74, 20, { align: 'center' });
  doc.line(12, 24, 136, 24);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('BUKTI PENYELESAIAN UJIAN CBT', 74, 32, { align: 'center' });

  const rows: Array<[string, string]> = [
    ['Nomor Peserta', data.participant.exam_number],
    ['Nama Peserta', data.participant.full_name],
    ['Kelas / Rombel', data.participant.class_name],
    ['Paket Ujian', data.exam.title],
    ['Mata Pelajaran', data.exam.subject_name],
    ['Waktu Selesai', new Date(data.result.completed_at).toLocaleString('id-ID')],
    [
      'Status Sesi',
      data.session_status === 'flagged_cheating'
        ? `Dicurigai Curang (${data.violations_count}x Pelanggaran)`
        : 'Selesai Normal',
    ],
  ];

  if (data.show_result_to_student) {
    rows.push(
      ['Rincian Jawaban', `Benar: ${data.result.total_correct} · Salah: ${data.result.total_wrong} · Kosong: ${data.result.total_empty}`],
      ['Skor Akhir', `${data.result.final_score.toFixed(2)} (KKM ${data.exam.kkm})`],
      ['Status Kelulusan', data.result.passing_status]
    );
  }

  autoTable(doc, {
    startY: 38,
    body: rows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 42, fillColor: [248, 250, 252] },
    },
  });

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Dokumen ini diterbitkan secara otomatis oleh Sistem CBT Sekolah/Madrasah.', 74, 192, {
    align: 'center',
  });

  doc.save(`Bukti_Ujian_${data.participant.exam_number}.pdf`);
}
