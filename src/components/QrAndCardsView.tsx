import React, { useEffect, useMemo, useState } from 'react';
import {
  QrCode,
  RefreshCw,
  Download,
  FolderArchive,
  Printer,
  ShieldAlert,
  CheckCircle2,
  Search,
  CreditCard,
  Users,
  GraduationCap,
  FileText,
} from 'lucide-react';
import {
  AttendanceSettings,
  PageId,
  QrToken,
  SchoolClass,
  Student,
  Teacher,
  TeacherQrToken,
  UserProfile,
} from '../types';
import {
  downloadBulkQrZip,
  downloadBulkTeacherQrZip,
  downloadSingleQrPng,
  downloadTeacherQrPng,
  exportStudentIdCardsToPdf,
  exportTeacherIdCardsToPdf,
  generateQrDataUrl,
} from '../utils/exportUtils';
import { resolveTeacherQrData } from '../firebase';
import { isSubjectTeacher } from './TeachersClassesView';

interface QrGeneratorViewProps {
  userProfile: UserProfile;
  students: Student[];
  teachers: Teacher[];
  classes: SchoolClass[];
  qrTokens: QrToken[];
  teacherQrTokens?: TeacherQrToken[];
  schoolName?: string;
  onRegenerateStudentQr: (student: Student, reason: string) => Promise<void>;
  onBulkRegenerateQr: (targetStudents: Student[], scopeLabel: string) => Promise<void>;
  onRegenerateTeacherQr?: (teacher: Teacher, reason: string) => Promise<void>;
  onBulkRegenerateTeacherQr?: (targetTeachers: Teacher[], scopeLabel: string) => Promise<void>;
  onNavigate: (page: PageId) => void;
}

export const QrGeneratorView: React.FC<QrGeneratorViewProps> = ({
  userProfile,
  students,
  teachers,
  classes,
  qrTokens,
  teacherQrTokens = [],
  schoolName = 'SDN ASEMROWO II/63 SURABAYA',
  onRegenerateStudentQr,
  onBulkRegenerateQr,
  onRegenerateTeacherQr,
  onBulkRegenerateTeacherQr,
  onNavigate,
}) => {
  const canManageQr =
    userProfile.role === 'SUPER_ADMIN' || userProfile.role === 'ADMIN_SEKOLAH';

  const [targetMode, setTargetMode] = useState<'SISWA' | 'GURU'>('SISWA');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [teacherRoleFilter, setTeacherRoleFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [teacherQrMap, setTeacherQrMap] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [regenTarget, setRegenTarget] = useState<Student | null>(null);
  const [regenReason, setRegenReason] = useState('Kartu pelajar hilang / rusak');
  const [regenTeacherTarget, setRegenTeacherTarget] = useState<Teacher | null>(null);
  const [regenTeacherReason, setRegenTeacherReason] = useState(
    'Pembaruan / penggantian kartu QR guru'
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) => {
      if (s.status !== 'AKTIF') return false;
      if (classFilter !== 'ALL' && s.classId !== classFilter) return false;
      if (!q) return true;
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.nis.toLowerCase().includes(q) ||
        s.qrCodeId.toLowerCase().includes(q)
      );
    });
  }, [students, classFilter, searchQuery]);

  const filteredTeachers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return teachers.filter((t) => {
      if (t.status !== 'AKTIF') return false;
      if (teacherRoleFilter === 'WALI_KELAS') {
        if (t.role !== 'GURU' || isSubjectTeacher(t)) return false;
      } else if (teacherRoleFilter === 'GURU_MAPEL') {
        if (!isSubjectTeacher(t)) return false;
      } else if (teacherRoleFilter === 'STAF') {
        if (t.role === 'GURU') return false;
      }
      if (!q) return true;
      return (
        t.fullName.toLowerCase().includes(q) ||
        t.nip.toLowerCase().includes(q) ||
        t.className.toLowerCase().includes(q)
      );
    });
  }, [teachers, teacherRoleFilter, searchQuery]);

  useEffect(() => {
    let cancelled = false;
    async function renderVisibleQrs() {
      const nextMap: Record<string, string> = {};
      for (const s of filteredStudents.slice(0, 40)) {
        try {
          nextMap[s.id] = await generateQrDataUrl(s.qrToken, 220);
        } catch {
          // ignore
        }
      }
      if (!cancelled) setQrMap(nextMap);
    }
    if (targetMode === 'SISWA') {
      renderVisibleQrs();
    }
    return () => {
      cancelled = true;
    };
  }, [filteredStudents, targetMode]);

  useEffect(() => {
    let cancelled = false;
    async function renderTeacherQrs() {
      const nextMap: Record<string, string> = {};
      for (const t of filteredTeachers) {
        try {
          const { qrToken } = resolveTeacherQrData(t);
          nextMap[t.id] = await generateQrDataUrl(qrToken, 220);
        } catch {
          // ignore
        }
      }
      if (!cancelled) setTeacherQrMap(nextMap);
    }
    if (targetMode === 'GURU') {
      renderTeacherQrs();
    }
    return () => {
      cancelled = true;
    };
  }, [filteredTeachers, targetMode]);

  const revokedCount = useMemo(
    () => qrTokens.filter((t) => t.status === 'REVOKED').length,
    [qrTokens]
  );

  const teacherTokenStats = useMemo(() => {
    const activeTokenVersionByTeacher = new Map<string, number>();
    teacherQrTokens.forEach((tok) => {
      if (tok.status === 'ACTIVE') {
        activeTokenVersionByTeacher.set(tok.teacherId, tok.version || 1);
      }
    });
    const persistedCount = teachers.filter(
      (t) => t.status === 'AKTIF' && Boolean(t.qrToken && t.qrCodeId)
    ).length;
    const revokedTeacherCount = teacherQrTokens.filter((t) => t.status === 'REVOKED').length;
    return { activeTokenVersionByTeacher, persistedCount, revokedTeacherCount };
  }, [teacherQrTokens, teachers]);

  const handleBulkZipDownload = async () => {
    if (filteredStudents.length === 0) return;
    setIsProcessing(true);
    try {
      const label =
        classFilter === 'ALL'
          ? 'Seluruh_Siswa'
          : classes.find((c) => c.id === classFilter)?.name.replace(/\s+/g, '_') || 'Kelas';
      await downloadBulkQrZip(filteredStudents, label);
      setStatusBanner(
        `Berhasil mengunduh arsip ZIP berisi ${filteredStudents.length} file PNG QR Code.`
      );
      setTimeout(() => setStatusBanner(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkTeacherZipDownload = async () => {
    if (filteredTeachers.length === 0) return;
    setIsProcessing(true);
    try {
      const label =
        teacherRoleFilter === 'WALI_KELAS'
          ? 'Wali_Kelas'
          : teacherRoleFilter === 'GURU_MAPEL'
          ? 'Guru_Mapel'
          : teacherRoleFilter === 'STAF'
          ? 'Staf_Sekolah'
          : 'Seluruh_Guru_dan_Staf';
      await downloadBulkTeacherQrZip(filteredTeachers, label, schoolName);
      setStatusBanner(
        `Berhasil mengunduh arsip ZIP berisi ${filteredTeachers.length} file PNG QR Code Guru & Staf.`
      );
      setTimeout(() => setStatusBanner(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkGenerateScope = async (scope: 'CLASS' | 'ALL') => {
    const targets =
      scope === 'ALL'
        ? students.filter((s) => s.status === 'AKTIF')
        : filteredStudents;
    if (targets.length === 0) return;
    setIsProcessing(true);
    try {
      const label =
        scope === 'ALL'
          ? 'Seluruh Siswa Sekolah'
          : classes.find((c) => c.id === classFilter)?.name || 'Kelas Terpilih';
      await onBulkRegenerateQr(targets, label);
      setStatusBanner(
        `Berhasil memperbarui & memverifikasi ${targets.length} token QR Code (${label}). Token lama otomatis dinonaktifkan.`
      );
      setTimeout(() => setStatusBanner(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkGenerateTeacherScope = async (scope: 'FILTERED' | 'ALL') => {
    if (!onBulkRegenerateTeacherQr) return;
    const targets =
      scope === 'ALL'
        ? teachers.filter((t) => t.status === 'AKTIF')
        : filteredTeachers;
    if (targets.length === 0) return;
    setIsProcessing(true);
    try {
      const label =
        scope === 'ALL'
          ? 'Seluruh Guru & Staf'
          : teacherRoleFilter === 'WALI_KELAS'
          ? 'Guru Wali Kelas'
          : teacherRoleFilter === 'GURU_MAPEL'
          ? 'Guru Mata Pelajaran'
          : 'Staf Sekolah';
      await onBulkRegenerateTeacherQr(targets, label);
      setStatusBanner(
        `Berhasil menerbitkan/memperbarui ${targets.length} token QR Code Guru (${label}) di Firestore. QR lama otomatis dinonaktifkan.`
      );
      setTimeout(() => setStatusBanner(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Mode Switcher: Siswa vs Guru Kelas, Mapel & Staf */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[#0A3D91] uppercase tracking-wider">
            Pilih Kategori Token QR Code Absensi
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola dan unduh QR Code resmi untuk Siswa (Per Rombel 1A–6B) maupun Guru Kelas, Guru Mata Pelajaran &amp; Staf
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-[#F5F8FF] p-1 border border-blue-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTargetMode('SISWA')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              targetMode === 'SISWA'
                ? 'bg-[#0A3D91] text-white shadow-xs'
                : 'text-slate-700 hover:text-[#0A3D91]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>QR Siswa ({students.filter((s) => s.status === 'AKTIF').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTargetMode('GURU')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              targetMode === 'GURU'
                ? 'bg-[#0A3D91] text-white shadow-xs'
                : 'text-slate-700 hover:text-[#0A3D91]'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>QR Guru Kelas, Mapel &amp; Staf ({teachers.filter((t) => t.status === 'AKTIF').length})</span>
          </button>
        </div>
      </div>

      {/* Top Action Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold font-display text-slate-900">
            {targetMode === 'SISWA'
              ? 'QR Code Generator & Manajemen Token Siswa'
              : 'QR Code Generator Guru Wali Kelas, Guru Mapel & Staf'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {targetMode === 'SISWA'
              ? `Setiap siswa memiliki 1 QR Code kriptografis permanen tanpa menyimpan data pribadi di dalam payload QR (${filteredStudents.length} token aktif · ${revokedCount} token lama dinonaktifkan)`
              : `Setiap Guru Wali Rombel, Guru Mata Pelajaran, dan Staf memiliki QR Code terverifikasi Firestore (${teacherTokenStats.persistedCount}/${teachers.filter((t) => t.status === 'AKTIF').length} token tersimpan · ${teacherTokenStats.revokedTeacherCount} token lama dinonaktifkan)`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {targetMode === 'SISWA' && canManageQr && (
            <>
              {classFilter !== 'ALL' && (
                <button
                  onClick={() => handleBulkGenerateScope('CLASS')}
                  disabled={isProcessing}
                  className="px-3.5 py-2 text-xs font-semibold text-[#0A3D91] bg-[#F5F8FF] border border-blue-200 hover:bg-blue-50 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Generate QR Satu Rombel</span>
                </button>
              )}

              <button
                onClick={() => handleBulkGenerateScope('ALL')}
                disabled={isProcessing}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <QrCode className="w-3.5 h-3.5 text-[#0A3D91]" />
                <span>Generate QR Seluruh Siswa</span>
              </button>
            </>
          )}

          {targetMode === 'SISWA' && (
            <button
              onClick={handleBulkZipDownload}
              disabled={isProcessing || filteredStudents.length === 0}
              className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <FolderArchive className="w-4 h-4 text-amber-700" />
              <span>{isProcessing ? 'Memproses ZIP...' : 'Download QR dalam ZIP'}</span>
            </button>
          )}

          {targetMode === 'GURU' && canManageQr && onBulkRegenerateTeacherQr && (
            <>
              {teacherRoleFilter !== 'ALL' && (
                <button
                  onClick={() => handleBulkGenerateTeacherScope('FILTERED')}
                  disabled={isProcessing || filteredTeachers.length === 0}
                  className="px-3.5 py-2 text-xs font-semibold text-[#0A3D91] bg-[#F5F8FF] border border-blue-200 hover:bg-blue-50 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Generate QR Kategori Terpilih</span>
                </button>
              )}

              <button
                onClick={() => handleBulkGenerateTeacherScope('ALL')}
                disabled={isProcessing || teachers.filter((t) => t.status === 'AKTIF').length === 0}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <QrCode className="w-3.5 h-3.5 text-[#0A3D91]" />
                <span>Generate QR Seluruh Guru</span>
              </button>
            </>
          )}

          {targetMode === 'GURU' && (
            <button
              onClick={handleBulkTeacherZipDownload}
              disabled={isProcessing || filteredTeachers.length === 0}
              className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <FolderArchive className="w-4 h-4 text-amber-700" />
              <span>{isProcessing ? 'Memproses ZIP...' : 'Download QR Guru (ZIP)'}</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('id-cards')}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CreditCard className="w-4 h-4 text-[#D4AF37]" />
            <span>Cetak Kartu ID (Siswa &amp; Guru)</span>
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              targetMode === 'SISWA'
                ? 'Cari nama siswa, NIS, atau Token ID...'
                : 'Cari nama guru, NIP, rombel, atau mata pelajaran...'
            }
            className="w-full pl-10 pr-4 py-2 text-xs bg-[#F5F8FF] border border-slate-200 rounded-lg focus:outline-none focus:border-[#0A3D91]"
          />
        </div>

        {targetMode === 'SISWA' ? (
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-[#F5F8FF] border border-slate-200 rounded-lg text-slate-800"
          >
            <option value="ALL">Semua Rombel (Kelas 1A – 6B)</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={teacherRoleFilter}
            onChange={(e) => setTeacherRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-[#F5F8FF] border border-slate-200 rounded-lg text-slate-800"
          >
            <option value="ALL">Semua Guru &amp; Staf</option>
            <option value="WALI_KELAS">Guru Kelas (Wali Rombel 1A–6B)</option>
            <option value="GURU_MAPEL">Guru Mata Pelajaran (Mapel)</option>
            <option value="STAF">Staf Tata Usaha &amp; Pimpinan</option>
          </select>
        )}
      </div>

      {/* QR Code Cards Grid */}
      {targetMode === 'SISWA' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredStudents.map((std) => (
            <div
              key={std.id}
              className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-xs font-semibold text-[#0A3D91]">{std.className}</p>
                    <h3 className="text-sm font-bold font-display text-slate-900 line-clamp-1">
                      {std.fullName}
                    </h3>
                    <p className="text-xs font-mono tabular-nums text-slate-500">
                      NIS: {std.nis} · NISN: {std.nisn}
                    </p>
                  </div>
                </div>

                <div className="bg-[#F5F8FF] border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center my-2">
                  {qrMap[std.id] ? (
                    <img
                      src={qrMap[std.id]}
                      alt={`QR ${std.fullName}`}
                      referrerPolicy="no-referrer"
                      className="w-40 h-40 object-contain"
                    />
                  ) : (
                    <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400">
                      Memuat QR...
                    </div>
                  )}
                  <p className="mt-2 text-[11px] font-mono tabular-nums text-slate-500 truncate max-w-full">
                    ID: {std.qrCodeId}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                <button
                  onClick={() => downloadSingleQrPng(std)}
                  className="flex-1 py-1.5 px-2.5 text-xs font-semibold text-[#0A3D91] bg-[#F5F8FF] hover:bg-blue-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh PNG</span>
                </button>

                {canManageQr && (
                  <button
                    onClick={() => {
                      setRegenTarget(std);
                      setRegenReason('Kartu pelajar hilang / rusak');
                    }}
                    title="Regenerasi Token QR (Nonaktifkan QR Lama)"
                    className="py-1.5 px-2.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Regenerasi</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTeachers.map((tch) => {
            const isMapel = isSubjectTeacher(tch);
            const { qrCodeId, isPersistent } = resolveTeacherQrData(tch);
            const tokenVersion = teacherTokenStats.activeTokenVersionByTeacher.get(tch.id) || 1;
            return (
              <div
                key={tch.id}
                className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                            isMapel
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : tch.role === 'GURU'
                              ? 'bg-blue-50 text-[#0A3D91] border border-blue-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isMapel
                            ? 'GURU MAPEL'
                            : tch.role === 'GURU'
                            ? 'WALI KELAS'
                            : 'STAF / TU'}
                        </span>
                        <span
                          className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isPersistent
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isPersistent ? `Token v${tokenVersion}` : 'QR Standar'}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold font-display text-slate-900 line-clamp-1">
                        {tch.fullName}
                      </h3>
                      <p className="text-xs font-semibold text-[#0A3D91] line-clamp-1">
                        {tch.className}
                      </p>
                      <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                        NIP: {tch.nip}
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#F5F8FF] border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center my-2">
                    {teacherQrMap[tch.id] ? (
                      <img
                        src={teacherQrMap[tch.id]}
                        alt={`QR ${tch.fullName}`}
                        referrerPolicy="no-referrer"
                        className="w-40 h-40 object-contain"
                      />
                    ) : (
                      <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400">
                        Memuat QR...
                      </div>
                    )}
                    <p className="mt-2 text-[11px] font-mono tabular-nums text-slate-500 truncate max-w-full">
                      ID: {qrCodeId}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                  <button
                    onClick={() => downloadTeacherQrPng(tch, schoolName)}
                    className="flex-1 py-1.5 px-2.5 text-xs font-semibold text-[#0A3D91] bg-[#F5F8FF] hover:bg-blue-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh PNG</span>
                  </button>

                  {canManageQr && onRegenerateTeacherQr && (
                    <button
                      onClick={() => {
                        setRegenTeacherTarget(tch);
                        setRegenTeacherReason('Pembaruan / penggantian kartu QR guru');
                      }}
                      title="Regenerasi Token QR Guru (Nonaktifkan QR Lama)"
                      className="py-1.5 px-2.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Regenerasi</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Regenerate QR Modal (Revokes old QR Token) */}
      {regenTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center gap-2.5 text-amber-700 mb-3">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold font-display text-slate-900">
                Regenerasi QR Code Siswa
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Anda akan membuat token QR Code baru untuk{' '}
              <strong className="text-slate-900">{regenTarget.fullName}</strong> ({regenTarget.className}
              ). Token QR lama (<span className="font-mono">{regenTarget.qrCodeId}</span>) akan
              otomatis diubah menjadi <strong>REVOKED (Nonaktif)</strong> dan tidak dapat digunakan
              lagi untuk scan absensi.
            </p>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alasan Regenerasi (Tercatat di Audit Log) *
              </label>
              <input
                type="text"
                value={regenReason}
                onChange={(e) => setRegenReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F5F8FF] border border-slate-200 rounded-lg"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRegenTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  setIsProcessing(true);
                  try {
                    await onRegenerateStudentQr(regenTarget, regenReason);
                    setStatusBanner(
                      `QR Code baru untuk ${regenTarget.fullName} berhasil dibuat. QR Code lama telah dinonaktifkan.`
                    );
                    setRegenTarget(null);
                    setTimeout(() => setStatusBanner(null), 5000);
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg cursor-pointer"
              >
                {isProcessing ? 'Memproses...' : 'Buat QR Baru & Nonaktifkan Lama'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Regenerate Teacher QR Modal */}
      {regenTeacherTarget && onRegenerateTeacherQr && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center gap-2.5 text-amber-700 mb-3">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold font-display text-slate-900">
                Regenerasi QR Code Guru &amp; Staf
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Anda akan menerbitkan token QR Code baru untuk{' '}
              <strong className="text-slate-900">{regenTeacherTarget.fullName}</strong> (
              {regenTeacherTarget.className}). Token QR sebelumnya (
              <span className="font-mono">{resolveTeacherQrData(regenTeacherTarget).qrCodeId}</span>
              ) akan otomatis diubah menjadi <strong>REVOKED (Nonaktif)</strong> dan tidak dapat
              digunakan lagi untuk scan presensi guru.
            </p>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alasan Regenerasi (Tercatat di Audit Log) *
              </label>
              <input
                type="text"
                value={regenTeacherReason}
                onChange={(e) => setRegenTeacherReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F5F8FF] border border-slate-200 rounded-lg"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRegenTeacherTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  setIsProcessing(true);
                  try {
                    await onRegenerateTeacherQr(regenTeacherTarget, regenTeacherReason);
                    setStatusBanner(
                      `QR Code baru untuk ${regenTeacherTarget.fullName} berhasil diterbitkan. QR Code lama telah dinonaktifkan.`
                    );
                    setRegenTeacherTarget(null);
                    setTimeout(() => setStatusBanner(null), 5000);
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg cursor-pointer"
              >
                {isProcessing ? 'Memproses...' : 'Terbitkan QR Baru & Nonaktifkan Lama'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface StudentIdCardsViewProps {
  students: Student[];
  teachers: Teacher[];
  classes: SchoolClass[];
  settings: AttendanceSettings;
  tagline?: string;
}

export const StudentIdCardsView: React.FC<StudentIdCardsViewProps> = ({
  students,
  teachers,
  classes,
  settings,
  tagline = 'Scan, Verify, Attend!',
}) => {
  const [cardMode, setCardMode] = useState<'SISWA' | 'GURU'>('SISWA');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [teacherRoleFilter, setTeacherRoleFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [teacherQrMap, setTeacherQrMap] = useState<Record<string, string>>({});
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [cardBanner, setCardBanner] = useState<string | null>(null);

  const activeStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) => {
      if (s.status !== 'AKTIF') return false;
      if (classFilter !== 'ALL' && s.classId !== classFilter) return false;
      if (!q) return true;
      return s.fullName.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q);
    });
  }, [students, classFilter, searchQuery]);

  const activeTeachers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return teachers.filter((t) => {
      if (t.status !== 'AKTIF') return false;
      if (teacherRoleFilter === 'WALI_KELAS') {
        if (t.role !== 'GURU' || isSubjectTeacher(t)) return false;
      } else if (teacherRoleFilter === 'GURU_MAPEL') {
        if (!isSubjectTeacher(t)) return false;
      } else if (teacherRoleFilter === 'STAF') {
        if (t.role === 'GURU') return false;
      }
      if (!q) return true;
      return (
        t.fullName.toLowerCase().includes(q) ||
        t.nip.toLowerCase().includes(q) ||
        t.className.toLowerCase().includes(q)
      );
    });
  }, [teachers, teacherRoleFilter, searchQuery]);

  useEffect(() => {
    let cancelled = false;
    async function loadQrs() {
      const map: Record<string, string> = {};
      for (const s of activeStudents) {
        try {
          map[s.id] = await generateQrDataUrl(s.qrToken, 200);
        } catch {
          // ignore
        }
      }
      if (!cancelled) setQrMap(map);
    }
    if (cardMode === 'SISWA') {
      loadQrs();
    }
    return () => {
      cancelled = true;
    };
  }, [activeStudents, cardMode]);

  useEffect(() => {
    let cancelled = false;
    async function loadTeacherQrs() {
      const map: Record<string, string> = {};
      for (const t of activeTeachers) {
        try {
          const { qrToken } = resolveTeacherQrData(t);
          map[t.id] = await generateQrDataUrl(qrToken, 200);
        } catch {
          // ignore
        }
      }
      if (!cancelled) setTeacherQrMap(map);
    }
    if (cardMode === 'GURU') {
      loadTeacherQrs();
    }
    return () => {
      cancelled = true;
    };
  }, [activeTeachers, cardMode]);

  const activeCount = cardMode === 'SISWA' ? activeStudents.length : activeTeachers.length;

  const handleDownloadCardsPdf = async () => {
    if (activeCount === 0) return;
    setIsExportingPdf(true);
    try {
      if (cardMode === 'SISWA') {
        const label =
          classFilter === 'ALL'
            ? 'Seluruh_Siswa'
            : classes.find((c) => c.id === classFilter)?.name || 'Rombel';
        await exportStudentIdCardsToPdf(activeStudents, settings, label, tagline);
        setCardBanner(
          `Berhasil mengunduh file PDF Lembar Cetak Kartu Pelajar (${activeStudents.length} kartu ukuran CR-80 siap cetak A4).`
        );
      } else {
        const label =
          teacherRoleFilter === 'WALI_KELAS'
            ? 'Guru_Wali_Kelas'
            : teacherRoleFilter === 'GURU_MAPEL'
            ? 'Guru_Mata_Pelajaran'
            : teacherRoleFilter === 'STAF'
            ? 'Staf_Sekolah'
            : 'Seluruh_Guru_dan_Staf';
        await exportTeacherIdCardsToPdf(activeTeachers, settings, label, tagline);
        setCardBanner(
          `Berhasil mengunduh file PDF Lembar Cetak Kartu ID Guru & Staf (${activeTeachers.length} kartu ukuran CR-80 siap cetak A4).`
        );
      }
      setTimeout(() => setCardBanner(null), 5000);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Switcher (Hidden during print) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <p className="text-xs font-bold text-[#0A3D91] uppercase tracking-wider">
            Pilih Jenis Kartu ID (Standar CR-80)
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Cetak kartu ber-QR Code untuk Siswa maupun Guru Kelas, Guru Mata Pelajaran &amp; Staf
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-[#F5F8FF] p-1 border border-blue-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setCardMode('SISWA')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              cardMode === 'SISWA'
                ? 'bg-[#0A3D91] text-white shadow-xs'
                : 'text-slate-700 hover:text-[#0A3D91]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Kartu Pelajar Siswa ({students.filter((s) => s.status === 'AKTIF').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setCardMode('GURU')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              cardMode === 'GURU'
                ? 'bg-[#0A3D91] text-white shadow-xs'
                : 'text-slate-700 hover:text-[#0A3D91]'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Kartu ID Guru &amp; Mapel ({teachers.filter((t) => t.status === 'AKTIF').length})</span>
          </button>
        </div>
      </div>

      {/* Control Header (Hidden during print) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold font-display text-slate-900">
            {cardMode === 'SISWA'
              ? 'Cetak Kartu Pelajar QR Code (Ukuran Standar ID Card CR-80)'
              : 'Cetak Kartu ID Guru Kelas, Guru Mapel & Staf (Standar CR-80)'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Template kartu resmi dilengkapi Logo Sekolah, Identitas{' '}
            {cardMode === 'SISWA' ? 'Siswa' : 'Pendidik / Tenaga Kependidikan'}, dan QR Code
            permanen ({activeCount} kartu siap cetak)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={cardMode === 'SISWA' ? 'Cari nama / NIS...' : 'Cari nama / NIP / Mapel...'}
              className="pl-9 pr-3 py-2 text-xs bg-[#F5F8FF] border border-slate-200 rounded-lg"
            />
          </div>

          {cardMode === 'SISWA' ? (
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-[#F5F8FF] border border-slate-200 rounded-lg"
            >
              <option value="ALL">Semua Rombel ({students.length} Siswa)</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={teacherRoleFilter}
              onChange={(e) => setTeacherRoleFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-[#F5F8FF] border border-slate-200 rounded-lg"
            >
              <option value="ALL">Semua Guru &amp; Staf ({teachers.length})</option>
              <option value="WALI_KELAS">Guru Kelas (Wali Rombel)</option>
              <option value="GURU_MAPEL">Guru Mata Pelajaran (Mapel)</option>
              <option value="STAF">Staf Tata Usaha</option>
            </select>
          )}

          <button
            onClick={() => void handleDownloadCardsPdf()}
            disabled={isExportingPdf || activeCount === 0}
            className="px-4 py-2 text-xs font-semibold text-[#0A3D91] bg-[#F5F8FF] hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <FileText className="w-4 h-4 text-[#0A3D91]" />
            <span>
              {isExportingPdf
                ? 'Menyusun PDF...'
                : `Unduh PDF Siap Cetak A4 (${activeCount})`}
            </span>
          </button>

          <button
            onClick={() => window.print()}
            disabled={activeCount === 0}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <Printer className="w-4 h-4 text-[#D4AF37]" />
            <span>Cetak Langsung ({activeCount})</span>
          </button>
        </div>
      </div>

      {cardBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2 no-print">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{cardBanner}</span>
        </div>
      )}

      {/* Printable ID Cards Grid (CR-80 Standard Proportions) */}
      {cardMode === 'SISWA' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
          {activeStudents.map((std) => (
            <div
              key={std.id}
              className="bg-white rounded-2xl border border-slate-300 overflow-hidden shadow-xs break-inside-avoid"
            >
              {/* Card Header Banner */}
              <div className="bg-[#0A3D91] text-white px-4 py-3 flex items-center gap-3 border-b-4 border-[#D4AF37]">
                <div className="w-10 h-10 rounded-lg bg-white p-0.5 shrink-0 flex items-center justify-center overflow-hidden">
                  <img
                    src="/assets/aistudio/EB607786-7417-4AF8-93A0-7453467400F4_9963c46a.png"
                    alt={`Logo ${settings.schoolName}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-[#D4AF37] tracking-wider">
                    KARTU PELAJAR SMART ATTENDANCE
                  </p>
                  <h3 className="text-xs font-bold font-display text-white truncate">
                    {settings.schoolName}
                  </h3>
                  <p className="text-[10px] text-blue-100 truncate">
                    Dinas Pendidikan Kota Surabaya · NPSN {settings.npsn}
                  </p>
                </div>
              </div>

              {/* Card Body: Student Photo & Identity + QR Code */}
              <div className="p-4 flex items-center justify-between gap-3 bg-white">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Student Photo */}
                  <div className="w-16 h-20 rounded-lg bg-[#F5F8FF] border border-slate-200 flex flex-col items-center justify-center shrink-0 overflow-hidden text-[#0A3D91]">
                    {std.photoUrl ? (
                      <img
                        src={std.photoUrl}
                        alt={std.fullName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <span className="text-base font-bold font-display">
                          {std.fullName
                            .split(' ')
                            .slice(0, 2)
                            .map((n) => n[0])
                            .join('')}
                        </span>
                        <span className="text-[9px] text-slate-400 mt-0.5">FOTO 3x4</span>
                      </>
                    )}
                  </div>

                  {/* Student Identity */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs font-bold font-display text-slate-900 leading-snug line-clamp-2">
                      {std.fullName}
                    </p>
                    <div className="text-[11px] text-slate-600 space-y-0.5 font-mono tabular-nums">
                      <p>
                        <span className="text-slate-400">NIS:</span>{' '}
                        <strong className="text-slate-800">{std.nis}</strong>
                      </p>
                      <p>
                        <span className="text-slate-400">NISN:</span> {std.nisn}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-[#0A3D91] pt-0.5">{std.className}</p>
                    <p className="text-[10px] text-slate-500 truncate">{std.birthPlaceDate}</p>
                  </div>
                </div>

                {/* Permanent Student QR Code */}
                <div className="shrink-0 flex flex-col items-center">
                  <div className="p-1.5 bg-white border border-slate-200 rounded-lg">
                    {qrMap[std.id] ? (
                      <img
                        src={qrMap[std.id]}
                        alt={`QR ${std.nis}`}
                        referrerPolicy="no-referrer"
                        className="w-20 h-20 object-contain"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-slate-100" />
                    )}
                  </div>
                  <span className="text-[9px] font-mono tabular-nums text-slate-400 mt-1">
                    {std.nis} · {std.gender}
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-4 py-2 bg-[#F5F8FF] border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
                <span>{tagline}</span>
                <span className="font-mono tabular-nums">TP {settings.activeAcademicYear}</span>
              </div>

              {/* Individual Card Actions (Hidden during print) */}
              <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center justify-between gap-2 no-print">
                <button
                  type="button"
                  onClick={() => void downloadSingleQrPng(std)}
                  className="flex-1 py-1.5 px-2.5 text-[11px] font-semibold text-[#0A3D91] bg-[#F5F8FF] hover:bg-blue-100 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void exportStudentIdCardsToPdf(
                      [std],
                      settings,
                      `${std.className}_${std.nis}_${std.fullName}`,
                      tagline
                    )
                  }
                  className="flex-1 py-1.5 px-2.5 text-[11px] font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Cetak PDF Kartu</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
          {activeTeachers.map((tch) => {
            const isMapel = isSubjectTeacher(tch);
            const { qrCodeId } = resolveTeacherQrData(tch);
            return (
              <div
                key={tch.id}
                className="bg-white rounded-2xl border border-slate-300 overflow-hidden shadow-xs break-inside-avoid"
              >
                {/* Card Header Banner */}
                <div className="bg-[#0A3D91] text-white px-4 py-3 flex items-center gap-3 border-b-4 border-[#D4AF37]">
                  <div className="w-10 h-10 rounded-lg bg-white p-0.5 shrink-0 flex items-center justify-center overflow-hidden">
                    <img
                      src="/assets/aistudio/EB607786-7417-4AF8-93A0-7453467400F4_9963c46a.png"
                      alt={`Logo ${settings.schoolName}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-[#D4AF37] tracking-wider">
                      KARTU PRESENSI GURU &amp; TENAGA KEPENDIDIKAN
                    </p>
                    <h3 className="text-xs font-bold font-display text-white truncate">
                      {settings.schoolName}
                    </h3>
                    <p className="text-[10px] text-blue-100 truncate">
                      Dinas Pendidikan Kota Surabaya · NPSN {settings.npsn}
                    </p>
                  </div>
                </div>

                {/* Card Body: Teacher Identity + QR Code */}
                <div className="p-4 flex items-center justify-between gap-3 bg-white">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-16 h-20 rounded-lg bg-[#F5F8FF] border border-slate-200 flex flex-col items-center justify-center shrink-0 overflow-hidden text-[#0A3D91]">
                      <span className="text-base font-bold font-display">
                        {tch.fullName
                          .split(' ')
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join('')}
                      </span>
                      <span className="text-[9px] text-slate-400 mt-0.5">
                        {isMapel ? 'MAPEL' : tch.role === 'GURU' ? 'ROMBEL' : 'STAF'}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-bold font-display text-slate-900 leading-snug line-clamp-2">
                        {tch.fullName}
                      </p>
                      <p className="text-[11px] font-mono tabular-nums text-slate-600">
                        <span className="text-slate-400">NIP:</span>{' '}
                        <strong className="text-slate-800">{tch.nip}</strong>
                      </p>
                      <p className="text-xs font-bold text-[#0A3D91] pt-0.5 line-clamp-1">
                        {tch.className}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {isMapel
                          ? 'Guru Mata Pelajaran (Kelas 1A–6B)'
                          : tch.role === 'GURU'
                          ? 'Wali Kelas Rombel'
                          : 'Tenaga Kependidikan'}
                      </p>
                    </div>
                  </div>

                  {/* Permanent Teacher QR Code */}
                  <div className="shrink-0 flex flex-col items-center">
                    <div className="p-1.5 bg-white border border-slate-200 rounded-lg">
                      {teacherQrMap[tch.id] ? (
                        <img
                          src={teacherQrMap[tch.id]}
                          alt={`QR ${tch.fullName}`}
                          referrerPolicy="no-referrer"
                          className="w-20 h-20 object-contain"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-slate-100" />
                      )}
                    </div>
                    <span className="text-[9px] font-mono tabular-nums text-slate-400 mt-1">
                      {qrCodeId}
                    </span>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-4 py-2 bg-[#F5F8FF] border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
                  <span>{tagline}</span>
                  <span className="font-mono tabular-nums">TP {settings.activeAcademicYear}</span>
                </div>

                {/* Individual Teacher Card Actions (Hidden during print) */}
                <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center justify-between gap-2 no-print">
                  <button
                    type="button"
                    onClick={() => void downloadTeacherQrPng(tch, settings.schoolName)}
                    className="flex-1 py-1.5 px-2.5 text-[11px] font-semibold text-[#0A3D91] bg-[#F5F8FF] hover:bg-blue-100 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh PNG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void exportTeacherIdCardsToPdf(
                        [tch],
                        settings,
                        `${tch.className}_${tch.fullName}`,
                        tagline
                      )
                    }
                    className="flex-1 py-1.5 px-2.5 text-[11px] font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Cetak PDF Kartu</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

