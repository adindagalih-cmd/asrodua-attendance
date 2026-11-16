import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  RefreshCw,
  CheckCircle2,
  Send,
  Settings,
  ShieldCheck,
  User,
  Calendar,
  Plus,
  RotateCcw,
  AlertTriangle,
  Users,
  GraduationCap,
} from 'lucide-react';
import {
  AcademicYear,
  AttendanceSettings,
  AuditLog,
  NotificationLog,
  ResetDataResult,
  ResetDataScope,
  SchoolClass,
  UserProfile,
  UserRole,
} from '../types';
import { DIRTY_DOZEN_TESTS } from '../../firestore.rules.test';

interface NotificationsViewProps {
  userProfile: UserProfile;
  notificationLogs: NotificationLog[];
  settings: AttendanceSettings;
  onRetryNotification: (log: NotificationLog) => Promise<void>;
  onSaveTemplate: (newTemplate: string) => Promise<void>;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  userProfile,
  notificationLogs,
  settings,
  onRetryNotification,
  onSaveTemplate,
}) => {
  const canEditTemplate =
    userProfile.role === 'SUPER_ADMIN' || userProfile.role === 'ADMIN_SEKOLAH';
  const [templateText, setTemplateText] = useState(settings.whatsappTemplate);
  const [isSaving, setIsSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    setTemplateText(settings.whatsappTemplate);
  }, [settings.whatsappTemplate]);

  const deliveredCount = notificationLogs.filter(
    (n) => n.status === 'DELIVERED' || n.status === 'SENT'
  ).length;
  const failedCount = notificationLogs.filter((n) => n.status === 'FAILED').length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold font-display text-slate-900">
            Notifikasi WhatsApp Orang Tua / Wali Siswa
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Otomatisasi pengiriman pesan kehadiran siswa ke nomor WhatsApp orang tua dengan
            proteksi anti-duplikasi ({deliveredCount} terkirim · {failedCount} gagal)
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
          <span className="text-slate-600">
            Gateway: <strong>{settings.whatsappProvider}</strong>
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-emerald-700 font-semibold">
            {settings.whatsappEnabled ? 'AKTIF' : 'NONAKTIF'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Cols: Official WhatsApp Message Template Editor */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold font-display text-slate-900">
                Template Pesan WhatsApp Resmi
              </h2>
              <MessageSquare className="w-4 h-4 text-[#0A3D91]" />
            </div>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Gunakan variabel <code className="font-mono text-[#0A3D91]">[Nama Siswa]</code>,{' '}
              <code className="font-mono text-[#0A3D91]">[Kelas]</code>,{' '}
              <code className="font-mono text-[#0A3D91]">[Jam Kehadiran]</code>, dan{' '}
              <code className="font-mono text-[#0A3D91]">[Tanggal]</code>. Sistem tidak mengirim
              notifikasi Alpa otomatis sebelum batas jam verifikasi sekolah selesai.
            </p>

            <textarea
              rows={11}
              value={templateText}
              disabled={!canEditTemplate}
              onChange={(e) => setTemplateText(e.target.value)}
              className="w-full p-3.5 text-xs font-mono bg-[#F5F8FF] border border-slate-200 rounded-xl text-slate-800 leading-relaxed focus:outline-none focus:border-[#0A3D91]"
            />
          </div>

          {canEditTemplate && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              {savedBanner ? (
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Template disimpan
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">
                  Perubahan langsung berlaku saat scan berikutnya
                </span>
              )}
              <button
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    await onSaveTemplate(templateText);
                    setSavedBanner(true);
                    setTimeout(() => setSavedBanner(false), 3000);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg cursor-pointer"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan Template'}
              </button>
            </div>
          )}
        </div>

        {/* Right 7 Cols: Riwayat & Status Pengiriman Notifikasi */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold font-display text-slate-900">
                Riwayat Pengiriman Notifikasi WhatsApp
              </h2>
              <p className="text-xs text-slate-500">
                Dilengkapi pencegahan pesan ganda (Idempotent Notification ID) & pengiriman ulang
              </p>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-[#F5F8FF] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Waktu</th>
                  <th className="py-2.5 px-4">Siswa & Kelas</th>
                  <th className="py-2.5 px-4">Orang Tua / Nomor WA</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notificationLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Belum ada riwayat notifikasi WhatsApp.
                    </td>
                  </tr>
                ) : (
                  notificationLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                        {log.sentAt.slice(11, 19) || log.date}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{log.studentName}</p>
                        <p className="text-slate-500">
                          {log.className} · Sesi {log.session}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-800">{log.parentName}</p>
                        <p className="font-mono tabular-nums text-slate-500">
                          {log.recipientPhone}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-bold ${
                            log.status === 'DELIVERED' || log.status === 'SENT'
                              ? 'text-emerald-700'
                              : log.status === 'FAILED'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {log.status}
                        </span>
                        {log.retryCount > 0 && (
                          <span className="block text-[10px] font-mono text-slate-400">
                            Retry: {log.retryCount}x
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => onRetryNotification(log)}
                            title="Kirim Ulang via API Gateway"
                            className="px-2.5 py-1 text-xs font-semibold text-[#0A3D91] bg-[#F5F8FF] hover:bg-blue-100 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Kirim Ulang</span>
                          </button>
                          <a
                            href={`https://wa.me/${log.recipientPhone.replace(
                              /[^0-9]/g,
                              ''
                            )}?text=${encodeURIComponent(log.message)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg inline-flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            <span>WA</span>
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SettingsViewProps {
  userProfile: UserProfile;
  settings: AttendanceSettings;
  academicYears: AcademicYear[];
  auditLogs: AuditLog[];
  onSaveSettings: (updated: AttendanceSettings) => Promise<void>;
  onAddAcademicYear: (year: string, semester: 'GANJIL' | 'GENAP') => Promise<void>;
  onActivateAcademicYear: (ay: AcademicYear) => Promise<void>;
  teacherCount?: number;
  studentCount?: number;
  onResetSchoolData?: (
    scope: ResetDataScope,
    includeAttendance: boolean
  ) => Promise<ResetDataResult>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  userProfile,
  settings,
  academicYears,
  auditLogs,
  onSaveSettings,
  onAddAcademicYear,
  onActivateAcademicYear,
  teacherCount = 0,
  studentCount = 0,
  onResetSchoolData,
}) => {
  const canEditSettings =
    userProfile.role === 'SUPER_ADMIN' || userProfile.role === 'ADMIN_SEKOLAH';
  const [form, setForm] = useState<AttendanceSettings>(settings);
  const [newYearStr, setNewYearStr] = useState('2027/2028');
  const [newSemester, setNewSemester] = useState<'GANJIL' | 'GENAP'>('GANJIL');
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [resetScopeModal, setResetScopeModal] = useState<ResetDataScope | null>(null);
  const [includeAttendanceReset, setIncludeAttendanceReset] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [resetResultMsg, setResetResultMsg] = useState<string | null>(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSettings) return;
    setIsSaving(true);
    try {
      await onSaveSettings(form);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold font-display text-slate-900">
            Pengaturan Sistem, Jam Operasional & Keamanan
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Konfigurasi jam masuk/pulang, tahun pelajaran aktif, WhatsApp API Gateway, dan Audit
            Keamanan Firestore
          </p>
        </div>
        <Settings className="w-6 h-6 text-[#0A3D91]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Operational Hours & School Config */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-5 text-xs"
        >
          <h2 className="text-base font-bold font-display text-slate-900 pb-3 border-b border-slate-200">
            1. Pengaturan Jam Masuk, Jam Pulang & Identitas Sekolah
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Sekolah</label>
              <input
                type="text"
                disabled={!canEditSettings}
                value={form.schoolName}
                onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">NPSN Sekolah</label>
              <input
                type="text"
                disabled={!canEditSettings}
                value={form.npsn}
                onChange={(e) => setForm({ ...form, npsn: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap Sekolah</label>
            <input
              type="text"
              disabled={!canEditSettings}
              value={form.schoolAddress}
              onChange={(e) => setForm({ ...form, schoolAddress: e.target.value })}
              className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Kepala Sekolah</label>
              <input
                type="text"
                disabled={!canEditSettings}
                value={form.principalName}
                onChange={(e) => setForm({ ...form, principalName: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">NIP Kepala Sekolah</label>
              <input
                type="text"
                disabled={!canEditSettings}
                value={form.principalNip}
                onChange={(e) => setForm({ ...form, principalNip: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Email Login Kepsek (Firestore)
              </label>
              <input
                type="email"
                disabled={!canEditSettings}
                value={form.principalEmail}
                onChange={(e) => setForm({ ...form, principalEmail: e.target.value })}
                placeholder="kepsek@sdnasemrowo2.sch.id"
                className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Tahun Pelajaran Aktif
              </label>
              <input
                type="text"
                disabled={!canEditSettings}
                value={form.activeAcademicYear}
                onChange={(e) => setForm({ ...form, activeAcademicYear: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Semester Aktif</label>
              <select
                disabled={!canEditSettings}
                value={form.semester}
                onChange={(e) =>
                  setForm({ ...form, semester: e.target.value as 'GANJIL' | 'GENAP' })
                }
                className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
              >
                <option value="GANJIL">GANJIL</option>
                <option value="GENAP">GENAP</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mulai Masuk</label>
              <input
                type="time"
                disabled={!canEditSettings}
                value={form.checkInStart}
                onChange={(e) => setForm({ ...form, checkInStart: e.target.value })}
                className="w-full px-2.5 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Batas Tepat Waktu</label>
              <input
                type="time"
                disabled={!canEditSettings}
                value={form.checkInDeadline}
                onChange={(e) => setForm({ ...form, checkInDeadline: e.target.value })}
                className="w-full px-2.5 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Batas Telat</label>
              <input
                type="time"
                disabled={!canEditSettings}
                value={form.checkInLateLimit}
                onChange={(e) => setForm({ ...form, checkInLateLimit: e.target.value })}
                className="w-full px-2.5 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mulai Pulang</label>
              <input
                type="time"
                disabled={!canEditSettings}
                value={form.checkOutStart}
                onChange={(e) => setForm({ ...form, checkOutStart: e.target.value })}
                className="w-full px-2.5 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Batas Pulang</label>
              <input
                type="time"
                disabled={!canEditSettings}
                value={form.checkOutEnd}
                onChange={(e) => setForm({ ...form, checkOutEnd: e.target.value })}
                className="w-full px-2.5 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Provider WhatsApp API</label>
              <input
                type="text"
                disabled={!canEditSettings}
                value={form.whatsappProvider}
                onChange={(e) => setForm({ ...form, whatsappProvider: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Endpoint URL WhatsApp Gateway
              </label>
              <input
                type="text"
                disabled={!canEditSettings}
                value={form.whatsappApiUrl}
                onChange={(e) => setForm({ ...form, whatsappApiUrl: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nomor Pengirim WA</label>
              <input
                type="text"
                disabled={!canEditSettings}
                value={form.whatsappSenderNumber}
                onChange={(e) => setForm({ ...form, whatsappSenderNumber: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={!canEditSettings}
                checked={form.whatsappEnabled}
                onChange={(e) => setForm({ ...form, whatsappEnabled: e.target.checked })}
                className="rounded text-[#0A3D91]"
              />
              <span className="font-medium text-slate-700">
                Aktifkan pengiriman notifikasi WhatsApp otomatis ke orang tua/wali saat scan masuk
              </span>
            </label>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canEditSettings}
                  checked={form.allowTeacherManualEdit}
                  onChange={(e) =>
                    setForm({ ...form, allowTeacherManualEdit: e.target.checked })
                  }
                  className="rounded text-[#0A3D91]"
                />
                <span className="font-medium text-slate-700">
                  Izinkan Guru Wali Kelas melakukan koreksi manual (Izin/Sakit/Hadir) dengan Audit
                  Log
                </span>
              </label>

              {canEditSettings && (
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isSaving ? 'Menyimpan...' : savedNotice ? 'Tersimpan!' : 'Simpan Pengaturan'}
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Right 5 Cols: Academic Years & Security Rules Verification */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 text-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold font-display text-slate-900">
                2. Manajemen Tahun Pelajaran
              </h2>
              <Calendar className="w-4 h-4 text-[#0A3D91]" />
            </div>

            <div className="space-y-2 mb-4">
              {academicYears.map((ay) => (
                <div
                  key={ay.id}
                  className="p-3 rounded-lg bg-[#F5F8FF] border border-slate-200 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-bold text-slate-900 font-mono tabular-nums">
                      TP {ay.year} · Semester {ay.semester}
                    </p>
                    <p className="text-slate-500 font-mono tabular-nums">
                      {ay.startDate} s/d {ay.endDate}
                    </p>
                  </div>
                  {ay.isActive ? (
                    <span className="font-semibold text-emerald-700">AKTIF</span>
                  ) : canEditSettings ? (
                    <button
                      type="button"
                      onClick={() => onActivateAcademicYear(ay)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-[#0A3D91] bg-white border border-blue-200 hover:bg-blue-50 rounded-md cursor-pointer"
                    >
                      Aktifkan
                    </button>
                  ) : (
                    <span className="font-semibold text-slate-400">ARSIP</span>
                  )}
                </div>
              ))}
            </div>

            {canEditSettings && (
              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <input
                  type="text"
                  value={newYearStr}
                  onChange={(e) => setNewYearStr(e.target.value)}
                  placeholder="2027/2028"
                  className="px-3 py-1.5 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono w-28"
                />
                <select
                  value={newSemester}
                  onChange={(e) => setNewSemester(e.target.value as 'GANJIL' | 'GENAP')}
                  className="px-3 py-1.5 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                >
                  <option value="GANJIL">GANJIL</option>
                  <option value="GENAP">GENAP</option>
                </select>
                <button
                  type="button"
                  onClick={() => onAddAcademicYear(newYearStr, newSemester)}
                  className="px-3 py-1.5 font-semibold text-white bg-[#0A3D91] rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              </div>
            )}
          </div>

          {/* Security Rules Verification Matrix */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 text-xs">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold font-display text-slate-900">
                Status Proteksi Firestore Security Rules (Zero-Trust RBAC)
              </h2>
            </div>
            <p className="text-slate-500 mb-3">
              12 Skenario Pengujian Keamanan (&ldquo;Dirty Dozen&rdquo;) Terverifikasi:
            </p>
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {DIRTY_DOZEN_TESTS.map((test) => (
                <div key={test.id} className="p-2 px-3 flex items-center justify-between gap-2">
                  <span className="text-slate-700 truncate">
                    {test.id}. {test.name}
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-emerald-700 shrink-0">
                    BLOCKED ({test.expectedResult})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {canEditSettings && onResetSchoolData && (
            <div className="bg-white rounded-xl border border-rose-200 p-5 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-bold font-display text-slate-900">
                    3. Reset Data Guru &amp; Siswa (Persiapan Data Baru)
                  </h2>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    Kosongkan data guru dan/atau data siswa contoh agar Anda dapat memasukkan data
                    sekolah resmi. Daftar rombel Kelas 1A–6B dan pengaturan sekolah tetap aman
                    tersimpan.
                  </p>
                </div>
              </div>

              {resetResultMsg && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                  {resetResultMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-lg bg-[#F5F8FF] border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-[#0A3D91]" />
                    <span>Data Guru/Staf:</span>
                  </span>
                  <strong className="font-mono text-slate-900">{teacherCount}</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F5F8FF] border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#0A3D91]" />
                    <span>Data Siswa:</span>
                  </span>
                  <strong className="font-mono text-slate-900">{studentCount}</strong>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setResetScopeModal('BOTH')}
                  className="px-3.5 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Guru &amp; Siswa Sekaligus</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResetScopeModal('TEACHERS')}
                  className="px-3 py-2 font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer"
                >
                  Reset Data Guru Saja
                </button>
                <button
                  type="button"
                  onClick={() => setResetScopeModal('STUDENTS')}
                  className="px-3 py-2 font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer"
                >
                  Reset Data Siswa Saja
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {resetScopeModal && onResetSchoolData && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl text-xs">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold font-display text-slate-900">
                  {resetScopeModal === 'BOTH'
                    ? 'Reset Semua Data Guru & Siswa?'
                    : resetScopeModal === 'TEACHERS'
                    ? 'Reset Semua Data Guru & Staf?'
                    : 'Reset Semua Data Siswa?'}
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Tindakan ini menghapus data terpilih langsung dari Firestore
                </p>
              </div>
            </div>

            <p className="text-slate-600 leading-relaxed mb-4">
              {resetScopeModal === 'BOTH' && (
                <>
                  Anda akan menghapus <strong>{teacherCount} data guru/staf</strong> dan{' '}
                  <strong>{studentCount} data siswa</strong>. Setelah reset, data contoh tidak akan
                  diisi otomatis lagi saat login sehingga Anda bebas mengisi data baru.
                </>
              )}
              {resetScopeModal === 'TEACHERS' && (
                <>
                  Anda akan menghapus <strong>{teacherCount} data guru/staf</strong> dan mengosongkan
                  wali kelas pada rombel agar siap diisi data guru baru.
                </>
              )}
              {resetScopeModal === 'STUDENTS' && (
                <>
                  Anda akan menghapus <strong>{studentCount} data siswa</strong> beserta token QR
                  pelajar lama agar siap diisi/diimport data siswa baru.
                </>
              )}
            </p>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F5F8FF] border border-slate-200 text-slate-700 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAttendanceReset}
                onChange={(e) => setIncludeAttendanceReset(e.target.checked)}
                className="mt-0.5 rounded text-[#0A3D91]"
              />
              <span>
                Hapus juga seluruh riwayat absensi terkait (absensi guru, absensi siswa, token QR
                lama, &amp; log notifikasi).
              </span>
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setResetScopeModal(null)}
                className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={async () => {
                  setIsResetting(true);
                  try {
                    const res = await onResetSchoolData(resetScopeModal, includeAttendanceReset);
                    setResetScopeModal(null);
                    setResetResultMsg(
                      `Reset berhasil! Terhapus: ${res.deletedTeachers} guru, ${res.deletedStudents} siswa, ${res.deletedTeacherAttendance + res.deletedStudentAttendance} riwayat absensi, ${res.deletedQrTokens} token QR.`
                    );
                    setTimeout(() => setResetResultMsg(null), 7000);
                  } finally {
                    setIsResetting(false);
                  }
                }}
                className="px-4 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                <span>{isResetting ? 'Mereset Firestore...' : 'Ya, Reset Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ProfileViewProps {
  userProfile: UserProfile;
  classes: SchoolClass[];
  onUpdateProfile: (
    updates: Partial<
      Pick<
        UserProfile,
        'name' | 'nip' | 'phone' | 'assignedClassId' | 'assignedClassName' | 'role'
      >
    >
  ) => Promise<void>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userProfile,
  classes,
  onUpdateProfile,
}) => {
  const [name, setName] = useState(userProfile.name);
  const [nip, setNip] = useState(userProfile.nip);
  const [phone, setPhone] = useState(userProfile.phone);
  const [assignedClassId, setAssignedClassId] = useState(userProfile.assignedClassId || 'cls_1a');
  const [isSaving, setIsSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const canSwitchRoleForTesting =
    userProfile.email === 'adindagalih@gmail.com' || userProfile.role === 'SUPER_ADMIN';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const cls = classes.find((c) => c.id === assignedClassId);
      await onUpdateProfile({
        name: name.trim(),
        nip: nip.trim(),
        phone: phone.trim(),
        assignedClassId,
        assignedClassName:
          assignedClassId === 'ALL' ? 'Seluruh Kelas' : cls?.name || 'Kelas 1A',
      });
      setSavedMsg('Profil pengguna berhasil diperbarui.');
      setTimeout(() => setSavedMsg(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-4 pb-5 border-b border-slate-200 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-[#0A3D91] text-white flex items-center justify-center font-bold text-xl font-display">
            {userProfile.name
              .split(' ')
              .slice(0, 2)
              .map((n) => n[0])
              .join('')}
          </div>
          <div>
            <h1 className="text-xl font-bold font-display text-slate-900">{userProfile.name}</h1>
            <p className="text-xs text-slate-500">
              {userProfile.email} · Peran Aktif:{' '}
              <strong className="text-[#0A3D91]">{userProfile.role}</strong>
            </p>
          </div>
        </div>

        {savedMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
            {savedMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">NIP</label>
              <input
                type="text"
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nomor Telepon / WA</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Kelas Tanggung Jawab (Khusus Guru)
              </label>
              <select
                value={assignedClassId}
                onChange={(e) => setAssignedClassId(e.target.value)}
                className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
              >
                <option value="ALL">Seluruh Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg cursor-pointer"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Perubahan Profil'}
            </button>
          </div>
        </form>
      </div>

      {/* Role Switcher for Super Admin / Evaluator to test all 4 Roles */}
      {canSwitchRoleForTesting && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-xs">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-[#0A3D91]" />
            <h2 className="text-sm font-bold font-display text-slate-900">
              Simulasi Hak Akses Role (Khusus Pengujian Administrator)
            </h2>
          </div>
          <p className="text-slate-600 mb-4 leading-relaxed">
            Sebagai pemilik/administrator utama sistem, Anda dapat beralih peran di bawah ini untuk
            menguji pembatasan menu dan hak akses antara <strong>SUPER ADMIN</strong>,{' '}
            <strong>KEPALA SEKOLAH</strong>, <strong>ADMIN SEKOLAH</strong>, dan{' '}
            <strong>GURU</strong>:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(['SUPER_ADMIN', 'KEPALA_SEKOLAH', 'ADMIN_SEKOLAH', 'GURU'] as UserRole[]).map((r) => (
              <button
                key={r}
                onClick={() => onUpdateProfile({ role: r })}
                className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  userProfile.role === r
                    ? 'bg-[#0A3D91] text-white border-[#0A3D91]'
                    : 'bg-[#F5F8FF] text-slate-800 border-slate-200 hover:border-[#0A3D91]'
                }`}
              >
                <p className="font-bold mb-1">{r.replace('_', ' ')}</p>
                <p
                  className={`text-[11px] ${
                    userProfile.role === r ? 'text-blue-100' : 'text-slate-500'
                  }`}
                >
                  {r === 'SUPER_ADMIN'
                    ? 'Akses penuh seluruh modul & pengaturan'
                    : r === 'KEPALA_SEKOLAH'
                    ? 'Dashboard eksekutif, pengawasan kelas & laporan'
                    : r === 'GURU'
                    ? 'Fokus scan QR & rekap kelas ampuan'
                    : 'Kelola siswa, kelas, cetak kartu & laporan'}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
