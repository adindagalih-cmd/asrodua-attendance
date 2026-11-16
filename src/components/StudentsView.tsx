import React, { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Upload,
  Download,
  FileSpreadsheet,
  Edit2,
  Trash2,
  QrCode,
  X,
  Check,
} from 'lucide-react';
import { SchoolClass, Student, UserProfile } from '../types';
import {
  downloadSingleQrPng,
  downloadStudentImportTemplate,
  exportStudentsToExcel,
  parseStudentExcelFile,
} from '../utils/exportUtils';

interface StudentsViewProps {
  userProfile: UserProfile;
  students: Student[];
  classes: SchoolClass[];
  onSaveStudent: (
    studentData: Omit<Student, 'id' | 'qrCodeId' | 'qrToken' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteStudent: (student: Student) => Promise<void>;
  onBulkImportStudents: (
    rows: Array<{
      nis: string;
      nisn: string;
      fullName: string;
      gender: 'L' | 'P';
      birthPlaceDate: string;
      className: string;
      parentName: string;
      parentWhatsapp: string;
    }>
  ) => Promise<number>;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  userProfile,
  students,
  classes,
  onSaveStudent,
  onDeleteStudent,
  onBulkImportStudents,
}) => {
  const canEdit = userProfile.role === 'SUPER_ADMIN' || userProfile.role === 'ADMIN_SEKOLAH';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string>(
    userProfile.role === 'GURU' && userProfile.assignedClassId && userProfile.assignedClassId !== 'ALL'
      ? userProfile.assignedClassId
      : 'ALL'
  );
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AKTIF' | 'NONAKTIF'>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Form state
  const [nis, setNis] = useState('');
  const [nisn, setNisn] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'L' | 'P'>('L');
  const [birthPlaceDate, setBirthPlaceDate] = useState('');
  const [classId, setClassId] = useState(classes[0]?.id || 'cls_1a');
  const [parentName, setParentName] = useState('');
  const [parentWhatsapp, setParentWhatsapp] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [status, setStatus] = useState<'AKTIF' | 'NONAKTIF'>('AKTIF');

  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) => {
      if (classFilter !== 'ALL' && s.classId !== classFilter) return false;
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.nis.toLowerCase().includes(q) ||
        s.nisn.toLowerCase().includes(q) ||
        s.parentName.toLowerCase().includes(q)
      );
    });
  }, [students, searchQuery, classFilter, statusFilter]);

  const openAddModal = () => {
    setEditingStudent(null);
    setNis('');
    setNisn('');
    setFullName('');
    setGender('L');
    setBirthPlaceDate('Surabaya, ');
    setClassId(classes[0]?.id || 'cls_1a');
    setParentName('');
    setParentWhatsapp('628');
    setPhotoUrl('');
    setStatus('AKTIF');
    setIsModalOpen(true);
  };

  const openEditModal = (std: Student) => {
    setEditingStudent(std);
    setNis(std.nis);
    setNisn(std.nisn);
    setFullName(std.fullName);
    setGender(std.gender);
    setBirthPlaceDate(std.birthPlaceDate);
    setClassId(std.classId);
    setParentName(std.parentName);
    setParentWhatsapp(std.parentWhatsapp);
    setPhotoUrl(std.photoUrl);
    setStatus(std.status);
    setIsModalOpen(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 200;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, 160, 200);
        setPhotoUrl(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nis.trim() || !fullName.trim()) return;
    setIsSaving(true);
    try {
      const selectedClass = classes.find((c) => c.id === classId);
      await onSaveStudent(
        {
          nis: nis.trim(),
          nisn: nisn.trim() || nis.trim(),
          fullName: fullName.trim(),
          gender,
          birthPlaceDate: birthPlaceDate.trim() || 'Surabaya',
          classId,
          className: selectedClass ? selectedClass.name : 'Kelas 1A',
          parentName: parentName.trim() || '-',
          parentWhatsapp: parentWhatsapp.trim(),
          photoUrl: photoUrl.trim(),
          status,
        },
        editingStudent?.id
      );
      setIsModalOpen(false);
      setFeedbackMsg(
        editingStudent
          ? `Data siswa ${fullName} berhasil diperbarui.`
          : `Siswa baru ${fullName} beserta QR Code unik berhasil ditambahkan.`
      );
      setTimeout(() => setFeedbackMsg(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSaving(true);
    try {
      const parsed = await parseStudentExcelFile(file);
      if (parsed.length === 0) {
        setFeedbackMsg('File Excel tidak berisi baris siswa yang valid (Pastikan kolom NIS & Nama Lengkap terisi).');
      } else {
        const count = await onBulkImportStudents(parsed);
        setFeedbackMsg(`Berhasil mengimpor ${count} data siswa beserta token QR unik dari Excel.`);
      }
      setTimeout(() => setFeedbackMsg(null), 5000);
    } finally {
      setIsSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold font-display text-slate-900">
            Database Induk Siswa
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola identitas siswa, NIS/NISN, nomor WhatsApp orang tua/wali, serta token QR Code
            permanen ({filteredStudents.length} dari {students.length} siswa ditampilkan)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadStudentImportTemplate}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#0A3D91]" />
            <span>Template Excel</span>
          </button>

          {canEdit && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
                className="px-3.5 py-2 text-xs font-semibold text-[#0A3D91] bg-[#F5F8FF] border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Import Excel</span>
              </button>
            </>
          )}

          <button
            onClick={() => exportStudentsToExcel(filteredStudents)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          {canEdit && (
            <button
              onClick={openAddModal}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#D4AF37]" />
              <span>Tambah Siswa</span>
            </button>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between">
          <span>{feedbackMsg}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-emerald-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan nama siswa, NIS, NISN, atau nama orang tua..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-[#F5F8FF] border border-slate-200 rounded-lg focus:outline-none focus:border-[#0A3D91]"
          />
        </div>

        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-3 py-2 text-xs font-medium bg-[#F5F8FF] border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#0A3D91]"
        >
          <option value="ALL">Semua Kelas</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(['ALL', 'AKTIF', 'NONAKTIF'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-white text-[#0A3D91] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st === 'ALL' ? 'Semua' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Responsive Student Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F5F8FF] text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Siswa</th>
                <th className="py-3 px-4">NIS / NISN</th>
                <th className="py-3 px-4">L/P · TTL</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4">Orang Tua & WhatsApp</th>
                <th className="py-3 px-4">QR Code ID</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    Tidak ada data siswa yang sesuai dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((std) => (
                  <tr key={std.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#0A3D91] text-white font-bold flex items-center justify-center shrink-0 overflow-hidden text-xs">
                          {std.photoUrl ? (
                            <img
                              src={std.photoUrl}
                              alt={std.fullName}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            std.fullName
                              .split(' ')
                              .slice(0, 2)
                              .map((n) => n[0])
                              .join('')
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{std.fullName}</p>
                          <p className="text-slate-400 font-mono tabular-nums text-[11px]">
                            ID: {std.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums">
                      <p className="font-semibold text-slate-800">{std.nis}</p>
                      <p className="text-slate-500">{std.nisn}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <span className="font-semibold">{std.gender}</span>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span>{std.birthPlaceDate}</span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#0A3D91]">{std.className}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-800">{std.parentName}</p>
                      <p className="font-mono tabular-nums text-slate-500">{std.parentWhatsapp}</p>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[11px] text-slate-600">
                      {std.qrCodeId}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${
                          std.status === 'AKTIF' ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {std.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => downloadSingleQrPng(std)}
                          title="Unduh QR Code PNG"
                          className="p-1.5 text-[#0A3D91] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => openEditModal(std)}
                              title="Edit Data Siswa"
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(std)}
                              title="Hapus Siswa"
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <h2 className="text-lg font-bold font-display text-slate-900">
                {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor Induk Siswa (NIS) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={30}
                    value={nis}
                    onChange={(e) => setNis(e.target.value)}
                    placeholder="Contoh: 6301"
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">NISN *</label>
                  <input
                    type="text"
                    required
                    maxLength={30}
                    value={nisn}
                    onChange={(e) => setNisn(e.target.value)}
                    placeholder="Contoh: 0134829101"
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lengkap Siswa *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Masukkan nama lengkap sesuai Dapodik"
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'L' | 'P')}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kelas</label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status Siswa</label>
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

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tempat, Tanggal Lahir
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={birthPlaceDate}
                  onChange={(e) => setBirthPlaceDate(e.target.value)}
                  placeholder="Surabaya, 14 Maret 2019"
                  className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Orang Tua / Wali *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    placeholder="Nama Ayah/Ibu/Wali"
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor WhatsApp Orang Tua *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={30}
                    value={parentWhatsapp}
                    onChange={(e) => setParentWhatsapp(e.target.value)}
                    placeholder="6281234567890"
                    className="w-full px-3 py-2 bg-[#F5F8FF] border border-slate-200 rounded-lg font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Foto Siswa (Opsional — untuk Kartu Pelajar)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#F5F8FF] file:text-[#0A3D91] hover:file:bg-blue-100"
                  />
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="text-rose-600 hover:underline text-xs cursor-pointer"
                    >
                      Hapus Foto
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Check className="w-4 h-4 text-[#D4AF37]" />
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Data Siswa'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-bold font-display text-slate-900 mb-2">
              Konfirmasi Hapus Data Siswa
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              Apakah Anda yakin ingin menghapus data siswa{' '}
              <strong className="text-slate-900">{deleteTarget.fullName}</strong> (NIS:{' '}
              {deleteTarget.nis}, {deleteTarget.className})? QR Code siswa ini juga akan
              dinonaktifkan.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  await onDeleteStudent(deleteTarget);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                Ya, Hapus Siswa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
