import React, { useMemo, useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Users,
  BookOpen,
  QrCode,
  UserCheck,
  Search,
  GraduationCap,
  Layers,
} from 'lucide-react';
import { PageId, SchoolClass, Student, Teacher, UserProfile, UserRole } from '../types';
import { SUBJECT_TEACHER_OPTIONS } from '../seedData';
import { downloadTeacherQrPng } from '../utils/exportUtils';

interface TeachersViewProps {
  userProfile: UserProfile;
  teachers: Teacher[];
  classes: SchoolClass[];
  schoolName?: string;
  onSaveTeacher: (
    data: Omit<Teacher, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteTeacher: (teacher: Teacher) => Promise<void>;
  onNavigate?: (page: PageId) => void;
}

type TeacherAssignmentType = 'WALI_KELAS' | 'GURU_MAPEL' | 'STAF';

export function isSubjectTeacher(teacher: Pick<Teacher, 'classId' | 'className'>): boolean {
  return (
    teacher.classId.startsWith('MAPEL_') ||
    teacher.className.toLowerCase().includes('mapel')
  );
}

export const TeachersView: React.FC<TeachersViewProps> = ({
  userProfile,
  teachers,
  classes,
  schoolName = 'SDN ASEMROWO II/63 SURABAYA',
  onSaveTeacher,
  onDeleteTeacher,
  onNavigate,
}) => {
  const canEdit = userProfile.role === 'SUPER_ADMIN' || userProfile.role === 'ADMIN_SEKOLAH';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<
    'ALL' | 'WALI_KELAS' | 'GURU_MAPEL' | 'STAF'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [nip, setNip] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('GURU');
  const [assignmentType, setAssignmentType] = useState<TeacherAssignmentType>('WALI_KELAS');
  const [classId, setClassId] = useState('cls_1a');
  const [subjectCode, setSubjectCode] = useState(SUBJECT_TEACHER_OPTIONS[0].code);
  const [customSubjectName, setCustomSubjectName] = useState('');
  const [status, setStatus] = useState<'AKTIF' | 'NONAKTIF'>('AKTIF');
  const [isSaving, setIsSaving] = useState(false);

  const teacherStats = useMemo(() => {
    const waliCount = teachers.filter(
      (t) => t.role === 'GURU' && !isSubjectTeacher(t) && t.classId !== 'ALL'
    ).length;
    const mapelCount = teachers.filter((t) => isSubjectTeacher(t)).length;
    const stafCount = teachers.filter(
      (t) =>
        t.role !== 'GURU' || (!isSubjectTeacher(t) && t.classId === 'ALL')
    ).length;
    return { total: teachers.length, waliCount, mapelCount, stafCount };
  }, [teachers]);

  const filteredTeachers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return teachers.filter((t) => {
      const isMapel = isSubjectTeacher(t);
      const isWali = t.role === 'GURU' && !isMapel && t.classId !== 'ALL';
      const isStaf = !isMapel && !isWali;

      if (categoryFilter === 'WALI_KELAS' && !isWali) return false;
      if (categoryFilter === 'GURU_MAPEL' && !isMapel) return false;
      if (categoryFilter === 'STAF' && !isStaf) return false;

      if (!q) return true;
      return (
        t.fullName.toLowerCase().includes(q) ||
        t.nip.toLowerCase().includes(q) ||
        t.className.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q)
      );
    });
  }, [teachers, categoryFilter, searchQuery]);

  const openAdd = (defaultType: TeacherAssignmentType = 'WALI_KELAS') => {
    setEditingTeacher(null);
    setNip('');
    setFullName('');
    setEmail('');
    setPhone('0812');
    setRole(defaultType === 'STAF' ? 'ADMIN_SEKOLAH' : 'GURU');
    setAssignmentType(defaultType);
    setClassId(classes[0]?.id || 'cls_1a');
    setSubjectCode(SUBJECT_TEACHER_OPTIONS[0].code);
    setCustomSubjectName('');
    setStatus('AKTIF');
    setIsModalOpen(true);
  };

  const openEdit = (t: Teacher) => {
    setEditingTeacher(t);
    setNip(t.nip);
    setFullName(t.fullName);
    setEmail(t.email);
    setPhone(t.phone);
    setRole(t.role);

    if (isSubjectTeacher(t)) {
      setAssignmentType('GURU_MAPEL');
      const matchedOpt = SUBJECT_TEACHER_OPTIONS.find((o) => o.code === t.classId);
      if (matchedOpt) {
        setSubjectCode(matchedOpt.code);
        setCustomSubjectName('');
      } else {
        setSubjectCode('MAPEL_LAINNYA');
        setCustomSubjectName(t.className.replace(/^Guru Mapel\s+/i, ''));
      }
    } else if (t.classId === 'ALL' || t.role !== 'GURU') {
      setAssignmentType('STAF');
      setClassId('ALL');
    } else {
      setAssignmentType('WALI_KELAS');
      setClassId(t.classId);
    }

    setStatus(t.status);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setIsSaving(true);
    try {
      let resolvedClassId = 'ALL';
      let resolvedClassName = 'Tata Usaha / Staf Sekolah';

      if (assignmentType === 'WALI_KELAS') {
        const cls = classes.find((c) => c.id === classId);
        resolvedClassId = cls?.id || classId || 'cls_1a';
        resolvedClassName = cls?.name || 'Kelas 1A';
      } else if (assignmentType === 'GURU_MAPEL') {
        const matchedOpt = SUBJECT_TEACHER_OPTIONS.find((o) => o.code === subjectCode);
        if (matchedOpt) {
          resolvedClassId = matchedOpt.code;
          resolvedClassName = matchedOpt.label.slice(0, 50);
        } else {
          const cleanSubj = (customSubjectName.trim() || 'Umum').slice(0, 32);
          resolvedClassId = `MAPEL_${cleanSubj.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
          resolvedClassName = `Guru Mapel ${cleanSubj}`.slice(0, 50);
        }
      } else {
        resolvedClassId = 'ALL';
        resolvedClassName =
          role === 'KEPALA_SEKOLAH'
            ? 'Kepala Sekolah'
            : role === 'SUPER_ADMIN'
            ? 'Super Administrator'
            : 'Tata Usaha Sekolah';
      }

      await onSaveTeacher(
        {
          nip: nip.trim() || '-',
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role,
          classId: resolvedClassId,
          className: resolvedClassName,
          status,
          userUid: editingTeacher?.userUid || '',
        },
        editingTeacher?.id
      );
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold font-display text-slate-900">
            Data Guru Kelas (Rombel), Guru Mata Pelajaran &amp; Staf
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar pendidik wali rombel paralel, guru mata pelajaran (PAI, PJOK, B. Inggris, B.
            Jawa, Seni), dan staf {schoolName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigate && (
            <button
              onClick={() => onNavigate('teacher-attendance')}
              className="px-3.5 py-2 text-xs font-semibold text-[#0A3D91] bg-[#F5F8FF] hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>Buka Absensi Guru</span>
            </button>
          )}
          {canEdit && (
            <>
              <button
                onClick={() => openAdd('GURU_MAPEL')}
                className="px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <GraduationCap className="w-4 h-4 text-amber-700" />
                <span>+ Guru Mata Pelajaran</span>
              </button>
              <button
                onClick={() => openAdd('WALI_KELAS')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#D4AF37]" />
                <span>+ Guru Wali Rombel / Staf</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards & Category Filter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setCategoryFilter('ALL')}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            categoryFilter === 'ALL'
              ? 'bg-[#0A3D91] text-white border-[#0A3D91]'
              : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <p
            className={`text-xs font-medium ${
              categoryFilter === 'ALL' ? 'text-blue-100' : 'text-slate-500'
            }`}
          >
            Total Pendidik &amp; Staf
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums mt-1">{teacherStats.total}</p>
          <p
            className={`text-[11px] mt-1 ${
              categoryFilter === 'ALL' ? 'text-[#D4AF37]' : 'text-slate-400'
            }`}
          >
            Semua kategori aktif
          </p>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter('WALI_KELAS')}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            categoryFilter === 'WALI_KELAS'
              ? 'bg-[#0A3D91] text-white border-[#0A3D91]'
              : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <p
            className={`text-xs font-medium ${
              categoryFilter === 'WALI_KELAS' ? 'text-blue-100' : 'text-slate-500'
            }`}
          >
            Guru Kelas (Wali Rombel)
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums mt-1">
            {teacherStats.waliCount}
          </p>
          <p
            className={`text-[11px] mt-1 ${
              categoryFilter === 'WALI_KELAS' ? 'text-[#D4AF37]' : 'text-slate-400'
            }`}
          >
            Pengampu Kelas 1A – 6B
          </p>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter('GURU_MAPEL')}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            categoryFilter === 'GURU_MAPEL'
              ? 'bg-[#0A3D91] text-white border-[#0A3D91]'
              : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <p
            className={`text-xs font-medium ${
              categoryFilter === 'GURU_MAPEL' ? 'text-blue-100' : 'text-slate-500'
            }`}
          >
            Guru Mata Pelajaran (Mapel)
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums mt-1">
            {teacherStats.mapelCount}
          </p>
          <p
            className={`text-[11px] mt-1 ${
              categoryFilter === 'GURU_MAPEL' ? 'text-[#D4AF37]' : 'text-slate-400'
            }`}
          >
            PAI, PJOK, B. Inggris, Mulok, Seni
          </p>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter('STAF')}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            categoryFilter === 'STAF'
              ? 'bg-[#0A3D91] text-white border-[#0A3D91]'
              : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <p
            className={`text-xs font-medium ${
              categoryFilter === 'STAF' ? 'text-blue-100' : 'text-slate-500'
            }`}
          >
            Tenaga Kependidikan / Staf
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums mt-1">
            {teacherStats.stafCount}
          </p>
          <p
            className={`text-[11px] mt-1 ${
              categoryFilter === 'STAF' ? 'text-[#D4AF37]' : 'text-slate-400'
            }`}
          >
            Tata Usaha &amp; Manajemen
          </p>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
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
        <span className="text-xs text-slate-500 font-medium">
          Menampilkan <strong className="text-slate-900">{filteredTeachers.length}</strong> dari{' '}
          {teachers.length} guru/staf
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F5F8FF] text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">NIP</th>
                <th className="py-3 px-4">Kategori Pendidik</th>
                <th className="py-3 px-4">Rombel / Mata Pelajaran Ampuan</th>
                <th className="py-3 px-4">Email &amp; Telepon</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi &amp; QR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTeachers.map((t) => {
                const isMapel = isSubjectTeacher(t);
                return (
                  <tr key={t.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-semibold text-slate-900">{t.fullName}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-700">{t.nip}</td>
                    <td className="py-3 px-4">
                      {isMapel ? (
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          Guru Mata Pelajaran
                        </span>
                      ) : t.role === 'SUPER_ADMIN' ? (
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                          Super Admin
                        </span>
                      ) : t.role === 'KEPALA_SEKOLAH' ? (
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-[#0A3D91] border border-blue-200">
                          Kepala Sekolah
                        </span>
                      ) : t.role === 'ADMIN_SEKOLAH' || t.classId === 'ALL' ? (
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                          Staf / Tata Usaha
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Wali Kelas (Rombel)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      <p>{t.className}</p>
                      {isMapel && (
                        <p className="text-[11px] text-slate-500 font-normal">
                          Mengajar Lintas Rombel (Kelas 1–6)
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-800">{t.email}</p>
                      <p className="font-mono tabular-nums text-slate-500">{t.phone}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${
                          t.status === 'AKTIF' ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => void downloadTeacherQrPng(t, schoolName)}
                          title="Unduh Kartu QR Absensi Guru (PNG)"
                          className="px-2 py-1 text-[11px] font-semibold text-[#0A3D91] bg-[#F5F8FF] hover:bg-blue-100 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR</span>
                        </button>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => openEdit(t)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(t)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <h2 className="text-lg font-bold font-display text-slate-900">
                {editingTeacher
                  ? 'Edit Data Guru / Mata Pelajaran'
                  : 'Tambah Guru Kelas, Guru Mapel, atau Staf'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Assignment Category Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Jenis Penugasan Pendidik / Staf *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignmentType('WALI_KELAS');
                      setRole('GURU');
                    }}
                    className={`py-2 px-2.5 rounded-lg font-semibold border text-center cursor-pointer ${
                      assignmentType === 'WALI_KELAS'
                        ? 'bg-[#0A3D91] text-white border-[#0A3D91]'
                        : 'bg-[#F5F8FF] text-slate-700 border-slate-200'
                    }`}
                  >
                    Wali Kelas (Rombel)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignmentType('GURU_MAPEL');
                      setRole('GURU');
                    }}
                    className={`py-2 px-2.5 rounded-lg font-semibold border text-center cursor-pointer ${
                      assignmentType === 'GURU_MAPEL'
                        ? 'bg-[#0A3D91] text-white border-[#0A3D91]'
                        : 'bg-[#F5F8FF] text-slate-700 border-slate-200'
                    }`}
                  >
                    Guru Mata Pelajaran
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignmentType('STAF');
                      if (role === 'GURU') setRole('ADMIN_SEKOLAH');
                    }}
                    className={`py-2 px-2.5 rounded-lg font-semibold border text-center cursor-pointer ${
                      assignmentType === 'STAF'
                        ? 'bg-[#0A3D91] text-white border-[#0A3D91]'
                        : 'bg-[#F5F8FF] text-slate-700 border-slate-200'
                    }`}
                  >
                    Staf / Pimpinan
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lengkap &amp; Gelar *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Contoh: Drs. H. Mulyadi, M.Pd.I."
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">NIP</label>
                  <input
                    type="text"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    placeholder="198403122009021003"
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    No. Telepon / WA
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="081231001001"
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Akun *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="guru@sdnasemrowo2.sch.id"
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                />
              </div>

              {assignmentType === 'WALI_KELAS' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Pilih Rombongan Belajar (Wali Kelas) *
                  </label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-semibold text-slate-800"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Tingkat Kelas {c.grade})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {assignmentType === 'GURU_MAPEL' && (
                <div className="space-y-3 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
                  <div>
                    <label className="block font-semibold text-amber-950 mb-1">
                      Pilih Mata Pelajaran Ampuan *
                    </label>
                    <select
                      value={subjectCode}
                      onChange={(e) => setSubjectCode(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg font-semibold text-slate-800"
                    >
                      {SUBJECT_TEACHER_OPTIONS.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label}
                        </option>
                      ))}
                      <option value="MAPEL_LAINNYA">Mata Pelajaran Lainnya (Ketik Manual)</option>
                    </select>
                  </div>
                  {subjectCode === 'MAPEL_LAINNYA' && (
                    <div>
                      <label className="block font-semibold text-amber-950 mb-1">
                        Nama Mata Pelajaran *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={32}
                        value={customSubjectName}
                        onChange={(e) => setCustomSubjectName(e.target.value)}
                        placeholder="Contoh: Bahasa Arab / Pramuka"
                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Role Akses</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                  >
                    <option value="GURU">GURU (Wali Kelas / Mapel)</option>
                    <option value="ADMIN_SEKOLAH">ADMIN SEKOLAH / TU</option>
                    <option value="KEPALA_SEKOLAH">KEPALA SEKOLAH</option>
                    <option value="SUPER_ADMIN">SUPER ADMIN</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status Aktif</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'AKTIF' | 'NONAKTIF')}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                  >
                    <option value="AKTIF">AKTIF</option>
                    <option value="NONAKTIF">NONAKTIF</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
                  <span>Simpan Data</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-bold font-display text-slate-900 mb-2">
              Hapus Data Guru / Staf?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              Anda akan menghapus <strong>{deleteTarget.fullName}</strong> (NIP {deleteTarget.nip})
              dari daftar guru &amp; wali kelas. Tindakan ini akan dicatat di Audit Log.
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
                  await onDeleteTeacher(target);
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

interface ClassesViewProps {
  userProfile: UserProfile;
  classes: SchoolClass[];
  teachers: Teacher[];
  students: Student[];
  onSaveClass: (
    data: Omit<SchoolClass, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteClass: (cls: SchoolClass) => Promise<void>;
}

export const ClassesView: React.FC<ClassesViewProps> = ({
  userProfile,
  classes,
  teachers,
  students,
  onSaveClass,
  onDeleteClass,
}) => {
  const canEdit = userProfile.role === 'SUPER_ADMIN' || userProfile.role === 'ADMIN_SEKOLAH';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [gradeFilter, setGradeFilter] = useState<number | 'ALL'>('ALL');

  const [name, setName] = useState('');
  const [grade, setGrade] = useState(1);
  const [rombelSuffix, setRombelSuffix] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [homeroomTeacherId, setHomeroomTeacherId] = useState('');
  const [academicYear, setAcademicYear] = useState('2026/2027');
  const [capacity, setCapacity] = useState(32);

  const subjectTeachers = useMemo(
    () => teachers.filter((t) => t.status === 'AKTIF' && isSubjectTeacher(t)),
    [teachers]
  );

  const filteredClasses = useMemo(() => {
    if (gradeFilter === 'ALL') return classes;
    return classes.filter((c) => c.grade === gradeFilter);
  }, [classes, gradeFilter]);

  const openAdd = () => {
    setEditingClass(null);
    setGrade(1);
    setRombelSuffix('B');
    setName('Kelas 1B');
    setHomeroomTeacherId(teachers[0]?.id || '');
    setAcademicYear('2026/2027');
    setCapacity(32);
    setIsModalOpen(true);
  };

  const openEdit = (cls: SchoolClass) => {
    setEditingClass(cls);
    setName(cls.name);
    setGrade(cls.grade);
    setHomeroomTeacherId(cls.homeroomTeacherId);
    setAcademicYear(cls.academicYear);
    setCapacity(cls.capacity);
    setIsModalOpen(true);
  };

  const handleApplyRombelPreset = (g: number, suffix: 'A' | 'B' | 'C' | 'D') => {
    setGrade(g);
    setRombelSuffix(suffix);
    setName(`Kelas ${g}${suffix}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const tch = teachers.find((t) => t.id === homeroomTeacherId);
    await onSaveClass(
      {
        name: name.trim(),
        grade: Number(grade),
        homeroomTeacherId,
        homeroomTeacherName: tch ? tch.fullName : 'Belum Ditentukan',
        academicYear,
        capacity: Number(capacity),
      },
      editingClass?.id
    );
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold font-display text-slate-900">
            Manajemen Data Kelas &amp; Rombongan Belajar (Rombel Paralel)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar rombel aktif ({classes.length} rombel paralel), wali kelas pengampu, serta guru
            mata pelajaran lintas kelas
          </p>
        </div>

        {canEdit && (
          <button
            onClick={openAdd}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#D4AF37]" />
            <span>Tambah Rombel Baru</span>
          </button>
        )}
      </div>

      {/* Filter Tingkat Kelas (1 - 6) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setGradeFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              gradeFilter === 'ALL'
                ? 'bg-[#0A3D91] text-white'
                : 'bg-[#F5F8FF] text-slate-700 hover:bg-blue-50'
            }`}
          >
            Semua Tingkat ({classes.length} Rombel)
          </button>
          {[1, 2, 3, 4, 5, 6].map((g) => {
            const count = classes.filter((c) => c.grade === g).length;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setGradeFilter(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  gradeFilter === g
                    ? 'bg-[#0A3D91] text-white'
                    : 'bg-[#F5F8FF] text-slate-700 hover:bg-blue-50'
                }`}
              >
                Kelas {g} ({count} Rombel)
              </button>
            );
          })}
        </div>

        <span className="text-xs text-slate-500 font-mono">
          Total Siswa Aktif: {students.filter((s) => s.status === 'AKTIF').length} Siswa
        </span>
      </div>

      {/* Rombel Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClasses.map((cls) => {
          const studentCount = students.filter(
            (s) => s.classId === cls.id && s.status === 'AKTIF'
          ).length;
          const maleCount = students.filter(
            (s) => s.classId === cls.id && s.status === 'AKTIF' && s.gender === 'L'
          ).length;
          const femaleCount = studentCount - maleCount;

          return (
            <div
              key={cls.id}
              className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-[#F5F8FF] border border-blue-100 text-[#0A3D91] flex items-center justify-center font-bold font-display text-sm">
                      {cls.name.replace(/^Kelas\s+/i, '')}
                    </div>
                    <div>
                      <h3 className="text-base font-bold font-display text-slate-900">
                        {cls.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Tingkat Kelas {cls.grade} · Rombel Paralel · TP {cls.academicYear}
                      </p>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(cls)}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteClass(cls)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="py-3 border-y border-slate-100 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Wali Rombel:</span>
                    <span className="font-semibold text-slate-800">{cls.homeroomTeacherName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Kapasitas Rombel:</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-800">
                      {studentCount} / {cls.capacity} Siswa
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Guru Mapel Terintegrasi:</span>
                    <span className="font-semibold text-[#0A3D91]">
                      {subjectTeachers.length} Guru Mapel
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-600 font-mono tabular-nums">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#0A3D91]" />
                  <span>L: {maleCount}</span>
                  <span>·</span>
                  <span>P: {femaleCount}</span>
                </span>
                <span className="text-[#0A3D91] font-semibold">Rombel Aktif</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Guru Mata Pelajaran Lintas Rombel Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-[#0A3D91]" />
          <div>
            <h2 className="text-sm font-bold font-display text-slate-900">
              Daftar Guru Mata Pelajaran (Mengajar Seluruh Rombel Kelas 1A – 6B)
            </h2>
            <p className="text-xs text-slate-500">
              Guru mata pelajaran tercatat kehadirannya pada modul Absensi Guru &amp; Staf
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {subjectTeachers.map((st) => (
            <div
              key={st.id}
              className="p-3.5 rounded-xl bg-[#F5F8FF] border border-slate-200 flex items-center justify-between gap-2"
            >
              <div>
                <p className="font-bold text-slate-900">{st.fullName}</p>
                <p className="text-[#0A3D91] font-semibold mt-0.5">{st.className}</p>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5">NIP: {st.nip}</p>
              </div>
              <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                MAPEL
              </span>
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <h2 className="text-lg font-bold font-display text-slate-900">
                {editingClass ? 'Edit Data Rombel' : 'Tambah Rombongan Belajar Baru'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {!editingClass && (
                <div className="p-3 rounded-xl bg-[#F5F8FF] border border-slate-200 space-y-2">
                  <p className="font-semibold text-slate-700">
                    Pilih Cepat Rombel Paralel (Otomatis Isi Nama):
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={grade}
                      onChange={(e) =>
                        handleApplyRombelPreset(Number(e.target.value), rombelSuffix)
                      }
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold"
                    >
                      {[1, 2, 3, 4, 5, 6].map((g) => (
                        <option key={g} value={g}>
                          Tingkat Kelas {g}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      {(['A', 'B', 'C', 'D'] as const).map((sfx) => (
                        <button
                          key={sfx}
                          type="button"
                          onClick={() => handleApplyRombelPreset(grade, sfx)}
                          className={`flex-1 py-1.5 rounded-lg font-bold border cursor-pointer ${
                            rombelSuffix === sfx
                              ? 'bg-[#0A3D91] text-white border-[#0A3D91]'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {sfx}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Rombongan Belajar *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Kelas 1B"
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tingkat (1–6)</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
                  >
                    {[1, 2, 3, 4, 5, 6].map((g) => (
                      <option key={g} value={g}>
                        Kelas {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kapasitas Siswa</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Wali Kelas Pengampu Rombel
                </label>
                <select
                  value={homeroomTeacherId}
                  onChange={(e) => setHomeroomTeacherId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} ({t.className})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-[#0A3D91] rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-[#D4AF37]" />
                  <span>Simpan Rombel</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

