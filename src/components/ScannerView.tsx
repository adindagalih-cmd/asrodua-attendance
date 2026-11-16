import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Volume2,
  VolumeX,
  QrCode,
  Clock,
  ShieldCheck,
  Sparkles,
  SwitchCamera,
} from 'lucide-react';
import {
  AttendanceRecord,
  AttendanceSession,
  AttendanceSettings,
  QrToken,
  SchoolClass,
  Student,
  Teacher,
  TeacherAttendanceRecord,
  TeacherQrToken,
  UserProfile,
} from '../types';
import {
  formatIndonesianDate,
  getTodayDateString,
  resolveTeacherQrData,
} from '../firebase';
import { playScanSound, unlockScanAudio } from '../utils/exportUtils';

export interface ScanVerificationResult {
  outcome: 'SUCCESS' | 'ALREADY_SCANNED' | 'REVOKED_TOKEN' | 'INVALID_TOKEN';
  message: string;
  student?: Student;
  record?: AttendanceRecord;
  teacher?: Teacher;
  teacherRecord?: TeacherAttendanceRecord;
  timestamp: string;
}

interface ScannerViewProps {
  userProfile: UserProfile;
  students: Student[];
  teachers?: Teacher[];
  classes: SchoolClass[];
  qrTokens: QrToken[];
  teacherQrTokens?: TeacherQrToken[];
  attendance: AttendanceRecord[];
  teacherAttendance?: TeacherAttendanceRecord[];
  settings: AttendanceSettings;
  onProcessQrScan: (
    rawQrText: string,
    session: 'MASUK' | 'PULANG'
  ) => Promise<ScanVerificationResult>;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  userProfile,
  students,
  teachers = [],
  classes,
  qrTokens,
  teacherQrTokens = [],
  attendance,
  teacherAttendance = [],
  settings,
  onProcessQrScan,
}) => {
  const [session, setSession] = useState<'MASUK' | 'PULANG'>('MASUK');
  const [simTargetMode, setSimTargetMode] = useState<'SISWA' | 'GURU'>('SISWA');
  const [historyTab, setHistoryTab] = useState<'SISWA' | 'GURU'>('SISWA');
  const [simTeacherFilter, setSimTeacherFilter] = useState<'ALL' | 'WALI_KELAS' | 'GURU_MAPEL' | 'STAF'>('ALL');
  const [simTeacherSearch, setSimTeacherSearch] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScanVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [simClassFilter, setSimClassFilter] = useState<string>(
    userProfile.role === 'GURU' && userProfile.assignedClassId && userProfile.assignedClassId !== 'ALL'
      ? userProfile.assignedClassId
      : 'ALL'
  );
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('AUTO_ENV');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedTokenRef = useRef<{ token: string; time: number }>({ token: '', time: 0 });

  const todayStr = getTodayDateString();
  const todayScans = useMemo(() => {
    return attendance
      .filter((a) => a.date === todayStr)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [attendance, todayStr]);

  const handleDecodedToken = async (decodedText: string) => {
    const now = Date.now();
    // Prevent accidental rapid duplicate scans within 3.5 seconds for the exact same token
    if (
      lastScannedTokenRef.current.token === decodedText &&
      now - lastScannedTokenRef.current.time < 3500
    ) {
      return;
    }
    lastScannedTokenRef.current = { token: decodedText, time: now };

    if (soundEnabled) {
      void unlockScanAudio();
    }

    setIsVerifying(true);
    try {
      const res = await onProcessQrScan(decodedText, session);
      setLastResult(res);
      if (res.teacher) {
        setHistoryTab('GURU');
      } else if (res.student) {
        setHistoryTab('SISWA');
      }
      if (soundEnabled) {
        if (res.outcome === 'SUCCESS') {
          playScanSound('success');
        } else {
          playScanSound('warning');
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? `Gagal memverifikasi QR Code: ${err.message}`
          : 'Terjadi kegagalan sistem saat memverifikasi QR Code.';
      setLastResult({
        outcome: 'INVALID_TOKEN',
        message: errorMessage,
        timestamp: new Date().toTimeString().slice(0, 8),
      });
      if (soundEnabled) {
        playScanSound('warning');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleToggleSound = () => {
    const nextEnabled = !soundEnabled;
    setSoundEnabled(nextEnabled);
    if (nextEnabled) {
      void unlockScanAudio().then(() => {
        playScanSound('success');
      });
    }
  };

  const loadAvailableCameras = async (): Promise<Array<{ id: string; label: string }>> => {
    try {
      const devices = await Html5Qrcode.getCameras();
      const mapped = devices.map((d, idx) => ({
        id: d.id,
        label: d.label || `Kamera ${idx + 1}`,
      }));
      setAvailableCameras(mapped);
      return mapped;
    } catch {
      return [];
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // ignore stop error
      }
      scannerRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async (overrideCameraId?: string) => {
    setCameraError(null);
    if (soundEnabled) {
      void unlockScanAudio();
    }

    const targetId = overrideCameraId ?? selectedCameraId;
    const cameraConfig: string | MediaTrackConstraints =
      targetId === 'AUTO_ENV'
        ? { facingMode: 'environment' }
        : targetId === 'AUTO_USER'
        ? { facingMode: 'user' }
        : targetId;

    try {
      if (scannerRef.current) {
        await stopCamera();
      }
      const html5QrCode = new Html5Qrcode('asrodua-qr-reader');
      scannerRef.current = html5QrCode;
      await html5QrCode.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
        },
        (decodedText) => {
          handleDecodedToken(decodedText);
        },
        () => {
          // frame scan miss ignored
        }
      );
      setIsCameraActive(true);

      // Refresh camera list after permission is granted so full device labels appear
      const devices = await loadAvailableCameras();
      if (
        devices.length > 0 &&
        (targetId === 'AUTO_ENV' || targetId === 'AUTO_USER')
      ) {
        const preferred =
          targetId === 'AUTO_ENV'
            ? devices.find((d) => /back|rear|environment|belakang/i.test(d.label))
            : devices.find((d) => /front|user|face|depan/i.test(d.label));
        if (preferred) {
          setSelectedCameraId(preferred.id);
        }
      }
    } catch (err) {
      scannerRef.current = null;
      setCameraError(
        err instanceof Error
          ? `Tidak dapat mengakses kamera perangkat: ${err.message}. Anda tetap dapat menggunakan fitur Simulasi Scan Cepat atau input token di samping.`
          : 'Gagal mengakses kamera perangkat.'
      );
      setIsCameraActive(false);
    }
  };

  const handleSelectCamera = async (nextCameraId: string) => {
    setSelectedCameraId(nextCameraId);
    if (isCameraActive) {
      setIsSwitchingCamera(true);
      try {
        await startCamera(nextCameraId);
      } finally {
        setIsSwitchingCamera(false);
      }
    }
  };

  const handleSwitchCamera = async () => {
    let nextCameraId: string;
    if (availableCameras.length > 1) {
      const currentIdx = availableCameras.findIndex((c) => c.id === selectedCameraId);
      const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % availableCameras.length : 0;
      nextCameraId = availableCameras[nextIdx].id;
    } else {
      nextCameraId = selectedCameraId === 'AUTO_USER' ? 'AUTO_ENV' : 'AUTO_USER';
    }
    await handleSelectCamera(nextCameraId);
  };

  useEffect(() => {
    void loadAvailableCameras();
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const simStudents = useMemo(() => {
    return students.filter((s) => {
      if (s.status !== 'AKTIF') return false;
      if (simClassFilter !== 'ALL' && s.classId !== simClassFilter) return false;
      return true;
    });
  }, [students, simClassFilter]);

  const revokedSampleToken = useMemo(
    () => qrTokens.find((t) => t.status === 'REVOKED'),
    [qrTokens]
  );

  const revokedTeacherSampleToken = useMemo(
    () => teacherQrTokens.find((t) => t.status === 'REVOKED'),
    [teacherQrTokens]
  );

  const todayTeacherScans = useMemo(() => {
    return teacherAttendance
      .filter((a) => a.date === todayStr)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [teacherAttendance, todayStr]);

  const activeTeachers = useMemo(
    () => teachers.filter((t) => t.status === 'AKTIF'),
    [teachers]
  );

  const simTeachers = useMemo(() => {
    const q = simTeacherSearch.toLowerCase().trim();
    return activeTeachers.filter((t) => {
      const isMapel =
        t.classId.startsWith('MAPEL_') || t.className.toLowerCase().includes('mapel');
      const isWali = t.role === 'GURU' && !isMapel && t.classId !== 'ALL';
      if (simTeacherFilter === 'WALI_KELAS' && !isWali) return false;
      if (simTeacherFilter === 'GURU_MAPEL' && !isMapel) return false;
      if (simTeacherFilter === 'STAF' && (isWali || isMapel)) return false;
      if (!q) return true;
      return (
        t.fullName.toLowerCase().includes(q) ||
        t.nip.toLowerCase().includes(q) ||
        t.className.toLowerCase().includes(q)
      );
    });
  }, [activeTeachers, simTeacherFilter, simTeacherSearch]);

  return (
    <div className="space-y-6">
      {/* Top Bar Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>SCAN ATTENDANCE REAL-TIME (SISWA & GURU)</span>
            <span aria-hidden="true">·</span>
            <span>{formatIndonesianDate(todayStr)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Batas Tepat Waktu: {settings.checkInDeadline} WIB
            </span>
          </div>
          <h1 className="text-xl lg:text-2xl font-bold font-display text-slate-900">
            Pemindai QR Code Kehadiran Siswa & Guru
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Session Selector: ABSENSI MASUK vs ABSENSI PULANG */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setSession('MASUK')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                session === 'MASUK'
                  ? 'bg-[#0A3D91] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              SESI ABSENSI MASUK
            </button>
            <button
              onClick={() => setSession('PULANG')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                session === 'PULANG'
                  ? 'bg-[#0A3D91] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              SESI ABSENSI PULANG
            </button>
          </div>

          <button
            type="button"
            onClick={handleToggleSound}
            aria-pressed={soundEnabled}
            aria-label={soundEnabled ? 'Nonaktifkan suara pemindai' : 'Aktifkan suara pemindai'}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-[#F5F8FF] border border-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-4 h-4 text-[#0A3D91]" />
                <span>Suara Aktif</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-slate-400" />
                <span>Suara Nonaktif</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Camera Viewport & Verification Result Card + Quick Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Camera & Live Identity Verification Result */}
        <div className="lg:col-span-7 space-y-6">
          {/* Camera Container */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-bold font-display text-slate-900">
                  Kamera Pemindai QR Code ({session === 'MASUK' ? 'Absensi Masuk' : 'Absensi Pulang'})
                </h2>
                <p className="text-xs text-slate-500">
                  Pilih kamera depan/belakang atau perangkat kamera yang tersedia untuk memindai QR siswa maupun guru/staf
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isCameraActive ? (
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <Camera className="w-4 h-4 text-[#D4AF37]" />
                    <span>Aktifkan Kamera</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void stopCamera()}
                    className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <CameraOff className="w-4 h-4" />
                    <span>Matikan Kamera</span>
                  </button>
                )}
              </div>
            </div>

            {/* Camera Selection Toolbar */}
            <div className="mb-4 p-3 rounded-xl bg-[#F5F8FF] border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <label
                  htmlFor="scanner-camera-select"
                  className="text-xs font-semibold text-slate-700 whitespace-nowrap"
                >
                  Pilih Kamera:
                </label>
                <select
                  id="scanner-camera-select"
                  aria-label="Pilih kamera perangkat"
                  value={selectedCameraId}
                  disabled={isSwitchingCamera}
                  onChange={(e) => void handleSelectCamera(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4DA8FF]/40 focus:border-[#0A3D91] cursor-pointer disabled:opacity-60"
                >
                  <option value="AUTO_ENV">Kamera Belakang (Utama)</option>
                  <option value="AUTO_USER">Kamera Depan (Selfie)</option>
                  {availableCameras.map((cam) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                disabled={isSwitchingCamera}
                onClick={() => void handleSwitchCamera()}
                className="px-3 py-1.5 text-xs font-semibold text-[#0A3D91] bg-white border border-blue-200 hover:bg-blue-50 rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                <SwitchCamera className="w-3.5 h-3.5" />
                <span>
                  {isSwitchingCamera
                    ? 'Mengganti...'
                    : availableCameras.length > 1
                    ? 'Ganti Kamera'
                    : selectedCameraId === 'AUTO_USER'
                    ? 'Pakai Belakang'
                    : 'Pakai Depan'}
                </span>
              </button>
            </div>

            {cameraError && (
              <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                {cameraError}
              </div>
            )}

            <div className="relative bg-slate-900 rounded-xl overflow-hidden min-h-64 flex flex-col items-center justify-center border border-slate-800">
              <div id="asrodua-qr-reader" className="w-full max-w-md mx-auto" />
              {!isCameraActive && (
                <div className="p-8 text-center text-slate-300 flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-[#D4AF37] mb-3">
                    <QrCode className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-semibold text-white mb-1">
                    Kamera Siap Diaktifkan
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm mb-4">
                    Klik tombol &ldquo;Aktifkan Kamera&rdquo; untuk memindai kartu QR siswa maupun
                    guru/staf secara langsung, atau gunakan panel uji scan cepat di sebelah kanan.
                  </p>
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="px-5 py-2.5 text-xs font-semibold bg-[#0A3D91] hover:bg-[#082f70] text-white rounded-xl transition-colors cursor-pointer"
                  >
                    Buka Kamera Sekarang
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Real-Time Verification Result Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-bold font-display text-slate-900 mb-3">
              Status Verifikasi Identitas (Siswa / Guru & Staf)
            </h2>

            {!lastResult ? (
              <div className="p-6 rounded-xl bg-[#F5F8FF] border border-slate-200 text-center text-xs text-slate-500">
                Menunggu pemindaian QR Code siswa atau guru... Hasil verifikasi akan tampil secara
                otomatis di sini.
              </div>
            ) : lastResult.outcome === 'SUCCESS' && lastResult.student && lastResult.record ? (
              <div className="p-5 rounded-xl bg-emerald-50/90 border border-emerald-200">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-emerald-200/80">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-sm font-bold font-display">
                      ABSENSI SISWA BERHASIL ({session})
                    </span>
                  </div>
                  <span className="text-xs font-mono tabular-nums font-semibold text-emerald-800">
                    Pukul {lastResult.timestamp} WIB
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-16 h-20 rounded-xl bg-[#0A3D91] text-white font-bold flex items-center justify-center shrink-0 overflow-hidden text-base">
                    {lastResult.student.photoUrl ? (
                      <img
                        src={lastResult.student.photoUrl}
                        alt={lastResult.student.fullName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      lastResult.student.fullName
                        .split(' ')
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join('')
                    )}
                  </div>

                  <div className="flex-1 space-y-1 text-xs">
                    <p className="text-base font-bold font-display text-slate-900">
                      {lastResult.student.fullName}
                    </p>
                    <p className="font-mono tabular-nums text-slate-700">
                      NIS: <strong>{lastResult.student.nis}</strong> · NISN:{' '}
                      {lastResult.student.nisn}
                    </p>
                    <p className="font-semibold text-[#0A3D91]">
                      {lastResult.student.className} · Status:{' '}
                      <span
                        className={
                          lastResult.record.status === 'HADIR'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }
                      >
                        {lastResult.record.status}
                      </span>
                    </p>
                    <p className="text-slate-600 pt-1">{lastResult.message}</p>
                  </div>
                </div>
              </div>
            ) : lastResult.outcome === 'SUCCESS' && lastResult.teacher && lastResult.teacherRecord ? (
              <div className="p-5 rounded-xl bg-emerald-50/90 border border-emerald-200">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-emerald-200/80">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-sm font-bold font-display">
                      PRESENSI GURU / STAF BERHASIL ({session})
                    </span>
                  </div>
                  <span className="text-xs font-mono tabular-nums font-semibold text-emerald-800">
                    Pukul {lastResult.timestamp} WIB
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-16 h-20 rounded-xl bg-[#0A3D91] text-[#D4AF37] font-bold flex items-center justify-center shrink-0 text-base">
                    {lastResult.teacher.fullName
                      .split(' ')
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join('')}
                  </div>

                  <div className="flex-1 space-y-1 text-xs">
                    <p className="text-base font-bold font-display text-slate-900">
                      {lastResult.teacher.fullName}
                    </p>
                    <p className="font-mono tabular-nums text-slate-700">
                      NIP: <strong>{lastResult.teacher.nip || '-'}</strong> · Jabatan:{' '}
                      {lastResult.teacher.role.replace('_', ' ')}
                    </p>
                    <p className="font-semibold text-[#0A3D91]">
                      {lastResult.teacher.className} · Status:{' '}
                      <span
                        className={
                          lastResult.teacherRecord.status === 'HADIR'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }
                      >
                        {lastResult.teacherRecord.status}
                      </span>
                    </p>
                    <p className="text-slate-600 pt-1">{lastResult.message}</p>
                  </div>
                </div>
              </div>
            ) : lastResult.outcome === 'ALREADY_SCANNED' ? (
              <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="text-sm font-bold text-amber-900 mb-1">
                    PENCEGAHAN SCAN GANDA — SUDAH TERCATAT HARI INI
                  </p>
                  <p className="text-amber-800 leading-relaxed">{lastResult.message}</p>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="text-sm font-bold text-rose-900 mb-1">
                    {lastResult.outcome === 'REVOKED_TOKEN'
                      ? 'QR CODE SUDAH DINONAKTIFKAN (REVOKED)'
                      : 'QR CODE TIDAK VALID / TIDAK TERDAFTAR'}
                  </p>
                  <p className="text-rose-800 leading-relaxed">{lastResult.message}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Cols: Quick Student & Teacher Scan Trigger (For Testing / Backup) + Recent Session Log */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0A3D91]" />
                <h2 className="text-sm font-bold font-display text-slate-900">
                  Simulasi Scan Kartu QR
                </h2>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setSimTargetMode('SISWA')}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                    simTargetMode === 'SISWA'
                      ? 'bg-[#0A3D91] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  QR Siswa ({simStudents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSimTargetMode('GURU')}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                    simTargetMode === 'GURU'
                      ? 'bg-[#0A3D91] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  QR Guru ({activeTeachers.length})
                </button>
              </div>
            </div>

            {simTargetMode === 'SISWA' ? (
              <>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Klik kartu siswa untuk menyimulasikan scan QR siswa &amp; notifikasi WA orang tua:
                  </p>
                  <select
                    value={simClassFilter}
                    onChange={(e) => setSimClassFilter(e.target.value)}
                    className="px-2.5 py-1 text-xs bg-[#F5F8FF] border border-slate-200 rounded-lg shrink-0"
                  >
                    <option value="ALL">Semua Kelas</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {simStudents.map((std) => {
                    const todayRec = todayScans.find((r) => r.studentId === std.id);
                    const alreadyDone =
                      session === 'MASUK'
                        ? Boolean(todayRec?.checkInTime)
                        : Boolean(todayRec?.checkOutTime);

                    return (
                      <div
                        key={std.id}
                        className="p-2.5 px-3 flex items-center justify-between gap-2 hover:bg-slate-50 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{std.fullName}</p>
                          <p className="text-slate-500 font-mono tabular-nums text-[11px]">
                            {std.className} · NIS {std.nis}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDecodedToken(std.qrToken)}
                          disabled={isVerifying}
                          className={`px-3 py-1.5 rounded-lg font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                            alreadyDone
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-[#0A3D91] text-white hover:bg-[#082f70]'
                          }`}
                        >
                          {alreadyDone ? `Sudah Scan (${session})` : `Scan QR ${session}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-2.5 leading-relaxed">
                  Klik nama guru/staf untuk menyimulasikan pemindaian Kartu QR Guru ke{' '}
                  <code className="font-mono text-[#0A3D91]">teacherAttendance</code>:
                </p>

                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    value={simTeacherSearch}
                    onChange={(e) => setSimTeacherSearch(e.target.value)}
                    placeholder="Cari nama guru / NIP..."
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-[#F5F8FF] border border-slate-200 rounded-lg focus:outline-none focus:border-[#0A3D91]"
                  />
                  <select
                    value={simTeacherFilter}
                    onChange={(e) =>
                      setSimTeacherFilter(
                        e.target.value as 'ALL' | 'WALI_KELAS' | 'GURU_MAPEL' | 'STAF'
                      )
                    }
                    className="px-2.5 py-1.5 text-xs bg-[#F5F8FF] border border-slate-200 rounded-lg shrink-0"
                  >
                    <option value="ALL">Semua Kategori</option>
                    <option value="WALI_KELAS">Wali Kelas</option>
                    <option value="GURU_MAPEL">Guru Mapel</option>
                    <option value="STAF">Staf / TU</option>
                  </select>
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {simTeachers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Tidak ada guru/staf yang sesuai filter.
                    </div>
                  ) : (
                    simTeachers.map((tch) => {
                      const todayRec = todayTeacherScans.find((r) => r.teacherId === tch.id);
                      const alreadyDone =
                        session === 'MASUK'
                          ? Boolean(todayRec?.checkInTime)
                          : Boolean(todayRec?.checkOutTime);
                      const { qrCodeId, qrToken } = resolveTeacherQrData(tch);

                      return (
                        <div
                          key={tch.id}
                          className="p-2.5 px-3 flex items-center justify-between gap-2 hover:bg-slate-50 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{tch.fullName}</p>
                            <p className="text-slate-500 font-mono tabular-nums text-[11px] truncate">
                              {tch.className} · {qrCodeId}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDecodedToken(qrToken)}
                            disabled={isVerifying}
                            className={`px-3 py-1.5 rounded-lg font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                              alreadyDone
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-[#0A3D91] text-white hover:bg-[#082f70]'
                            }`}
                          >
                            {alreadyDone ? `Sudah Scan (${session})` : `Scan Guru ${session}`}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* Security Edge-Case Verification Buttons */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleDecodedToken('ASRODUA::INVALID::FAKE_TOKEN_999')}
                className="px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
              >
                Uji QR Tidak Valid
              </button>
              {revokedSampleToken && (
                <button
                  onClick={() => handleDecodedToken(revokedSampleToken.token)}
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg cursor-pointer"
                >
                  Uji QR Siswa Lama (Nonaktif)
                </button>
              )}
              {revokedTeacherSampleToken && (
                <button
                  onClick={() => handleDecodedToken(revokedTeacherSampleToken.token)}
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg cursor-pointer"
                >
                  Uji QR Guru Lama (Nonaktif)
                </button>
              )}
            </div>
          </div>

          {/* Live Log Today */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0A3D91]" />
                <h2 className="text-sm font-bold font-display text-slate-900">
                  Riwayat Scan Hari Ini
                </h2>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setHistoryTab('SISWA')}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                    historyTab === 'SISWA'
                      ? 'bg-[#0A3D91] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Siswa ({todayScans.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryTab('GURU')}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                    historyTab === 'GURU'
                      ? 'bg-[#0A3D91] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Guru ({todayTeacherScans.length})
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
              {historyTab === 'SISWA' ? (
                todayScans.length === 0 ? (
                  <p className="text-center text-slate-400 py-6">
                    Belum ada pemindaian QR siswa hari ini.
                  </p>
                ) : (
                  todayScans.slice(0, 10).map((rec) => (
                    <div
                      key={rec.id}
                      className="p-2.5 rounded-lg bg-[#F5F8FF] border border-slate-200 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{rec.studentName}</p>
                        <p className="text-slate-500">
                          {rec.className} ·{' '}
                          <span className="font-semibold text-[#0A3D91]">{rec.status}</span>
                        </p>
                      </div>
                      <div className="text-right font-mono tabular-nums text-[11px] text-slate-600 shrink-0">
                        <p>Masuk: {rec.checkInTime || '-'}</p>
                        <p>Pulang: {rec.checkOutTime || '-'}</p>
                      </div>
                    </div>
                  ))
                )
              ) : todayTeacherScans.length === 0 ? (
                <p className="text-center text-slate-400 py-6">
                  Belum ada pemindaian QR guru/staf hari ini.
                </p>
              ) : (
                todayTeacherScans.slice(0, 12).map((rec) => (
                  <div
                    key={rec.id}
                    className="p-2.5 rounded-lg bg-[#F5F8FF] border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{rec.teacherName}</p>
                      <p className="text-slate-500">
                        {rec.className} ·{' '}
                        <span className="font-semibold text-[#0A3D91]">
                          {rec.status.replace('_', ' ')}
                        </span>
                      </p>
                    </div>
                    <div className="text-right font-mono tabular-nums text-[11px] text-slate-600 shrink-0">
                      <p>Masuk: {rec.checkInTime || '-'}</p>
                      <p>Pulang: {rec.checkOutTime || '-'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
