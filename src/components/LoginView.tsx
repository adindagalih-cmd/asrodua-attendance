import React from 'react';
import { QrCode, ShieldCheck, CheckCircle2, ArrowRight, Lock, Megaphone, Pin } from 'lucide-react';
import { Announcement, SiteContent } from '../types';
import { formatIndonesianDate } from '../firebase';

interface LoginViewProps {
  onGoogleLogin: () => Promise<void>;
  isLoggingIn: boolean;
  authError: string | null;
  siteContent: SiteContent;
  announcements: Announcement[];
}

export const LoginView: React.FC<LoginViewProps> = ({
  onGoogleLogin,
  isLoggingIn,
  authError,
  siteContent,
  announcements,
}) => {
  const publishedAnnouncements = announcements
    .filter((a) => a.isPublished)
    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.publishDate.localeCompare(a.publishDate))
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-[#F5F8FF] flex flex-col justify-between">
      {/* Top Bar Contract: 3 zones */}
      <header className="flex items-center justify-between gap-8 px-6 lg:px-12 py-4 bg-white border-b border-slate-200">
        <a
          href="#top"
          className="text-lg font-bold tracking-tight text-[#0A3D91] font-display whitespace-nowrap shrink-0"
        >
          {siteContent.appTitle}
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a href="#fitur" className="hover:text-[#0A3D91] transition-colors whitespace-nowrap shrink-0">
            Fitur Sistem
          </a>
          <a href="#informasi" className="hover:text-[#0A3D91] transition-colors whitespace-nowrap shrink-0">
            Informasi Sekolah
          </a>
          <a href="#hak-akses" className="hover:text-[#0A3D91] transition-colors whitespace-nowrap shrink-0">
            Hak Akses
          </a>
          <a href="#keamanan" className="hover:text-[#0A3D91] transition-colors whitespace-nowrap shrink-0">
            Keamanan QR
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onGoogleLogin}
            disabled={isLoggingIn}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0A3D91] rounded-lg hover:bg-[#082f70] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            {isLoggingIn ? 'Memproses...' : 'Masuk Portal'}
          </button>
        </div>
      </header>

      {/* Main Split Section */}
      <main id="top" className="max-w-7xl w-full mx-auto px-6 lg:px-12 py-8 lg:py-12 space-y-8">
        {/* Editable Public Announcement Banner */}
        {siteContent.showAnnouncementBanner && siteContent.announcementBannerTitle && (
          <div className="bg-white rounded-xl border border-blue-200 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#0A3D91] text-[#D4AF37] flex items-center justify-center shrink-0 mt-0.5">
                <Megaphone className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0A3D91]">
                  {siteContent.announcementBannerTitle}
                </p>
                <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                  {siteContent.announcementBannerBody}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-slate-500 shrink-0">
              TP {siteContent.activeAcademicYear} · {siteContent.semester}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: School Identity & Value Proposition */}
          <div className="lg:col-span-7 bg-[#0A3D91] text-white rounded-2xl p-8 lg:p-10 flex flex-col justify-between border border-[#082f70]">
            <div>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-xl bg-white p-1 shrink-0 flex items-center justify-center overflow-hidden">
                  <img
                    src="/assets/aistudio/EB607786-7417-4AF8-93A0-7453467400F4_9963c46a.png"
                    alt={`Logo ${siteContent.schoolName}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-[#D4AF37] tracking-wide">
                    {siteContent.heroSubtitle}
                  </p>
                  <h2 className="text-xl lg:text-2xl font-bold font-display text-white">
                    {siteContent.schoolName}
                  </h2>
                  <p className="text-xs text-blue-100 mt-0.5">
                    {siteContent.schoolAddress} · NPSN {siteContent.npsn}
                  </p>
                </div>
              </div>

              <p className="text-sm font-semibold text-[#D4AF37] mb-2">
                {siteContent.tagline}
              </p>
              <h1
                className="text-3xl lg:text-4xl font-bold font-display leading-tight text-white mb-4"
                style={{ textWrap: 'balance' }}
              >
                {siteContent.heroTitle}
              </h1>
              <p className="text-sm lg:text-base text-blue-100 leading-relaxed max-w-2xl mb-8">
                {siteContent.heroDescription}
              </p>

              <div id="fitur" className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-white/15">
                <div>
                  <p className="text-xs text-blue-200">{siteContent.feature1Title}</p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {siteContent.feature1Desc}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-200">{siteContent.feature2Title}</p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {siteContent.feature2Desc}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-200">{siteContent.feature3Title}</p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {siteContent.feature3Desc}
                  </p>
                </div>
              </div>
            </div>

            <div id="hak-akses" className="mt-8 pt-6 border-t border-white/15">
              <p className="text-xs font-medium text-[#D4AF37] mb-3">
                Matriks Hak Akses Pengguna (Role-Based Access Control)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white/10 rounded-xl p-3.5">
                  <p className="font-semibold text-white mb-1">1. Super Admin</p>
                  <p className="text-blue-100 leading-relaxed">
                    Akses penuh seluruh data siswa, guru, kelas, konten website, generator QR, jam
                    operasional, integrasi WA, dan audit log.
                  </p>
                </div>
                <div className="bg-white/10 rounded-xl p-3.5">
                  <p className="font-semibold text-white mb-1">2. Guru / Wali Kelas</p>
                  <p className="text-blue-100 leading-relaxed">
                    Kamera scanner QR real-time, pantau siswa hadir/belum hadir di kelasnya, dan
                    koreksi izin/sakit.
                  </p>
                </div>
                <div className="bg-white/10 rounded-xl p-3.5">
                  <p className="font-semibold text-white mb-1">3. Admin Sekolah</p>
                  <p className="text-blue-100 leading-relaxed">
                    Kelola informasi website, data siswa, guru, kelas, cetak kartu QR pelajar, serta
                    unduh laporan Excel & PDF.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Authentication Card */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-8 lg:p-10 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#F5F8FF] border border-blue-100 flex items-center justify-center text-[#0A3D91]">
                  <QrCode className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium text-slate-500 font-mono tabular-nums">
                  TP {siteContent.activeAcademicYear} · Semester{' '}
                  {siteContent.semester === 'GANJIL' ? 'Ganjil' : 'Genap'}
                </span>
              </div>

              <h2 className="text-2xl font-bold font-display text-slate-900 mb-2">
                Login Portal Guru & Admin
              </h2>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Gunakan akun Google resmi sekolah atau akun administrator yang terdaftar untuk
                mengakses dashboard {siteContent.appTitle}.
              </p>

              {authError && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed">
                  <p className="font-semibold mb-0.5">Gagal Masuk:</p>
                  <p>{authError}</p>
                </div>
              )}

              <button
                onClick={onGoogleLogin}
                disabled={isLoggingIn}
                className="w-full py-3.5 px-5 bg-[#0A3D91] hover:bg-[#082f70] text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
              >
                <Lock className="w-4 h-4 text-[#D4AF37]" />
                <span>{isLoggingIn ? 'Memverifikasi Akun...' : 'Masuk dengan Akun Google'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div id="keamanan" className="mt-8 space-y-3 pt-6 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-800">
                  Standar Keamanan Sistem Sekolah:
                </p>
                <div className="flex items-start gap-2.5 text-xs text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-[#0A3D91] shrink-0 mt-0.5" />
                  <span>
                    Verifikasi autentikasi terenkripsi melalui Firebase Authentication & Cloud
                    Firestore Rules.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-[#0A3D91] shrink-0 mt-0.5" />
                  <span>
                    QR Code hanya menyimpan token acak yang divalidasi di server, melindungi privasi
                    NISN dan nomor telepon orang tua.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-[#0A3D91] shrink-0 mt-0.5" />
                  <span>
                    Pencegahan scan ganda otomatis (Idempotent Check-In/Check-Out) dan pencatatan
                    Audit Log pada setiap perubahan status.
                  </span>
                </div>
              </div>
            </div>

            <div id="sekolah" className="mt-8 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>{siteContent.schoolName}</span>
              <span>
                {siteContent.schoolPhone} · {siteContent.schoolEmail}
              </span>
            </div>
          </div>
        </div>

        {/* Public School Announcements Feed */}
        {publishedAnnouncements.length > 0 && (
          <section id="informasi" className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold font-display text-slate-900">
                  Informasi & Pengumuman Sekolah Terbaru
                </h2>
                <p className="text-xs text-slate-500">
                  Pembaruan resmi dari administrator {siteContent.schoolName}
                </p>
              </div>
              <span className="text-xs text-slate-500">
                Kepala Sekolah: <strong className="text-slate-800">{siteContent.principalName}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {publishedAnnouncements.map((ann) => (
                <article
                  key={ann.id}
                  className="p-4 rounded-xl bg-[#F5F8FF] border border-slate-200/80 space-y-1.5"
                >
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                    <span className="text-[#0A3D91]">{ann.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatIndonesianDate(ann.publishDate)}
                    </span>
                    {ann.isPinned && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-700 inline-flex items-center gap-0.5">
                          <Pin className="w-3 h-3" /> Penting
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="text-sm font-bold font-display text-slate-900">{ann.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{ann.content}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="px-6 lg:px-12 py-4 bg-white border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>
          © 2026 {siteContent.schoolName} — {siteContent.appTitle}
        </span>
        <span>{siteContent.footerText}</span>
      </footer>
    </div>
  );
};

