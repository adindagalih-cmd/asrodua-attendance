import QRCode from 'qrcode';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AttendanceRecord,
  AttendanceSettings,
  SchoolClass,
  Student,
  Teacher,
  TeacherAttendanceRecord,
} from '../types';
import {
  formatIndonesianDate,
  resolveTeacherQrData,
} from '../firebase';

// Web Audio API Sound Synthesizer for QR Scanner Feedback
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

export async function unlockScanAudio(): Promise<void> {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  } catch {
    // Ignore browser autoplay restrictions until next user gesture
  }
}

function scheduleTone(
  ctx: AudioContext,
  options: {
    type: OscillatorType;
    frequency: number;
    startTime: number;
    duration: number;
    peakGain: number;
  }
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = options.type;
  osc.frequency.setValueAtTime(options.frequency, options.startTime);

  // Smooth attack and exponential release to avoid audible speaker clicks
  gain.gain.setValueAtTime(0.0001, options.startTime);
  gain.gain.linearRampToValueAtTime(options.peakGain, options.startTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, options.startTime + options.duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(options.startTime);
  osc.stop(options.startTime + options.duration + 0.01);
}

export function playScanSound(type: 'success' | 'warning' | 'error'): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const triggerPlayback = () => {
      const now = ctx.currentTime;
      if (type === 'success') {
        // Distinct bright ascending two-note chime for valid QR scan
        scheduleTone(ctx, {
          type: 'sine',
          frequency: 1046.5, // C6
          startTime: now,
          duration: 0.11,
          peakGain: 0.2,
        });
        scheduleTone(ctx, {
          type: 'sine',
          frequency: 1318.51, // E6
          startTime: now + 0.09,
          duration: 0.18,
          peakGain: 0.22,
        });
      } else {
        // Distinct double descending alert tone for invalid, revoked, duplicate, or failed scans
        scheduleTone(ctx, {
          type: 'triangle',
          frequency: type === 'warning' ? 440 : 349.23,
          startTime: now,
          duration: 0.14,
          peakGain: 0.24,
        });
        scheduleTone(ctx, {
          type: 'triangle',
          frequency: type === 'warning' ? 311.13 : 246.94,
          startTime: now + 0.17,
          duration: 0.2,
          peakGain: 0.24,
        });
      }
    };

    if (ctx.state === 'suspended') {
      void ctx
        .resume()
        .then(triggerPlayback)
        .catch(() => {
          // Ignore if browser blocks audio without user gesture
        });
    } else {
      triggerPlayback();
    }
  } catch {
    // Ignore audio context restrictions if unsupported
  }
}

export async function generateQrDataUrl(tokenPayload: string, width = 320): Promise<string> {
  return QRCode.toDataURL(tokenPayload, {
    width,
    margin: 2,
    color: {
      dark: '#0A3D91',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  });
}

// Render high-resolution QR Card PNG for individual or bulk ZIP download
export async function renderStudentQrPosterBlob(student: Student): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 760;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header Banner (#0A3D91)
  ctx.fillStyle = '#0A3D91';
  ctx.fillRect(0, 0, canvas.width, 130);

  // Gold Accent Bar (#D4AF37)
  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(0, 130, canvas.width, 8);

  // School Name text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SDN ASEMROWO II/63 SURABAYA', canvas.width / 2, 55);

  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 15px Plus Jakarta Sans, sans-serif';
  ctx.fillText('ASRODUA SMART ATTENDANCE — QR TOKEN SISWA', canvas.width / 2, 92);

  // QR Image
  const qrDataUrl = await generateQrDataUrl(student.qrToken, 380);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
    img.src = qrDataUrl;
  });

  // Border around QR
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.strokeRect(105, 175, 390, 390);
  ctx.drawImage(img, 110, 180, 380, 380);

  // Student Details Footer
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 24px Outfit, sans-serif';
  ctx.fillText(student.fullName.toUpperCase(), canvas.width / 2, 615);

  ctx.fillStyle = '#334155';
  ctx.font = '600 18px IBM Plex Mono, monospace';
  ctx.fillText(`NIS: ${student.nis}  •  NISN: ${student.nisn}`, canvas.width / 2, 652);

  ctx.fillStyle = '#0A3D91';
  ctx.font = 'bold 20px Plus Jakarta Sans, sans-serif';
  ctx.fillText(student.className, canvas.width / 2, 690);

  ctx.fillStyle = '#64748B';
  ctx.font = '13px IBM Plex Mono, monospace';
  ctx.fillText(`Token ID: ${student.qrCodeId}`, canvas.width / 2, 730);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Gagal membuat gambar PNG'));
    }, 'image/png');
  });
}

export async function downloadSingleQrPng(student: Student): Promise<void> {
  const blob = await renderStudentQrPosterBlob(student);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = student.fullName.replace(/[^a-zA-Z0-9]/g, '_');
  a.download = `QR_${student.className.replace(/\s+/g, '')}_${student.nis}_${safeName}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadBulkQrZip(
  students: Student[],
  zipLabel = 'Seluruh_Siswa'
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder(`QR_ASRODUA_${zipLabel}`) || zip;

  for (const std of students) {
    const blob = await renderStudentQrPosterBlob(std);
    const safeName = std.fullName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${std.className.replace(/\s+/g, '')}_${std.nis}_${safeName}.png`;
    folder.file(filename, blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `QR_Code_ASRODUA_${zipLabel}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Excel Export & Import for Student Master Database
export function exportStudentsToExcel(students: Student[]): void {
  const rows = students.map((s, idx) => ({
    No: idx + 1,
    'ID Siswa': s.id,
    NIS: s.nis,
    NISN: s.nisn,
    'Nama Lengkap': s.fullName,
    'L/P': s.gender,
    'Tempat, Tanggal Lahir': s.birthPlaceDate,
    Kelas: s.className,
    'Nama Orang Tua/Wali': s.parentName,
    'No. WhatsApp Ortu': s.parentWhatsapp,
    Status: s.status,
    'QR Code ID': s.qrCodeId,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data_Siswa');
  XLSX.writeFile(wb, `Data_Siswa_SDN_Asemrowo_II_63_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function downloadStudentImportTemplate(): void {
  const sampleRows = [
    {
      NIS: '6401',
      NISN: '0139988771',
      'Nama Lengkap': 'Bima Arya Pratama',
      'L/P': 'L',
      'Tempat, Tanggal Lahir': 'Surabaya, 10 Mei 2019',
      Kelas: 'Kelas 1A',
      'Nama Orang Tua/Wali': 'Hendro Pratama',
      'No. WhatsApp Ortu': '6281234567801',
    },
    {
      NIS: '6402',
      NISN: '0139988772',
      'Nama Lengkap': 'Siti Nurhaliza Putri',
      'L/P': 'P',
      'Tempat, Tanggal Lahir': 'Surabaya, 18 Agustus 2018',
      Kelas: 'Kelas 2A',
      'Nama Orang Tua/Wali': 'Abdul Rahman',
      'No. WhatsApp Ortu': '6281234567802',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template_Import_Siswa');
  XLSX.writeFile(wb, 'Template_Import_Siswa_ASRODUA.xlsx');
}

export async function parseStudentExcelFile(file: File): Promise<
  Array<{
    nis: string;
    nisn: string;
    fullName: string;
    gender: 'L' | 'P';
    birthPlaceDate: string;
    className: string;
    parentName: string;
    parentWhatsapp: string;
  }>
> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  return json
    .map((row) => {
      const nis = String(row['NIS'] || row['nis'] || '').trim();
      const nisn = String(row['NISN'] || row['nisn'] || nis).trim();
      const fullName = String(
        row['Nama Lengkap'] || row['Nama'] || row['fullName'] || ''
      ).trim();
      const rawGender = String(row['L/P'] || row['Jenis Kelamin'] || row['gender'] || 'L')
        .trim()
        .toUpperCase();
      const gender: 'L' | 'P' = rawGender.startsWith('P') ? 'P' : 'L';
      const birthPlaceDate = String(
        row['Tempat, Tanggal Lahir'] || row['TTL'] || row['birthPlaceDate'] || 'Surabaya'
      ).trim();
      const className = String(row['Kelas'] || row['className'] || 'Kelas 1A').trim();
      const parentName = String(
        row['Nama Orang Tua/Wali'] || row['Orang Tua'] || row['parentName'] || '-'
      ).trim();
      const parentWhatsapp = String(
        row['No. WhatsApp Ortu'] || row['WhatsApp'] || row['parentWhatsapp'] || ''
      ).trim();

      return {
        nis,
        nisn,
        fullName,
        gender,
        birthPlaceDate,
        className,
        parentName,
        parentWhatsapp,
      };
    })
    .filter((item) => item.nis && item.fullName);
}

// Export Attendance Report to Excel
export function exportAttendanceToExcel(
  records: AttendanceRecord[],
  filenamePrefix = 'Laporan_Absensi_ASRODUA'
): void {
  const rows = records.map((r, idx) => ({
    No: idx + 1,
    Tanggal: r.date,
    NIS: r.nis,
    NISN: r.nisn,
    'Nama Siswa': r.studentName,
    Kelas: r.className,
    'Status Kehadiran': r.status,
    'Jam Masuk': r.checkInTime || '-',
    'Jam Pulang': r.checkOutTime || '-',
    Sesi: r.session,
    Keterangan: r.notes || '-',
    'Diverifikasi Oleh': r.verifiedByName,
    'Notifikasi WA': r.whatsappSent ? 'Terkirim' : 'Belum',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan_Absensi');
  XLSX.writeFile(wb, `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export interface FullAttendanceExportOptions {
  records: AttendanceRecord[];
  unrecordedStudents?: Student[];
  startDate: string;
  endDate: string;
  classLabel: string;
  exportedBy: string;
  settings: AttendanceSettings;
}

export function exportFullAttendanceRangeToExcel({
  records,
  unrecordedStudents = [],
  startDate,
  endDate,
  classLabel,
  exportedBy,
  settings,
}: FullAttendanceExportOptions): void {
  const sortedRecords = [...records].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.className.localeCompare(b.className) ||
      a.nis.localeCompare(b.nis)
  );

  interface FullAttendanceExportRow {
    No: number;
    'ID Catatan': string;
    Tanggal: string;
    'Tahun Pelajaran': string;
    NIS: string;
    NISN: string;
    'Nama Siswa': string;
    Kelas: string;
    'Status Kehadiran': string;
    'Jam Masuk': string;
    'Jam Pulang': string;
    Sesi: string;
    'Token QR': string;
    Keterangan: string;
    'Diverifikasi Oleh': string;
    'Notifikasi WA': string;
    'Diperbarui Pada': string;
  }

  const dataRows: FullAttendanceExportRow[] = sortedRecords.map((r, idx) => ({
    No: idx + 1,
    'ID Catatan': r.id,
    Tanggal: r.date,
    'Tahun Pelajaran': r.academicYear || settings.activeAcademicYear,
    NIS: r.nis,
    NISN: r.nisn,
    'Nama Siswa': r.studentName,
    Kelas: r.className,
    'Status Kehadiran': r.status,
    'Jam Masuk': r.checkInTime || '-',
    'Jam Pulang': r.checkOutTime || '-',
    Sesi: r.session,
    'Token QR': r.qrTokenUsed || '-',
    Keterangan: r.notes || '-',
    'Diverifikasi Oleh': r.verifiedByName || '-',
    'Notifikasi WA': r.whatsappSent ? 'Terkirim' : 'Belum',
    'Diperbarui Pada': r.updatedAt ? r.updatedAt.slice(0, 19).replace('T', ' ') : '-',
  }));

  if (unrecordedStudents.length > 0 && startDate === endDate) {
    unrecordedStudents.forEach((std) => {
      dataRows.push({
        No: dataRows.length + 1,
        'ID Catatan': '-',
        Tanggal: startDate,
        'Tahun Pelajaran': settings.activeAcademicYear,
        NIS: std.nis,
        NISN: std.nisn,
        'Nama Siswa': std.fullName,
        Kelas: std.className,
        'Status Kehadiran': 'BELUM SCAN',
        'Jam Masuk': '-',
        'Jam Pulang': '-',
        Sesi: '-',
        'Token QR': std.qrCodeId || '-',
        Keterangan: 'Belum melakukan scan atau verifikasi manual',
        'Diverifikasi Oleh': '-',
        'Notifikasi WA': 'Belum',
        'Diperbarui Pada': '-',
      });
    });
  }

  const wsData = XLSX.utils.json_to_sheet(
    dataRows.length > 0
      ? dataRows
      : [
          {
            Info: `Tidak ada data absensi pada rentang ${startDate} s/d ${endDate} (${classLabel})`,
          },
        ]
  );

  wsData['!cols'] = [
    { wch: 5 },
    { wch: 24 },
    { wch: 12 },
    { wch: 15 },
    { wch: 10 },
    { wch: 14 },
    { wch: 28 },
    { wch: 12 },
    { wch: 16 },
    { wch: 11 },
    { wch: 11 },
    { wch: 10 },
    { wch: 22 },
    { wch: 34 },
    { wch: 22 },
    { wch: 14 },
    { wch: 20 },
  ];

  const hadir = sortedRecords.filter((r) => r.status === 'HADIR').length;
  const terlambat = sortedRecords.filter((r) => r.status === 'TERLAMBAT').length;
  const izin = sortedRecords.filter((r) => r.status === 'IZIN').length;
  const sakit = sortedRecords.filter((r) => r.status === 'SAKIT').length;
  const alpa = sortedRecords.filter((r) => r.status === 'ALPA').length;

  const summaryRows = [
    { Keterangan: 'Sekolah', Nilai: settings.schoolName },
    { Keterangan: 'NPSN', Nilai: settings.npsn },
    { Keterangan: 'Tahun Pelajaran', Nilai: `${settings.activeAcademicYear} (${settings.semester})` },
    { Keterangan: 'Rentang Tanggal', Nilai: startDate === endDate ? startDate : `${startDate} s/d ${endDate}` },
    { Keterangan: 'Filter Kelas', Nilai: classLabel },
    { Keterangan: 'Diekspor Oleh', Nilai: exportedBy },
    { Keterangan: 'Waktu Ekspor', Nilai: new Date().toISOString().slice(0, 19).replace('T', ' ') },
    { Keterangan: 'Total Catatan Absensi', Nilai: String(sortedRecords.length) },
    { Keterangan: 'Hadir', Nilai: String(hadir) },
    { Keterangan: 'Terlambat', Nilai: String(terlambat) },
    { Keterangan: 'Izin', Nilai: String(izin) },
    { Keterangan: 'Sakit', Nilai: String(sakit) },
    { Keterangan: 'Alpa', Nilai: String(alpa) },
    ...(unrecordedStudents.length > 0 && startDate === endDate
      ? [{ Keterangan: 'Belum Scan (Tanggal Terpilih)', Nilai: String(unrecordedStudents.length) }]
      : []),
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 45 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsData, 'Data_Absensi');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan_Ekspor');

  const safeClass = classLabel.replace(/[^a-zA-Z0-9]/g, '_');
  const datePart = startDate === endDate ? startDate : `${startDate}_sd_${endDate}`;
  XLSX.writeFile(wb, `Absensi_${safeClass}_${datePart}.xlsx`);
}

const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function formatIndonesianMonthYear(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const monthIdx = Number(month) - 1;
  if (!year || Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) {
    return monthStr;
  }
  return `${INDONESIAN_MONTHS[monthIdx]} ${year}`;
}

function applyPdfLetterhead(
  doc: jsPDF,
  settings: AttendanceSettings,
  reportTitle: string,
  filterSubtitle: string,
  summaryLine: string
): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(10, 61, 145);
  doc.text('PEMERINTAH KOTA SURABAYA — DINAS PENDIDIKAN', 148.5, 12, { align: 'center' });

  doc.setFontSize(16);
  doc.text(settings.schoolName.toUpperCase(), 148.5, 19, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${settings.schoolAddress}  |  NPSN: ${settings.npsn}  |  Tahun Pelajaran: ${settings.activeAcademicYear} (${settings.semester})`,
    148.5,
    24.5,
    { align: 'center' }
  );

  doc.setDrawColor(10, 61, 145);
  doc.setLineWidth(0.7);
  doc.line(14, 27.5, 283, 27.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(reportTitle.toUpperCase(), 14, 35);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(filterSubtitle, 14, 40.5);
  doc.text(summaryLine, 14, 46);
}

function applyPdfSignatureAndFooters(doc: jsPDF, settings: AttendanceSettings): void {
  const lastY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 140;

  let signY = lastY + 12;
  if (signY + 34 > 195) {
    doc.addPage();
    signY = 24;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Surabaya, ${formatIndonesianDate(new Date().toISOString().slice(0, 10))}`,
    218,
    signY
  );
  doc.text('Mengetahui, Kepala Sekolah', 218, signY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.principalName || 'Kepala Sekolah', 218, signY + 23);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${settings.principalNip || '-'}`, 218, signY + 28);

  const totalPages = doc.getNumberOfPages();
  const printTime = new Date().toISOString().slice(0, 16).replace('T', ' ');
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${settings.schoolName} — ASRODUA Smart Attendance · Dicetak: ${printTime} WIB`,
      14,
      203
    );
    doc.text(`Halaman ${p} dari ${totalPages}`, 283, 203, { align: 'right' });
  }
}

// Export Attendance Report to Official School PDF
export function exportAttendanceToPdf(
  records: AttendanceRecord[],
  reportTitle: string,
  filterSubtitle: string,
  settings: AttendanceSettings,
  fileName?: string
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const hadir = records.filter((r) => r.status === 'HADIR').length;
  const terlambat = records.filter((r) => r.status === 'TERLAMBAT').length;
  const izin = records.filter((r) => r.status === 'IZIN').length;
  const sakit = records.filter((r) => r.status === 'SAKIT').length;
  const alpa = records.filter((r) => r.status === 'ALPA').length;

  applyPdfLetterhead(
    doc,
    settings,
    reportTitle,
    filterSubtitle,
    `Ringkasan: Total Data = ${records.length}  |  Hadir = ${hadir}  |  Terlambat = ${terlambat}  |  Izin = ${izin}  |  Sakit = ${sakit}  |  Alpa = ${alpa}`
  );

  const tableRows =
    records.length > 0
      ? records.map((r, i) => [
          String(i + 1),
          r.date,
          r.nis,
          r.studentName,
          r.className,
          r.status,
          r.checkInTime || '-',
          r.checkOutTime || '-',
          r.notes || '-',
          r.verifiedByName,
        ])
      : [['-', '-', '-', 'Belum ada data absensi pada filter/periode ini', '-', '-', '-', '-', '-', '-']];

  autoTable(doc, {
    startY: 50,
    head: [
      [
        'No',
        'Tanggal',
        'NIS',
        'Nama Siswa',
        'Kelas',
        'Status',
        'Jam Masuk',
        'Jam Pulang',
        'Keterangan',
        'Verifikator',
      ],
    ],
    body: tableRows,
    styles: {
      fontSize: 8.5,
      cellPadding: 2.2,
    },
    headStyles: {
      fillColor: [10, 61, 145],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 248, 255],
    },
  });

  applyPdfSignatureAndFooters(doc, settings);

  doc.save(
    fileName || `Laporan_Absensi_SDN_Asemrowo_II_63_${new Date().toISOString().slice(0, 10)}.pdf`
  );
}

export interface MonthlyStudentRecapRow {
  student: Student;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpa: number;
  total: number;
  pct: number;
}

export interface MonthlyClassRecapRow {
  cls: SchoolClass;
  studentCount: number;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpa: number;
  pct: number;
}

export function exportMonthlyStudentRecapToPdf(options: {
  monthLabel: string;
  monthKey: string;
  classLabel: string;
  studentRows: MonthlyStudentRecapRow[];
  classRows?: MonthlyClassRecapRow[];
  dailyRecordsCount: number;
  settings: AttendanceSettings;
  titleOverride?: string;
}): void {
  const {
    monthLabel,
    monthKey,
    classLabel,
    studentRows,
    classRows = [],
    dailyRecordsCount,
    settings,
    titleOverride,
  } = options;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const totals = studentRows.reduce(
    (acc, r) => ({
      hadir: acc.hadir + r.hadir,
      terlambat: acc.terlambat + r.terlambat,
      izin: acc.izin + r.izin,
      sakit: acc.sakit + r.sakit,
      alpa: acc.alpa + r.alpa,
      total: acc.total + r.total,
    }),
    { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0, total: 0 }
  );
  const avgPct =
    totals.total > 0
      ? Math.round(((totals.hadir + totals.terlambat) / totals.total) * 100)
      : 0;

  applyPdfLetterhead(
    doc,
    settings,
    titleOverride || 'LAPORAN REKAPITULASI BULANAN KEHADIRAN SISWA',
    `Periode: ${monthLabel}  |  Rombel: ${classLabel}  |  Total Siswa: ${studentRows.length}  |  Catatan Kehadiran: ${dailyRecordsCount}`,
    `Ringkasan: Hadir = ${totals.hadir}  |  Terlambat = ${totals.terlambat}  |  Izin = ${totals.izin}  |  Sakit = ${totals.sakit}  |  Alpa = ${totals.alpa}  |  Tingkat Kehadiran = ${avgPct}%`
  );

  if (classRows.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(10, 61, 145);
    doc.text('A. REKAPITULASI PER ROMBONGAN BELAJAR (ROMBEL)', 14, 53);

    autoTable(doc, {
      startY: 56,
      head: [
        [
          'No',
          'Rombel',
          'Wali Kelas',
          'Siswa Aktif',
          'Hadir',
          'Terlambat',
          'Izin',
          'Sakit',
          'Alpa',
          '% Hadir',
        ],
      ],
      body: classRows.map((c, idx) => [
        String(idx + 1),
        c.cls.name,
        c.cls.homeroomTeacherName || '-',
        String(c.studentCount),
        String(c.hadir),
        String(c.terlambat),
        String(c.izin),
        String(c.sakit),
        String(c.alpa),
        `${c.pct}%`,
      ]),
      styles: { fontSize: 8.5, cellPadding: 2.1 },
      headStyles: { fillColor: [10, 61, 145], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right', fontStyle: 'bold' },
      },
    });
  }

  const prevY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 50;
  let nextStartY = classRows.length > 0 ? prevY + 10 : 54;
  if (classRows.length > 0 && nextStartY > 165) {
    doc.addPage();
    nextStartY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(10, 61, 145);
  doc.text(
    classRows.length > 0
      ? 'B. REKAPITULASI KEHADIRAN PER SISWA'
      : 'REKAPITULASI KEHADIRAN PER SISWA',
    14,
    nextStartY - 2
  );

  const studentTableBody =
    studentRows.length > 0
      ? studentRows.map((r, idx) => [
          String(idx + 1),
          r.student.nis,
          r.student.fullName,
          r.student.className,
          String(r.hadir),
          String(r.terlambat),
          String(r.izin),
          String(r.sakit),
          String(r.alpa),
          String(r.total),
          `${r.pct}%`,
        ])
      : [['-', '-', 'Belum ada data siswa aktif untuk filter ini', '-', '0', '0', '0', '0', '0', '0', '0%']];

  autoTable(doc, {
    startY: nextStartY + 1,
    head: [
      [
        'No',
        'NIS',
        'Nama Siswa',
        'Rombel',
        'Hadir',
        'Terlambat',
        'Izin',
        'Sakit',
        'Alpa',
        'Total',
        '% Kehadiran',
      ],
    ],
    body: studentTableBody,
    styles: { fontSize: 8.5, cellPadding: 2.1 },
    headStyles: { fillColor: [10, 61, 145], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 248, 255] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
      10: { halign: 'right', fontStyle: 'bold' },
    },
  });

  applyPdfSignatureAndFooters(doc, settings);

  const safeClass = classLabel.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Rekap_Bulanan_Absensi_Siswa_${safeClass}_${monthKey}.pdf`);
}

export interface MonthlyTeacherRecapRow {
  teacher: Teacher;
  hadir: number;
  terlambat: number;
  dinasLuar: number;
  izin: number;
  sakit: number;
  alpa: number;
  total: number;
  pct: number;
}

export function exportMonthlyTeacherRecapToPdf(options: {
  monthLabel: string;
  monthKey: string;
  categoryLabel: string;
  teacherRows: MonthlyTeacherRecapRow[];
  settings: AttendanceSettings;
  titleOverride?: string;
}): void {
  const { monthLabel, monthKey, categoryLabel, teacherRows, settings, titleOverride } = options;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const totals = teacherRows.reduce(
    (acc, r) => ({
      hadir: acc.hadir + r.hadir,
      terlambat: acc.terlambat + r.terlambat,
      dinasLuar: acc.dinasLuar + r.dinasLuar,
      izinSakit: acc.izinSakit + r.izin + r.sakit,
      alpa: acc.alpa + r.alpa,
      total: acc.total + r.total,
    }),
    { hadir: 0, terlambat: 0, dinasLuar: 0, izinSakit: 0, alpa: 0, total: 0 }
  );
  const avgPct =
    totals.total > 0
      ? Math.round(((totals.hadir + totals.terlambat + totals.dinasLuar) / totals.total) * 100)
      : 0;

  applyPdfLetterhead(
    doc,
    settings,
    titleOverride || 'LAPORAN REKAPITULASI BULANAN KEHADIRAN GURU & STAF',
    `Periode: ${monthLabel}  |  Kategori: ${categoryLabel}  |  Total Pendidik & Staf: ${teacherRows.length}`,
    `Ringkasan: Hadir = ${totals.hadir}  |  Terlambat = ${totals.terlambat}  |  Dinas Luar = ${totals.dinasLuar}  |  Izin/Sakit = ${totals.izinSakit}  |  Alpa = ${totals.alpa}  |  Kehadiran = ${avgPct}%`
  );

  const tableBody =
    teacherRows.length > 0
      ? teacherRows.map((r, idx) => [
          String(idx + 1),
          r.teacher.nip || '-',
          r.teacher.fullName,
          r.teacher.role.replace('_', ' '),
          r.teacher.className,
          String(r.hadir),
          String(r.terlambat),
          String(r.dinasLuar),
          String(r.izin + r.sakit),
          String(r.alpa),
          String(r.total),
          `${r.pct}%`,
        ])
      : [['-', '-', 'Belum ada data guru/staf aktif untuk filter ini', '-', '-', '0', '0', '0', '0', '0', '0', '0%']];

  autoTable(doc, {
    startY: 51,
    head: [
      [
        'No',
        'NIP',
        'Nama Guru / Staf',
        'Jabatan',
        'Rombel / Mapel',
        'Hadir',
        'Terlambat',
        'Dinas Luar',
        'Izin/Sakit',
        'Alpa',
        'Total',
        '% Hadir',
      ],
    ],
    body: tableBody,
    styles: { fontSize: 8.5, cellPadding: 2.1 },
    headStyles: { fillColor: [10, 61, 145], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 248, 255] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
      10: { halign: 'right' },
      11: { halign: 'right', fontStyle: 'bold' },
    },
  });

  applyPdfSignatureAndFooters(doc, settings);

  doc.save(`Rekap_Bulanan_Absensi_Guru_${monthKey}.pdf`);
}

// Render high-resolution QR Card PNG for Teacher / Staff
export async function renderTeacherQrPosterBlob(
  teacher: Teacher,
  schoolName = 'SDN ASEMROWO II/63 SURABAYA'
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 760;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0A3D91';
  ctx.fillRect(0, 0, canvas.width, 130);

  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(0, 130, canvas.width, 8);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(schoolName.toUpperCase(), canvas.width / 2, 55);

  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 15px Plus Jakarta Sans, sans-serif';
  ctx.fillText('ASRODUA SMART ATTENDANCE — QR ABSENSI GURU & STAF', canvas.width / 2, 92);

  const { qrToken: tokenPayload, qrCodeId } = resolveTeacherQrData(teacher);
  const qrDataUrl = await generateQrDataUrl(tokenPayload, 380);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
    img.src = qrDataUrl;
  });

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.strokeRect(105, 175, 390, 390);
  ctx.drawImage(img, 110, 180, 380, 380);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 22px Outfit, sans-serif';
  ctx.fillText(teacher.fullName.toUpperCase(), canvas.width / 2, 612);

  ctx.fillStyle = '#334155';
  ctx.font = '600 17px IBM Plex Mono, monospace';
  ctx.fillText(`NIP: ${teacher.nip || '-'}`, canvas.width / 2, 648);

  ctx.fillStyle = '#0A3D91';
  ctx.font = 'bold 18px Plus Jakarta Sans, sans-serif';
  ctx.fillText(`${teacher.role.replace('_', ' ')} • ${teacher.className}`, canvas.width / 2, 686);

  ctx.fillStyle = '#64748B';
  ctx.font = '13px IBM Plex Mono, monospace';
  ctx.fillText(`Token ID: ${qrCodeId}`, canvas.width / 2, 728);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Gagal membuat gambar PNG QR Guru'));
    }, 'image/png');
  });
}

export async function downloadTeacherQrPng(
  teacher: Teacher,
  schoolName = 'SDN ASEMROWO II/63 SURABAYA'
): Promise<void> {
  const blob = await renderTeacherQrPosterBlob(teacher, schoolName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = teacher.fullName.replace(/[^a-zA-Z0-9]/g, '_');
  a.download = `QR_Guru_${teacher.nip || teacher.id}_${safeName}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadBulkTeacherQrZip(
  teachers: Teacher[],
  zipLabel = 'Seluruh_Guru',
  schoolName = 'SDN ASEMROWO II/63 SURABAYA'
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder(`QR_Guru_ASRODUA_${zipLabel}`) || zip;

  for (const tch of teachers) {
    const blob = await renderTeacherQrPosterBlob(tch, schoolName);
    const safeName = tch.fullName.replace(/[^a-zA-Z0-9]/g, '_');
    const safeClass = (tch.className || 'Staf').replace(/[^a-zA-Z0-9]/g, '_');
    const safeNip = (tch.nip && tch.nip !== '-' ? tch.nip : tch.id).replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${safeClass}_${safeNip}_${safeName}.png`;
    folder.file(filename, blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `QR_Code_Guru_ASRODUA_${zipLabel}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface TeacherAttendanceExportOptions {
  records: TeacherAttendanceRecord[];
  unrecordedTeachers?: Teacher[];
  startDate: string;
  endDate: string;
  exportedBy: string;
  settings: AttendanceSettings;
}

export function exportTeacherAttendanceToExcel({
  records,
  unrecordedTeachers = [],
  startDate,
  endDate,
  exportedBy,
  settings,
}: TeacherAttendanceExportOptions): void {
  const sortedRecords = [...records].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.teacherName.localeCompare(b.teacherName)
  );

  interface TeacherExportRow {
    No: number;
    Tanggal: string;
    'Tahun Pelajaran': string;
    NIP: string;
    'Nama Guru / Staf': string;
    Jabatan: string;
    'Unit / Kelas Ampuan': string;
    'Status Kehadiran': string;
    'Jam Masuk': string;
    'Jam Pulang': string;
    Metode: string;
    Keterangan: string;
    'Diverifikasi Oleh': string;
  }

  const dataRows: TeacherExportRow[] = sortedRecords.map((r, idx) => ({
    No: idx + 1,
    Tanggal: r.date,
    'Tahun Pelajaran': r.academicYear || settings.activeAcademicYear,
    NIP: r.nip || '-',
    'Nama Guru / Staf': r.teacherName,
    Jabatan: r.role.replace('_', ' '),
    'Unit / Kelas Ampuan': r.className,
    'Status Kehadiran': r.status.replace('_', ' '),
    'Jam Masuk': r.checkInTime || '-',
    'Jam Pulang': r.checkOutTime || '-',
    Metode: r.session,
    Keterangan: r.notes || '-',
    'Diverifikasi Oleh': r.verifiedByName || '-',
  }));

  if (unrecordedTeachers.length > 0 && startDate === endDate) {
    unrecordedTeachers.forEach((t) => {
      dataRows.push({
        No: dataRows.length + 1,
        Tanggal: startDate,
        'Tahun Pelajaran': settings.activeAcademicYear,
        NIP: t.nip || '-',
        'Nama Guru / Staf': t.fullName,
        Jabatan: t.role.replace('_', ' '),
        'Unit / Kelas Ampuan': t.className,
        'Status Kehadiran': 'BELUM ABSEN',
        'Jam Masuk': '-',
        'Jam Pulang': '-',
        Metode: '-',
        Keterangan: 'Belum melakukan scan atau presensi mandiri',
        'Diverifikasi Oleh': '-',
      });
    });
  }

  const wsData = XLSX.utils.json_to_sheet(
    dataRows.length > 0
      ? dataRows
      : [
          {
            Info: `Tidak ada data absensi guru pada rentang ${startDate} s/d ${endDate}`,
          },
        ]
  );

  wsData['!cols'] = [
    { wch: 5 },
    { wch: 12 },
    { wch: 15 },
    { wch: 22 },
    { wch: 28 },
    { wch: 16 },
    { wch: 20 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 32 },
    { wch: 22 },
  ];

  const hadir = sortedRecords.filter((r) => r.status === 'HADIR').length;
  const terlambat = sortedRecords.filter((r) => r.status === 'TERLAMBAT').length;
  const izin = sortedRecords.filter((r) => r.status === 'IZIN').length;
  const sakit = sortedRecords.filter((r) => r.status === 'SAKIT').length;
  const dinasLuar = sortedRecords.filter((r) => r.status === 'DINAS_LUAR').length;
  const alpa = sortedRecords.filter((r) => r.status === 'ALPA').length;

  const summaryRows = [
    { Keterangan: 'Sekolah', Nilai: settings.schoolName },
    { Keterangan: 'NPSN', Nilai: settings.npsn },
    { Keterangan: 'Tahun Pelajaran', Nilai: `${settings.activeAcademicYear} (${settings.semester})` },
    { Keterangan: 'Rentang Tanggal', Nilai: startDate === endDate ? startDate : `${startDate} s/d ${endDate}` },
    { Keterangan: 'Diekspor Oleh', Nilai: exportedBy },
    { Keterangan: 'Total Catatan Presensi Guru', Nilai: String(sortedRecords.length) },
    { Keterangan: 'Hadir Tepat Waktu', Nilai: String(hadir) },
    { Keterangan: 'Terlambat', Nilai: String(terlambat) },
    { Keterangan: 'Dinas Luar', Nilai: String(dinasLuar) },
    { Keterangan: 'Izin', Nilai: String(izin) },
    { Keterangan: 'Sakit', Nilai: String(sakit) },
    { Keterangan: 'Alpa', Nilai: String(alpa) },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 45 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsData, 'Absensi_Guru');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

  const datePart = startDate === endDate ? startDate : `${startDate}_sd_${endDate}`;
  XLSX.writeFile(wb, `Absensi_Guru_SDN_Asemrowo_II_63_${datePart}.xlsx`);
}

export function exportTeacherAttendanceToPdf(
  records: TeacherAttendanceRecord[],
  unrecordedTeachers: Teacher[],
  reportTitle: string,
  filterSubtitle: string,
  settings: AttendanceSettings,
  fileName?: string
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const hadir = records.filter((r) => r.status === 'HADIR').length;
  const terlambat = records.filter((r) => r.status === 'TERLAMBAT').length;
  const dinasLuar = records.filter((r) => r.status === 'DINAS_LUAR').length;
  const izin = records.filter((r) => r.status === 'IZIN').length;
  const sakit = records.filter((r) => r.status === 'SAKIT').length;
  const alpa = records.filter((r) => r.status === 'ALPA').length;

  applyPdfLetterhead(
    doc,
    settings,
    reportTitle,
    filterSubtitle,
    `Ringkasan: Tercatat = ${records.length}  |  Hadir = ${hadir}  |  Terlambat = ${terlambat}  |  Dinas Luar = ${dinasLuar}  |  Izin = ${izin}  |  Sakit = ${sakit}  |  Alpa = ${alpa}  |  Belum Absen = ${unrecordedTeachers.length}`
  );

  const tableRows: string[][] = records.map((r, i) => [
    String(i + 1),
    r.date,
    r.nip || '-',
    r.teacherName,
    r.role.replace('_', ' '),
    r.className,
    r.status.replace('_', ' '),
    r.checkInTime || '-',
    r.checkOutTime || '-',
    r.notes || '-',
  ]);

  unrecordedTeachers.forEach((t) => {
    tableRows.push([
      String(tableRows.length + 1),
      '-',
      t.nip || '-',
      t.fullName,
      t.role.replace('_', ' '),
      t.className,
      'BELUM ABSEN',
      '-',
      '-',
      'Belum melakukan presensi',
    ]);
  });

  if (tableRows.length === 0) {
    tableRows.push([
      '-',
      '-',
      '-',
      'Belum ada data presensi guru/staf pada periode ini',
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
    ]);
  }

  autoTable(doc, {
    startY: 50,
    head: [
      [
        'No',
        'Tanggal',
        'NIP',
        'Nama Guru / Staf',
        'Jabatan',
        'Kelas / Unit',
        'Status',
        'Jam Masuk',
        'Jam Pulang',
        'Keterangan',
      ],
    ],
    body: tableRows,
    styles: {
      fontSize: 8.5,
      cellPadding: 2.2,
    },
    headStyles: {
      fillColor: [10, 61, 145],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 248, 255],
    },
  });

  applyPdfSignatureAndFooters(doc, settings);

  doc.save(
    fileName || `Laporan_Absensi_Guru_SDN_Asemrowo_II_63_${new Date().toISOString().slice(0, 10)}.pdf`
  );
}

// Export Printable A4 Sheet of CR-80 (85.6mm x 54mm) Student QR ID Cards (8 Cards per Page)
export async function exportStudentIdCardsToPdf(
  students: Student[],
  settings: AttendanceSettings,
  scopeLabel = 'Seluruh_Siswa',
  tagline = 'Scan, Verify, Attend!'
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cardW = 86;
  const cardH = 54;
  const marginX = 14;
  const marginY = 20;
  const gapX = 10;
  const gapY = 8;

  const drawPageHeader = (pageNum: number, totalPages: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(10, 61, 145);
    doc.text(
      `LEMBAR CETAK KARTU PELAJAR QR CODE (CR-80) — ${settings.schoolName.toUpperCase()}`,
      105,
      11,
      { align: 'center' }
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Filter: ${scopeLabel.replace(/_/g, ' ')}  |  Ukuran Standar ID Card: 86mm x 54mm  |  Halaman ${pageNum} dari ${totalPages}`,
      105,
      15.5,
      { align: 'center' }
    );
  };

  const totalPages = Math.max(1, Math.ceil(students.length / 8));

  for (let i = 0; i < students.length; i++) {
    const std = students[i];
    const indexOnPage = i % 8;
    if (i > 0 && indexOnPage === 0) {
      doc.addPage();
    }
    if (indexOnPage === 0) {
      drawPageHeader(Math.floor(i / 8) + 1, totalPages);
    }

    const col = indexOnPage % 2;
    const row = Math.floor(indexOnPage / 2);
    const x = marginX + col * (cardW + gapX);
    const y = marginY + row * (cardH + gapY);

    // Card Outer Border
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'FD');

    // Top Header Banner (#0A3D91)
    doc.setFillColor(10, 61, 145);
    doc.rect(x, y, cardW, 13, 'F');

    // Gold Accent Line (#D4AF37)
    doc.setFillColor(212, 175, 55);
    doc.rect(x, y + 13, cardW, 1.2, 'F');

    // Header Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(212, 175, 55);
    doc.text('KARTU PELAJAR SMART ATTENDANCE', x + 3.5, y + 4.3);

    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(settings.schoolName.toUpperCase().slice(0, 34), x + 3.5, y + 8.3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(219, 234, 254);
    doc.text(`Dinas Pendidikan Kota Surabaya · NPSN ${settings.npsn}`, x + 3.5, y + 11.5);

    // Avatar / Photo Box
    doc.setFillColor(245, 248, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.roundedRect(x + 3.5, y + 17, 15, 20, 1.5, 1.5, 'FD');

    const initials = std.fullName
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0] || '')
      .join('')
      .toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(10, 61, 145);
    doc.text(initials || 'S', x + 11, y + 27, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.8);
    doc.setTextColor(148, 163, 184);
    doc.text('FOTO 3x4', x + 11, y + 32, { align: 'center' });

    // Student Identity
    const textX = x + 20.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(15, 23, 42);
    const wrappedName = doc.splitTextToSize(std.fullName, 39).slice(0, 2);
    doc.text(wrappedName, textX, y + 19.8);

    const metaStartY = wrappedName.length > 1 ? y + 26.5 : y + 24;
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`NIS : ${std.nis}`, textX, metaStartY);
    doc.setFont('courier', 'normal');
    doc.text(`NISN: ${std.nisn}`, textX, metaStartY + 3.6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(10, 61, 145);
    doc.text(std.className, textX, metaStartY + 7.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(100, 116, 139);
    doc.text((std.birthPlaceDate || '').slice(0, 28), textX, metaStartY + 11);

    // QR Code Image
    const qrDataUrl = await generateQrDataUrl(std.qrToken, 240);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x + cardW - 23.5, y + 16.5, 20, 20, 1.2, 1.2, 'S');
    doc.addImage(qrDataUrl, 'PNG', x + cardW - 23, y + 17, 19, 19);

    doc.setFont('courier', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${std.nis}·${std.gender}`, x + cardW - 13.5, y + 39.5, { align: 'center' });

    // Footer Strip
    doc.setFillColor(245, 248, 255);
    doc.rect(x + 0.3, y + cardH - 6.5, cardW - 0.6, 6.2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(x, y + cardH - 6.5, x + cardW, y + cardH - 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(100, 116, 139);
    doc.text(tagline, x + 3.5, y + cardH - 2.5);
    doc.setFont('courier', 'normal');
    doc.text(`TP ${settings.activeAcademicYear}`, x + cardW - 3.5, y + cardH - 2.5, {
      align: 'right',
    });
  }

  const safeLabel = scopeLabel.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Kartu_Pelajar_QR_${safeLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// Export Printable A4 Sheet of CR-80 (85.6mm x 54mm) Teacher & Staff QR ID Cards (8 Cards per Page)
export async function exportTeacherIdCardsToPdf(
  teachers: Teacher[],
  settings: AttendanceSettings,
  scopeLabel = 'Seluruh_Guru_dan_Staf',
  tagline = 'Scan, Verify, Attend!'
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cardW = 86;
  const cardH = 54;
  const marginX = 14;
  const marginY = 20;
  const gapX = 10;
  const gapY = 8;

  const drawPageHeader = (pageNum: number, totalPages: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(10, 61, 145);
    doc.text(
      `LEMBAR CETAK KARTU ID GURU & STAF QR CODE (CR-80) — ${settings.schoolName.toUpperCase()}`,
      105,
      11,
      { align: 'center' }
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Kategori: ${scopeLabel.replace(/_/g, ' ')}  |  Ukuran Standar ID Card: 86mm x 54mm  |  Halaman ${pageNum} dari ${totalPages}`,
      105,
      15.5,
      { align: 'center' }
    );
  };

  const totalPages = Math.max(1, Math.ceil(teachers.length / 8));

  for (let i = 0; i < teachers.length; i++) {
    const tch = teachers[i];
    const indexOnPage = i % 8;
    if (i > 0 && indexOnPage === 0) {
      doc.addPage();
    }
    if (indexOnPage === 0) {
      drawPageHeader(Math.floor(i / 8) + 1, totalPages);
    }

    const col = indexOnPage % 2;
    const row = Math.floor(indexOnPage / 2);
    const x = marginX + col * (cardW + gapX);
    const y = marginY + row * (cardH + gapY);

    // Card Outer Border
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'FD');

    // Top Header Banner (#0A3D91)
    doc.setFillColor(10, 61, 145);
    doc.rect(x, y, cardW, 13, 'F');

    // Gold Accent Line (#D4AF37)
    doc.setFillColor(212, 175, 55);
    doc.rect(x, y + 13, cardW, 1.2, 'F');

    // Header Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(212, 175, 55);
    doc.text('KARTU PRESENSI GURU & TENAGA KEPENDIDIKAN', x + 3.5, y + 4.3);

    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(settings.schoolName.toUpperCase().slice(0, 34), x + 3.5, y + 8.3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(219, 234, 254);
    doc.text(`Dinas Pendidikan Kota Surabaya · NPSN ${settings.npsn}`, x + 3.5, y + 11.5);

    // Avatar Box
    doc.setFillColor(245, 248, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.roundedRect(x + 3.5, y + 17, 15, 20, 1.5, 1.5, 'FD');

    const initials = tch.fullName
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0] || '')
      .join('')
      .toUpperCase();
    const isMapel =
      tch.classId.startsWith('MAPEL_') || tch.className.toLowerCase().includes('mapel');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(10, 61, 145);
    doc.text(initials || 'G', x + 11, y + 27, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.6);
    doc.setTextColor(148, 163, 184);
    doc.text(isMapel ? 'MAPEL' : tch.role === 'GURU' ? 'ROMBEL' : 'STAF', x + 11, y + 32, {
      align: 'center',
    });

    // Teacher Identity
    const textX = x + 20.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(15, 23, 42);
    const wrappedName = doc.splitTextToSize(tch.fullName, 39).slice(0, 2);
    doc.text(wrappedName, textX, y + 19.8);

    const metaStartY = wrappedName.length > 1 ? y + 26.5 : y + 24;
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(51, 65, 85);
    doc.text(`NIP: ${(tch.nip || '-').slice(0, 20)}`, textX, metaStartY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(10, 61, 145);
    doc.text((tch.className || '-').slice(0, 25), textX, metaStartY + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(100, 116, 139);
    const roleLabel = isMapel
      ? 'Guru Mata Pelajaran'
      : tch.role === 'GURU'
      ? 'Wali Kelas Rombel'
      : 'Tenaga Kependidikan';
    doc.text(roleLabel, textX, metaStartY + 8.2);

    // QR Code Image
    const { qrToken, qrCodeId } = resolveTeacherQrData(tch);
    const qrDataUrl = await generateQrDataUrl(qrToken, 240);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x + cardW - 23.5, y + 16.5, 20, 20, 1.2, 1.2, 'S');
    doc.addImage(qrDataUrl, 'PNG', x + cardW - 23, y + 17, 19, 19);

    doc.setFont('courier', 'normal');
    doc.setFontSize(4.6);
    doc.setTextColor(100, 116, 139);
    doc.text(qrCodeId.slice(0, 18), x + cardW - 13.5, y + 39.5, { align: 'center' });

    // Footer Strip
    doc.setFillColor(245, 248, 255);
    doc.rect(x + 0.3, y + cardH - 6.5, cardW - 0.6, 6.2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(x, y + cardH - 6.5, x + cardW, y + cardH - 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(100, 116, 139);
    doc.text(tagline, x + 3.5, y + cardH - 2.5);
    doc.setFont('courier', 'normal');
    doc.text(`TP ${settings.activeAcademicYear}`, x + cardW - 3.5, y + cardH - 2.5, {
      align: 'right',
    });
  }

  const safeLabel = scopeLabel.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Kartu_ID_Guru_QR_${safeLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
}


