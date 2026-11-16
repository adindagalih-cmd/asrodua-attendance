import { doc, writeBatch } from 'firebase/firestore';
import {
  db,
  formatIndonesianDate,
  formatWhatsAppMessage,
  generateSecureQrToken,
  getTeacherQrCodeId,
  getTodayDateString,
  handleFirestoreError,
} from './firebase';
import {
  AcademicYear,
  Announcement,
  AttendanceRecord,
  AttendanceSettings,
  NotificationLog,
  OperationType,
  QrToken,
  SchoolClass,
  SiteContent,
  Student,
  Teacher,
  TeacherAttendanceRecord,
  TeacherAttendanceStatus,
} from './types';

export const DEFAULT_WHATSAPP_TEMPLATE = `Assalamu'alaikum.

Kami informasikan bahwa siswa:

Nama: [Nama Siswa]
Kelas: [Kelas]
Status: HADIR
Waktu: [Jam Kehadiran]
Tanggal: [Tanggal]

Telah melakukan absensi masuk di SDN ASEMROWO II/63 SURABAYA.

Terima kasih.`;

export const DEFAULT_SETTINGS: AttendanceSettings = {
  id: 'global',
  schoolName: 'SDN ASEMROWO II/63 SURABAYA',
  npsn: '20532941',
  schoolAddress: 'Jl. Asemraya No. 45, Kec. Asemrowo, Kota Surabaya, Jawa Timur 60182',
  principalName: 'Dra. Hj. Siti Aminah, M.Pd.',
  principalNip: '196805141991032008',
  principalEmail: 'kepsek@sdnasemrowo2.sch.id',
  activeAcademicYear: '2026/2027',
  semester: 'GANJIL',
  checkInStart: '06:00',
  checkInDeadline: '07:00',
  checkInLateLimit: '08:30',
  checkOutStart: '12:30',
  checkOutEnd: '15:30',
  whatsappEnabled: true,
  whatsappProvider: 'WhatsApp Cloud API / Fonnte Official',
  whatsappApiUrl: 'https://api.fonnte.com/send',
  whatsappSenderNumber: '6281234567890',
  whatsappTemplate: DEFAULT_WHATSAPP_TEMPLATE,
  allowTeacherManualEdit: true,
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

export const DEFAULT_SITE_CONTENT: SiteContent = {
  id: 'public',
  appTitle: 'ASRODUA SMART ATTENDANCE',
  tagline: 'Scan, Verify, Attend!',
  schoolName: 'SDN ASEMROWO II/63 SURABAYA',
  npsn: '20532941',
  schoolAddress: 'Jl. Asemraya No. 45, Kec. Asemrowo, Kota Surabaya, Jawa Timur 60182',
  schoolEmail: 'info@sdnasemrowo2.sch.id',
  schoolPhone: '(031) 5462941',
  principalName: 'Dra. Hj. Siti Aminah, M.Pd.',
  principalNip: '196805141991032008',
  activeAcademicYear: '2026/2027',
  semester: 'GANJIL',
  heroTitle: 'Sistem Manajemen Absensi Siswa Berbasis QR Code Real-Time',
  heroSubtitle: 'PEMERINTAH KOTA SURABAYA · DINAS PENDIDIKAN',
  heroDescription:
    'Platform terpadu pencatatan kehadiran siswa sesi Masuk dan Pulang dengan token kriptografis unik, rekapitulasi laporan otomatis, cetak kartu pelajar standar ID Card, serta integrasi notifikasi WhatsApp langsung ke orang tua/wali.',
  feature1Title: 'Enkripsi Kartu',
  feature1Desc: 'Token QR Permanen Tanpa Data Pribadi',
  feature2Title: 'Notifikasi Wali Murid',
  feature2Desc: 'Integrasi WhatsApp Real-Time',
  feature3Title: 'Akuntabilitas Data',
  feature3Desc: 'Audit Log & Hak Akses 3 Role',
  announcementBannerTitle: 'Informasi Operasional Tahun Pelajaran 2026/2027',
  announcementBannerBody:
    'Gerbang scan QR absensi masuk dibuka pukul 06.00 – 07.00 WIB. Pastikan seluruh siswa membawa Kartu Pelajar Smart Attendance setiap hari sekolah.',
  showAnnouncementBanner: true,
  footerText: 'Dinas Pendidikan Kota Surabaya · Provinsi Jawa Timur',
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann_welcome_tp2026',
    title: 'Penerapan Kartu Pelajar QR Code & Notifikasi WhatsApp Wali Murid',
    content:
      'Mulai Tahun Pelajaran 2026/2027 Semester Ganjil, seluruh siswa Kelas 1A sampai 6A wajib memindai Kartu Pelajar QR Code saat tiba di gerbang sekolah maupun saat jam pulang. Notifikasi kehadiran akan langsung dikirim ke nomor WhatsApp orang tua/wali terdaftar.',
    category: 'PENGUMUMAN',
    publishDate: getTodayDateString(),
    isPinned: true,
    isPublished: true,
    authorName: 'Administrator Sekolah',
    authorUid: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ann_jam_masuk',
    title: 'Ketentuan Jam Masuk & Toleransi Keterlambatan Siswa',
    content:
      'Scan absensi masuk dimulai pukul 06.00 WIB dan batas tepat waktu ditetapkan pukul 07.00 WIB. Siswa yang memindai setelah pukul 07.00 WIB tercatat sebagai TERLAMBAT dan wali kelas akan menerima laporan otomatis pada dashboard kelas.',
    category: 'AKADEMIK',
    publishDate: getTodayDateString(),
    isPinned: false,
    isPublished: true,
    authorName: 'Administrator Sekolah',
    authorUid: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_ACADEMIC_YEARS: AcademicYear[] = [
  {
    id: 'ay_2026_2027_ganjil',
    year: '2026/2027',
    semester: 'GANJIL',
    isActive: true,
    startDate: '2026-07-13',
    endDate: '2026-12-19',
    createdAt: '2026-07-01T07:00:00.000Z',
  },
  {
    id: 'ay_2025_2026_genap',
    year: '2025/2026',
    semester: 'GENAP',
    isActive: false,
    startDate: '2026-01-05',
    endDate: '2026-06-20',
    createdAt: '2026-01-01T07:00:00.000Z',
  },
];

export const INITIAL_CLASSES: SchoolClass[] = [
  {
    id: 'cls_1a',
    name: 'Kelas 1A',
    grade: 1,
    homeroomTeacherId: 'tch_01',
    homeroomTeacherName: 'Budi Santoso, S.Pd.',
    academicYear: '2026/2027',
    capacity: 32,
    createdAt: '2026-07-01T07:00:00.000Z',
    updatedAt: '2026-07-01T07:00:00.000Z',
  },
  {
    id: 'cls_2a',
    name: 'Kelas 2A',
    grade: 2,
    homeroomTeacherId: 'tch_02',
    homeroomTeacherName: 'Ratna Dewi, S.Pd.',
    academicYear: '2026/2027',
    capacity: 32,
    createdAt: '2026-07-01T07:00:00.000Z',
    updatedAt: '2026-07-01T07:00:00.000Z',
  },
  {
    id: 'cls_3a',
    name: 'Kelas 3A',
    grade: 3,
    homeroomTeacherId: 'tch_03',
    homeroomTeacherName: 'Ahmad Fauzi, S.Pd.SD.',
    academicYear: '2026/2027',
    capacity: 32,
    createdAt: '2026-07-01T07:00:00.000Z',
    updatedAt: '2026-07-01T07:00:00.000Z',
  },
  {
    id: 'cls_4a',
    name: 'Kelas 4A',
    grade: 4,
    homeroomTeacherId: 'tch_04',
    homeroomTeacherName: 'Nurul Hidayah, S.Pd.',
    academicYear: '2026/2027',
    capacity: 32,
    createdAt: '2026-07-01T07:00:00.000Z',
    updatedAt: '2026-07-01T07:00:00.000Z',
  },
  {
    id: 'cls_5a',
    name: 'Kelas 5A',
    grade: 5,
    homeroomTeacherId: 'tch_05',
    homeroomTeacherName: 'Hendra Wijaya, M.Pd.',
    academicYear: '2026/2027',
    capacity: 32,
    createdAt: '2026-07-01T07:00:00.000Z',
    updatedAt: '2026-07-01T07:00:00.000Z',
  },
  {
    id: 'cls_6a',
    name: 'Kelas 6A',
    grade: 6,
    homeroomTeacherId: 'tch_06',
    homeroomTeacherName: 'Rina Kusuma, S.Pd.SD.',
    academicYear: '2026/2027',
    capacity: 32,
    createdAt: '2026-07-01T07:00:00.000Z',
    updatedAt: '2026-07-01T07:00:00.000Z',
  },
];

export const INITIAL_TEACHERS: Teacher[] = [
  {
    id: 'tch_01',
    nip: '198403122009021003',
    fullName: 'Budi Santoso, S.Pd.',
    email: 'budi.santoso@sdnasemrowo2.sch.id',
    phone: '081231001001',
    role: 'GURU',
    classId: 'cls_1a',
    className: 'Kelas 1A',
    status: 'AKTIF',
    userUid: '',
    createdAt: '2026-07-01T07:00:00.000Z',
    updatedAt: '2026-07-01T07:00:00.000Z',
  },
  {
    id: 'tch_02',
    nip: '198707212011012009',
    fullName: 'Ratna Dewi, S.Pd.',
    email: 'ratna.dewi@sdnasemrowo2.sch.id',
    phone: '081231001002',
    role: 'GURU',
    classId: 'cls_2a',
    className: 'Kelas 2A',
    status: 'AKTIF',
    userUid: '',
    createdAt: '2026-07-01T07:00:00.000Z',
    updatedAt: '2026-07-01T07:00:00.000Z',
  },
  {
    id: 'tch_03',
    nip: '198211052008011005',
    fullName: 'Ahmad Fauzi, S.Pd.SD.',
    email: 'ahmad.fauzi@sdnasemrowo2.sch.id',
    phone: '081231001003',
    role: 'GURU',
    classId: 'cls_3a',
    className: 'Kelas 3A',
    status: 'AKTIF',
    userUid: '',
    createdAt: '2026-07-01T07:00:00.000Z',
    updatedAt: '2026-07-01T07:00:00.000Z',
  },
  {
    id: 'tch_04',
    nip: '199002182015032004',
    fullName: 'Nurul Hidayah, S.Pd.',
    email: 'nurul.hidayah@sdnasemrowo2.sch.id',
    phone: '081231001004',
    role: 'GURU',
    classId: 'cls_4a',
    className: 'Kelas 4A',
    status: 'AKTIF',
    userUid: '',
    createdAt: '2026-07-01T07:00:00.000Z',
    updatedAt: '2026-07-01T07:00:00.000Z',
  },
  {
    id: 'tch_05',
    nip: '198009142006041008',
    fullName: 'Hendra Wijaya, M.Pd.',
    email: 'hendra.wijaya@sdnasemrowo2.sch.id',
    phone: '081231001005',
    role: 'GURU',
    classId: 'cls_5a',
    className: 'Kelas 5A',
    status: 'AKTIF',
    userUid: '',
    createdAt: '2026-07-01T07:00:00.000Z',
    updatedAt: '2026-07-01T07:00:00.000Z',
  },
  {
    id: 'tch_06',
    nip: '198512302010012012',
    fullName: 'Rina Kusuma, S.Pd.SD.',
    email: 'rina.kusuma@sdnasemrowo2.sch.id',
    phone: '081231001006',
    role: 'GURU',
    classId: 'cls_6a',
    className: 'Kelas 6A',
    status: 'AKTIF',
    userUid: '',
    createdAt: '2026-07-01T07:00:00.000Z',
    updatedAt: '2026-07-01T07:00:00.000Z',
  },
  {
    id: 'tch_admin',
    nip: '199204102018011002',
    fullName: 'Wahyu Pratama, A.Md.',
    email: 'tatausaha@sdnasemrowo2.sch.id',
    phone: '081231001007',
    role: 'ADMIN_SEKOLAH',
    classId: 'ALL',
    className: 'Tata Usaha Sekolah',
    status: 'AKTIF',
    userUid: '',
    createdAt: '2026-07-01T07:00:00.000Z',
    updatedAt: '2026-07-01T07:00:00.000Z',
  },
];

const RAW_STUDENTS: Array<{
  id: string;
  nis: string;
  nisn: string;
  fullName: string;
  gender: 'L' | 'P';
  birthPlaceDate: string;
  classId: string;
  className: string;
  parentName: string;
  parentWhatsapp: string;
}> = [
  {
    id: 'std_001',
    nis: '6301',
    nisn: '0134829101',
    fullName: 'Aditya Pratama Putra',
    gender: 'L',
    birthPlaceDate: 'Surabaya, 14 Maret 2019',
    classId: 'cls_1a',
    className: 'Kelas 1A',
    parentName: 'Slamet Riyadi',
    parentWhatsapp: '6281234001001',
  },
  {
    id: 'std_002',
    nis: '6302',
    nisn: '0134829102',
    fullName: 'Aisyah Putri Ramadhani',
    gender: 'P',
    birthPlaceDate: 'Surabaya, 22 Juni 2019',
    classId: 'cls_1a',
    className: 'Kelas 1A',
    parentName: 'Mochammad Toha',
    parentWhatsapp: '6281234001002',
  },
  {
    id: 'std_003',
    nis: '6303',
    nisn: '0134829103',
    fullName: 'Bagas Satrio Wibowo',
    gender: 'L',
    birthPlaceDate: 'Surabaya, 05 Januari 2019',
    classId: 'cls_1a',
    className: 'Kelas 1A',
    parentName: 'Agus Wibowo',
    parentWhatsapp: '6281234001003',
  },
  {
    id: 'std_004',
    nis: '6201',
    nisn: '0129481021',
    fullName: 'Citra Kirana Maharani',
    gender: 'P',
    birthPlaceDate: 'Surabaya, 19 Agustus 2018',
    classId: 'cls_2a',
    className: 'Kelas 2A',
    parentName: 'Bambang Irawan',
    parentWhatsapp: '6281234001004',
  },
  {
    id: 'std_005',
    nis: '6202',
    nisn: '0129481022',
    fullName: 'Dimas Arya Saputra',
    gender: 'L',
    birthPlaceDate: 'Gresik, 11 November 2018',
    classId: 'cls_2a',
    className: 'Kelas 2A',
    parentName: 'Eko Saputra',
    parentWhatsapp: '6281234001005',
  },
  {
    id: 'std_006',
    nis: '6203',
    nisn: '0129481023',
    fullName: 'Farah Nabila Azzahra',
    gender: 'P',
    birthPlaceDate: 'Surabaya, 03 April 2018',
    classId: 'cls_2a',
    className: 'Kelas 2A',
    parentName: 'Hasan Basri',
    parentWhatsapp: '6281234001006',
  },
  {
    id: 'std_007',
    nis: '6101',
    nisn: '0118392011',
    fullName: 'Gilang Ramadhan Kusuma',
    gender: 'L',
    birthPlaceDate: 'Surabaya, 28 Juli 2017',
    classId: 'cls_3a',
    className: 'Kelas 3A',
    parentName: 'Surya Kusuma',
    parentWhatsapp: '6281234001007',
  },
  {
    id: 'std_008',
    nis: '6102',
    nisn: '0118392012',
    fullName: 'Hana Sofia Maulida',
    gender: 'P',
    birthPlaceDate: 'Surabaya, 16 Februari 2017',
    classId: 'cls_3a',
    className: 'Kelas 3A',
    parentName: 'Lukman Hakim',
    parentWhatsapp: '6281234001008',
  },
  {
    id: 'std_009',
    nis: '6103',
    nisn: '0118392013',
    fullName: 'Ilham Maulana Ibrahim',
    gender: 'L',
    birthPlaceDate: 'Surabaya, 09 September 2017',
    classId: 'cls_3a',
    className: 'Kelas 3A',
    parentName: 'Anwar Ibrahim',
    parentWhatsapp: '6281234001009',
  },
  {
    id: 'std_010',
    nis: '6001',
    nisn: '0107281901',
    fullName: 'Jasmine Permata Sari',
    gender: 'P',
    birthPlaceDate: 'Surabaya, 12 Mei 2016',
    classId: 'cls_4a',
    className: 'Kelas 4A',
    parentName: 'Dedi Kurniawan',
    parentWhatsapp: '6281234001010',
  },
  {
    id: 'std_011',
    nis: '6002',
    nisn: '0107281902',
    fullName: 'Kevin Alfarizi Hidayat',
    gender: 'L',
    birthPlaceDate: 'Sidoarjo, 25 Oktober 2016',
    classId: 'cls_4a',
    className: 'Kelas 4A',
    parentName: 'Taufik Hidayat',
    parentWhatsapp: '6281234001011',
  },
  {
    id: 'std_012',
    nis: '6003',
    nisn: '0107281903',
    fullName: 'Laila Nur Syifa',
    gender: 'P',
    birthPlaceDate: 'Surabaya, 07 Desember 2016',
    classId: 'cls_4a',
    className: 'Kelas 4A',
    parentName: 'Zainal Abidin',
    parentWhatsapp: '6281234001012',
  },
  {
    id: 'std_013',
    nis: '5901',
    nisn: '0096172801',
    fullName: 'Muhammad Rizky Fadillah',
    gender: 'L',
    birthPlaceDate: 'Surabaya, 18 Januari 2015',
    classId: 'cls_5a',
    className: 'Kelas 5A',
    parentName: 'Hariyanto',
    parentWhatsapp: '6281234001013',
  },
  {
    id: 'std_014',
    nis: '5902',
    nisn: '0096172802',
    fullName: 'Nadia Safitri Anggraini',
    gender: 'P',
    birthPlaceDate: 'Surabaya, 30 Maret 2015',
    classId: 'cls_5a',
    className: 'Kelas 5A',
    parentName: 'Sugeng Priyanto',
    parentWhatsapp: '6281234001014',
  },
  {
    id: 'std_015',
    nis: '5903',
    nisn: '0096172803',
    fullName: 'Naufal Dzakwan Pratama',
    gender: 'L',
    birthPlaceDate: 'Surabaya, 21 Agustus 2015',
    classId: 'cls_5a',
    className: 'Kelas 5A',
    parentName: 'Yudi Pratama',
    parentWhatsapp: '6281234001015',
  },
  {
    id: 'std_016',
    nis: '5801',
    nisn: '0085061701',
    fullName: 'Putri Ayu Lestari',
    gender: 'P',
    birthPlaceDate: 'Surabaya, 04 Juni 2014',
    classId: 'cls_6a',
    className: 'Kelas 6A',
    parentName: 'Joko Susilo',
    parentWhatsapp: '6281234001016',
  },
  {
    id: 'std_017',
    nis: '5802',
    nisn: '0085061702',
    fullName: 'Rafa Akbar Firmansyah',
    gender: 'L',
    birthPlaceDate: 'Surabaya, 15 November 2014',
    classId: 'cls_6a',
    className: 'Kelas 6A',
    parentName: 'Didik Firmansyah',
    parentWhatsapp: '6281234001017',
  },
  {
    id: 'std_018',
    nis: '5803',
    nisn: '0085061703',
    fullName: 'Zahra Amalia Khairunnisa',
    gender: 'P',
    birthPlaceDate: 'Surabaya, 02 Februari 2014',
    classId: 'cls_6a',
    className: 'Kelas 6A',
    parentName: 'Mulyono',
    parentWhatsapp: '6281234001018',
  },
];

export async function seedSchoolDatabase(
  actorUid: string,
  actorName: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  const todayStr = getTodayDateString();
  const batch = writeBatch(db);

  // 1. Settings & Public Site Content
  batch.set(doc(db, 'attendanceSettings', 'global'), {
    ...DEFAULT_SETTINGS,
    updatedAt: nowIso,
    updatedBy: actorUid,
  });

  batch.set(doc(db, 'siteContent', 'public'), {
    ...DEFAULT_SITE_CONTENT,
    updatedAt: nowIso,
    updatedBy: actorUid,
  });

  // 1b. Announcements
  for (const ann of INITIAL_ANNOUNCEMENTS) {
    batch.set(doc(db, 'announcements', ann.id), {
      ...ann,
      publishDate: todayStr,
      authorName: actorName,
      authorUid: actorUid,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  // 2. Academic Years
  for (const ay of INITIAL_ACADEMIC_YEARS) {
    batch.set(doc(db, 'academicYears', ay.id), ay);
  }

  // 3. Classes
  for (const cls of INITIAL_CLASSES) {
    batch.set(doc(db, 'classes', cls.id), cls);
  }

  // 4. Teachers + Today's Sample Teacher Attendance
  const sampleTeacherAttendance: Array<{
    status: TeacherAttendanceStatus;
    checkInTime: string;
    checkOutTime: string;
    notes: string;
  } | null> = [
    { status: 'HADIR', checkInTime: '06:22:14', checkOutTime: '14:05:10', notes: 'Scan QR Guru Tepat Waktu' },
    { status: 'HADIR', checkInTime: '06:28:40', checkOutTime: '14:02:18', notes: 'Scan QR Guru Tepat Waktu' },
    { status: 'HADIR', checkInTime: '06:31:05', checkOutTime: '', notes: 'Scan QR Guru Tepat Waktu' },
    { status: 'DINAS_LUAR', checkInTime: '06:40:00', checkOutTime: '', notes: 'Rapat Koordinasi KKG Dinas Pendidikan Kota Surabaya' },
    { status: 'HADIR', checkInTime: '06:25:19', checkOutTime: '14:10:00', notes: 'Scan QR Guru Tepat Waktu' },
    { status: 'TERLAMBAT', checkInTime: '07:06:30', checkOutTime: '', notes: 'Kendala lalu lintas Jl. Asemraya' },
    { status: 'HADIR', checkInTime: '06:18:55', checkOutTime: '14:15:30', notes: 'Presensi Staf Tata Usaha Tepat Waktu' },
  ];

  INITIAL_TEACHERS.forEach((tch, idx) => {
    batch.set(doc(db, 'teachers', tch.id), tch);
    const tSample = sampleTeacherAttendance[idx];
    if (tSample) {
      const tAttId = `${todayStr}_${tch.id}`;
      const qrCodeId = getTeacherQrCodeId(tch.id, tch.nip);
      const tRecord: TeacherAttendanceRecord = {
        id: tAttId,
        teacherId: tch.id,
        nip: tch.nip,
        teacherName: tch.fullName,
        role: tch.role,
        classId: tch.classId,
        className: tch.className,
        date: todayStr,
        academicYear: '2026/2027',
        status: tSample.status,
        checkInTime: tSample.checkInTime,
        checkOutTime: tSample.checkOutTime,
        session: tSample.checkOutTime
          ? 'PULANG'
          : tSample.status === 'DINAS_LUAR'
          ? 'MANUAL'
          : 'MASUK',
        qrTokenUsed: qrCodeId,
        verifiedByUid: actorUid,
        verifiedByName: actorName,
        notes: tSample.notes,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      batch.set(doc(db, 'teacherAttendance', tAttId), tRecord);
    }
  });

  // 5. Students + Permanent Secure QR Tokens + Today's Sample Attendance
  const sampleStatuses: Array<{
    status: 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT';
    time: string;
    outTime: string;
    notes: string;
  } | null> = [
    { status: 'HADIR', time: '06:38:12', outTime: '13:05:10', notes: 'Scan QR Masuk Tepat Waktu' },
    { status: 'HADIR', time: '06:42:05', outTime: '13:06:22', notes: 'Scan QR Masuk Tepat Waktu' },
    { status: 'TERLAMBAT', time: '07:12:40', outTime: '', notes: 'Terlambat 12 menit (Ban bocor)' },
    { status: 'HADIR', time: '06:45:19', outTime: '13:02:45', notes: 'Scan QR Masuk Tepat Waktu' },
    { status: 'IZIN', time: '06:55:00', outTime: '', notes: 'Izin acara keluarga (Surat orang tua)' },
    { status: 'HADIR', time: '06:49:33', outTime: '', notes: 'Scan QR Masuk Tepat Waktu' },
    { status: 'HADIR', time: '06:35:50', outTime: '13:10:00', notes: 'Scan QR Masuk Tepat Waktu' },
    { status: 'SAKIT', time: '06:50:00', outTime: '', notes: 'Sakit demam (Konfirmasi WA Wali)' },
    { status: 'HADIR', time: '06:51:10', outTime: '', notes: 'Scan QR Masuk Tepat Waktu' },
    { status: 'HADIR', time: '06:40:28', outTime: '13:04:18', notes: 'Scan QR Masuk Tepat Waktu' },
    { status: 'TERLAMBAT', time: '07:08:15', outTime: '', notes: 'Terlambat 8 menit' },
    { status: 'HADIR', time: '06:47:02', outTime: '', notes: 'Scan QR Masuk Tepat Waktu' },
    { status: 'HADIR', time: '06:33:44', outTime: '13:08:50', notes: 'Scan QR Masuk Tepat Waktu' },
    { status: 'HADIR', time: '06:54:19', outTime: '', notes: 'Scan QR Masuk Tepat Waktu' },
    null, // Belum hadir
    { status: 'HADIR', time: '06:39:11', outTime: '13:12:04', notes: 'Scan QR Masuk Tepat Waktu' },
    null, // Belum hadir
    null, // Belum hadir
  ];

  RAW_STUDENTS.forEach((raw, idx) => {
    const { tokenId, tokenString } = generateSecureQrToken(raw.id, 1);

    const studentDoc: Student = {
      id: raw.id,
      nis: raw.nis,
      nisn: raw.nisn,
      fullName: raw.fullName,
      gender: raw.gender,
      birthPlaceDate: raw.birthPlaceDate,
      classId: raw.classId,
      className: raw.className,
      parentName: raw.parentName,
      parentWhatsapp: raw.parentWhatsapp,
      photoUrl: '',
      status: 'AKTIF',
      qrCodeId: tokenId,
      qrToken: tokenString,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    batch.set(doc(db, 'students', studentDoc.id), studentDoc);

    const qrTokenDoc: QrToken = {
      id: tokenId,
      token: tokenString,
      studentId: studentDoc.id,
      studentNis: studentDoc.nis,
      studentName: studentDoc.fullName,
      classId: studentDoc.classId,
      className: studentDoc.className,
      status: 'ACTIVE',
      version: 1,
      createdAt: nowIso,
      revokedAt: '',
      createdBy: actorUid,
    };
    batch.set(doc(db, 'qrTokens', qrTokenDoc.id), qrTokenDoc);

    const sample = sampleStatuses[idx];
    if (sample) {
      const attId = `${todayStr}_${studentDoc.id}`;
      const attRecord: AttendanceRecord = {
        id: attId,
        studentId: studentDoc.id,
        nis: studentDoc.nis,
        nisn: studentDoc.nisn,
        studentName: studentDoc.fullName,
        classId: studentDoc.classId,
        className: studentDoc.className,
        date: todayStr,
        academicYear: '2026/2027',
        status: sample.status,
        checkInTime: sample.time,
        checkOutTime: sample.outTime,
        session: sample.outTime ? 'PULANG' : sample.status === 'IZIN' || sample.status === 'SAKIT' ? 'MANUAL' : 'MASUK',
        qrTokenUsed: tokenId,
        verifiedByUid: actorUid,
        verifiedByName: actorName,
        notes: sample.notes,
        whatsappSent: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      batch.set(doc(db, 'attendance', attId), attRecord);

      if (sample.status === 'HADIR' || sample.status === 'TERLAMBAT') {
        const notifId = `notif_${attId}`;
        const msg = formatWhatsAppMessage(DEFAULT_WHATSAPP_TEMPLATE, {
          studentName: studentDoc.fullName,
          className: studentDoc.className,
          status: sample.status,
          time: sample.time,
          date: todayStr,
        });
        const notifDoc: NotificationLog = {
          id: notifId,
          attendanceId: attId,
          studentId: studentDoc.id,
          studentName: studentDoc.fullName,
          className: studentDoc.className,
          parentName: studentDoc.parentName,
          recipientPhone: studentDoc.parentWhatsapp,
          message: msg,
          status: 'DELIVERED',
          session: 'MASUK',
          date: todayStr,
          sentAt: nowIso,
          retryCount: 0,
          errorReason: '',
        };
        batch.set(doc(db, 'notificationLogs', notifId), notifDoc);
      }
    }
  });

  // 6. Audit Log for initial seed
  const auditId = `aud_seed_${Date.now()}`;
  batch.set(doc(db, 'auditLogs', auditId), {
    id: auditId,
    action: 'INISIALISASI_DATABASE_SEKOLAH',
    targetCollection: 'system',
    targetId: 'global',
    targetName: 'SDN ASEMROWO II/63 SURABAYA',
    previousValue: 'KOSONG',
    newValue: `18 Siswa, 6 Kelas, 7 Guru/Staf (${formatIndonesianDate(todayStr)})`,
    reason: 'Inisialisasi data awal sistem ASRODUA SMART ATTENDANCE',
    actorUid,
    actorName,
    actorRole: 'SUPER_ADMIN',
    createdAt: nowIso,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch_seed');
  }
}
