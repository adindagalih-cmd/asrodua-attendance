import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Printer,
  Edit2,
  Search,
  Check,
  X,
  History,
  Download,
  Filter,
} from 'lucide-react';
import {
  AttendanceRecord,
  AttendanceSettings,
  AttendanceStatus,
  AuditLog,
  SchoolClass,
  Student,
  UserProfile,
} from '../types';
import { formatIndonesianDate, getTodayDateString } from '../firebase';
import {
  exportAttendanceToExcel,
  exportAttendanceToPdf,
  exportFullAttendanceRangeToExcel,
} from '../utils/exportUtils';

interface AttendanceDataViewProps {
  userProfile: UserProfile;
  students: Student[];
  classes: SchoolClass[];
  attendance: AttendanceRecord[];
  auditLogs: AuditLog[];
  settings: AttendanceSettings;
  onUpdateAttendanceManual: (
    student: Student,
    date: string,
    status: AttendanceStatus,
    checkInTime: string,
    checkOutTime: string,
    reason: string
  ) => Promise<void>;
}

export const AttendanceDataView: React.FC<AttendanceDataViewProps> = ({
  userProfile,
  students,
  classes,
  attendance,
  auditLogs,
  settings,
  onUpdateAttendanceManual,
}) => {
  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [classFilter, setClassFilter] = useState<string>(
    userProfile.role === 'GURU' && userProfile.assignedClassId && userProfile.assignedClassId !== 'ALL'
      ? userProfile.assignedClassId
      : 'ALL'
  );
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [editingTarget, setEditingTarget] = useState<{
    student: Student;
    existingRecord?: AttendanceRecord;
  } | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('HADIR');
  const [editCheckIn, setEditCheckIn] = useState('06:45:00');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editReason, setEditReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Export Excel Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(selectedDate);
  const [exportEndDate, setExportEndDate] = useState(selectedDate);
  const [exportClassId, setExportClassId] = useState(classFilter);
  const [exportStatusFilter, setExportStatusFilter] = useState<string>('ALL');
  const [includeUnrecorded, setIncludeUnrecorded] = useState(true);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  const isAdminRole =
    userProfile.role === 'SUPER_ADMIN' || userProfile.role === 'ADMIN_SEKOLAH';
  const isGuruAssignedOnly =
    userProfile.role === 'GURU' &&
    Boolean(userProfile.assignedClassId) &&
    userProfile.assignedClassId !== 'ALL';
  const canExportExcel =
    userProfile.active &&
    (isAdminRole || userProfile.role === 'KEPALA_SEKOLAH' || userProfile.role === 'GURU');

  const canManualEdit =
    userProfile.role === 'SUPER_ADMIN' ||
    userProfile.role === 'ADMIN_SEKOLAH' ||
    (userProfile.role === 'GURU' && settings.allowTeacherManualEdit);

  const openExportModal = () => {
    setExportStartDate(selectedDate);
    setExportEndDate(selectedDate);
    setExportClassId(
      isGuruAssignedOnly ? userProfile.assignedClassId : classFilter
    );
    setExportStatusFilter(statusFilter === 'BELUM_SCAN' ? 'ALL' : statusFilter);
    setIncludeUnrecorded(true);
    setIsExportModalOpen(true);
  };

  const exportMatchedRecords = useMemo(() => {
    const effectiveClassId = isGuruAssignedOnly
      ? userProfile.assignedClassId
      : exportClassId;
    return attendance.filter((rec) => {
      if (exportStartDate && rec.date < exportStartDate) return false;
      if (exportEndDate && rec.date > exportEndDate) return false;
      if (effectiveClassId !== 'ALL' && rec.classId !== effectiveClassId) return false;
      if (exportStatusFilter !== 'ALL' && rec.status !== exportStatusFilter) return false;
      return true;
    });
  }, [
    attendance,
    exportStartDate,
    exportEndDate,
    exportClassId,
    exportStatusFilter,
    isGuruAssignedOnly,
    userProfile.assignedClassId,
  ]);

  const exportUnrecordedStudents = useMemo(() => {
    if (
      !includeUnrecorded ||
      exportStartDate !== exportEndDate ||
      exportStatusFilter !== 'ALL'
    ) {
      return [];
    }
    const effectiveClassId = isGuruAssignedOnly
      ? userProfile.assignedClassId
      : exportClassId;
    const recordedStudentIds = new Set(
      attendance
        .filter((a) => a.date === exportStartDate)
        .map((a) => a.studentId)
    );
    return students.filter((s) => {
      if (s.status !== 'AKTIF') return false;
      if (effectiveClassId !== 'ALL' && s.classId !== effectiveClassId) return false;
      return !recordedStudentIds.has(s.id);
    });
  }, [
    includeUnrecorded,
    exportStartDate,
    exportEndDate,
    exportStatusFilter,
    exportClassId,
    isGuruAssignedOnly,
    userProfile.assignedClassId,
    attendance,
    students,
  ]);

  const handleConfirmExportExcel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canExportExcel) return;
    if (exportStartDate > exportEndDate) return;

    const effectiveClassId = isGuruAssignedOnly
      ? userProfile.assignedClassId
      : exportClassId;
    const classLabel =
      effectiveClassId === 'ALL'
        ? 'Semua Kelas'
        : classes.find((c) => c.id === effectiveClassId)?.name || effectiveClassId;

    exportFullAttendanceRangeToExcel({
      records: exportMatchedRecords,
      unrecordedStudents: exportUnrecordedStudents,
      startDate: exportStartDate,
      endDate: exportEndDate,
      classLabel,
      exportedBy: `${userProfile.name} (${userProfile.role})`,
      settings,
    });

    setIsExportModalOpen(false);
    setExportSuccessMsg(
      `File Excel absensi (${exportMatchedRecords.length} catatan${
        exportUnrecordedStudents.length > 0
          ? ` + ${exportUnrecordedStudents.length} belum scan`
          : ''
      }) berhasil diunduh.`
    );
    setTimeout(() => setExportSuccessMsg(null), 5000);
  };

  const scopedActiveStudents = useMemo(() => {
    return students.filter((s) => {
      if (s.status !== 'AKTIF') return false;
      if (classFilter !== 'ALL' && s.classId !== classFilter) return false;
      return true;
    });
  }, [students, classFilter]);

  const combinedRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return scopedActiveStudents
      .filter((s) => {
        if (!q) return true;
        return (
          s.fullName.toLowerCase().includes(q) ||
          s.nis.toLowerCase().includes(q) ||
          s.nisn.toLowerCase().includes(q)
        );
      })
      .map((student) => {
        const record = attendance.find(
          (a) => a.studentId === student.id && a.date === selectedDate
        );
        return { student, record };
      })
      .filter(({ record }) => {
        if (statusFilter === 'ALL') return true;
        if (statusFilter === 'BELUM_SCAN') return !record;
        return record?.status === statusFilter;
      });
  }, [scopedActiveStudents, attendance, selectedDate, statusFilter, searchQuery]);

  const openCorrectionModal = (student: Student, record?: AttendanceRecord) => {
    setEditingTarget({ student, existingRecord: record });
    setEditStatus(record?.status || 'HADIR');
    setEditCheckIn(record?.checkInTime || '06:45:00');
    setEditCheckOut(record?.checkOutTime || '');
    setEditReason(record?.notes || '');
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTarget || !editReason.trim()) return;
    setIsSaving(true);
    try {
      await onUpdateAttendanceManual(
        editingTarget.student,
        selectedDate,
        editStatus,
        editCheckIn,
        editCheckOut,
        editReason.trim()
      );
      setEditingTarget(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold font-display text-slate-900">
            Data Absensi Harian & Koreksi Kehadiran
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantau status hadir, terlambat, izin, sakit, dan alpa siswa pada{' '}
            {formatIndonesianDate(selectedDate)}. Setiap koreksi dicatat ke dalam Audit Log.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 text-xs font-mono tabular-nums bg-[#F5F8FF] border border-slate-200 rounded-lg"
          />
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-[#F5F8FF] border border-slate-200 rounded-lg"
          >
            <option value="ALL">Semua Kelas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {canExportExcel && (
            <button
              onClick={openExportModal}
              className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Excel (.xlsx)</span>
            </button>
          )}
        </div>
      </div>

      {exportSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
          <span className="font-medium">{exportSuccessMsg}</span>
          <button
            onClick={() => setExportSuccessMsg(null)}
            className="font-bold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            aria-label="Cari siswa berdasarkan nama"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama siswa, NIS, atau NISN..."
            className="w-full pl-10 pr-9 py-2 text-xs bg-[#F5F8FF] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4DA8FF]/40 focus:border-[#0A3D91]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Hapus pencarian"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              aria-label="Filter status kehadiran"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-xs font-semibold text-slate-700 bg-[#F5F8FF] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4DA8FF]/40 focus:border-[#0A3D91] cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="HADIR">Hadir</option>
              <option value="TERLAMBAT">Terlambat</option>
              <option value="IZIN">Izin</option>
              <option value="SAKIT">Sakit</option>
              <option value="ALPA">Alpa</option>
              <option value="BELUM_SCAN">Belum Scan</option>
            </select>
          </div>

          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
            Menampilkan <strong className="text-slate-800">{combinedRows.length}</strong> dari{' '}
            <strong className="text-slate-800">{scopedActiveStudents.length}</strong> siswa
          </span>

          {(searchQuery.trim() !== '' || statusFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
              }}
              className="px-2.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Main Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F5F8FF] text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">NIS</th>
                <th className="py-3 px-4">Nama Siswa</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4">Status Kehadiran</th>
                <th className="py-3 px-4">Jam Masuk</th>
                <th className="py-3 px-4">Jam Pulang</th>
                <th className="py-3 px-4">Keterangan & Verifikator</th>
                {canManualEdit && <th className="py-3 px-4 text-right">Koreksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {combinedRows.map(({ student, record }) => (
                <tr key={student.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                    {student.nis}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">{student.fullName}</td>
                  <td className="py-3 px-4 text-slate-700">{student.className}</td>
                  <td className="py-3 px-4">
                    {!record ? (
                      <span className="text-slate-400 font-medium">BELUM SCAN</span>
                    ) : (
                      <span
                        className={`font-bold ${
                          record.status === 'HADIR'
                            ? 'text-emerald-700'
                            : record.status === 'TERLAMBAT'
                            ? 'text-amber-700'
                            : record.status === 'ALPA'
                            ? 'text-rose-700'
                            : 'text-sky-700'
                        }`}
                      >
                        {record.status}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                    {record?.checkInTime || '-'}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                    {record?.checkOutTime || '-'}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {record ? (
                      <div>
                        <p>{record.notes || '-'}</p>
                        <p className="text-[11px] text-slate-400">
                          Oleh: {record.verifiedByName} ({record.session})
                        </p>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  {canManualEdit && (
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openCorrectionModal(student, record)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-[#0A3D91] bg-[#F5F8FF] hover:bg-blue-100 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Ubah Status</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {combinedRows.length === 0 && (
                <tr>
                  <td
                    colSpan={canManualEdit ? 8 : 7}
                    className="py-10 px-4 text-center text-slate-500"
                  >
                    <p className="font-semibold text-slate-700">
                      Tidak ada data siswa yang sesuai dengan filter.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Ubah kata kunci pencarian, status kehadiran, atau pilih kelas lain.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Audit Logs Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-[#0A3D91]" />
          <h2 className="text-sm font-bold font-display text-slate-900">
            Audit Log Perubahan Data Kehadiran Terbaru
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F5F8FF] text-slate-600 font-semibold">
                <th className="py-2 px-3">Waktu</th>
                <th className="py-2 px-3">Aktor</th>
                <th className="py-2 px-3">Aksi</th>
                <th className="py-2 px-3">Target</th>
                <th className="py-2 px-3">Perubahan & Alasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.slice(0, 6).map((log) => (
                <tr key={log.id}>
                  <td className="py-2 px-3 font-mono tabular-nums text-slate-500">
                    {log.createdAt.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-800">
                    {log.actorName} ({log.actorRole})
                  </td>
                  <td className="py-2 px-3 font-mono text-[#0A3D91]">{log.action}</td>
                  <td className="py-2 px-3 font-medium text-slate-800">{log.targetName}</td>
                  <td className="py-2 px-3 text-slate-600">
                    <span className="text-slate-400">{log.previousValue}</span> →{' '}
                    <strong className="text-slate-800">{log.newValue}</strong> · Alasan:{' '}
                    <em>{log.reason}</em>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Koreksi Kehadiran */}
      {editingTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold font-display text-slate-900">
                Koreksi Kehadiran Siswa (Audit Log)
              </h3>
              <button
                onClick={() => setEditingTarget(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCorrection} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-[#F5F8FF] border border-slate-200">
                <p className="font-bold text-slate-900">{editingTarget.student.fullName}</p>
                <p className="text-slate-500 font-mono tabular-nums">
                  NIS {editingTarget.student.nis} · {editingTarget.student.className} · Tanggal{' '}
                  {selectedDate}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kategori Kehadiran *
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as AttendanceStatus)}
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-semibold"
                >
                  <option value="HADIR">HADIR</option>
                  <option value="TERLAMBAT">TERLAMBAT</option>
                  <option value="IZIN">IZIN</option>
                  <option value="SAKIT">SAKIT</option>
                  <option value="ALPA">ALPA</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jam Masuk</label>
                  <input
                    type="text"
                    value={editCheckIn}
                    onChange={(e) => setEditCheckIn(e.target.value)}
                    placeholder="06:45:00"
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jam Pulang</label>
                  <input
                    type="text"
                    value={editCheckOut}
                    onChange={(e) => setEditCheckOut(e.target.value)}
                    placeholder="13:05:00"
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alasan Perubahan / Keterangan Wajib (Audit Log) *
                </label>
                <input
                  type="text"
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Contoh: Surat izin sakit dari orang tua siswa"
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
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
                  disabled={isSaving}
                  className="px-4 py-2 font-semibold text-white bg-[#0A3D91] rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 text-[#D4AF37]" />
                  <span>Simpan & Catat Audit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Export to Excel (.xlsx) */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold font-display text-slate-900">
                    Export Data Absensi ke Excel (.xlsx)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Unduh catatan kehadiran lengkap berdasarkan rentang tanggal atau kelas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmExportExcel} className="space-y-4 text-xs">
              {/* Quick Date Range Presets */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Pilih Cepat Rentang Tanggal
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setExportStartDate(selectedDate);
                      setExportEndDate(selectedDate);
                    }}
                    className="px-2.5 py-1 bg-[#F5F8FF] hover:bg-blue-100 text-[#0A3D91] font-semibold rounded-md border border-blue-200 cursor-pointer"
                  >
                    Tanggal Dipilih ({selectedDate})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const end = new Date(`${todayStr}T00:00:00Z`);
                      const start = new Date(end);
                      start.setUTCDate(end.getUTCDate() - 6);
                      setExportStartDate(start.toISOString().slice(0, 10));
                      setExportEndDate(todayStr);
                    }}
                    className="px-2.5 py-1 bg-[#F5F8FF] hover:bg-blue-100 text-[#0A3D91] font-semibold rounded-md border border-blue-200 cursor-pointer"
                  >
                    7 Hari Terakhir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExportStartDate(`${todayStr.slice(0, 7)}-01`);
                      setExportEndDate(todayStr);
                    }}
                    className="px-2.5 py-1 bg-[#F5F8FF] hover:bg-blue-100 text-[#0A3D91] font-semibold rounded-md border border-blue-200 cursor-pointer"
                  >
                    Bulan Ini
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Dari Tanggal *
                  </label>
                  <input
                    type="date"
                    required
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Sampai Tanggal *
                  </label>
                  <input
                    type="date"
                    required
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
                  />
                </div>
              </div>

              {exportStartDate > exportEndDate && (
                <p className="text-rose-600 font-medium">
                  Tanggal mulai tidak boleh lebih besar daripada tanggal akhir.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Filter Kelas {isGuruAssignedOnly ? '(Kelas Ampuan)' : ''}
                  </label>
                  <select
                    value={isGuruAssignedOnly ? userProfile.assignedClassId : exportClassId}
                    disabled={isGuruAssignedOnly}
                    onChange={(e) => setExportClassId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg disabled:opacity-75"
                  >
                    {!isGuruAssignedOnly && <option value="ALL">Semua Kelas</option>}
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Filter Status</label>
                  <select
                    value={exportStatusFilter}
                    onChange={(e) => setExportStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="HADIR">HADIR</option>
                    <option value="TERLAMBAT">TERLAMBAT</option>
                    <option value="IZIN">IZIN</option>
                    <option value="SAKIT">SAKIT</option>
                    <option value="ALPA">ALPA</option>
                  </select>
                </div>
              </div>

              {exportStartDate === exportEndDate && exportStatusFilter === 'ALL' && (
                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={includeUnrecorded}
                    onChange={(e) => setIncludeUnrecorded(e.target.checked)}
                    className="rounded text-[#0A3D91]"
                  />
                  <span>
                    Sertakan siswa aktif yang belum scan pada tanggal ini (Status: BELUM SCAN)
                  </span>
                </label>
              )}

              {/* Preview Box */}
              <div className="p-3.5 rounded-xl bg-[#F5F8FF] border border-slate-200 space-y-1">
                <p className="font-semibold text-slate-800">
                  Ringkasan Data yang Akan Diekspor:
                </p>
                <p className="text-slate-600 font-mono tabular-nums">
                  {exportMatchedRecords.length} catatan absensi tersimpan
                  {exportUnrecordedStudents.length > 0 && exportStatusFilter === 'ALL'
                    ? ` + ${exportUnrecordedStudents.length} siswa belum scan`
                    : ''}
                </p>
                <p className="text-[11px] text-slate-500">
                  Format: Microsoft Excel (.xlsx) · 2 Sheet (Data_Absensi &amp; Ringkasan_Ekspor)
                </p>
              </div>

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
                  disabled={
                    exportStartDate > exportEndDate ||
                    (exportMatchedRecords.length === 0 && exportUnrecordedStudents.length === 0)
                  }
                  className="px-4 py-2 font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
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

interface AttendanceReportsViewProps {
  students: Student[];
  classes: SchoolClass[];
  attendance: AttendanceRecord[];
  settings: AttendanceSettings;
}

export const AttendanceReportsView: React.FC<AttendanceReportsViewProps> = ({
  students,
  classes,
  attendance,
  settings,
}) => {
  const todayStr = getTodayDateString();
  const [reportTab, setReportTab] = useState<
    'HARIAN' | 'MINGGUAN' | 'BULANAN' | 'TAHUNAN' | 'PER_SISWA' | 'PER_KELAS'
  >('HARIAN');

  const [filterDate, setFilterDate] = useState(todayStr);
  const [filterMonth, setFilterMonth] = useState(todayStr.slice(0, 7));
  const [filterYear, setFilterYear] = useState(todayStr.slice(0, 4));
  const [filterClassId, setFilterClassId] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterStudentQuery, setFilterStudentQuery] = useState('');

  const filteredRecords = useMemo(() => {
    const q = filterStudentQuery.toLowerCase().trim();
    return attendance.filter((r) => {
      if (reportTab === 'HARIAN' && filterDate && r.date !== filterDate) return false;
      if (reportTab === 'BULANAN' && filterMonth && !r.date.startsWith(filterMonth)) return false;
      if (reportTab === 'TAHUNAN' && filterYear && !r.date.startsWith(filterYear)) return false;
      if (filterClassId !== 'ALL' && r.classId !== filterClassId) return false;
      if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
      if (q && !r.studentName.toLowerCase().includes(q) && !r.nis.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [
    attendance,
    reportTab,
    filterDate,
    filterMonth,
    filterYear,
    filterClassId,
    filterStatus,
    filterStudentQuery,
  ]);

  const studentRecapRows = useMemo(() => {
    const q = filterStudentQuery.toLowerCase().trim();
    return students
      .filter((s) => {
        if (filterClassId !== 'ALL' && s.classId !== filterClassId) return false;
        if (q && !s.fullName.toLowerCase().includes(q) && !s.nis.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .map((s) => {
        const recs = attendance.filter((a) => a.studentId === s.id);
        const hadir = recs.filter((a) => a.status === 'HADIR').length;
        const terlambat = recs.filter((a) => a.status === 'TERLAMBAT').length;
        const izin = recs.filter((a) => a.status === 'IZIN').length;
        const sakit = recs.filter((a) => a.status === 'SAKIT').length;
        const alpa = recs.filter((a) => a.status === 'ALPA').length;
        const total = recs.length || 1;
        const pct = Math.round(((hadir + terlambat) / total) * 100);
        return { student: s, hadir, terlambat, izin, sakit, alpa, total: recs.length, pct };
      });
  }, [students, attendance, filterClassId, filterStudentQuery]);

  const classRecapRows = useMemo(() => {
    return classes.map((cls) => {
      const clsStudents = students.filter((s) => s.classId === cls.id && s.status === 'AKTIF');
      const recs = attendance.filter((a) => a.classId === cls.id);
      const hadir = recs.filter((a) => a.status === 'HADIR').length;
      const terlambat = recs.filter((a) => a.status === 'TERLAMBAT').length;
      const izin = recs.filter((a) => a.status === 'IZIN').length;
      const sakit = recs.filter((a) => a.status === 'SAKIT').length;
      const alpa = recs.filter((a) => a.status === 'ALPA').length;
      const denom = Math.max(1, clsStudents.length);
      const pct = Math.min(100, Math.round(((hadir + terlambat) / denom) * 100));
      return {
        cls,
        studentCount: clsStudents.length,
        hadir,
        terlambat,
        izin,
        sakit,
        alpa,
        pct,
      };
    });
  }, [classes, students, attendance]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold font-display text-slate-900">
            Laporan & Rekapitulasi Kehadiran Siswa
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rekap harian, mingguan, bulanan, tahunan, per siswa, dan per kelas dilengkapi ekspor
            Excel, PDF resmi, dan Cetak
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportAttendanceToExcel(filteredRecords, `Rekap_${reportTab}`)}
            className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() =>
              exportAttendanceToPdf(
                filteredRecords,
                `LAPORAN REKAPITULASI ABSENSI (${reportTab})`,
                `Periode: ${filterDate} | Kelas: ${
                  filterClassId === 'ALL'
                    ? 'Semua Kelas'
                    : classes.find((c) => c.id === filterClassId)?.name || 'Semua'
                }`,
                settings
              )
            }
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#D4AF37]" />
            <span>Export PDF Resmi</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Report Mode Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 no-print">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
          {(
            [
              { id: 'HARIAN', label: 'Rekap Harian' },
              { id: 'MINGGUAN', label: 'Rekap Mingguan' },
              { id: 'BULANAN', label: 'Rekap Bulanan' },
              { id: 'TAHUNAN', label: 'Rekap Tahunan' },
              { id: 'PER_SISWA', label: 'Rekap Per Siswa' },
              { id: 'PER_KELAS', label: 'Rekap Per Kelas' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setReportTab(t.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                reportTab === t.id
                  ? 'bg-[#0A3D91] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Multi-Dimensional Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {reportTab === 'HARIAN' && (
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
            />
          )}
          {reportTab === 'BULANAN' && (
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
            />
          )}
          {reportTab === 'TAHUNAN' && (
            <input
              type="number"
              min={2024}
              max={2030}
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
            />
          )}

          <select
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className="px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
          >
            <option value="ALL">Semua Kelas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
          >
            <option value="ALL">Semua Status Kehadiran</option>
            <option value="HADIR">HADIR</option>
            <option value="TERLAMBAT">TERLAMBAT</option>
            <option value="IZIN">IZIN</option>
            <option value="SAKIT">SAKIT</option>
            <option value="ALPA">ALPA</option>
          </select>

          <input
            type="text"
            value={filterStudentQuery}
            onChange={(e) => setFilterStudentQuery(e.target.value)}
            placeholder="Filter nama siswa atau NIS..."
            className="px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg lg:col-span-2"
          />
        </div>
      </div>

      {/* Table Content Based on Active Tab */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {reportTab === 'PER_SISWA' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-[#F5F8FF] font-semibold text-slate-600">
                  <th className="py-3 px-4">NIS</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4 text-right">Hadir</th>
                  <th className="py-3 px-4 text-right">Terlambat</th>
                  <th className="py-3 px-4 text-right">Izin</th>
                  <th className="py-3 px-4 text-right">Sakit</th>
                  <th className="py-3 px-4 text-right">Alpa</th>
                  <th className="py-3 px-4 text-right">Persentase Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentRecapRows.map((row) => (
                  <tr key={row.student.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono tabular-nums">{row.student.nis}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {row.student.fullName}
                    </td>
                    <td className="py-3 px-4">{row.student.className}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                      {row.hadir}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700">
                      {row.terlambat}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-sky-700">
                      {row.izin}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-indigo-700">
                      {row.sakit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-rose-700">
                      {row.alpa}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-[#0A3D91]">
                      {row.pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : reportTab === 'PER_KELAS' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-[#F5F8FF] font-semibold text-slate-600">
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">Wali Kelas</th>
                  <th className="py-3 px-4 text-right">Jumlah Siswa</th>
                  <th className="py-3 px-4 text-right">Hadir</th>
                  <th className="py-3 px-4 text-right">Terlambat</th>
                  <th className="py-3 px-4 text-right">Izin</th>
                  <th className="py-3 px-4 text-right">Sakit</th>
                  <th className="py-3 px-4 text-right">Alpa</th>
                  <th className="py-3 px-4 text-right">Persentase Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classRecapRows.map((row) => (
                  <tr key={row.cls.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-[#0A3D91]">{row.cls.name}</td>
                    <td className="py-3 px-4 text-slate-700">{row.cls.homeroomTeacherName}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {row.studentCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                      {row.hadir}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700">
                      {row.terlambat}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-sky-700">
                      {row.izin}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-indigo-700">
                      {row.sakit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-rose-700">
                      {row.alpa}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-[#0A3D91]">
                      {row.pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-[#F5F8FF] font-semibold text-slate-600">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">NIS</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Jam Masuk</th>
                  <th className="py-3 px-4">Jam Pulang</th>
                  <th className="py-3 px-4">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      Tidak ada data laporan absensi untuk filter yang dipilih.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono tabular-nums">{rec.date}</td>
                      <td className="py-3 px-4 font-mono tabular-nums">{rec.nis}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{rec.studentName}</td>
                      <td className="py-3 px-4">{rec.className}</td>
                      <td className="py-3 px-4 font-bold text-[#0A3D91]">{rec.status}</td>
                      <td className="py-3 px-4 font-mono tabular-nums">
                        {rec.checkInTime || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums">
                        {rec.checkOutTime || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{rec.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
