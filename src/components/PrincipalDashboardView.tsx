import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Award,
  Mail,
  Users,
  UserCheck,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  History,
  Megaphone,
  Edit3,
  Check,
  X,
  ArrowUpRight,
  GraduationCap,
  ShieldCheck,
  Pin,
} from 'lucide-react';
import {
  Announcement,
  AttendanceRecord,
  AttendanceSettings,
  AuditLog,
  NotificationLog,
  PageId,
  SchoolClass,
  Student,
  Teacher,
  TeacherAttendanceRecord,
  UserProfile,
} from '../types';
import { formatIndonesianDate, getTodayDateString } from '../firebase';
import {
  exportAttendanceToPdf,
  exportFullAttendanceRangeToExcel,
} from '../utils/exportUtils';
import { isSubjectTeacher } from './TeachersClassesView';

interface PrincipalDashboardViewProps {
  userProfile: UserProfile;
  students: Student[];
  teachers: Teacher[];
  classes: SchoolClass[];
  attendance: AttendanceRecord[];
  teacherAttendance: TeacherAttendanceRecord[];
  notificationLogs: NotificationLog[];
  auditLogs: AuditLog[];
  announcements: Announcement[];
  settings: AttendanceSettings;
  onNavigate: (page: PageId) => void;
  onSavePrincipalConfig: (
    principalName: string,
    principalNip: string,
    principalEmail: string
  ) => Promise<void>;
}

export const PrincipalDashboardView: React.FC<PrincipalDashboardViewProps> = ({
  userProfile,
  students,
  teachers,
  classes,
  attendance,
  teacherAttendance,
  notificationLogs,
  auditLogs,
  announcements,
  settings,
  onNavigate,
  onSavePrincipalConfig,
}) => {
  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [principalName, setPrincipalName] = useState(settings.principalName);
  const [principalNip, setPrincipalNip] = useState(settings.principalNip);
  const [principalEmail, setPrincipalEmail] = useState(settings.principalEmail || '');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    setPrincipalName(settings.principalName);
    setPrincipalNip(settings.principalNip);
    setPrincipalEmail(settings.principalEmail || '');
  }, [settings]);

  const canManagePrincipalEmail =
    userProfile.role === 'SUPER_ADMIN' || userProfile.role === 'ADMIN_SEKOLAH';

  const activeStudents = useMemo(
    () => students.filter((s) => s.status === 'AKTIF'),
    [students]
  );

  const activeTeachers = useMemo(
    () => teachers.filter((t) => t.status === 'AKTIF'),
    [teachers]
  );

  const dateAttendance = useMemo(
    () => attendance.filter((a) => a.date === selectedDate),
    [attendance, selectedDate]
  );

  const dateTeacherAttendance = useMemo(
    () => teacherAttendance.filter((r) => r.date === selectedDate),
    [teacherAttendance, selectedDate]
  );

  const executiveStats = useMemo(() => {
    const totalStudents = activeStudents.length;
    const hadir = dateAttendance.filter((a) => a.status === 'HADIR').length;
    const terlambat = dateAttendance.filter((a) => a.status === 'TERLAMBAT').length;
    const izin = dateAttendance.filter((a) => a.status === 'IZIN').length;
    const sakit = dateAttendance.filter((a) => a.status === 'SAKIT').length;
    const alpa = dateAttendance.filter((a) => a.status === 'ALPA').length;
    const recordedIds = new Set(dateAttendance.map((a) => a.studentId));
    const belumScan = activeStudents.filter((s) => !recordedIds.has(s.id)).length;

    const totalPresent = hadir + terlambat;
    const attendanceRate =
      totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 1000) / 10 : 0;
    const onTimeRate =
      totalPresent > 0 ? Math.round((hadir / totalPresent) * 1000) / 10 : 0;
    const attentionCount = alpa + terlambat + belumScan;

    const dateNotifs = notificationLogs.filter((n) => n.date === selectedDate);
    const waDelivered = dateNotifs.filter(
      (n) => n.status === 'SENT' || n.status === 'DELIVERED'
    ).length;
    const waRate =
      dateNotifs.length > 0 ? Math.round((waDelivered / dateNotifs.length) * 100) : 100;

    const tHadir = dateTeacherAttendance.filter((r) => r.status === 'HADIR').length;
    const tLate = dateTeacherAttendance.filter((r) => r.status === 'TERLAMBAT').length;
    const tDinas = dateTeacherAttendance.filter((r) => r.status === 'DINAS_LUAR').length;
    const tIzinSakit = dateTeacherAttendance.filter(
      (r) => r.status === 'IZIN' || r.status === 'SAKIT'
    ).length;
    const tAlpa = dateTeacherAttendance.filter((r) => r.status === 'ALPA').length;
    const tRecordedIds = new Set(dateTeacherAttendance.map((r) => r.teacherId));
    const tBelum = activeTeachers.filter((t) => !tRecordedIds.has(t.id)).length;
    const tPresent = tHadir + tLate + tDinas;
    const teacherRate =
      activeTeachers.length > 0
        ? Math.round((tPresent / activeTeachers.length) * 1000) / 10
        : 0;
    const waliCount = activeTeachers.filter((t) => t.role === 'GURU' && !isSubjectTeacher(t)).length;
    const mapelCount = activeTeachers.filter((t) => isSubjectTeacher(t)).length;

    return {
      totalStudents,
      hadir,
      terlambat,
      izin,
      sakit,
      alpa,
      belumScan,
      totalPresent,
      attendanceRate,
      onTimeRate,
      attentionCount,
      dateNotifsCount: dateNotifs.length,
      waDelivered,
      waRate,
      tHadir,
      tLate,
      tDinas,
      tIzinSakit,
      tAlpa,
      tBelum,
      tPresent,
      teacherRate,
      waliCount,
      mapelCount,
    };
  }, [activeStudents, activeTeachers, dateAttendance, dateTeacherAttendance, notificationLogs, selectedDate]);

  const classPerformance = useMemo(() => {
    return classes.map((cls) => {
      const clsStudents = activeStudents.filter((s) => s.classId === cls.id);
      const clsAttendance = dateAttendance.filter((a) => a.classId === cls.id);
      const hadir = clsAttendance.filter((a) => a.status === 'HADIR').length;
      const terlambat = clsAttendance.filter((a) => a.status === 'TERLAMBAT').length;
      const izinSakit = clsAttendance.filter(
        (a) => a.status === 'IZIN' || a.status === 'SAKIT'
      ).length;
      const alpa = clsAttendance.filter((a) => a.status === 'ALPA').length;
      const recordedCount = hadir + terlambat + izinSakit + alpa;
      const belumScan = Math.max(0, clsStudents.length - recordedCount);
      const rate =
        clsStudents.length > 0
          ? Math.round(((hadir + terlambat) / clsStudents.length) * 1000) / 10
          : 0;

      const evaluation =
        clsStudents.length === 0
          ? 'Belum Ada Siswa'
          : rate >= 95
          ? 'Optimal'
          : rate >= 85
          ? 'Pantau'
          : 'Perlu Pembinaan';

      return {
        id: cls.id,
        name: cls.name,
        homeroomTeacherName: cls.homeroomTeacherName,
        total: clsStudents.length,
        Hadir: hadir,
        Terlambat: terlambat,
        'Izin/Sakit': izinSakit,
        Alpa: alpa,
        'Belum Scan': belumScan,
        rate,
        evaluation,
      };
    });
  }, [classes, activeStudents, dateAttendance]);

  const statusDistributionData = useMemo(
    () => [
      { kategori: 'Hadir', Jumlah: executiveStats.hadir },
      { kategori: 'Terlambat', Jumlah: executiveStats.terlambat },
      { kategori: 'Izin', Jumlah: executiveStats.izin },
      { kategori: 'Sakit', Jumlah: executiveStats.sakit },
      { kategori: 'Alpa', Jumlah: executiveStats.alpa },
      { kategori: 'Belum Scan', Jumlah: executiveStats.belumScan },
    ],
    [executiveStats]
  );

  const attentionStudents = useMemo(() => {
    const recMap = new Map<string, AttendanceRecord>();
    dateAttendance.forEach((r) => recMap.set(r.studentId, r));

    const flagged: Array<{
      student: Student;
      statusLabel: string;
      detail: string;
      severity: 'HIGH' | 'MEDIUM' | 'INFO';
    }> = [];

    activeStudents.forEach((std) => {
      const rec = recMap.get(std.id);
      if (!rec) {
        flagged.push({
          student: std,
          statusLabel: 'BELUM SCAN',
          detail: 'Belum melakukan scan QR atau verifikasi wali kelas',
          severity: 'MEDIUM',
        });
      } else if (rec.status === 'ALPA') {
        flagged.push({
          student: std,
          statusLabel: 'ALPA',
          detail: rec.notes || 'Tidak hadir tanpa keterangan',
          severity: 'HIGH',
        });
      } else if (rec.status === 'TERLAMBAT') {
        flagged.push({
          student: std,
          statusLabel: 'TERLAMBAT',
          detail: `Scan masuk pukul ${rec.checkInTime || '-'} WIB`,
          severity: 'INFO',
        });
      }
    });

    const priority: Record<'HIGH' | 'MEDIUM' | 'INFO', number> = {
      HIGH: 0,
      MEDIUM: 1,
      INFO: 2,
    };
    return flagged.sort((a, b) => priority[a.severity] - priority[b.severity]);
  }, [activeStudents, dateAttendance]);

  const unrecordedStudentsForExport = useMemo(() => {
    const recordedIds = new Set(dateAttendance.map((a) => a.studentId));
    return activeStudents.filter((s) => !recordedIds.has(s.id));
  }, [activeStudents, dateAttendance]);

  const visibleAnnouncements = useMemo(
    () =>
      announcements
        .filter((a) => a.isPublished)
        .sort(
          (a, b) =>
            Number(b.isPinned) - Number(a.isPinned) ||
            b.publishDate.localeCompare(a.publishDate)
        )
        .slice(0, 4),
    [announcements]
  );

  const handleSaveConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManagePrincipalEmail) return;
    setIsSavingConfig(true);
    try {
      await onSavePrincipalConfig(
        principalName.trim(),
        principalNip.trim(),
        principalEmail.trim().toLowerCase()
      );
      setIsConfigOpen(false);
      setFeedbackMsg(
        `Email Kepala Sekolah (${principalEmail.trim().toLowerCase()}) berhasil diintegrasikan ke Firestore.`
      );
      setTimeout(() => setFeedbackMsg(null), 5000);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleExportPdfExecutive = () => {
    exportAttendanceToPdf(
      dateAttendance,
      `Laporan Eksekutif Kehadiran Kepala Sekolah — ${formatIndonesianDate(selectedDate)}`,
      `Kelas: Seluruh Rombel (1A–6B) · Total Siswa Aktif: ${activeStudents.length} · Tingkat Kehadiran: ${executiveStats.attendanceRate}%`,
      settings
    );
  };

  const handleExportExcelExecutive = () => {
    exportFullAttendanceRangeToExcel({
      records: dateAttendance,
      unrecordedStudents: unrecordedStudentsForExport,
      startDate: selectedDate,
      endDate: selectedDate,
      classLabel: 'Seluruh Sekolah',
      exportedBy: `${userProfile.name} (${userProfile.role})`,
      settings,
    });
  };

  return (
    <div className="space-y-6">
      {/* Executive Header & Firestore Principal Email Card */}
      <div className="bg-[#0A3D91] text-white rounded-2xl p-6 border border-[#082f70] flex flex-col xl:flex-row xl:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-blue-200">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#D4AF37]">
              <Award className="w-4 h-4" />
              DASHBOARD EKSEKUTIF KEPALA SEKOLAH
            </span>
            <span aria-hidden="true">·</span>
            <span>{settings.schoolName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              TP {settings.activeAcademicYear} ({settings.semester})
            </span>
          </div>

          <h1 className="text-xl lg:text-2xl font-bold font-display text-white">
            Monitoring Mutu Kehadiran & Kedisiplinan Sekolah
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-blue-100 pt-1">
            <span>
              Kepala Sekolah: <strong className="text-white">{settings.principalName}</strong> (NIP{' '}
              <span className="font-mono tabular-nums">{settings.principalNip}</span>)
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#D4AF37] font-medium">
              <Mail className="w-3.5 h-3.5" />
              <span>
                Email Integrasi Firestore:{' '}
                <strong className="font-mono">
                  {settings.principalEmail || 'Belum diatur'}
                </strong>
              </span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <input
            type="date"
            aria-label="Tanggal monitoring kepala sekolah"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 text-xs font-mono tabular-nums bg-white text-slate-900 rounded-lg border border-blue-200"
          />

          <button
            type="button"
            onClick={handleExportExcelExecutive}
            className="px-3.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#D4AF37]" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdfExecutive}
            className="px-3.5 py-2 text-xs font-semibold bg-[#D4AF37] hover:bg-amber-400 text-[#0A3D91] rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Laporan PDF</span>
          </button>

          {canManagePrincipalEmail && (
            <button
              type="button"
              onClick={() => setIsConfigOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-white text-[#0A3D91] hover:bg-blue-50 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Atur Email Kepsek</span>
            </button>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
          <span className="font-medium">{feedbackMsg}</span>
          <button onClick={() => setFeedbackMsg(null)} className="font-bold cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {/* Executive 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Tingkat Kehadiran Sekolah</span>
            <Users className="w-4 h-4 text-[#0A3D91]" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-3xl font-bold font-mono tabular-nums text-[#0A3D91]">
              {executiveStats.attendanceRate}%
            </p>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              Target ≥ 95%
            </span>
          </div>
          <div className="mt-3 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0A3D91] rounded-full transition-all"
              style={{ width: `${Math.min(100, executiveStats.attendanceRate)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-mono tabular-nums">
            {executiveStats.totalPresent} dari {executiveStats.totalStudents} siswa aktif hadir
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Ketepatan Waktu Masuk</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-3xl font-bold font-mono tabular-nums text-emerald-700">
              {executiveStats.onTimeRate}%
            </p>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              Batas {settings.checkInDeadline}
            </span>
          </div>
          <div className="mt-3 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all"
              style={{ width: `${Math.min(100, executiveStats.onTimeRate)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-mono tabular-nums">
            {executiveStats.hadir} tepat waktu · {executiveStats.terlambat} terlambat
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Siswa Perlu Tindak Lanjut</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-3xl font-bold font-mono tabular-nums text-amber-700">
            {executiveStats.attentionCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-3 font-mono tabular-nums">
            Alpa: <strong className="text-rose-700">{executiveStats.alpa}</strong> · Terlambat:{' '}
            <strong className="text-amber-700">{executiveStats.terlambat}</strong> · Belum Scan:{' '}
            <strong className="text-slate-700">{executiveStats.belumScan}</strong>
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Kehadiran Guru &amp; Mapel</span>
            <GraduationCap className="w-4 h-4 text-[#0A3D91]" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {executiveStats.teacherRate}%
            </p>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {classes.length} Rombel · {activeTeachers.length} Guru
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 font-mono tabular-nums">
            Hadir: <strong className="text-emerald-700">{executiveStats.tHadir}</strong> · Dinas Luar:{' '}
            <strong className="text-[#0A3D91]">{executiveStats.tDinas}</strong> · Terlambat:{' '}
            <strong className="text-amber-700">{executiveStats.tLate}</strong>
          </p>
        </div>
      </div>

      {/* Executive Teacher & Subject Teacher Supervision Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-[#0A3D91]" />
            <h2 className="text-sm font-bold font-display text-slate-900">
              Supervisi Kehadiran Guru Kelas ({executiveStats.waliCount} Rombel) &amp; Guru Mata Pelajaran ({executiveStats.mapelCount} Mapel)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Hadir Tepat: <strong>{executiveStats.tHadir}</strong> · Terlambat: <strong>{executiveStats.tLate}</strong> · Dinas Luar/KKG: <strong>{executiveStats.tDinas}</strong> · Izin/Sakit: <strong>{executiveStats.tIzinSakit}</strong> · Belum Absen: <strong>{executiveStats.tBelum}</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('teacher-attendance')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Buka Presensi Guru &amp; Mapel</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('classes')}
            className="px-3.5 py-2 text-xs font-semibold text-[#0A3D91] bg-[#F5F8FF] border border-blue-200 hover:bg-blue-100 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <span>Lihat 12 Rombel &amp; Mapel</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold font-display text-slate-900">
                Perbandingan Kehadiran Per Kelas
              </h2>
              <p className="text-xs text-slate-500">
                Evaluasi distribusi hadir, terlambat, izin/sakit, dan belum scan pada{' '}
                {formatIndonesianDate(selectedDate)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('attendance-reports')}
              className="text-xs font-semibold text-[#0A3D91] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Rekap Lengkap</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={classPerformance}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Hadir" stackId="a" fill="#0A3D91" />
                <Bar dataKey="Terlambat" stackId="a" fill="#D4AF37" />
                <Bar dataKey="Izin/Sakit" stackId="a" fill="#4DA8FF" />
                <Bar dataKey="Belum Scan" stackId="a" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold font-display text-slate-900">
                Rekap Kategori Kehadiran Sekolah
              </h2>
              <p className="text-xs text-slate-500">
                Total {executiveStats.totalStudents} siswa aktif terdaftar
              </p>
            </div>
            <Clock className="w-4 h-4 text-[#0A3D91]" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statusDistributionData}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="kategori" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Jumlah" fill="#0A3D91" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Class Performance & Homeroom Supervision Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold font-display text-slate-900">
              Evaluasi Kinerja Kehadiran Per Rombongan Belajar &amp; Wali Kelas
            </h2>
            <p className="text-xs text-slate-500">
              Pemantauan capaian target kehadiran harian setiap kelas oleh Kepala Sekolah
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => onNavigate('teachers')}
              className="font-semibold text-[#0A3D91] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Lihat Data Guru</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('students')}
              className="font-semibold text-[#0A3D91] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Lihat Data Siswa</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F5F8FF] font-semibold text-slate-600">
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4">Wali Kelas</th>
                <th className="py-3 px-4 text-right">Siswa</th>
                <th className="py-3 px-4 text-right">Hadir</th>
                <th className="py-3 px-4 text-right">Terlambat</th>
                <th className="py-3 px-4 text-right">Izin/Sakit</th>
                <th className="py-3 px-4 text-right">Alpa</th>
                <th className="py-3 px-4 text-right">Belum Scan</th>
                <th className="py-3 px-4 text-right">% Hadir</th>
                <th className="py-3 px-4">Status Evaluasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classPerformance.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 font-bold text-slate-900">{row.name}</td>
                  <td className="py-3 px-4 text-slate-700">{row.homeroomTeacherName}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">{row.total}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                    {row.Hadir}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-amber-700">
                    {row.Terlambat}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-sky-700">
                    {row['Izin/Sakit']}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-rose-700">
                    {row.Alpa}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                    {row['Belum Scan']}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-[#0A3D91]">
                    {row.rate}%
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`font-semibold ${
                        row.evaluation === 'Optimal'
                          ? 'text-emerald-700'
                          : row.evaluation === 'Pantau'
                          ? 'text-amber-700'
                          : row.evaluation === 'Perlu Pembinaan'
                          ? 'text-rose-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {row.evaluation}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Oversight Row: Watchlist + Audit Logs & Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold font-display text-slate-900">
                Daftar Siswa Memerlukan Atensi Khusus
              </h2>
              <p className="text-xs text-slate-500">
                Siswa berstatus Alpa, Terlambat, atau Belum Scan pada {formatIndonesianDate(selectedDate)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('attendance-data')}
              className="text-xs font-semibold text-[#0A3D91] hover:underline cursor-pointer"
            >
              Lihat Data Absensi
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
            {attentionStudents.length === 0 ? (
              <div className="p-8 text-center text-emerald-700 font-medium">
                Seluruh siswa aktif hadir tepat waktu atau memiliki izin resmi pada tanggal ini.
              </div>
            ) : (
              attentionStudents.slice(0, 15).map(({ student, statusLabel, detail, severity }) => (
                <div
                  key={student.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      {student.fullName}{' '}
                      <span className="font-normal text-slate-500">({student.className})</span>
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {detail} · Wali: {student.parentName} ({student.parentWhatsapp})
                    </p>
                  </div>
                  <span
                    className={`font-bold whitespace-nowrap shrink-0 ${
                      severity === 'HIGH'
                        ? 'text-rose-700'
                        : severity === 'MEDIUM'
                        ? 'text-amber-700'
                        : 'text-[#0A3D91]'
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-6 space-y-6">
          {/* Audit Log Oversight */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#0A3D91]" />
                <div>
                  <h2 className="text-sm font-bold font-display text-slate-900">
                    Pengawasan Audit Log &amp; Perubahan Sistem
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Catatan akuntabilitas perubahan absensi &amp; konfigurasi di Firestore
                  </p>
                </div>
              </div>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>

            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
              {auditLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="px-5 py-2.5 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-[#0A3D91]">{log.action}</span>
                    <span className="font-mono tabular-nums text-[11px] text-slate-400">
                      {log.createdAt.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                  <p className="text-slate-700">
                    <strong>{log.targetName}</strong> · oleh {log.actorName} ({log.actorRole})
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{log.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Announcements Overview */}
          {visibleAnnouncements.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[#0A3D91]" />
                <h2 className="text-sm font-bold font-display text-slate-900">
                  Pengumuman &amp; Agenda Sekolah Aktif
                </h2>
              </div>
              <div className="space-y-2">
                {visibleAnnouncements.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-3 rounded-lg bg-[#F5F8FF] border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-0.5">
                      <span className="font-semibold text-[#0A3D91]">{ann.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatIndonesianDate(ann.publishDate)}
                      </span>
                      {ann.isPinned && <Pin className="w-3 h-3 text-amber-600 ml-auto" />}
                    </div>
                    <p className="font-bold text-slate-900">{ann.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Atur Email Kepala Sekolah Terintegrasi Firestore */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h2 className="text-base font-bold font-display text-slate-900">
                  Integrasi Email Kepala Sekolah (Firestore)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Akun Google yang masuk dengan email ini otomatis diarahkan ke Dashboard Kepala
                  Sekolah
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfigSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lengkap Kepala Sekolah *
                </label>
                <input
                  type="text"
                  required
                  value={principalName}
                  onChange={(e) => setPrincipalName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  NIP Kepala Sekolah
                </label>
                <input
                  type="text"
                  value={principalNip}
                  onChange={(e) => setPrincipalNip(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email Google Kepala Sekolah Terintegrasi Firestore *
                </label>
                <input
                  type="email"
                  required
                  value={principalEmail}
                  onChange={(e) => setPrincipalEmail(e.target.value)}
                  placeholder="kepsek@sdnasemrowo2.sch.id"
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Disimpan di dokumen <code className="font-mono">attendanceSettings/global</code>{' '}
                  dan divalidasi oleh Firestore Security Rules saat login Google.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-4 py-2 font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 text-[#D4AF37]" />
                  <span>{isSavingConfig ? 'Menyimpan...' : 'Simpan Integrasi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
