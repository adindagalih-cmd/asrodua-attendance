import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Check, Users, BookOpen, QrCode, UserCheck } from 'lucide-react';
import { PageId, SchoolClass, Student, Teacher, UserProfile, UserRole } from '../types';
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

  const [nip, setNip] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('GURU');
  const [classId, setClassId] = useState('cls_1a');
  const [status, setStatus] = useState<'AKTIF' | 'NONAKTIF'>('AKTIF');
  const [isSaving, setIsSaving] = useState(false);

  const openAdd = () => {
    setEditingTeacher(null);
    setNip('');
    setFullName('');
    setEmail('');
    setPhone('0812');
    setRole('GURU');
    setClassId(classes[0]?.id || 'cls_1a');
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
    setClassId(t.classId);
    setStatus(t.status);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setIsSaving(true);
    try {
      const cls = classes.find((c) => c.id === classId);
      await onSaveTeacher(
        {
          nip: nip.trim() || '-',
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role,
          classId,
          className: classId === 'ALL' ? 'Semua Kelas / Staf' : cls?.name || 'Kelas 1A',
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
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold font-display text-slate-900">
            Data Guru & Wali Kelas
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar pendidik dan tenaga kependidikan {schoolName} ({teachers.length}{' '}
            terdaftar)
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
            <button
              onClick={openAdd}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#D4AF37]" />
              <span>Tambah Guru / Staf</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F5F8FF] text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">NIP</th>
                <th className="py-3 px-4">Peran / Role</th>
                <th className="py-3 px-4">Tanggung Jawab Kelas</th>
                <th className="py-3 px-4">Email & Telepon</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi & QR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {teachers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 font-semibold text-slate-900">{t.fullName}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-700">{t.nip}</td>
                  <td className="py-3 px-4 font-medium text-[#0A3D91]">
                    {t.role === 'SUPER_ADMIN'
                      ? 'Super Admin'
                      : t.role === 'KEPALA_SEKOLAH'
                      ? 'Kepala Sekolah'
                      : t.role === 'ADMIN_SEKOLAH'
                      ? 'Admin Sekolah'
                      : 'Guru Kelas'}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{t.className}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <h2 className="text-lg font-bold font-display text-slate-900">
                {editingTeacher ? 'Edit Data Guru' : 'Tambah Guru / Staf Baru'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lengkap & Gelar *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Contoh: Budi Santoso, S.Pd."
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
                  <label className="block font-semibold text-slate-700 mb-1">No. Telepon / WA</label>
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Role Akses</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                  >
                    <option value="GURU">GURU</option>
                    <option value="ADMIN_SEKOLAH">ADMIN SEKOLAH</option>
                    <option value="KEPALA_SEKOLAH">KEPALA SEKOLAH</option>
                    <option value="SUPER_ADMIN">SUPER ADMIN</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kelas Ampuan</label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                  >
                    <option value="ALL">Semua Kelas (Staf)</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
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
                  <span>Simpan</span>
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

  const [name, setName] = useState('');
  const [grade, setGrade] = useState(1);
  const [homeroomTeacherId, setHomeroomTeacherId] = useState('');
  const [academicYear, setAcademicYear] = useState('2026/2027');
  const [capacity, setCapacity] = useState(32);

  const openAdd = () => {
    setEditingClass(null);
    setName('');
    setGrade(1);
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
            Manajemen Data Kelas & Rombongan Belajar
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar kelas aktif, wali kelas pengampu, serta jumlah siswa per rombel
          </p>
        </div>

        {canEdit && (
          <button
            onClick={openAdd}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#D4AF37]" />
            <span>Tambah Kelas</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((cls) => {
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
                    <div className="w-10 h-10 rounded-xl bg-[#F5F8FF] border border-blue-100 text-[#0A3D91] flex items-center justify-center font-bold font-display">
                      {cls.grade}
                    </div>
                    <div>
                      <h3 className="text-base font-bold font-display text-slate-900">
                        {cls.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Tingkat Kelas {cls.grade} · TP {cls.academicYear}
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
                    <span className="text-slate-500">Wali Kelas:</span>
                    <span className="font-semibold text-slate-800">{cls.homeroomTeacherName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Kapasitas Rombel:</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-800">
                      {studentCount} / {cls.capacity} Siswa
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
                <span className="text-[#0A3D91] font-semibold">Aktif</span>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <h2 className="text-lg font-bold font-display text-slate-900">
                {editingClass ? 'Edit Data Kelas' : 'Tambah Kelas Baru'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Kelas *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Kelas 1B"
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
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
                <label className="block font-semibold text-slate-700 mb-1">Wali Kelas</label>
                <select
                  value={homeroomTeacherId}
                  onChange={(e) => setHomeroomTeacherId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName}
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
                  <span>Simpan Kelas</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
