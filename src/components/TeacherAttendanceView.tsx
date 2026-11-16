import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  FileSpreadsheet,
  FileText,
  Filter,
  LogIn,
  LogOut,
  QrCode,
  ScanLine,
  Search,
  UserCheck,
  Users,
  X,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';
import {
  AttendanceSettings,
  PageId,
  Teacher,
  TeacherAttendanceRecord,
  TeacherAttendanceStatus,
  UserProfile,
} from '../types';
import {
  formatIndonesianDate,
  getCurrentTimeString,
  getTeacherQrCodeId,
  getTeacherQrToken,
  getTodayDateString,
} from '../firebase';
import {
  downloadTeacherQrPng,
  exportTeacherAttendanceToExcel,
  exportTeacherAttendanceToPdf,
  generateQrDataUrl,
} from '../utils/exportUtils';

interface TeacherAttendanceViewProps {
  userProfile: UserProfile;
  teachers: Teacher[];
  teacherAttendance: TeacherAttendanceRecord[];
  settings: AttendanceSettings;
  onRecordTeacherScanOrSelf: (
    teacher: Teacher,
    session: 'MASUK' | 'PULANG'
  ) => Promise<void>;
  onUpdateTeacherAttendanceManual: (
    teacher: Teacher,
    date: string,
    status: TeacherAttendanceStatus,
    checkInTime: string,
    checkOutTime: string,
    reason: string
  ) => Promise<void>;
  onNavigate: (page: PageId) => void;
}

export const TeacherAttendanceView: React.FC<TeacherAttendanceViewProps> = ({
  userProfile,
  teachers,
  teacherAttendance,
  settings,
  onRecordTeacherScanOrSelf,
  onUpdateTeacherAttendanceManual,
  onNavigate,
}) => {
  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const activeTeachers = useMemo(
    () => teachers.filter((t) => t.status === 'AKTIF'),
    [teachers]
  );

  // Match logged-in user to a teacher profile, or allow selecting self identity for testing
  const matchedSelfTeacher = useMemo(() => {
    const byUid = activeTeachers.find((t) => t.userUid && t.userUid === userProfile.uid);
    if (byUid) return byUid;
    const byEmail = activeTeachers.find(
      (t) => t.email.toLowerCase() === userProfile.email.toLowerCase()
    );
    if (byEmail) return byEmail;
    const byClass = activeTeachers.find(
      (t) =>
        userProfile.assignedClassId &&
        userProfile.assignedClassId !== 'ALL' &&
        t.classId === userProfile.assignedClassId
    );
    return byClass || activeTeachers[0] || null;
  }, [activeTeachers, userProfile]);

  const [selectedSelfTeacherId, setSelectedSelfTeacherId] = useState<string>(
    matchedSelfTeacher?.id || ''
  );

  useEffect(() => {
    if (matchedSelfTeacher && !selectedSelfTeacherId) {
      setSelectedSelfTeacherId(matchedSelfTeacher.id);
    }
  }, [matchedSelfTeacher, selectedSelfTeacherId]);

  const selfTeacher = useMemo(
    () =>
      activeTeachers.find((t) => t.id === selectedSelfTeacherId) ||
      matchedSelfTeacher ||
      null,
    [activeTeachers, selectedSelfTeacherId, matchedSelfTeacher]
  );

  const selfTodayRecord = useMemo(() => {
    if (!selfTeacher) return undefined;
    return teacherAttendance.find(
      (r) => r.teacherId === selfTeacher.id && r.date === todayStr
    );
  }, [selfTeacher, teacherAttendance, todayStr]);

  // Manual Edit Modal State
  const [editingTarget, setEditingTarget] = useState<{
    teacher: Teacher;
    existingRecord?: TeacherAttendanceRecord;
  } | null>(null);
  const [editStatus, setEditStatus] = useState<TeacherAttendanceStatus>('HADIR');
  const [editCheckIn, setEditCheckIn] = useState('06:30:00');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editReason, setEditReason] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);

  // QR Preview Modal State
  const [qrPreviewTeacher, setQrPreviewTeacher] = useState<Teacher | null>(null);
  const [qrPreviewDataUrl, setQrPreviewDataUrl] = useState<string>('');
  const [isDownloadingQr, setIsDownloadingQr] = useState(false);

  // Excel Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(selectedDate);
  const [exportEndDate, setExportEndDate] = useState(selectedDate);
  const [includeUnrecorded, setIncludeUnrecorded] = useState(true);
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [isProcessingQuick, setIsProcessingQuick] = useState<string | null>(null);

  useEffect(() => {
    if (!qrPreviewTeacher) {
      setQrPreviewDataUrl('');
      return;
    }
    const token = getTeacherQrToken(qrPreviewTeacher.id, qrPreviewTeacher.nip);
    generateQrDataUrl(token, 300)
      .then(setQrPreviewDataUrl)
      .catch(() => setQrPreviewDataUrl(''));
  }, [qrPreviewTeacher]);

  const canManageAll =
    userProfile.role === 'SUPER_ADMIN' ||
    userProfile.role === 'ADMIN_SEKOLAH' ||
    userProfile.role === 'KEPALA_SEKOLAH';

  const dateRecords = useMemo(
    () => teacherAttendance.filter((r) => r.date === selectedDate),
    [teacherAttendance, selectedDate]
  );

  const stats = useMemo(() => {
    const total = activeTeachers.length;
    const hadir = dateRecords.filter((r) => r.status === 'HADIR').length;
    const terlambat = dateRecords.filter((r) => r.status === 'TERLAMBAT').length;
    const dinasLuar = dateRecords.filter((r) => r.status === 'DINAS_LUAR').length;
    const izinSakit = dateRecords.filter(
      (r) => r.status === 'IZIN' || r.status === 'SAKIT'
    ).length;
    const alpa = dateRecords.filter((r) => r.status === 'ALPA').length;
    const recordedIds = new Set(dateRecords.map((r) => r.teacherId));
    const belumAbsen = activeTeachers.filter((t) => !recordedIds.has(t.id)).length;
    const presentRate =
      total > 0 ? Math.round(((hadir + terlambat + dinasLuar) / total) * 100) : 0;

    return {
      total,
      hadir,
      terlambat,
      dinasLuar,
      izinSakit,
      alpa,
      belumAbsen,
      presentRate,
    };
  }, [activeTeachers, dateRecords]);

  const combinedRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return activeTeachers
      .filter((t) => {
        const isMapel =
          t.classId.startsWith('MAPEL_') || t.className.toLowerCase().includes('mapel');
        const isWali = t.role === 'GURU' && !isMapel && t.classId !== 'ALL';
        if (roleFilter === 'WALI_KELAS' && !isWali) return false;
        if (roleFilter === 'GURU_MAPEL' && !isMapel) return false;
        if (roleFilter === 'STAF' && (isWali || isMapel)) return false;
        if (
          roleFilter !== 'ALL' &&
          roleFilter !== 'WALI_KELAS' &&
          roleFilter !== 'GURU_MAPEL' &&
          roleFilter !== 'STAF' &&
          t.role !== roleFilter
        ) {
          return false;
        }
        if (!q) return true;
        return (
          t.fullName.toLowerCase().includes(q) ||
          t.nip.toLowerCase().includes(q) ||
          t.className.toLowerCase().includes(q)
        );
      })
      .map((teacher) => {
        const record = dateRecords.find((r) => r.teacherId === teacher.id);
        return { teacher, record };
      })
      .filter(({ record }) => {
        if (statusFilter === 'ALL') return true;
        if (statusFilter === 'BELUM_ABSEN') return !record;
        return record?.status === statusFilter;
      });
  }, [activeTeachers, dateRecords, roleFilter, searchQuery, statusFilter]);

  const openCorrectionModal = (
    teacher: Teacher,
    existingRecord?: TeacherAttendanceRecord,
    defaultStatus?: TeacherAttendanceStatus
  ) => {
    setEditingTarget({ teacher, existingRecord });
    setEditStatus(defaultStatus || existingRecord?.status || 'HADIR');
    setEditCheckIn(existingRecord?.checkInTime || getCurrentTimeString());
    setEditCheckOut(existingRecord?.checkOutTime || '');
    setEditReason(
      existingRecord?.notes ||
        (defaultStatus === 'DINAS_LUAR'
          ? 'Tugas Dinas Luar / KKG'
          : defaultStatus === 'IZIN'
          ? 'Izin keperluan keluarga'
          : '')
    );
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTarget || !editReason.trim()) return;
    setIsSavingManual(true);
    try {
      await onUpdateTeacherAttendanceManual(
        editingTarget.teacher,
        selectedDate,
        editStatus,
        editCheckIn,
        editCheckOut,
        editReason.trim()
      );
      setActionBanner(
        `Status kehadiran ${editingTarget.teacher.fullName} berhasil disimpan (${editStatus.replace('_', ' ')}).`
      );
      setTimeout(() => setActionBanner(null), 4000);
      setEditingTarget(null);
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleQuickCheck = async (teacher: Teacher, session: 'MASUK' | 'PULANG') => {
    setIsProcessingQuick(`${teacher.id}_${session}`);
    try {
      await onRecordTeacherScanOrSelf(teacher, session);
      setActionBanner(
        `Presensi ${session} untuk ${teacher.fullName} berhasil dicatat pada pukul ${getCurrentTimeString()} WIB.`
      );
      setTimeout(() => setActionBanner(null), 4000);
    } finally {
      setIsProcessingQuick(null);
    }
  };

  const handleExportPdf = () => {
    const recordedIds = new Set(dateRecords.map((r) => r.teacherId));
    const unrecorded = activeTeachers.filter((t) => !recordedIds.has(t.id));
    exportTeacherAttendanceToPdf(
      dateRecords,
      unrecorded,
      'Laporan Kehadiran Guru Kelas (Rombel), Guru Mapel & Staf',
      `Tanggal: ${formatIndonesianDate(selectedDate)}  |  Batas Masuk Tepat Waktu: ${settings.checkInDeadline} WIB`,
      settings
    );
  };

  const handleConfirmExportExcel = (e: React.FormEvent) => {
    e.preventDefault();
    if (exportStartDate > exportEndDate) return;
    const matched = teacherAttendance.filter(
      (r) => r.date >= exportStartDate && r.date <= exportEndDate
    );
    const recordedIds = new Set(
      teacherAttendance
        .filter((r) => r.date === exportStartDate)
        .map((r) => r.teacherId)
    );
    const unrecorded =
      includeUnrecorded && exportStartDate === exportEndDate
        ? activeTeachers.filter((t) => !recordedIds.has(t.id))
        : [];

    exportTeacherAttendanceToExcel({
      records: matched,
      unrecordedTeachers: unrecorded,
      startDate: exportStartDate,
      endDate: exportEndDate,
      exportedBy: `${userProfile.name} (${userProfile.role})`,
      settings,
    });
    setIsExportModalOpen(false);
    setActionBanner('File Excel Laporan Absensi Guru berhasil diunduh.');
    setTimeout(() => setActionBanner(null), 4000);
  };

  const renderStatusBadge = (status?: TeacherAttendanceStatus) => {
    if (!status) {
      return (
        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600">
          BELUM ABSEN
        </span>
      );
    }
    const styles: Record<TeacherAttendanceStatus, string> = {
      HADIR: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      TERLAMBAT: 'bg-amber-50 text-amber-800 border border-amber-200',
      DINAS_LUAR: 'bg-blue-50 text-[#0A3D91] border border-blue-200',
      IZIN: 'bg-sky-50 text-sky-800 border border-sky-200',
      SAKIT: 'bg-purple-50 text-purple-800 border border-purple-200',
      ALPA: 'bg-rose-50 text-rose-700 border border-rose-200',
    };
    return (
      <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${styles[status]}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0A3D91] mb-1">
            <UserCheck className="w-4 h-4 text-[#D4AF37]" />
            <span>MODUL PRESENSI WALI ROMBEL, GURU MATA PELAJARAN &amp; STAF</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-bold font-display text-slate-900">
            Absensi Guru Kelas, Guru Mapel &amp; Staf Sekolah
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan kehadiran masuk, pulang, dinas luar, dan izin guru wali rombel, guru mata
            pelajaran (PAI, PJOK, B. Inggris, Mulok, Seni), serta staf {settings.schoolName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 text-xs font-mono bg-[#F5F8FF] border border-slate-200 rounded-lg text-slate-800"
          />

          <button
            onClick={() => onNavigate('scan-attendance')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <ScanLine className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Scan QR Guru</span>
          </button>

          <button
            onClick={() => {
              setExportStartDate(selectedDate);
              setExportEndDate(selectedDate);
              setIsExportModalOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleExportPdf}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-[#F5F8FF] hover:bg-blue-50 border border-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-[#0A3D91]" />
            <span>Cetak PDF</span>
          </button>
        </div>
      </div>

      {actionBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionBanner}</span>
          </div>
          <button
            onClick={() => setActionBanner(null)}
            className="text-emerald-700 font-bold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Self Check-In / Check-Out Panel for Guru & Staf */}
      {selfTeacher && (
        <div className="bg-gradient-to-r from-[#0A3D91] to-[#0d4bb5] rounded-2xl p-5 text-white shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#D4AF37] text-slate-950">
                  PRESENSI MANDIRI HARI INI ({formatIndonesianDate(todayStr)})
                </span>
                <span className="text-xs text-blue-100 font-mono">
                  Batas Masuk: {settings.checkInDeadline} WIB · Jam Pulang: {settings.checkOutStart} WIB
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                <h2 className="text-lg font-bold font-display text-white">
                  {selfTeacher.fullName}
                </h2>
                <select
                  aria-label="Pilih identitas guru untuk presensi mandiri"
                  value={selfTeacher.id}
                  onChange={(e) => setSelectedSelfTeacherId(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-white/15 border border-white/25 rounded-lg text-white font-medium focus:outline-none cursor-pointer"
                >
                  {activeTeachers.map((t) => (
                    <option key={t.id} value={t.id} className="text-slate-900">
                      {t.fullName} ({t.className})
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-blue-100 font-mono">
                NIP: {selfTeacher.nip || '-'} · Penugasan: {selfTeacher.className} · Token QR: {getTeacherQrCodeId(selfTeacher.id, selfTeacher.nip)}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
                <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/15">
                  <span className="text-blue-200">Status Hari Ini: </span>
                  <strong className="text-[#D4AF37]">
                    {selfTodayRecord ? selfTodayRecord.status.replace('_', ' ') : 'BELUM ABSEN'}
                  </strong>
                </div>
                <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/15 font-mono">
                  <span className="text-blue-200">Jam Masuk: </span>
                  <strong>{selfTodayRecord?.checkInTime || '-'}</strong>
                </div>
                <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/15 font-mono">
                  <span className="text-blue-200">Jam Pulang: </span>
                  <strong>{selfTodayRecord?.checkOutTime || '-'}</strong>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                onClick={() => void handleQuickCheck(selfTeacher, 'MASUK')}
                disabled={
                  Boolean(selfTodayRecord?.checkInTime) ||
                  isProcessingQuick === `${selfTeacher.id}_MASUK`
                }
                className="px-4 py-2.5 text-xs font-bold bg-[#D4AF37] hover:bg-[#c29d2b] text-slate-950 rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>
                  {selfTodayRecord?.checkInTime ? 'Sudah Absen Masuk' : 'Absen Masuk Sekarang'}
                </span>
              </button>

              <button
                onClick={() => void handleQuickCheck(selfTeacher, 'PULANG')}
                disabled={
                  Boolean(selfTodayRecord?.checkOutTime) ||
                  isProcessingQuick === `${selfTeacher.id}_PULANG`
                }
                className="px-4 py-2.5 text-xs font-bold bg-white text-[#0A3D91] hover:bg-blue-50 rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                <span>
                  {selfTodayRecord?.checkOutTime ? 'Sudah Absen Pulang' : 'Absen Pulang'}
                </span>
              </button>

              <button
                onClick={() =>
                  openCorrectionModal(selfTeacher, selfTodayRecord, 'DINAS_LUAR')
                }
                className="px-3.5 py-2.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Briefcase className="w-4 h-4 text-[#D4AF37]" />
                <span>Izin / Dinas Luar</span>
              </button>

              <button
                onClick={() => setQrPreviewTeacher(selfTeacher)}
                className="px-3.5 py-2.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-[#D4AF37]" />
                <span>Kartu QR Saya</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Guru &amp; Staf Aktif</p>
            <p className="text-2xl font-bold font-display text-slate-900 mt-1 font-mono tabular-nums">
              {stats.total}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Kehadiran Aktif: <strong className="text-[#0A3D91]">{stats.presentRate}%</strong>
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#F5F8FF] text-[#0A3D91] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Hadir Tepat Waktu</p>
            <p className="text-2xl font-bold font-display text-emerald-700 mt-1 font-mono tabular-nums">
              {stats.hadir}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Sebelum pukul {settings.checkInDeadline} WIB
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Terlambat &amp; Dinas Luar</p>
            <p className="text-2xl font-bold font-display text-amber-700 mt-1 font-mono tabular-nums">
              {stats.terlambat} <span className="text-slate-300">/</span>{' '}
              <span className="text-[#0A3D91]">{stats.dinasLuar}</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {stats.terlambat} Terlambat · {stats.dinasLuar} Dinas Luar
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Izin/Sakit &amp; Belum Absen</p>
            <p className="text-2xl font-bold font-display text-rose-700 mt-1 font-mono tabular-nums">
              {stats.izinSakit + stats.alpa} <span className="text-slate-300">/</span>{' '}
              <span className="text-slate-600">{stats.belumAbsen}</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {stats.izinSakit} Izin/Sakit · {stats.belumAbsen} Belum Scan
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama guru, NIP, mata pelajaran, atau rombel..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-[#F5F8FF] border border-slate-200 rounded-lg focus:outline-none focus:border-[#0A3D91]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-medium text-slate-700"
            >
              <option value="ALL">Semua Status Kehadiran</option>
              <option value="HADIR">HADIR</option>
              <option value="TERLAMBAT">TERLAMBAT</option>
              <option value="DINAS_LUAR">DINAS LUAR</option>
              <option value="IZIN">IZIN</option>
              <option value="SAKIT">SAKIT</option>
              <option value="ALPA">ALPA</option>
              <option value="BELUM_ABSEN">BELUM ABSEN</option>
            </select>
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-medium text-slate-700"
          >
            <option value="ALL">Semua Kategori Guru &amp; Staf</option>
            <option value="WALI_KELAS">Guru Kelas (Wali Rombel 1A–6B)</option>
            <option value="GURU_MAPEL">Guru Mata Pelajaran (Mapel)</option>
            <option value="STAF">Staf Tata Usaha &amp; Pimpinan</option>
          </select>
        </div>
      </div>

      {/* Main Teacher Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold font-display text-slate-900">
              Daftar Kehadiran Guru Kelas, Guru Mapel &amp; Staf — {formatIndonesianDate(selectedDate)}
            </h2>
            <p className="text-xs text-slate-500">
              Menampilkan {combinedRows.length} dari {activeTeachers.length} pendidik &amp; tenaga
              kependidikan aktif
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F5F8FF] text-slate-600 font-semibold">
                <th className="py-3 px-4">Nama Guru / Staf</th>
                <th className="py-3 px-4">NIP</th>
                <th className="py-3 px-4">Kategori &amp; Penugasan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Jam Masuk</th>
                <th className="py-3 px-4">Jam Pulang</th>
                <th className="py-3 px-4">Keterangan</th>
                <th className="py-3 px-4 text-right">Aksi Presensi &amp; QR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {combinedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Tidak ada data guru yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                combinedRows.map(({ teacher, record }) => {
                  const isSelf = selfTeacher?.id === teacher.id;
                  const canActOnRow = canManageAll || isSelf || settings.allowTeacherManualEdit;
                  const isMapel =
                    teacher.classId.startsWith('MAPEL_') ||
                    teacher.className.toLowerCase().includes('mapel');
                  return (
                    <tr key={teacher.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{teacher.fullName}</p>
                        <p className="text-[11px] text-slate-500">{teacher.email}</p>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                        {teacher.nip || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#0A3D91]">
                          {isMapel
                            ? 'Guru Mata Pelajaran'
                            : teacher.role === 'GURU' && teacher.classId !== 'ALL'
                            ? 'Wali Kelas (Rombel)'
                            : teacher.role.replace('_', ' ')}
                        </p>
                        <p className="text-slate-600 font-medium">{teacher.className}</p>
                      </td>
                      <td className="py-3 px-4">{renderStatusBadge(record?.status)}</td>
                      <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-800">
                        {record?.checkInTime || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-800">
                        {record?.checkOutTime || '-'}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <p className="text-slate-700 truncate">{record?.notes || '-'}</p>
                        {record?.verifiedByName && (
                          <p className="text-[10px] text-slate-400">
                            Oleh: {record.verifiedByName} ({record.session})
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                          {selectedDate === todayStr && canActOnRow && !record?.checkInTime && (
                            <button
                              onClick={() => void handleQuickCheck(teacher, 'MASUK')}
                              disabled={isProcessingQuick === `${teacher.id}_MASUK`}
                              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg cursor-pointer"
                            >
                              Absen Masuk
                            </button>
                          )}

                          {selectedDate === todayStr &&
                            canActOnRow &&
                            Boolean(record?.checkInTime) &&
                            !record?.checkOutTime && (
                              <button
                                onClick={() => void handleQuickCheck(teacher, 'PULANG')}
                                disabled={isProcessingQuick === `${teacher.id}_PULANG`}
                                className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer"
                              >
                                Absen Pulang
                              </button>
                            )}

                          <button
                            onClick={() => setQrPreviewTeacher(teacher)}
                            title="Lihat & Unduh Kartu QR Guru"
                            className="px-2.5 py-1 text-[11px] font-semibold text-[#0A3D91] bg-[#F5F8FF] hover:bg-blue-100 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>QR</span>
                          </button>

                          {canActOnRow && (
                            <button
                              onClick={() => openCorrectionModal(teacher, record)}
                              title="Input / Koreksi Kehadiran Guru"
                              className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input / Koreksi Manual Kehadiran Guru */}
      {editingTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-base font-bold font-display text-slate-900">
                  Input / Koreksi Absensi Guru
                </h3>
                <p className="text-xs text-slate-500">
                  {editingTarget.teacher.fullName} · {formatIndonesianDate(selectedDate)}
                </p>
              </div>
              <button
                onClick={() => setEditingTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManual} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Status Kehadiran Guru
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TeacherAttendanceStatus)}
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-semibold text-slate-800"
                >
                  <option value="HADIR">HADIR (Tepat Waktu)</option>
                  <option value="TERLAMBAT">TERLAMBAT</option>
                  <option value="DINAS_LUAR">DINAS LUAR (KKG / Rapat Dinas)</option>
                  <option value="IZIN">IZIN</option>
                  <option value="SAKIT">SAKIT</option>
                  <option value="ALPA">ALPA (Tanpa Keterangan)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jam Masuk</label>
                  <input
                    type="text"
                    value={editCheckIn}
                    onChange={(e) => setEditCheckIn(e.target.value)}
                    placeholder="06:30:00"
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jam Pulang</label>
                  <input
                    type="text"
                    value={editCheckOut}
                    onChange={(e) => setEditCheckOut(e.target.value)}
                    placeholder="14:00:00"
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Keterangan / Alasan (Tercatat di Audit Log) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Contoh: Rapat Koordinasi KKG di Dinas Pendidikan Kota Surabaya..."
                  className="w-full p-3 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTarget(null)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingManual}
                  className="px-4 py-2 font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg cursor-pointer"
                >
                  {isSavingManual ? 'Menyimpan...' : 'Simpan Absensi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kartu QR Absensi Guru */}
      {qrPreviewTeacher && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold font-display text-slate-900">
                Kartu QR Absensi Guru
              </h3>
              <button
                onClick={() => setQrPreviewTeacher(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#F5F8FF] border border-slate-200 mb-4">
              <p className="text-xs font-bold text-[#0A3D91] mb-2">{settings.schoolName}</p>
              {qrPreviewDataUrl ? (
                <img
                  src={qrPreviewDataUrl}
                  alt={`QR ${qrPreviewTeacher.fullName}`}
                  className="w-48 h-48 mx-auto rounded-lg border border-slate-200 bg-white p-2"
                />
              ) : (
                <div className="w-48 h-48 mx-auto flex items-center justify-center text-xs text-slate-400">
                  Memuat QR...
                </div>
              )}
              <p className="text-sm font-bold font-display text-slate-900 mt-3">
                {qrPreviewTeacher.fullName}
              </p>
              <p className="text-xs font-mono text-slate-600">
                NIP: {qrPreviewTeacher.nip || '-'}
              </p>
              <p className="text-xs font-semibold text-[#0A3D91] mt-0.5">
                {qrPreviewTeacher.role.replace('_', ' ')} · {qrPreviewTeacher.className}
              </p>
              <p className="text-[10px] font-mono text-slate-400 mt-1">
                ID: {getTeacherQrCodeId(qrPreviewTeacher.id, qrPreviewTeacher.nip)}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setQrPreviewTeacher(null)}
                className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
              >
                Tutup
              </button>
              <button
                disabled={isDownloadingQr}
                onClick={async () => {
                  setIsDownloadingQr(true);
                  try {
                    await downloadTeacherQrPng(qrPreviewTeacher, settings.schoolName);
                  } finally {
                    setIsDownloadingQr(false);
                  }
                }}
                className="px-4 py-2 font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>{isDownloadingQr ? 'Mengunduh...' : 'Unduh Kartu PNG'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Export Excel Rentang Tanggal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold font-display text-slate-900">
                Export Excel Absensi Guru (.xlsx)
              </h3>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmExportExcel} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dari Tanggal</label>
                  <input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sampai Tanggal</label>
                  <input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              {exportStartDate === exportEndDate && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeUnrecorded}
                    onChange={(e) => setIncludeUnrecorded(e.target.checked)}
                    className="rounded text-[#0A3D91]"
                  />
                  <span className="text-slate-700">
                    Sertakan guru yang belum melakukan presensi pada tanggal tersebut
                  </span>
                </label>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh File .xlsx</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
