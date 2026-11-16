import React, { useEffect, useState } from 'react';
import {
  Globe,
  Megaphone,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Pin,
  Eye,
  EyeOff,
  Users,
  GraduationCap,
  BookOpen,
  Settings,
  MessageSquare,
  ArrowUpRight,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import {
  Announcement,
  AnnouncementCategory,
  PageId,
  SchoolClass,
  SiteContent,
  Student,
  Teacher,
  UserProfile,
  UserRole,
} from '../types';
import { formatIndonesianDate, getTodayDateString } from '../firebase';

interface WebsiteCmsViewProps {
  userProfile: UserProfile;
  siteContent: SiteContent;
  announcements: Announcement[];
  students: Student[];
  teachers: Teacher[];
  classes: SchoolClass[];
  usersList: UserProfile[];
  onSaveSiteContent: (updated: SiteContent) => Promise<void>;
  onSaveAnnouncement: (
    data: Omit<Announcement, 'id' | 'authorName' | 'authorUid' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteAnnouncement: (ann: Announcement) => Promise<void>;
  onUpdateUserAccount: (
    targetUser: UserProfile,
    updates: Partial<Pick<UserProfile, 'role' | 'active' | 'assignedClassId' | 'assignedClassName'>>
  ) => Promise<void>;
  onNavigate: (page: PageId) => void;
}

type CmsTab = 'WEBSITE' | 'ANNOUNCEMENTS' | 'DATA_HUB';

export const WebsiteCmsView: React.FC<WebsiteCmsViewProps> = ({
  userProfile,
  siteContent,
  announcements,
  students,
  teachers,
  classes,
  usersList,
  onSaveSiteContent,
  onSaveAnnouncement,
  onDeleteAnnouncement,
  onUpdateUserAccount,
  onNavigate,
}) => {
  const canEdit = userProfile.role === 'SUPER_ADMIN' || userProfile.role === 'ADMIN_SEKOLAH';
  const isSuperAdmin = userProfile.role === 'SUPER_ADMIN';

  const [activeTab, setActiveTab] = useState<CmsTab>('WEBSITE');
  const [form, setForm] = useState<SiteContent>(siteContent);
  const [isSavingSite, setIsSavingSite] = useState(false);
  const [siteSavedNotice, setSiteSavedNotice] = useState(false);

  // Sync form when siteContent updates from Firestore
  useEffect(() => {
    setForm(siteContent);
  }, [siteContent]);

  // Announcement modal state
  const [isAnnModalOpen, setIsAnnModalOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annCategory, setAnnCategory] = useState<AnnouncementCategory>('PENGUMUMAN');
  const [annDate, setAnnDate] = useState(getTodayDateString());
  const [annPinned, setAnnPinned] = useState(false);
  const [annPublished, setAnnPublished] = useState(true);
  const [isSavingAnn, setIsSavingAnn] = useState(false);

  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setIsSavingSite(true);
    try {
      await onSaveSiteContent(form);
      setSiteSavedNotice(true);
      setTimeout(() => setSiteSavedNotice(false), 3500);
    } finally {
      setIsSavingSite(false);
    }
  };

  const openAddAnnouncement = () => {
    setEditingAnn(null);
    setAnnTitle('');
    setAnnContent('');
    setAnnCategory('PENGUMUMAN');
    setAnnDate(getTodayDateString());
    setAnnPinned(false);
    setAnnPublished(true);
    setIsAnnModalOpen(true);
  };

  const openEditAnnouncement = (ann: Announcement) => {
    setEditingAnn(ann);
    setAnnTitle(ann.title);
    setAnnContent(ann.content);
    setAnnCategory(ann.category);
    setAnnDate(ann.publishDate);
    setAnnPinned(ann.isPinned);
    setAnnPublished(ann.isPublished);
    setIsAnnModalOpen(true);
  };

  const handleSubmitAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;
    setIsSavingAnn(true);
    try {
      await onSaveAnnouncement(
        {
          title: annTitle.trim(),
          content: annContent.trim(),
          category: annCategory,
          publishDate: annDate,
          isPinned: annPinned,
          isPublished: annPublished,
        },
        editingAnn?.id
      );
      setIsAnnModalOpen(false);
    } finally {
      setIsSavingAnn(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tab Switcher */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold font-display text-slate-900">
            Kelola Konten Website & Informasi Sekolah
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pusat pengaturan konten portal depan, pengumuman sekolah, identitas resmi, serta akses
            cepat edit data siswa, guru, dan kelas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl self-start">
          <button
            onClick={() => setActiveTab('WEBSITE')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'WEBSITE'
                ? 'bg-white text-[#0A3D91] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Isi & Identitas Website</span>
          </button>
          <button
            onClick={() => setActiveTab('ANNOUNCEMENTS')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ANNOUNCEMENTS'
                ? 'bg-white text-[#0A3D91] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Informasi & Pengumuman ({announcements.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('DATA_HUB')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'DATA_HUB'
                ? 'bg-white text-[#0A3D91] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Edit Data Sekolah & Akun</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Website & School Identity Editor */}
      {activeTab === 'WEBSITE' && (
        <form onSubmit={handleSaveSite} className="space-y-6 text-xs">
          {/* Live Preview Banner */}
          <div className="bg-[#0A3D91] text-white rounded-xl p-5 border border-[#082f70] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-[#D4AF37]">
                PRATINJAU HEADER PORTAL · {form.heroSubtitle}
              </p>
              <h2 className="text-lg font-bold font-display">
                {form.appTitle} — {form.schoolName}
              </h2>
              <p className="text-xs text-blue-100">
                {form.tagline} · TP {form.activeAcademicYear} ({form.semester}) · NPSN {form.npsn}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {siteSavedNotice && (
                <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tersimpan ke Website</span>
                </span>
              )}
              {canEdit && (
                <button
                  type="submit"
                  disabled={isSavingSite}
                  className="px-4 py-2.5 text-xs font-semibold text-[#0A3D91] bg-[#D4AF37] hover:bg-amber-400 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingSite ? 'Menyimpan...' : 'Publikasikan Perubahan'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 6 Cols: Identitas Sekolah & Website */}
            <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-base font-bold font-display text-slate-900 pb-3 border-b border-slate-200">
                1. Identitas Aplikasi & Profil Sekolah
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Website / Aplikasi *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!canEdit}
                    value={form.appTitle}
                    onChange={(e) => setForm({ ...form, appTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tagline Website</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={form.tagline}
                    onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Nama Sekolah *</label>
                  <input
                    type="text"
                    required
                    disabled={!canEdit}
                    value={form.schoolName}
                    onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">NPSN</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={form.npsn}
                    onChange={(e) => setForm({ ...form, npsn: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alamat Sekolah</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={form.schoolAddress}
                  onChange={(e) => setForm({ ...form, schoolAddress: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Resmi Sekolah</label>
                  <input
                    type="email"
                    disabled={!canEdit}
                    value={form.schoolEmail}
                    onChange={(e) => setForm({ ...form, schoolEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telepon Sekolah</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={form.schoolPhone}
                    onChange={(e) => setForm({ ...form, schoolPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kepala Sekolah</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={form.principalName}
                    onChange={(e) => setForm({ ...form, principalName: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">NIP Kepala Sekolah</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={form.principalNip}
                    onChange={(e) => setForm({ ...form, principalNip: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
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
                    disabled={!canEdit}
                    value={form.activeAcademicYear}
                    onChange={(e) => setForm({ ...form, activeAcademicYear: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Semester Aktif</label>
                  <select
                    disabled={!canEdit}
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

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Teks Footer Website</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={form.footerText}
                  onChange={(e) => setForm({ ...form, footerText: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            {/* Right 6 Cols: Konten Halaman Utama & Banner Informasi */}
            <div className="lg:col-span-6 space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <h3 className="text-base font-bold font-display text-slate-900 pb-3 border-b border-slate-200">
                  2. Konten Halaman Utama (Portal Depan)
                </h3>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Sub-Judul Instansi (Header)
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={form.heroSubtitle}
                    onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Judul Utama Portal (Hero Title)
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={form.heroTitle}
                    onChange={(e) => setForm({ ...form, heroTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Deskripsi Utama Portal
                  </label>
                  <textarea
                    rows={3}
                    disabled={!canEdit}
                    value={form.heroDescription}
                    onChange={(e) => setForm({ ...form, heroDescription: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="block font-semibold text-slate-700">Sorotan 1</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.feature1Title}
                      onChange={(e) => setForm({ ...form, feature1Title: e.target.value })}
                      placeholder="Judul"
                      className="w-full px-2.5 py-1.5 bg-[#F5F8FF] border border-slate-200 rounded-lg font-semibold"
                    />
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.feature1Desc}
                      onChange={(e) => setForm({ ...form, feature1Desc: e.target.value })}
                      placeholder="Keterangan"
                      className="w-full px-2.5 py-1.5 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block font-semibold text-slate-700">Sorotan 2</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.feature2Title}
                      onChange={(e) => setForm({ ...form, feature2Title: e.target.value })}
                      placeholder="Judul"
                      className="w-full px-2.5 py-1.5 bg-[#F5F8FF] border border-slate-200 rounded-lg font-semibold"
                    />
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.feature2Desc}
                      onChange={(e) => setForm({ ...form, feature2Desc: e.target.value })}
                      placeholder="Keterangan"
                      className="w-full px-2.5 py-1.5 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block font-semibold text-slate-700">Sorotan 3</label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.feature3Title}
                      onChange={(e) => setForm({ ...form, feature3Title: e.target.value })}
                      placeholder="Judul"
                      className="w-full px-2.5 py-1.5 bg-[#F5F8FF] border border-slate-200 rounded-lg font-semibold"
                    />
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={form.feature3Desc}
                      onChange={(e) => setForm({ ...form, feature3Desc: e.target.value })}
                      placeholder="Keterangan"
                      className="w-full px-2.5 py-1.5 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="text-base font-bold font-display text-slate-900">
                    3. Banner Informasi Penting (Portal & Dashboard)
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={form.showAnnouncementBanner}
                      onChange={(e) =>
                        setForm({ ...form, showAnnouncementBanner: e.target.checked })
                      }
                      className="rounded text-[#0A3D91]"
                    />
                    <span>Tampilkan Banner</span>
                  </label>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Judul Banner</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={form.announcementBannerTitle}
                    onChange={(e) =>
                      setForm({ ...form, announcementBannerTitle: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Isi Informasi Banner</label>
                  <textarea
                    rows={3}
                    disabled={!canEdit}
                    value={form.announcementBannerBody}
                    onChange={(e) => setForm({ ...form, announcementBannerBody: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg leading-relaxed"
                  />
                </div>
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center justify-end gap-3">
              {siteSavedNotice && (
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Semua perubahan konten website berhasil disimpan dan disinkronkan.</span>
                </span>
              )}
              <button
                type="submit"
                disabled={isSavingSite}
                className="px-6 py-2.5 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Check className="w-4 h-4 text-[#D4AF37]" />
                <span>{isSavingSite ? 'Menyimpan...' : 'Simpan Konten Website'}</span>
              </button>
            </div>
          )}
        </form>
      )}

      {/* TAB 2: Informasi & Pengumuman Sekolah CRUD */}
      {activeTab === 'ANNOUNCEMENTS' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold font-display text-slate-900">
                Papan Informasi & Pengumuman Resmi Sekolah
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Informasi yang dipublikasikan otomatis muncul di Halaman Login Portal dan Dashboard
                Guru/Admin
              </p>
            </div>
            {canEdit && (
              <button
                onClick={openAddAnnouncement}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#D4AF37]" />
                <span>Tambah Informasi Baru</span>
              </button>
            )}
          </div>

          {announcements.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500">
              Belum ada pengumuman atau informasi sekolah yang ditambahkan.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="text-[11px] font-semibold text-slate-500 flex flex-wrap items-center gap-1.5">
                        <span
                          className={
                            ann.category === 'DARURAT'
                              ? 'text-rose-700'
                              : ann.category === 'AKADEMIK'
                              ? 'text-indigo-700'
                              : ann.category === 'KEGIATAN'
                              ? 'text-emerald-700'
                              : 'text-[#0A3D91]'
                          }
                        >
                          {ann.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {formatIndonesianDate(ann.publishDate)}
                        </span>
                        {ann.isPinned && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-700 inline-flex items-center gap-0.5">
                              <Pin className="w-3 h-3" /> Disematkan
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className={ann.isPublished ? 'text-emerald-700' : 'text-slate-400'}>
                          {ann.isPublished ? 'Publik' : 'Draf'}
                        </span>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEditAnnouncement(ann)}
                            title="Edit Informasi"
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(ann)}
                            title="Hapus Informasi"
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <h3 className="text-sm font-bold font-display text-slate-900 mb-1.5">
                      {ann.title}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                      {ann.content}
                    </p>
                  </div>

                  {canEdit && (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Oleh: {ann.authorName}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            onSaveAnnouncement(
                              {
                                title: ann.title,
                                content: ann.content,
                                category: ann.category,
                                publishDate: ann.publishDate,
                                isPinned: !ann.isPinned,
                                isPublished: ann.isPublished,
                              },
                              ann.id
                            )
                          }
                          className="px-2.5 py-1 font-semibold bg-[#F5F8FF] text-[#0A3D91] hover:bg-blue-100 rounded-md cursor-pointer inline-flex items-center gap-1"
                        >
                          <Pin className="w-3 h-3" />
                          <span>{ann.isPinned ? 'Lepas Sematan' : 'Sematkan'}</span>
                        </button>
                        <button
                          onClick={() =>
                            onSaveAnnouncement(
                              {
                                title: ann.title,
                                content: ann.content,
                                category: ann.category,
                                publishDate: ann.publishDate,
                                isPinned: ann.isPinned,
                                isPublished: !ann.isPublished,
                              },
                              ann.id
                            )
                          }
                          className="px-2.5 py-1 font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md cursor-pointer inline-flex items-center gap-1"
                        >
                          {ann.isPublished ? (
                            <>
                              <EyeOff className="w-3 h-3" />
                              <span>Jadikan Draf</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" />
                              <span>Publikasikan</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Quick Edit Hub for Data Siswa, Data Guru, Data Kelas, Pengaturan & Users */}
      {activeTab === 'DATA_HUB' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F5F8FF] text-[#0A3D91] flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
                    {students.length} Siswa
                  </span>
                </div>
                <h3 className="text-sm font-bold font-display text-slate-900">
                  Kelola Data Induk Siswa
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Tambah, edit biodata, pindah kelas, foto, nomor WhatsApp orang tua, serta import
                  atau export data siswa Excel.
                </p>
              </div>
              <button
                onClick={() => onNavigate('students')}
                className="mt-4 w-full py-2 px-3 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Buka Editor Data Siswa</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F5F8FF] text-[#0A3D91] flex items-center justify-center">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
                    {teachers.length} Guru
                  </span>
                </div>
                <h3 className="text-sm font-bold font-display text-slate-900">
                  Kelola Data Guru & Staf
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Tambah, edit NIP, peran wali kelas, email, dan status keaktifan seluruh pendidik
                  dan tenaga kependidikan.
                </p>
              </div>
              <button
                onClick={() => onNavigate('teachers')}
                className="mt-4 w-full py-2 px-3 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Buka Editor Data Guru</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F5F8FF] text-[#0A3D91] flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
                    {classes.length} Kelas
                  </span>
                </div>
                <h3 className="text-sm font-bold font-display text-slate-900">
                  Kelola Data Rombongan Belajar
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Atur nama kelas, tingkat 1–6, kapasitas siswa, serta penugasan wali kelas untuk
                  tahun pelajaran aktif.
                </p>
              </div>
              <button
                onClick={() => onNavigate('classes')}
                className="mt-4 w-full py-2 px-3 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Buka Editor Data Kelas</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F5F8FF] text-[#0A3D91] flex items-center justify-center">
                    <Settings className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    Jam & Tahun Ajaran
                  </span>
                </div>
                <h3 className="text-sm font-bold font-display text-slate-900">
                  Jam Operasional & Tahun Pelajaran
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Edit jam mulai scan masuk, batas tepat waktu, jam pulang, provider WhatsApp, serta
                  daftar tahun pelajaran.
                </p>
              </div>
              <button
                onClick={() => onNavigate('settings')}
                className="mt-4 w-full py-2 px-3 text-xs font-semibold text-[#0A3D91] bg-[#F5F8FF] hover:bg-blue-100 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Buka Pengaturan Sistem</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F5F8FF] text-[#0A3D91] flex items-center justify-center">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    Template WA
                  </span>
                </div>
                <h3 className="text-sm font-bold font-display text-slate-900">
                  Edit Template Pesan WhatsApp
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Sesuaikan redaksi pesan WhatsApp resmi yang dikirim ke orang tua siswa saat scan
                  kehadiran.
                </p>
              </div>
              <button
                onClick={() => onNavigate('notifications')}
                className="mt-4 w-full py-2 px-3 text-xs font-semibold text-[#0A3D91] bg-[#F5F8FF] hover:bg-blue-100 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Buka Editor Template WA</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Super Admin Account Role Manager */}
          {isSuperAdmin && usersList.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#0A3D91]" />
                  <div>
                    <h2 className="text-base font-bold font-display text-slate-900">
                      Manajemen Akun Pengguna Login Portal
                    </h2>
                    <p className="text-xs text-slate-500">
                      Atur hak akses (Super Admin, Kepala Sekolah, Admin Sekolah, Guru) dan kelas ampu
                      untuk akun yang telah masuk
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {usersList.length} Akun Terdaftar
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F5F8FF] font-semibold text-slate-600">
                      <th className="py-2.5 px-4">Nama & Email</th>
                      <th className="py-2.5 px-4">Role Akses</th>
                      <th className="py-2.5 px-4">Kelas Tanggung Jawab</th>
                      <th className="py-2.5 px-4">Status Akun</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usersList.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">{u.name}</p>
                          <p className="text-slate-500">{u.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={u.role}
                            disabled={u.email === 'adindagalih@gmail.com'}
                            onChange={(e) =>
                              onUpdateUserAccount(u, { role: e.target.value as UserRole })
                            }
                            className="px-2.5 py-1.5 bg-[#F5F8FF] border border-slate-200 rounded-lg font-semibold text-[#0A3D91]"
                          >
                            <option value="SUPER_ADMIN">SUPER ADMIN</option>
                            <option value="KEPALA_SEKOLAH">KEPALA SEKOLAH</option>
                            <option value="ADMIN_SEKOLAH">ADMIN SEKOLAH</option>
                            <option value="GURU">GURU</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={u.assignedClassId || 'ALL'}
                            onChange={(e) => {
                              const cid = e.target.value;
                              const cls = classes.find((c) => c.id === cid);
                              onUpdateUserAccount(u, {
                                assignedClassId: cid,
                                assignedClassName: cid === 'ALL' ? 'Seluruh Kelas' : cls?.name || 'Kelas 1A',
                              });
                            }}
                            className="px-2.5 py-1.5 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                          >
                            <option value="ALL">Seluruh Kelas</option>
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            disabled={u.email === 'adindagalih@gmail.com'}
                            onClick={() => onUpdateUserAccount(u, { active: !u.active })}
                            className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer disabled:opacity-50 ${
                              u.active
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {u.active ? 'AKTIF' : 'NONAKTIF'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Add / Edit Announcement */}
      {isAnnModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <h2 className="text-lg font-bold font-display text-slate-900">
                {editingAnn ? 'Edit Informasi Sekolah' : 'Tambah Informasi / Pengumuman Baru'}
              </h2>
              <button
                onClick={() => setIsAnnModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAnnouncement} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Judul Informasi / Pengumuman *
                </label>
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Contoh: Jadwal Penilaian Tengah Semester Genap"
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={annCategory}
                    onChange={(e) => setAnnCategory(e.target.value as AnnouncementCategory)}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                  >
                    <option value="PENGUMUMAN">PENGUMUMAN</option>
                    <option value="AKADEMIK">AKADEMIK</option>
                    <option value="KEGIATAN">KEGIATAN</option>
                    <option value="DARURAT">DARURAT / PENTING</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Publikasi</label>
                  <input
                    type="date"
                    required
                    value={annDate}
                    onChange={(e) => setAnnDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Isi Informasi Lengkap *
                </label>
                <textarea
                  rows={5}
                  required
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  placeholder="Tulis rincian informasi sekolah untuk guru, orang tua, dan pengunjung portal..."
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg leading-relaxed"
                />
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={annPublished}
                    onChange={(e) => setAnnPublished(e.target.checked)}
                    className="rounded text-[#0A3D91]"
                  />
                  <span>Publikasikan ke Website & Dashboard</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={annPinned}
                    onChange={(e) => setAnnPinned(e.target.checked)}
                    className="rounded text-[#0A3D91]"
                  />
                  <span>Sematkan di Paling Atas</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAnnModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingAnn}
                  className="px-4 py-2 font-semibold text-white bg-[#0A3D91] rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 text-[#D4AF37]" />
                  <span>{isSavingAnn ? 'Menyimpan...' : 'Simpan Informasi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-bold font-display text-slate-900 mb-2">
              Hapus Informasi Sekolah?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              Anda akan menghapus informasi <strong>&ldquo;{deleteTarget.title}&rdquo;</strong>.
              Tindakan ini tidak dapat dibatalkan dan akan tercatat di Audit Log.
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  const target = deleteTarget;
                  setDeleteTarget(null);
                  await onDeleteAnnouncement(target);
                }}
                className="px-4 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
