import QRCode from 'qrcode';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AttendanceRecord,
  AttendanceSettings,
  Student,
  Teacher,
  TeacherAttendanceRecord,
} from '../types';
import {
  formatIndonesianDate,
  getTeacherQrCodeId,
  getTeacherQrToken,
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

// Export Attendance Report to Official School PDF
export function exportAttendanceToPdf(
  records: AttendanceRecord[],
  reportTitle: string,
  filterSubtitle: string,
  settings: AttendanceSettings
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Official Letterhead Header
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

  // Summary Counts
  const hadir = records.filter((r) => r.status === 'HADIR').length;
  const terlambat = records.filter((r) => r.status === 'TERLAMBAT').length;
  const izin = records.filter((r) => r.status === 'IZIN').length;
  const sakit = records.filter((r) => r.status === 'SAKIT').length;
  const alpa = records.filter((r) => r.status === 'ALPA').length;

  doc.text(
    `Ringkasan: Total Data = ${records.length}  |  Hadir = ${hadir}  |  Terlambat = ${terlambat}  |  Izin = ${izin}  |  Sakit = ${sakit}  |  Alpa = ${alpa}`,
    14,
    46
  );

  const tableRows = records.map((r, i) => [
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
  ]);

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

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 140;
  const signY = Math.min(finalY + 12, 175);

  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Surabaya, ${formatIndonesianDate(new Date().toISOString().slice(0, 10))}`,
    225,
    signY
  );
  doc.text('Mengetahui, Kepala Sekolah', 225, signY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.principalName, 225, signY + 23);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${settings.principalNip}`, 225, signY + 28);

  doc.save(`Laporan_Absensi_SDN_Asemrowo_II_63_${new Date().toISOString().slice(0, 10)}.pdf`);
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

  const tokenPayload = getTeacherQrToken(teacher.id, teacher.nip);
  const qrCodeId = getTeacherQrCodeId(teacher.id, teacher.nip);
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
  settings: AttendanceSettings
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

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

  const hadir = records.filter((r) => r.status === 'HADIR').length;
  const terlambat = records.filter((r) => r.status === 'TERLAMBAT').length;
  const dinasLuar = records.filter((r) => r.status === 'DINAS_LUAR').length;
  const izin = records.filter((r) => r.status === 'IZIN').length;
  const sakit = records.filter((r) => r.status === 'SAKIT').length;
  const alpa = records.filter((r) => r.status === 'ALPA').length;

  doc.text(
    `Ringkasan: Tercatat = ${records.length}  |  Hadir = ${hadir}  |  Terlambat = ${terlambat}  |  Dinas Luar = ${dinasLuar}  |  Izin = ${izin}  |  Sakit = ${sakit}  |  Alpa = ${alpa}  |  Belum Absen = ${unrecordedTeachers.length}`,
    14,
    46
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

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 140;
  const signY = Math.min(finalY + 12, 175);

  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Surabaya, ${formatIndonesianDate(new Date().toISOString().slice(0, 10))}`,
    225,
    signY
  );
  doc.text('Mengetahui, Kepala Sekolah', 225, signY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.principalName, 225, signY + 23);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${settings.principalNip}`, 225, signY + 28);

  doc.save(`Laporan_Absensi_Guru_SDN_Asemrowo_II_63_${new Date().toISOString().slice(0, 10)}.pdf`);
}

