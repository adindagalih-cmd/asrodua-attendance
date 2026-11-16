export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export type UserRole = 'SUPER_ADMIN' | 'ADMIN_SEKOLAH' | 'KEPALA_SEKOLAH' | 'GURU';

export type AttendanceStatus = 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'ALPA';

export type TeacherAttendanceStatus =
  | 'HADIR'
  | 'TERLAMBAT'
  | 'IZIN'
  | 'SAKIT'
  | 'DINAS_LUAR'
  | 'ALPA';

export type AttendanceSession = 'MASUK' | 'PULANG' | 'MANUAL';

export type PageId =
  | 'dashboard'
  | 'principal-dashboard'
  | 'website-cms'
  | 'students'
  | 'teachers'
  | 'teacher-attendance'
  | 'classes'
  | 'qr-generator'
  | 'id-cards'
  | 'scan-attendance'
  | 'attendance-data'
  | 'attendance-reports'
  | 'notifications'
  | 'settings'
  | 'profile';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  assignedClassId: string;
  assignedClassName: string;
  nip: string;
  phone: string;
  photoUrl: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Student {
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
  photoUrl: string;
  status: 'AKTIF' | 'NONAKTIF';
  qrCodeId: string;
  qrToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface Teacher {
  id: string;
  nip: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  classId: string;
  className: string;
  status: 'AKTIF' | 'NONAKTIF';
  userUid: string;
  qrCodeId?: string;
  qrToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  grade: number;
  homeroomTeacherId: string;
  homeroomTeacherName: string;
  academicYear: string;
  capacity: number;
  createdAt: string;
  updatedAt: string;
}

export interface QrToken {
  id: string;
  token: string;
  studentId: string;
  studentNis: string;
  studentName: string;
  classId: string;
  className: string;
  status: 'ACTIVE' | 'REVOKED';
  version: number;
  createdAt: string;
  revokedAt: string;
  createdBy: string;
}

export interface TeacherQrToken {
  id: string;
  token: string;
  teacherId: string;
  teacherNip: string;
  teacherName: string;
  role: UserRole;
  classId: string;
  className: string;
  status: 'ACTIVE' | 'REVOKED';
  version: number;
  createdAt: string;
  revokedAt: string;
  createdBy: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  nis: string;
  nisn: string;
  studentName: string;
  classId: string;
  className: string;
  date: string;
  academicYear: string;
  status: AttendanceStatus;
  checkInTime: string;
  checkOutTime: string;
  session: AttendanceSession;
  qrTokenUsed: string;
  verifiedByUid: string;
  verifiedByName: string;
  notes: string;
  whatsappSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherAttendanceRecord {
  id: string;
  teacherId: string;
  nip: string;
  teacherName: string;
  role: UserRole;
  classId: string;
  className: string;
  date: string;
  academicYear: string;
  status: TeacherAttendanceStatus;
  checkInTime: string;
  checkOutTime: string;
  session: AttendanceSession;
  qrTokenUsed: string;
  verifiedByUid: string;
  verifiedByName: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceSettings {
  id: string;
  schoolName: string;
  npsn: string;
  schoolAddress: string;
  principalName: string;
  principalNip: string;
  principalEmail: string;
  activeAcademicYear: string;
  semester: 'GANJIL' | 'GENAP';
  checkInStart: string;
  checkInDeadline: string;
  checkInLateLimit: string;
  checkOutStart: string;
  checkOutEnd: string;
  whatsappEnabled: boolean;
  whatsappProvider: string;
  whatsappApiUrl: string;
  whatsappSenderNumber: string;
  whatsappTemplate: string;
  allowTeacherManualEdit: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface NotificationLog {
  id: string;
  attendanceId: string;
  studentId: string;
  studentName: string;
  className: string;
  parentName: string;
  recipientPhone: string;
  message: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED' | 'PENDING';
  session: AttendanceSession;
  date: string;
  sentAt: string;
  retryCount: number;
  errorReason: string;
}

export interface AuditLog {
  id: string;
  action: string;
  targetCollection: string;
  targetId: string;
  targetName: string;
  previousValue: string;
  newValue: string;
  reason: string;
  actorUid: string;
  actorName: string;
  actorRole: UserRole;
  createdAt: string;
}

export interface AcademicYear {
  id: string;
  year: string;
  semester: 'GANJIL' | 'GENAP';
  isActive: boolean;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export type AnnouncementCategory = 'PENGUMUMAN' | 'KEGIATAN' | 'AKADEMIK' | 'DARURAT';

export interface SiteContent {
  id: string;
  appTitle: string;
  tagline: string;
  schoolName: string;
  npsn: string;
  schoolAddress: string;
  schoolEmail: string;
  schoolPhone: string;
  principalName: string;
  principalNip: string;
  activeAcademicYear: string;
  semester: 'GANJIL' | 'GENAP';
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  feature1Title: string;
  feature1Desc: string;
  feature2Title: string;
  feature2Desc: string;
  feature3Title: string;
  feature3Desc: string;
  announcementBannerTitle: string;
  announcementBannerBody: string;
  showAnnouncementBanner: boolean;
  footerText: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  publishDate: string;
  isPinned: boolean;
  isPublished: boolean;
  authorName: string;
  authorUid: string;
  createdAt: string;
  updatedAt: string;
}

export type ResetDataScope = 'TEACHERS' | 'STUDENTS' | 'BOTH';

export interface ResetDataResult {
  deletedTeachers: number;
  deletedTeacherAttendance: number;
  deletedStudents: number;
  deletedQrTokens: number;
  deletedStudentAttendance: number;
  deletedNotifications: number;
}

