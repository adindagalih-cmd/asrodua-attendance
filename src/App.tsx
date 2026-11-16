/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  QrCode,
  CreditCard,
  ScanLine,
  ClipboardCheck,
  BarChart3,
  MessageSquare,
  Settings,
  UserCircle,
  LogOut,
  Menu,
  X,
  AlertCircle,
  Globe,
  Award,
  UserCheck,
} from 'lucide-react';
import {
  auth,
  db,
  formatWhatsAppMessage,
  generateSecureQrToken,
  getCurrentTimeString,
  getTeacherQrCodeId,
  getTeacherQrToken,
  getTodayDateString,
  googleProvider,
  handleFirestoreError,
  sanitizeId,
  sanitizeString,
} from './firebase';
import {
  AcademicYear,
  Announcement,
  AttendanceRecord,
  AttendanceSettings,
  AttendanceStatus,
  AuditLog,
  NotificationLog,
  OperationType,
  PageId,
  QrToken,
  ResetDataResult,
  ResetDataScope,
  SchoolClass,
  SiteContent,
  Student,
  Teacher,
  TeacherAttendanceRecord,
  TeacherAttendanceStatus,
  UserProfile,
  UserRole,
} from './types';
import {
  DEFAULT_SETTINGS,
  DEFAULT_SITE_CONTENT,
  INITIAL_ANNOUNCEMENTS,
  seedSchoolDatabase,
  syncMissingRombelAndTeachers,
} from './seedData';
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';
import { PrincipalDashboardView } from './components/PrincipalDashboardView';
import { WebsiteCmsView } from './components/WebsiteCmsView';
import { StudentsView } from './components/StudentsView';
import { ClassesView, TeachersView } from './components/TeachersClassesView';
import { TeacherAttendanceView } from './components/TeacherAttendanceView';
import { QrGeneratorView, StudentIdCardsView } from './components/QrAndCardsView';
import { ScannerView, ScanVerificationResult } from './components/ScannerView';
import {
  AttendanceDataView,
  AttendanceReportsView,
} from './components/AttendanceReportsView';
import {
  NotificationsView,
  ProfileView,
  SettingsView,
} from './components/SettingsNotificationsProfileView';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_SEKOLAH', 'KEPALA_SEKOLAH', 'GURU'],
  },
  {
    id: 'principal-dashboard',
    label: 'Dashboard Kepala Sekolah',
    icon: Award,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_SEKOLAH'],
  },
  {
    id: 'website-cms',
    label: 'Kelola Isi Website',
    icon: Globe,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_SEKOLAH'],
  },
  {
    id: 'scan-attendance',
    label: 'Scan Attendance',
    icon: ScanLine,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_SEKOLAH', 'GURU'],
  },
  {
    id: 'attendance-data',
    label: 'Data Absensi',
    icon: ClipboardCheck,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_SEKOLAH', 'KEPALA_SEKOLAH', 'GURU'],
  },
  {
    id: 'teacher-attendance',
    label: 'Absensi Guru & Mapel',
    icon: UserCheck,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_SEKOLAH', 'KEPALA_SEKOLAH', 'GURU'],
  },
  {
    id: 'attendance-reports',
    label: 'Rekap Absensi',
    icon: BarChart3,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_SEKOLAH', 'KEPALA_SEKOLAH', 'GURU'],
  },
  {
    id: 'students',
    label: 'Data Siswa',
    icon: Users,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_SEKOLAH', 'KEPALA_SEKOLAH', 'GURU'],
  },
  {
    id: 'teachers',
    label: 'Data Guru & Mapel',
    icon: GraduationCap,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_SEKOLAH', 'KEPALA_SEKOLAH', 'GURU'],
  },
  {
    id: 'classes',
    label: 'Data Kelas & Rombel',
    icon: BookOpen,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_SEKOLAH', 'KEPALA_SEKOLAH', 'GURU'],
  },
  {
    id: 'qr-generator',
    label: 'QR Code Generator',
    icon: QrCode,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_SEKOLAH'],
  },
  {
    id: 'id-cards',
    label: 'Cetak Kartu ID',
    icon: CreditCard,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_SEKOLAH'],
  },
  {
    id: 'notifications',
    label: 'Notifikasi Orang Tua',
    icon: MessageSquare,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_SEKOLAH', 'KEPALA_SEKOLAH', 'GURU'],
  },
  {
    id: 'settings',
    label: 'Pengaturan',
    icon: Settings,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_SEKOLAH'],
  },
  {
    id: 'profile',
    label: 'Profil Pengguna',
    icon: UserCircle,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_SEKOLAH', 'KEPALA_SEKOLAH', 'GURU'],
  },
];

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Real-time Firestore state
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [qrTokens, setQrTokens] = useState<QrToken[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [teacherAttendance, setTeacherAttendance] = useState<TeacherAttendanceRecord[]>([]);
  const [settings, setSettings] = useState<AttendanceSettings>(DEFAULT_SETTINGS);
  const [siteContent, setSiteContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [announcements, setAnnouncements] = useState<Announcement[]>(INITIAL_ANNOUNCEMENTS);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  // 1. Track Firebase Authentication & bootstrap UserProfile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      if (!u) {
        setUserProfile(null);
        setAuthReady(true);
        return;
      }

      const userPath = `users/${u.uid}`;
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        const nowIso = new Date().toISOString();
        const userEmailLower = (u.email || '').trim().toLowerCase();

        // Check Firestore attendanceSettings/global for integrated principalEmail
        let configuredPrincipalEmail = '';
        let configuredPrincipalNip = DEFAULT_SETTINGS.principalNip;
        try {
          const settingsSnap = await getDoc(doc(db, 'attendanceSettings', 'global'));
          if (settingsSnap.exists()) {
            const settingsData = settingsSnap.data() as AttendanceSettings;
            configuredPrincipalEmail = (settingsData.principalEmail || '').trim().toLowerCase();
            if (settingsData.principalNip) {
              configuredPrincipalNip = settingsData.principalNip;
            }
          }
        } catch {
          // Non-principal accounts without profile yet cannot read attendanceSettings directly
        }

        const isSuper = userEmailLower === 'adindagalih@gmail.com';
        const isConfiguredPrincipal =
          Boolean(userEmailLower) &&
          Boolean(configuredPrincipalEmail) &&
          userEmailLower === configuredPrincipalEmail;

        if (snap.exists()) {
          const existingProfile = snap.data() as UserProfile;
          if (
            isConfiguredPrincipal &&
            existingProfile.role !== 'KEPALA_SEKOLAH' &&
            existingProfile.role !== 'SUPER_ADMIN'
          ) {
            await updateDoc(doc(db, 'users', u.uid), {
              role: 'KEPALA_SEKOLAH',
              assignedClassId: 'ALL',
              assignedClassName: 'Seluruh Sekolah',
              updatedAt: nowIso,
            });
            setUserProfile({
              ...existingProfile,
              role: 'KEPALA_SEKOLAH',
              assignedClassId: 'ALL',
              assignedClassName: 'Seluruh Sekolah',
              updatedAt: nowIso,
            });
          } else {
            setUserProfile(existingProfile);
          }
        } else {
          const resolvedRole: UserRole = isSuper
            ? 'SUPER_ADMIN'
            : isConfiguredPrincipal
            ? 'KEPALA_SEKOLAH'
            : 'GURU';
          const newProfile: UserProfile = {
            uid: sanitizeId(u.uid),
            name: sanitizeString(u.displayName || u.email || 'Pengguna ASRODUA', 120),
            email: sanitizeString(u.email || 'guru@sdnasemrowo2.sch.id', 150),
            role: resolvedRole,
            assignedClassId: isSuper || isConfiguredPrincipal ? 'ALL' : 'cls_1a',
            assignedClassName: isSuper
              ? 'Seluruh Kelas'
              : isConfiguredPrincipal
              ? 'Seluruh Sekolah'
              : 'Kelas 1A',
            nip: isSuper || isConfiguredPrincipal ? configuredPrincipalNip : '-',
            phone: '081234567890',
            photoUrl: sanitizeString(u.photoURL || '', 500),
            active: true,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          await setDoc(doc(db, 'users', u.uid), newProfile);
          setUserProfile(newProfile);
        }
      } catch (err) {
        console.error('Error loading user profile:', err);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // 1b. Public Website Content & Published Announcements Listeners (available on Login portal & inside app)
  useEffect(() => {
    const unsubSite = onSnapshot(
      doc(db, 'siteContent', 'public'),
      (snap) => {
        if (snap.exists()) {
          setSiteContent(snap.data() as SiteContent);
        }
      },
      (err) => {
        console.warn('Public siteContent listener fallback:', err.message);
      }
    );

    const annQuery = userProfile
      ? query(collection(db, 'announcements'), where('isPublished', 'in', [true, false]))
      : query(collection(db, 'announcements'), where('isPublished', '==', true));

    const unsubAnn = onSnapshot(
      annQuery,
      (snap) => {
        if (!snap.empty || userProfile) {
          const list = snap.docs
            .map((d) => d.data() as Announcement)
            .sort(
              (a, b) =>
                Number(b.isPinned) - Number(a.isPinned) ||
                b.publishDate.localeCompare(a.publishDate)
            );
          setAnnouncements(list);
        }
      },
      (err) => {
        console.warn('Announcements listener fallback:', err.message);
      }
    );

    return () => {
      unsubSite();
      unsubAnn();
    };
  }, [Boolean(userProfile)]);

  // 2. Attach Real-Time Firestore Listeners once authenticated
  useEffect(() => {
    if (!authReady || !firebaseUser || !userProfile) return;

    const unsubs: Array<() => void> = [];

    // Profile listener
    unsubs.push(
      onSnapshot(
        doc(db, 'users', firebaseUser.uid),
        (snap) => {
          if (snap.exists()) {
            setUserProfile(snap.data() as UserProfile);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`)
      )
    );

    // Settings listener
    unsubs.push(
      onSnapshot(
        doc(db, 'attendanceSettings', 'global'),
        (snap) => {
          if (snap.exists()) {
            setSettings({
              ...DEFAULT_SETTINGS,
              ...(snap.data() as Partial<AttendanceSettings>),
            });
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'attendanceSettings/global')
      )
    );

    // Students listener (matches allow list rule: status in ['AKTIF', 'NONAKTIF'])
    unsubs.push(
      onSnapshot(
        query(collection(db, 'students'), where('status', 'in', ['AKTIF', 'NONAKTIF'])),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as Student)
            .sort((a, b) => a.nis.localeCompare(b.nis));
          setStudents(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'students')
      )
    );

    // Teachers listener (matches allow list rule: status in ['AKTIF', 'NONAKTIF'])
    unsubs.push(
      onSnapshot(
        query(collection(db, 'teachers'), where('status', 'in', ['AKTIF', 'NONAKTIF'])),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as Teacher)
            .sort((a, b) => a.id.localeCompare(b.id));
          setTeachers(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'teachers')
      )
    );

    // Classes listener (matches allow list rule: grade >= 1 && grade <= 6)
    unsubs.push(
      onSnapshot(
        query(collection(db, 'classes'), where('grade', '>=', 1), where('grade', '<=', 6)),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as SchoolClass)
            .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name));
          setClasses(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'classes')
      )
    );

    // QR Tokens listener
    unsubs.push(
      onSnapshot(
        query(collection(db, 'qrTokens'), where('status', 'in', ['ACTIVE', 'REVOKED'])),
        (snap) => {
          setQrTokens(snap.docs.map((d) => d.data() as QrToken));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'qrTokens')
      )
    );

    // Attendance listener (Siswa)
    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'attendance'),
          where('status', 'in', ['HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'ALPA'])
        ),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as AttendanceRecord)
            .sort((a, b) => b.date.localeCompare(a.date) || (b.checkInTime || '').localeCompare(a.checkInTime || ''));
          setAttendance(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
      )
    );

    // Teacher Attendance listener (Guru & Staf)
    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'teacherAttendance'),
          where('status', 'in', ['HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'DINAS_LUAR', 'ALPA'])
        ),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as TeacherAttendanceRecord)
            .sort(
              (a, b) =>
                b.date.localeCompare(a.date) ||
                (b.checkInTime || '').localeCompare(a.checkInTime || '')
            );
          setTeacherAttendance(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'teacherAttendance')
      )
    );

    // Notification Logs listener
    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'notificationLogs'),
          where('status', 'in', ['SENT', 'DELIVERED', 'FAILED', 'PENDING'])
        ),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as NotificationLog)
            .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
          setNotificationLogs(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notificationLogs')
      )
    );

    // Audit Logs listener
    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'auditLogs'),
          where('actorRole', 'in', ['SUPER_ADMIN', 'ADMIN_SEKOLAH', 'KEPALA_SEKOLAH', 'GURU'])
        ),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as AuditLog)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setAuditLogs(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
      )
    );

    // Academic Years listener
    unsubs.push(
      onSnapshot(
        query(collection(db, 'academicYears'), where('semester', 'in', ['GANJIL', 'GENAP'])),
        (snap) => {
          setAcademicYears(snap.docs.map((d) => d.data() as AcademicYear));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'academicYears')
      )
    );

    // Users list listener (Super Admin only)
    if (userProfile.role === 'SUPER_ADMIN') {
      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => {
            const list = snap.docs
              .map((d) => d.data() as UserProfile)
              .sort((a, b) => a.name.localeCompare(b.name));
            setUsersList(list);
          },
          (err) => {
            console.warn('Users list listener:', err.message);
          }
        )
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, firebaseUser?.uid, Boolean(userProfile), userProfile?.role]);

  // Auto-seed school data & public website CMS on first Admin login if missing
  useEffect(() => {
    if (!authReady || !firebaseUser || !userProfile) return;
    if (userProfile.role !== 'SUPER_ADMIN' && userProfile.role !== 'ADMIN_SEKOLAH') return;

    let cancelled = false;
    async function checkAndAutoSeed() {
      try {
        const snap = await getDoc(doc(db, 'attendanceSettings', 'global'));
        if (!snap.exists() && !cancelled && userProfile!.role === 'SUPER_ADMIN') {
          setIsSeeding(true);
          await seedSchoolDatabase(firebaseUser!.uid, userProfile!.name);
          setIsSeeding(false);
          return;
        }

        // Ensure siteContent/public exists for upgrades of existing databases
        const siteSnap = await getDoc(doc(db, 'siteContent', 'public'));
        if (!siteSnap.exists() && !cancelled) {
          const nowIso = new Date().toISOString();
          await setDoc(doc(db, 'siteContent', 'public'), {
            ...DEFAULT_SITE_CONTENT,
            updatedAt: nowIso,
            updatedBy: firebaseUser!.uid,
          });
          for (const ann of INITIAL_ANNOUNCEMENTS) {
            await setDoc(doc(db, 'announcements', ann.id), {
              ...ann,
              publishDate: getTodayDateString(),
              authorName: userProfile!.name,
              authorUid: firebaseUser!.uid,
              createdAt: nowIso,
              updatedAt: nowIso,
            });
          }
        }

        // Check immutable auditLogs to ensure sample teachers/students are never re-seeded after an admin reset
        if (!cancelled) {
          const auditSnap = await getDocs(
            query(
              collection(db, 'auditLogs'),
              where('actorRole', 'in', ['SUPER_ADMIN', 'ADMIN_SEKOLAH', 'KEPALA_SEKOLAH', 'GURU'])
            )
          );
          let hasResetTeachers = false;
          let hasResetStudents = false;
          auditSnap.docs.forEach((d) => {
            const act = (d.data() as AuditLog).action;
            if (act === 'RESET_DATA_GURU' || act === 'RESET_DATA_GURU_DAN_SISWA') {
              hasResetTeachers = true;
            }
            if (act === 'RESET_DATA_SISWA' || act === 'RESET_DATA_GURU_DAN_SISWA') {
              hasResetStudents = true;
            }
          });

          await syncMissingRombelAndTeachers(
            firebaseUser!.uid,
            userProfile!.name,
            settings.activeAcademicYear || '2026/2027',
            { skipTeachers: hasResetTeachers, skipStudents: hasResetStudents }
          );
        }
      } catch (err) {
        console.error('Auto-seed / upgrade failed:', err);
        setIsSeeding(false);
      }
    }
    checkAndAutoSeed();
    return () => {
      cancelled = true;
    };
  }, [authReady, firebaseUser?.uid, userProfile?.role]);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Gagal masuk dengan Google. Silakan coba kembali.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setActivePage('dashboard');
  };

  // Helper to record immutable Audit Log entry
  const writeAuditEntry = async (params: {
    action: string;
    targetCollection: string;
    targetId: string;
    targetName: string;
    previousValue: string;
    newValue: string;
    reason: string;
  }) => {
    if (!userProfile) return;
    const id = sanitizeId(`aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const logDoc: AuditLog = {
      id,
      action: sanitizeString(params.action, 80),
      targetCollection: sanitizeString(params.targetCollection, 50),
      targetId: sanitizeString(params.targetId, 128),
      targetName: sanitizeString(params.targetName, 150),
      previousValue: sanitizeString(params.previousValue, 1000),
      newValue: sanitizeString(params.newValue, 1000),
      reason: sanitizeString(params.reason, 300),
      actorUid: userProfile.uid,
      actorName: sanitizeString(userProfile.name, 120),
      actorRole: userProfile.role,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'auditLogs', id), logDoc);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `auditLogs/${id}`);
    }
  };

  // Student CRUD Handlers
  const handleSaveStudent = async (
    data: Omit<Student, 'id' | 'qrCodeId' | 'qrToken' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => {
    if (!userProfile) return;
    const nowIso = new Date().toISOString();

    if (existingId) {
      const existing = students.find((s) => s.id === existingId);
      if (!existing) return;
      const updatedDoc: Student = {
        ...existing,
        ...data,
        nis: sanitizeString(data.nis, 30),
        nisn: sanitizeString(data.nisn, 30),
        fullName: sanitizeString(data.fullName, 120),
        birthPlaceDate: sanitizeString(data.birthPlaceDate, 100),
        className: sanitizeString(data.className, 50),
        parentName: sanitizeString(data.parentName, 120),
        parentWhatsapp: sanitizeString(data.parentWhatsapp, 30),
        photoUrl: sanitizeString(data.photoUrl, 2000),
        updatedAt: nowIso,
      };
      try {
        await setDoc(doc(db, 'students', existingId), updatedDoc);
        await writeAuditEntry({
          action: 'EDIT_SISWA',
          targetCollection: 'students',
          targetId: existingId,
          targetName: updatedDoc.fullName,
          previousValue: `${existing.fullName} (${existing.className})`,
          newValue: `${updatedDoc.fullName} (${updatedDoc.className})`,
          reason: 'Pembaruan data induk siswa',
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `students/${existingId}`);
      }
    } else {
      const newId = sanitizeId(`std_${data.nis}_${Date.now().toString().slice(-4)}`);
      const { tokenId, tokenString } = generateSecureQrToken(newId, 1);

      const newStudent: Student = {
        id: newId,
        nis: sanitizeString(data.nis, 30),
        nisn: sanitizeString(data.nisn, 30),
        fullName: sanitizeString(data.fullName, 120),
        gender: data.gender,
        birthPlaceDate: sanitizeString(data.birthPlaceDate, 100),
        classId: sanitizeString(data.classId, 128),
        className: sanitizeString(data.className, 50),
        parentName: sanitizeString(data.parentName, 120),
        parentWhatsapp: sanitizeString(data.parentWhatsapp, 30),
        photoUrl: sanitizeString(data.photoUrl, 2000),
        status: data.status,
        qrCodeId: tokenId,
        qrToken: tokenString,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const qrDoc: QrToken = {
        id: tokenId,
        token: tokenString,
        studentId: newId,
        studentNis: newStudent.nis,
        studentName: newStudent.fullName,
        classId: newStudent.classId,
        className: newStudent.className,
        status: 'ACTIVE',
        version: 1,
        createdAt: nowIso,
        revokedAt: '',
        createdBy: userProfile.uid,
      };

      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'students', newId), newStudent);
        batch.set(doc(db, 'qrTokens', tokenId), qrDoc);
        await batch.commit();
        await writeAuditEntry({
          action: 'TAMBAH_SISWA_DAN_QR',
          targetCollection: 'students',
          targetId: newId,
          targetName: newStudent.fullName,
          previousValue: 'NONE',
          newValue: `NIS ${newStudent.nis} · ${newStudent.className} · Token ${tokenId}`,
          reason: 'Penambahan siswa baru beserta QR Code permanen',
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `students/${newId}`);
      }
    }
  };

  const handleDeleteStudent = async (std: Student) => {
    try {
      await deleteDoc(doc(db, 'students', std.id));
      const oldToken = qrTokens.find((t) => t.id === std.qrCodeId);
      if (oldToken) {
        await updateDoc(doc(db, 'qrTokens', oldToken.id), {
          status: 'REVOKED',
          revokedAt: new Date().toISOString(),
        });
      }
      await writeAuditEntry({
        action: 'HAPUS_SISWA',
        targetCollection: 'students',
        targetId: std.id,
        targetName: std.fullName,
        previousValue: `NIS ${std.nis} (${std.className})`,
        newValue: 'DIHAPUS & QR REVOKED',
        reason: 'Penghapusan data siswa oleh administrator',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `students/${std.id}`);
    }
  };

  const handleBulkImportStudents = async (
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
  ): Promise<number> => {
    if (!userProfile) return 0;
    const nowIso = new Date().toISOString();
    const batch = writeBatch(db);
    let count = 0;

    for (const r of rows) {
      const matchedClass =
        classes.find((c) => c.name.toLowerCase() === r.className.toLowerCase()) ||
        classes[0] || { id: 'cls_1a', name: 'Kelas 1A' };
      const stdId = sanitizeId(`std_${r.nis}_${Date.now().toString().slice(-3)}_${count}`);
      const { tokenId, tokenString } = generateSecureQrToken(stdId, 1);

      const newStd: Student = {
        id: stdId,
        nis: sanitizeString(r.nis, 30),
        nisn: sanitizeString(r.nisn, 30),
        fullName: sanitizeString(r.fullName, 120),
        gender: r.gender,
        birthPlaceDate: sanitizeString(r.birthPlaceDate, 100),
        classId: matchedClass.id,
        className: matchedClass.name,
        parentName: sanitizeString(r.parentName, 120),
        parentWhatsapp: sanitizeString(r.parentWhatsapp, 30),
        photoUrl: '',
        status: 'AKTIF',
        qrCodeId: tokenId,
        qrToken: tokenString,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const qrDoc: QrToken = {
        id: tokenId,
        token: tokenString,
        studentId: stdId,
        studentNis: newStd.nis,
        studentName: newStd.fullName,
        classId: newStd.classId,
        className: newStd.className,
        status: 'ACTIVE',
        version: 1,
        createdAt: nowIso,
        revokedAt: '',
        createdBy: userProfile.uid,
      };

      batch.set(doc(db, 'students', stdId), newStd);
      batch.set(doc(db, 'qrTokens', tokenId), qrDoc);
      count++;
    }

    try {
      await batch.commit();
      await writeAuditEntry({
        action: 'IMPORT_EXCEL_SISWA',
        targetCollection: 'students',
        targetId: 'bulk',
        targetName: `${count} Siswa`,
        previousValue: `${students.length} Siswa`,
        newValue: `${students.length + count} Siswa`,
        reason: 'Import massal data siswa dari file Excel',
      });
      return count;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'students_bulk_import');
    }
  };

  // QR Code Regeneration (Revokes old QR Token & creates new version)
  const handleRegenerateStudentQr = async (student: Student, reason: string) => {
    if (!userProfile) return;
    const nowIso = new Date().toISOString();
    const currentTokenDoc = qrTokens.find((t) => t.id === student.qrCodeId);
    const nextVersion = (currentTokenDoc?.version || 1) + 1;
    const { tokenId, tokenString } = generateSecureQrToken(student.id, nextVersion);

    const batch = writeBatch(db);
    if (currentTokenDoc) {
      batch.update(doc(db, 'qrTokens', currentTokenDoc.id), {
        status: 'REVOKED',
        revokedAt: nowIso,
      });
    }

    const newQrDoc: QrToken = {
      id: tokenId,
      token: tokenString,
      studentId: student.id,
      studentNis: student.nis,
      studentName: student.fullName,
      classId: student.classId,
      className: student.className,
      status: 'ACTIVE',
      version: nextVersion,
      createdAt: nowIso,
      revokedAt: '',
      createdBy: userProfile.uid,
    };
    batch.set(doc(db, 'qrTokens', tokenId), newQrDoc);

    batch.update(doc(db, 'students', student.id), {
      qrCodeId: tokenId,
      qrToken: tokenString,
      updatedAt: nowIso,
    });

    try {
      await batch.commit();
      await writeAuditEntry({
        action: 'REGENERASI_QR_SISWA',
        targetCollection: 'qrTokens',
        targetId: tokenId,
        targetName: student.fullName,
        previousValue: `Token Lama: ${student.qrCodeId} (REVOKED)`,
        newValue: `Token Baru: ${tokenId} (v${nextVersion})`,
        reason,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `qrTokens/${tokenId}`);
    }
  };

  const handleBulkRegenerateQr = async (targetStudents: Student[], scopeLabel: string) => {
    if (!userProfile) return;
    const nowIso = new Date().toISOString();
    const batch = writeBatch(db);

    for (const std of targetStudents) {
      const currentTokenDoc = qrTokens.find((t) => t.id === std.qrCodeId);
      const nextVersion = (currentTokenDoc?.version || 1) + 1;
      const { tokenId, tokenString } = generateSecureQrToken(std.id, nextVersion);

      if (currentTokenDoc) {
        batch.update(doc(db, 'qrTokens', currentTokenDoc.id), {
          status: 'REVOKED',
          revokedAt: nowIso,
        });
      }

      const newQrDoc: QrToken = {
        id: tokenId,
        token: tokenString,
        studentId: std.id,
        studentNis: std.nis,
        studentName: std.fullName,
        classId: std.classId,
        className: std.className,
        status: 'ACTIVE',
        version: nextVersion,
        createdAt: nowIso,
        revokedAt: '',
        createdBy: userProfile.uid,
      };
      batch.set(doc(db, 'qrTokens', tokenId), newQrDoc);
      batch.update(doc(db, 'students', std.id), {
        qrCodeId: tokenId,
        qrToken: tokenString,
        updatedAt: nowIso,
      });
    }

    try {
      await batch.commit();
      await writeAuditEntry({
        action: 'GENERATE_MASSAL_QR',
        targetCollection: 'qrTokens',
        targetId: 'bulk',
        targetName: scopeLabel,
        previousValue: `${targetStudents.length} Token Lama (REVOKED)`,
        newValue: `${targetStudents.length} Token Baru Aktif`,
        reason: `Regenerasi massal QR Code untuk ${scopeLabel}`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'qrTokens_bulk');
    }
  };

  // Real-Time QR Code Verification & Idempotent Attendance Recording
  const handleProcessQrScan = async (
    rawQrText: string,
    session: 'MASUK' | 'PULANG'
  ): Promise<ScanVerificationResult> => {
    const timeStr = getCurrentTimeString();
    const todayStr = getTodayDateString();
    const nowIso = new Date().toISOString();

    if (!userProfile) {
      return {
        outcome: 'INVALID_TOKEN',
        message: 'Sesi pengguna tidak ditemukan.',
        timestamp: timeStr,
      };
    }

    const trimmedQr = rawQrText.trim();

    // 0. Check if scanned QR is a Teacher / Staff QR Code
    const matchedTeacher = teachers.find(
      (t) =>
        t.status === 'AKTIF' &&
        (getTeacherQrToken(t.id, t.nip) === trimmedQr ||
          getTeacherQrCodeId(t.id, t.nip) === trimmedQr ||
          trimmedQr.startsWith(`ASRODUA::GURU::${t.id}::`))
    );

    if (matchedTeacher) {
      const tAttId = `${todayStr}_${matchedTeacher.id}`;
      const existingTAtt = teacherAttendance.find((a) => a.id === tAttId);
      const qrCodeId = getTeacherQrCodeId(matchedTeacher.id, matchedTeacher.nip);

      if (session === 'MASUK') {
        if (existingTAtt && existingTAtt.checkInTime) {
          return {
            outcome: 'ALREADY_SCANNED',
            teacher: matchedTeacher,
            teacherRecord: existingTAtt,
            message: `${matchedTeacher.fullName} (${matchedTeacher.className}) sudah tercatat presensi MASUK hari ini pada pukul ${existingTAtt.checkInTime} WIB (${existingTAtt.status}).`,
            timestamp: timeStr,
          };
        }

        const deadlineWithSec = `${settings.checkInDeadline}:59`;
        const computedStatus: TeacherAttendanceStatus =
          timeStr > deadlineWithSec ? 'TERLAMBAT' : 'HADIR';

        const newTRecord: TeacherAttendanceRecord = {
          id: tAttId,
          teacherId: matchedTeacher.id,
          nip: matchedTeacher.nip || '-',
          teacherName: matchedTeacher.fullName,
          role: matchedTeacher.role,
          classId: matchedTeacher.classId || 'ALL',
          className: matchedTeacher.className || 'Semua Kelas',
          date: todayStr,
          academicYear: settings.activeAcademicYear,
          status: computedStatus,
          checkInTime: timeStr,
          checkOutTime: existingTAtt?.checkOutTime || '',
          session: 'MASUK',
          qrTokenUsed: qrCodeId,
          verifiedByUid: userProfile.uid,
          verifiedByName: userProfile.name,
          notes:
            computedStatus === 'HADIR'
              ? 'Scan QR Guru Masuk Tepat Waktu'
              : `Scan QR Guru Masuk Terlambat (Batas ${settings.checkInDeadline} WIB)`,
          createdAt: existingTAtt?.createdAt || nowIso,
          updatedAt: nowIso,
        };

        try {
          await setDoc(doc(db, 'teacherAttendance', tAttId), newTRecord);
          return {
            outcome: 'SUCCESS',
            teacher: matchedTeacher,
            teacherRecord: newTRecord,
            message: `Presensi MASUK Guru/Staf (${matchedTeacher.fullName}) berhasil disimpan ke Firestore.`,
            timestamp: timeStr,
          };
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `teacherAttendance/${tAttId}`);
        }
      } else {
        if (existingTAtt && existingTAtt.checkOutTime) {
          return {
            outcome: 'ALREADY_SCANNED',
            teacher: matchedTeacher,
            teacherRecord: existingTAtt,
            message: `${matchedTeacher.fullName} (${matchedTeacher.className}) sudah melakukan scan PULANG hari ini pada pukul ${existingTAtt.checkOutTime} WIB.`,
            timestamp: timeStr,
          };
        }

        const updatedTRecord: TeacherAttendanceRecord = existingTAtt
          ? {
              ...existingTAtt,
              checkOutTime: timeStr,
              session: 'PULANG',
              verifiedByUid: userProfile.uid,
              verifiedByName: userProfile.name,
              updatedAt: nowIso,
            }
          : {
              id: tAttId,
              teacherId: matchedTeacher.id,
              nip: matchedTeacher.nip || '-',
              teacherName: matchedTeacher.fullName,
              role: matchedTeacher.role,
              classId: matchedTeacher.classId || 'ALL',
              className: matchedTeacher.className || 'Semua Kelas',
              date: todayStr,
              academicYear: settings.activeAcademicYear,
              status: 'HADIR',
              checkInTime: '-',
              checkOutTime: timeStr,
              session: 'PULANG',
              qrTokenUsed: qrCodeId,
              verifiedByUid: userProfile.uid,
              verifiedByName: userProfile.name,
              notes: 'Scan QR Guru Pulang',
              createdAt: nowIso,
              updatedAt: nowIso,
            };

        try {
          await setDoc(doc(db, 'teacherAttendance', tAttId), updatedTRecord);
          return {
            outcome: 'SUCCESS',
            teacher: matchedTeacher,
            teacherRecord: updatedTRecord,
            message: `Presensi PULANG untuk ${matchedTeacher.fullName} tercatat pada pukul ${timeStr} WIB.`,
            timestamp: timeStr,
          };
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `teacherAttendance/${tAttId}`);
        }
      }
    }

    // 1. Find matching token in qrTokens (Siswa)
    const matchedToken = qrTokens.find(
      (t) => t.token === trimmedQr || t.id === trimmedQr
    );

    if (!matchedToken) {
      return {
        outcome: 'INVALID_TOKEN',
        message:
          'Token QR Code tidak terdaftar pada database SDN ASEMROWO II/63 SURABAYA. Pastikan menggunakan kartu pelajar atau kartu guru resmi.',
        timestamp: timeStr,
      };
    }

    if (matchedToken.status === 'REVOKED') {
      return {
        outcome: 'REVOKED_TOKEN',
        message: `Kartu QR lama milik ${matchedToken.studentName} (${matchedToken.id}) telah dinonaktifkan karena regenerasi kartu baru.`,
        timestamp: timeStr,
      };
    }

    const student = students.find((s) => s.id === matchedToken.studentId);
    if (!student || student.status !== 'AKTIF') {
      return {
        outcome: 'INVALID_TOKEN',
        message: 'Data siswa pemilik QR Code tidak aktif atau telah dihapus.',
        timestamp: timeStr,
      };
    }

    // 2. Idempotency Check: Document ID is strictly `${todayStr}_${student.id}`
    const attId = `${todayStr}_${student.id}`;
    const existingAtt = attendance.find((a) => a.id === attId);

    if (session === 'MASUK') {
      if (existingAtt && existingAtt.checkInTime) {
        return {
          outcome: 'ALREADY_SCANNED',
          student,
          record: existingAtt,
          message: `${student.fullName} (${student.className}) sudah tercatat absensi MASUK hari ini pada pukul ${existingAtt.checkInTime} WIB dengan status ${existingAtt.status}.`,
          timestamp: timeStr,
        };
      }

      // Determine HADIR vs TERLAMBAT based on settings.checkInDeadline (e.g. "07:00")
      const deadlineWithSec = `${settings.checkInDeadline}:59`;
      const computedStatus: AttendanceStatus =
        timeStr > deadlineWithSec ? 'TERLAMBAT' : 'HADIR';

      const newRecord: AttendanceRecord = {
        id: attId,
        studentId: student.id,
        nis: student.nis,
        nisn: student.nisn,
        studentName: student.fullName,
        classId: student.classId,
        className: student.className,
        date: todayStr,
        academicYear: settings.activeAcademicYear,
        status: computedStatus,
        checkInTime: timeStr,
        checkOutTime: existingAtt?.checkOutTime || '',
        session: 'MASUK',
        qrTokenUsed: matchedToken.id,
        verifiedByUid: userProfile.uid,
        verifiedByName: userProfile.name,
        notes:
          computedStatus === 'HADIR'
            ? 'Scan QR Masuk Tepat Waktu'
            : `Scan QR Masuk Terlambat (Batas ${settings.checkInDeadline} WIB)`,
        whatsappSent: Boolean(settings.whatsappEnabled && student.parentWhatsapp),
        createdAt: existingAtt?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'attendance', attId), newRecord);

      // 3. Automatically Dispatch WhatsApp Notification Log (Idempotent notif_${attId})
      const notifId = `notif_${attId}`;
      const existingNotif = notificationLogs.find((n) => n.id === notifId);
      if (settings.whatsappEnabled && student.parentWhatsapp && !existingNotif) {
        const msg = formatWhatsAppMessage(settings.whatsappTemplate, {
          studentName: student.fullName,
          className: student.className,
          status: computedStatus,
          time: timeStr,
          date: todayStr,
        });
        const notifDoc: NotificationLog = {
          id: notifId,
          attendanceId: attId,
          studentId: student.id,
          studentName: student.fullName,
          className: student.className,
          parentName: student.parentName,
          recipientPhone: student.parentWhatsapp,
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

      try {
        await batch.commit();
        return {
          outcome: 'SUCCESS',
          student,
          record: newRecord,
          message: `Absensi MASUK berhasil disimpan. Notifikasi WhatsApp telah dikirim ke orang tua (${student.parentName} · ${student.parentWhatsapp}).`,
          timestamp: timeStr,
        };
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `attendance/${attId}`);
      }
    } else {
      // Sesi PULANG
      if (existingAtt && existingAtt.checkOutTime) {
        return {
          outcome: 'ALREADY_SCANNED',
          student,
          record: existingAtt,
          message: `${student.fullName} (${student.className}) sudah melakukan scan PULANG hari ini pada pukul ${existingAtt.checkOutTime} WIB.`,
          timestamp: timeStr,
        };
      }

      const updatedRecord: AttendanceRecord = existingAtt
        ? {
            ...existingAtt,
            checkOutTime: timeStr,
            session: 'PULANG',
            verifiedByUid: userProfile.uid,
            verifiedByName: userProfile.name,
            updatedAt: nowIso,
          }
        : {
            id: attId,
            studentId: student.id,
            nis: student.nis,
            nisn: student.nisn,
            studentName: student.fullName,
            classId: student.classId,
            className: student.className,
            date: todayStr,
            academicYear: settings.activeAcademicYear,
            status: 'HADIR',
            checkInTime: '-',
            checkOutTime: timeStr,
            session: 'PULANG',
            qrTokenUsed: matchedToken.id,
            verifiedByUid: userProfile.uid,
            verifiedByName: userProfile.name,
            notes: 'Scan QR Pulang',
            whatsappSent: true,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

      try {
        await setDoc(doc(db, 'attendance', attId), updatedRecord);
        return {
          outcome: 'SUCCESS',
          student,
          record: updatedRecord,
          message: `Absensi PULANG untuk ${student.fullName} tercatat pada pukul ${timeStr} WIB.`,
          timestamp: timeStr,
        };
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `attendance/${attId}`);
      }
    }
  };

  // Manual Attendance Status Update with Mandatory Audit Log
  const handleUpdateAttendanceManual = async (
    student: Student,
    date: string,
    status: AttendanceStatus,
    checkInTime: string,
    checkOutTime: string,
    reason: string
  ) => {
    if (!userProfile) return;
    const nowIso = new Date().toISOString();
    const attId = `${date}_${student.id}`;
    const existing = attendance.find((a) => a.id === attId);

    const record: AttendanceRecord = {
      id: attId,
      studentId: student.id,
      nis: student.nis,
      nisn: student.nisn,
      studentName: student.fullName,
      classId: student.classId,
      className: student.className,
      date,
      academicYear: settings.activeAcademicYear,
      status,
      checkInTime: sanitizeString(checkInTime, 20),
      checkOutTime: sanitizeString(checkOutTime, 20),
      session: 'MANUAL',
      qrTokenUsed: student.qrCodeId,
      verifiedByUid: userProfile.uid,
      verifiedByName: userProfile.name,
      notes: sanitizeString(reason, 300),
      whatsappSent: existing?.whatsappSent || false,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    try {
      await setDoc(doc(db, 'attendance', attId), record);
      await writeAuditEntry({
        action: existing ? 'KOREKSI_ABSENSI' : 'INPUT_MANUAL_ABSENSI',
        targetCollection: 'attendance',
        targetId: attId,
        targetName: `${student.fullName} (${student.className})`,
        previousValue: existing ? `${existing.status} (${existing.checkInTime})` : 'BELUM_SCAN',
        newValue: `${status} (${checkInTime || '-'})`,
        reason,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `attendance/${attId}`);
    }
  };

  // Teacher Attendance Handlers (Self Check-In/Out & Manual Input/Correction with Audit Log)
  const handleRecordTeacherScanOrSelf = async (
    teacher: Teacher,
    session: 'MASUK' | 'PULANG'
  ) => {
    const qrToken = getTeacherQrToken(teacher.id, teacher.nip);
    await handleProcessQrScan(qrToken, session);
  };

  const handleUpdateTeacherAttendanceManual = async (
    teacher: Teacher,
    date: string,
    status: TeacherAttendanceStatus,
    checkInTime: string,
    checkOutTime: string,
    reason: string
  ) => {
    if (!userProfile) return;
    const nowIso = new Date().toISOString();
    const tAttId = `${date}_${teacher.id}`;
    const existing = teacherAttendance.find((a) => a.id === tAttId);
    const qrCodeId = getTeacherQrCodeId(teacher.id, teacher.nip);

    const record: TeacherAttendanceRecord = {
      id: tAttId,
      teacherId: teacher.id,
      nip: teacher.nip || '-',
      teacherName: teacher.fullName,
      role: teacher.role,
      classId: teacher.classId || 'ALL',
      className: teacher.className || 'Semua Kelas',
      date,
      academicYear: settings.activeAcademicYear,
      status,
      checkInTime: sanitizeString(checkInTime, 20),
      checkOutTime: sanitizeString(checkOutTime, 20),
      session: 'MANUAL',
      qrTokenUsed: qrCodeId,
      verifiedByUid: userProfile.uid,
      verifiedByName: userProfile.name,
      notes: sanitizeString(reason, 300),
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    try {
      await setDoc(doc(db, 'teacherAttendance', tAttId), record);
      await writeAuditEntry({
        action: existing ? 'KOREKSI_ABSENSI_GURU' : 'INPUT_MANUAL_ABSENSI_GURU',
        targetCollection: 'teacherAttendance',
        targetId: tAttId,
        targetName: `${teacher.fullName} (${teacher.className})`,
        previousValue: existing ? `${existing.status} (${existing.checkInTime})` : 'BELUM_ABSEN',
        newValue: `${status} (${checkInTime || '-'})`,
        reason,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `teacherAttendance/${tAttId}`);
    }
  };

  // Teacher & Class Handlers
  const handleSaveTeacher = async (
    data: Omit<Teacher, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => {
    const nowIso = new Date().toISOString();
    const id = existingId || sanitizeId(`tch_${Date.now()}`);
    const existing = teachers.find((t) => t.id === id);
    const teacherDoc: Teacher = {
      id,
      nip: sanitizeString(data.nip, 40),
      fullName: sanitizeString(data.fullName, 120),
      email: sanitizeString(data.email, 150),
      phone: sanitizeString(data.phone, 30),
      role: data.role,
      classId: sanitizeString(data.classId, 128),
      className: sanitizeString(data.className, 50),
      status: data.status,
      userUid: sanitizeString(data.userUid, 128),
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };
    try {
      await setDoc(doc(db, 'teachers', id), teacherDoc);
      await writeAuditEntry({
        action: existingId ? 'EDIT_DATA_GURU' : 'TAMBAH_DATA_GURU',
        targetCollection: 'teachers',
        targetId: id,
        targetName: teacherDoc.fullName,
        previousValue: existing ? `${existing.fullName} (${existing.className})` : 'NONE',
        newValue: `${teacherDoc.fullName} (${teacherDoc.role} · ${teacherDoc.className})`,
        reason: existingId ? 'Pembaruan data guru/wali kelas' : 'Penambahan guru/staf baru',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `teachers/${id}`);
    }
  };

  const handleDeleteTeacher = async (tch: Teacher) => {
    try {
      await deleteDoc(doc(db, 'teachers', tch.id));
      await writeAuditEntry({
        action: 'HAPUS_DATA_GURU',
        targetCollection: 'teachers',
        targetId: tch.id,
        targetName: tch.fullName,
        previousValue: `NIP ${tch.nip} (${tch.className})`,
        newValue: 'DIHAPUS',
        reason: 'Penghapusan data guru oleh administrator',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `teachers/${tch.id}`);
    }
  };

  const handleSaveClass = async (
    data: Omit<SchoolClass, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => {
    const nowIso = new Date().toISOString();
    const slug = data.name.trim().toLowerCase().replace(/^kelas\s+/i, '').replace(/\s+/g, '_');
    const id = existingId || sanitizeId(`cls_${slug}`);
    const existing = classes.find((c) => c.id === id);
    const clsDoc: SchoolClass = {
      id,
      name: sanitizeString(data.name, 50),
      grade: Math.min(6, Math.max(1, Number(data.grade))),
      homeroomTeacherId: sanitizeString(data.homeroomTeacherId, 128),
      homeroomTeacherName: sanitizeString(data.homeroomTeacherName, 120),
      academicYear: sanitizeString(data.academicYear, 30),
      capacity: Math.min(100, Math.max(1, Number(data.capacity))),
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };
    try {
      await setDoc(doc(db, 'classes', id), clsDoc);
      await writeAuditEntry({
        action: existingId ? 'EDIT_DATA_KELAS' : 'TAMBAH_DATA_KELAS',
        targetCollection: 'classes',
        targetId: id,
        targetName: clsDoc.name,
        previousValue: existing ? `${existing.name} (Wali: ${existing.homeroomTeacherName})` : 'NONE',
        newValue: `${clsDoc.name} (Wali: ${clsDoc.homeroomTeacherName})`,
        reason: existingId ? 'Pembaruan data kelas' : 'Penambahan rombongan belajar baru',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `classes/${id}`);
    }
  };

  const handleDeleteClass = async (cls: SchoolClass) => {
    try {
      await deleteDoc(doc(db, 'classes', cls.id));
      await writeAuditEntry({
        action: 'HAPUS_DATA_KELAS',
        targetCollection: 'classes',
        targetId: cls.id,
        targetName: cls.name,
        previousValue: `${cls.name} (TP ${cls.academicYear})`,
        newValue: 'DIHAPUS',
        reason: 'Penghapusan data kelas oleh administrator',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `classes/${cls.id}`);
    }
  };

  const handleSyncParallelRombel = async () => {
    if (!userProfile) {
      return { addedClasses: 0, addedTeachers: 0, addedStudents: 0 };
    }
    try {
      const hasResetTeachers = auditLogs.some(
        (l) => l.action === 'RESET_DATA_GURU' || l.action === 'RESET_DATA_GURU_DAN_SISWA'
      );
      const hasResetStudents = auditLogs.some(
        (l) => l.action === 'RESET_DATA_SISWA' || l.action === 'RESET_DATA_GURU_DAN_SISWA'
      );
      const res = await syncMissingRombelAndTeachers(
        userProfile.uid,
        userProfile.name,
        settings.activeAcademicYear || '2026/2027',
        { skipTeachers: hasResetTeachers, skipStudents: hasResetStudents }
      );
      if (res.addedClasses > 0 || res.addedTeachers > 0 || res.addedStudents > 0) {
        await writeAuditEntry({
          action: 'SINKRONISASI_ROMBEL_PARALEL',
          targetCollection: 'classes',
          targetId: 'rombel_1b_6b',
          targetName: 'Kelas 1B–6B',
          previousValue: `${classes.length} Rombel`,
          newValue: `+${res.addedClasses} Rombel, +${res.addedTeachers} Guru/Mapel, +${res.addedStudents} Siswa`,
          reason: 'Sinkronisasi rombel paralel Kelas 1B–6B dan wali kelas/guru mapel',
        });
      }
      return res;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'classes');
      return { addedClasses: 0, addedTeachers: 0, addedStudents: 0 };
    }
  };

  // Reset Data Guru & Siswa Handler (with 400-op chunked batches & audit log)
  const handleResetData = async (
    scope: ResetDataScope,
    includeAttendance: boolean
  ): Promise<ResetDataResult> => {
    const result: ResetDataResult = {
      deletedTeachers: 0,
      deletedTeacherAttendance: 0,
      deletedStudents: 0,
      deletedQrTokens: 0,
      deletedStudentAttendance: 0,
      deletedNotifications: 0,
    };
    if (!userProfile) return result;

    const nowIso = new Date().toISOString();
    const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

    try {
      if (scope === 'TEACHERS' || scope === 'BOTH') {
        const teachersSnap = await getDocs(
          query(collection(db, 'teachers'), where('status', 'in', ['AKTIF', 'NONAKTIF']))
        );
        teachersSnap.docs.forEach((d) => {
          ops.push((b) => b.delete(d.ref));
          result.deletedTeachers++;
        });

        // Clear homeroom teacher assignment on classes while keeping all 1A–6B rombel intact
        const classesSnap = await getDocs(
          query(collection(db, 'classes'), where('grade', '>=', 1))
        );
        classesSnap.docs.forEach((d) => {
          const c = d.data() as SchoolClass;
          if (c.homeroomTeacherId || c.homeroomTeacherName !== 'Belum Ditentukan') {
            ops.push((b) =>
              b.update(d.ref, {
                homeroomTeacherId: '',
                homeroomTeacherName: 'Belum Ditentukan',
                updatedAt: nowIso,
              })
            );
          }
        });

        if (includeAttendance) {
          const tAttSnap = await getDocs(
            query(
              collection(db, 'teacherAttendance'),
              where('status', 'in', ['HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'DINAS_LUAR', 'ALPA'])
            )
          );
          tAttSnap.docs.forEach((d) => {
            ops.push((b) => b.delete(d.ref));
            result.deletedTeacherAttendance++;
          });
        }
      }

      if (scope === 'STUDENTS' || scope === 'BOTH') {
        const studentsSnap = await getDocs(
          query(collection(db, 'students'), where('status', 'in', ['AKTIF', 'NONAKTIF']))
        );
        studentsSnap.docs.forEach((d) => {
          ops.push((b) => b.delete(d.ref));
          result.deletedStudents++;
        });

        const tokensSnap = await getDocs(
          query(collection(db, 'qrTokens'), where('status', 'in', ['ACTIVE', 'REVOKED']))
        );
        if (userProfile.role === 'SUPER_ADMIN') {
          tokensSnap.docs.forEach((d) => {
            ops.push((b) => b.delete(d.ref));
            result.deletedQrTokens++;
          });
        } else {
          tokensSnap.docs.forEach((d) => {
            const t = d.data() as QrToken;
            if (t.status === 'ACTIVE') {
              ops.push((b) => b.update(d.ref, { status: 'REVOKED', revokedAt: nowIso }));
              result.deletedQrTokens++;
            }
          });
        }

        if (includeAttendance && userProfile.role === 'SUPER_ADMIN') {
          const attSnap = await getDocs(
            query(
              collection(db, 'attendance'),
              where('status', 'in', ['HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'ALPA'])
            )
          );
          attSnap.docs.forEach((d) => {
            ops.push((b) => b.delete(d.ref));
            result.deletedStudentAttendance++;
          });

          const notifSnap = await getDocs(
            query(
              collection(db, 'notificationLogs'),
              where('status', 'in', ['SENT', 'DELIVERED', 'FAILED', 'PENDING'])
            )
          );
          notifSnap.docs.forEach((d) => {
            ops.push((b) => b.delete(d.ref));
            result.deletedNotifications++;
          });
        }
      }

      // Commit in 400-operation chunks (Firestore limit is 500 per batch)
      for (let i = 0; i < ops.length; i += 400) {
        const chunk = ops.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((applyOp) => applyOp(batch));
        await batch.commit();
      }

      const actionName =
        scope === 'TEACHERS'
          ? 'RESET_DATA_GURU'
          : scope === 'STUDENTS'
          ? 'RESET_DATA_SISWA'
          : 'RESET_DATA_GURU_DAN_SISWA';

      await writeAuditEntry({
        action: actionName,
        targetCollection:
          scope === 'TEACHERS'
            ? 'teachers'
            : scope === 'STUDENTS'
            ? 'students'
            : 'teachers_students',
        targetId: 'bulk_reset',
        targetName:
          scope === 'TEACHERS'
            ? 'Data Guru & Staf'
            : scope === 'STUDENTS'
            ? 'Data Siswa'
            : 'Data Guru & Siswa',
        previousValue: `${result.deletedTeachers} Guru, ${result.deletedStudents} Siswa, ${result.deletedTeacherAttendance + result.deletedStudentAttendance} Absensi`,
        newValue: '0 data (Siap pengisian data baru)',
        reason: 'Reset data oleh administrator untuk pengisian data guru dan/atau siswa baru',
      });

      return result;
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reset_${scope.toLowerCase()}`);
    }
  };

  // Notification & Settings Handlers
  const handleRetryNotification = async (log: NotificationLog) => {
    try {
      await updateDoc(doc(db, 'notificationLogs', log.id), {
        status: 'DELIVERED',
        sentAt: new Date().toISOString(),
        retryCount: (log.retryCount || 0) + 1,
        errorReason: '',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notificationLogs/${log.id}`);
    }
  };

  const handleSaveTemplate = async (newTemplate: string) => {
    if (!userProfile) return;
    const updated: AttendanceSettings = {
      ...settings,
      whatsappTemplate: sanitizeString(newTemplate, 1500),
      updatedAt: new Date().toISOString(),
      updatedBy: userProfile.uid,
    };
    try {
      await setDoc(doc(db, 'attendanceSettings', 'global'), updated);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'attendanceSettings/global');
    }
  };

  const handleSaveSettings = async (updated: AttendanceSettings) => {
    if (!userProfile) return;
    const nowIso = new Date().toISOString();
    const payload: AttendanceSettings = {
      ...updated,
      id: 'global',
      schoolName: sanitizeString(updated.schoolName, 150, DEFAULT_SETTINGS.schoolName),
      npsn: sanitizeString(updated.npsn, 30),
      schoolAddress: sanitizeString(updated.schoolAddress, 250),
      principalName: sanitizeString(updated.principalName, 120),
      principalNip: sanitizeString(updated.principalNip, 40),
      principalEmail: sanitizeString(updated.principalEmail || '', 150).toLowerCase(),
      activeAcademicYear: sanitizeString(updated.activeAcademicYear, 30),
      whatsappProvider: sanitizeString(updated.whatsappProvider, 60),
      whatsappApiUrl: sanitizeString(updated.whatsappApiUrl, 250),
      whatsappSenderNumber: sanitizeString(updated.whatsappSenderNumber, 30),
      whatsappTemplate: sanitizeString(updated.whatsappTemplate, 1500),
      updatedAt: nowIso,
      updatedBy: userProfile.uid,
    };
    const syncedSite: SiteContent = {
      ...siteContent,
      id: 'public',
      schoolName: payload.schoolName,
      npsn: payload.npsn,
      schoolAddress: payload.schoolAddress,
      principalName: payload.principalName,
      principalNip: payload.principalNip,
      activeAcademicYear: payload.activeAcademicYear,
      semester: payload.semester,
      updatedAt: nowIso,
      updatedBy: userProfile.uid,
    };
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'attendanceSettings', 'global'), payload);
      batch.set(doc(db, 'siteContent', 'public'), syncedSite);
      await batch.commit();
      await writeAuditEntry({
        action: 'UPDATE_PENGATURAN_SEKOLAH',
        targetCollection: 'attendanceSettings',
        targetId: 'global',
        targetName: payload.schoolName,
        previousValue: `Jam Masuk: ${settings.checkInDeadline} · Kepsek: ${settings.principalEmail || '-'}`,
        newValue: `Jam Masuk: ${payload.checkInDeadline} · Kepsek: ${payload.principalEmail || '-'}`,
        reason: 'Pembaruan konfigurasi operasional, email kepala sekolah & identitas sekolah',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'attendanceSettings/global');
    }
  };

  const handleSavePrincipalConfig = async (
    principalNameInput: string,
    principalNipInput: string,
    principalEmailInput: string
  ) => {
    if (!userProfile) return;
    const nowIso = new Date().toISOString();
    const cleanEmail = sanitizeString(principalEmailInput, 150).toLowerCase();
    const cleanName = sanitizeString(principalNameInput, 120, settings.principalName);
    const cleanNip = sanitizeString(principalNipInput, 40, settings.principalNip);

    const payload: AttendanceSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      id: 'global',
      principalName: cleanName,
      principalNip: cleanNip,
      principalEmail: cleanEmail,
      updatedAt: nowIso,
      updatedBy: userProfile.uid,
    };
    const syncedSite: SiteContent = {
      ...siteContent,
      id: 'public',
      principalName: cleanName,
      principalNip: cleanNip,
      updatedAt: nowIso,
      updatedBy: userProfile.uid,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'attendanceSettings', 'global'), payload);
      batch.set(doc(db, 'siteContent', 'public'), syncedSite);
      await batch.commit();
      await writeAuditEntry({
        action: 'UPDATE_EMAIL_KEPALA_SEKOLAH',
        targetCollection: 'attendanceSettings',
        targetId: 'global',
        targetName: cleanName,
        previousValue: settings.principalEmail || '-',
        newValue: cleanEmail,
        reason: 'Integrasi email akun Google Kepala Sekolah ke Firestore',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'attendanceSettings/global');
    }
  };

  // Website CMS & Announcements Handlers
  const handleSaveSiteContent = async (updated: SiteContent) => {
    if (!userProfile) return;
    const nowIso = new Date().toISOString();
    const payload: SiteContent = {
      id: 'public',
      appTitle: sanitizeString(updated.appTitle, 100, DEFAULT_SITE_CONTENT.appTitle),
      tagline: sanitizeString(updated.tagline, 120),
      schoolName: sanitizeString(updated.schoolName, 150, DEFAULT_SITE_CONTENT.schoolName),
      npsn: sanitizeString(updated.npsn, 30),
      schoolAddress: sanitizeString(updated.schoolAddress, 250),
      schoolEmail: sanitizeString(updated.schoolEmail, 150),
      schoolPhone: sanitizeString(updated.schoolPhone, 40),
      principalName: sanitizeString(updated.principalName, 120),
      principalNip: sanitizeString(updated.principalNip, 40),
      activeAcademicYear: sanitizeString(updated.activeAcademicYear, 30),
      semester: updated.semester === 'GENAP' ? 'GENAP' : 'GANJIL',
      heroTitle: sanitizeString(updated.heroTitle, 200),
      heroSubtitle: sanitizeString(updated.heroSubtitle, 150),
      heroDescription: sanitizeString(updated.heroDescription, 800),
      feature1Title: sanitizeString(updated.feature1Title, 80),
      feature1Desc: sanitizeString(updated.feature1Desc, 160),
      feature2Title: sanitizeString(updated.feature2Title, 80),
      feature2Desc: sanitizeString(updated.feature2Desc, 160),
      feature3Title: sanitizeString(updated.feature3Title, 80),
      feature3Desc: sanitizeString(updated.feature3Desc, 160),
      announcementBannerTitle: sanitizeString(updated.announcementBannerTitle, 150),
      announcementBannerBody: sanitizeString(updated.announcementBannerBody, 600),
      showAnnouncementBanner: Boolean(updated.showAnnouncementBanner),
      footerText: sanitizeString(updated.footerText, 200),
      updatedAt: nowIso,
      updatedBy: userProfile.uid,
    };

    const syncedSettings: AttendanceSettings = {
      ...settings,
      id: 'global',
      schoolName: payload.schoolName,
      npsn: payload.npsn,
      schoolAddress: payload.schoolAddress,
      principalName: payload.principalName,
      principalNip: payload.principalNip,
      activeAcademicYear: payload.activeAcademicYear,
      semester: payload.semester,
      updatedAt: nowIso,
      updatedBy: userProfile.uid,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'siteContent', 'public'), payload);
      batch.set(doc(db, 'attendanceSettings', 'global'), syncedSettings);
      await batch.commit();
      setSiteContent(payload);
      await writeAuditEntry({
        action: 'UPDATE_KONTEN_WEBSITE',
        targetCollection: 'siteContent',
        targetId: 'public',
        targetName: payload.appTitle,
        previousValue: `${siteContent.schoolName} · ${siteContent.heroTitle.slice(0, 60)}`,
        newValue: `${payload.schoolName} · ${payload.heroTitle.slice(0, 60)}`,
        reason: 'Pembaruan isi konten website dan informasi sekolah melalui Dashboard Admin',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'siteContent/public');
    }
  };

  const handleSaveAnnouncement = async (
    data: Omit<Announcement, 'id' | 'authorName' | 'authorUid' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => {
    if (!userProfile) return;
    const nowIso = new Date().toISOString();
    const id = existingId || sanitizeId(`ann_${Date.now()}`);
    const existing = announcements.find((a) => a.id === id);

    const annDoc: Announcement = {
      id,
      title: sanitizeString(data.title, 160),
      content: sanitizeString(data.content, 1500),
      category: data.category,
      publishDate: sanitizeString(data.publishDate, 20, getTodayDateString()),
      isPinned: Boolean(data.isPinned),
      isPublished: Boolean(data.isPublished),
      authorName: sanitizeString(existing?.authorName || userProfile.name, 120),
      authorUid: sanitizeString(existing?.authorUid || userProfile.uid, 128),
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    try {
      await setDoc(doc(db, 'announcements', id), annDoc);
      await writeAuditEntry({
        action: existingId ? 'EDIT_INFORMASI_SEKOLAH' : 'TAMBAH_INFORMASI_SEKOLAH',
        targetCollection: 'announcements',
        targetId: id,
        targetName: annDoc.title,
        previousValue: existing ? existing.title : 'NONE',
        newValue: `${annDoc.title} (${annDoc.isPublished ? 'Publik' : 'Draf'})`,
        reason: 'Pengelolaan informasi & pengumuman sekolah pada website',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `announcements/${id}`);
    }
  };

  const handleDeleteAnnouncement = async (ann: Announcement) => {
    try {
      await deleteDoc(doc(db, 'announcements', ann.id));
      await writeAuditEntry({
        action: 'HAPUS_INFORMASI_SEKOLAH',
        targetCollection: 'announcements',
        targetId: ann.id,
        targetName: ann.title,
        previousValue: ann.title,
        newValue: 'DIHAPUS',
        reason: 'Penghapusan pengumuman sekolah oleh administrator',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `announcements/${ann.id}`);
    }
  };

  const handleAddAcademicYear = async (year: string, semester: 'GANJIL' | 'GENAP') => {
    const id = sanitizeId(`ay_${year.replace(/[^0-9]/g, '_')}_${semester.toLowerCase()}`);
    const docData: AcademicYear = {
      id,
      year: sanitizeString(year, 30),
      semester,
      isActive: false,
      startDate: `${year.slice(0, 4)}-07-13`,
      endDate: `${year.slice(5, 9) || '2028'}-06-20`,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'academicYears', id), docData);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `academicYears/${id}`);
    }
  };

  const handleActivateAcademicYear = async (ay: AcademicYear) => {
    if (!userProfile) return;
    const nowIso = new Date().toISOString();
    const batch = writeBatch(db);
    for (const item of academicYears) {
      batch.update(doc(db, 'academicYears', item.id), {
        isActive: item.id === ay.id,
      });
    }
    batch.set(doc(db, 'attendanceSettings', 'global'), {
      ...settings,
      activeAcademicYear: ay.year,
      semester: ay.semester,
      updatedAt: nowIso,
      updatedBy: userProfile.uid,
    });
    batch.set(doc(db, 'siteContent', 'public'), {
      ...siteContent,
      activeAcademicYear: ay.year,
      semester: ay.semester,
      updatedAt: nowIso,
      updatedBy: userProfile.uid,
    });

    try {
      await batch.commit();
      await writeAuditEntry({
        action: 'AKTIFKAN_TAHUN_PELAJARAN',
        targetCollection: 'academicYears',
        targetId: ay.id,
        targetName: `TP ${ay.year} ${ay.semester}`,
        previousValue: `TP ${settings.activeAcademicYear} ${settings.semester}`,
        newValue: `TP ${ay.year} ${ay.semester}`,
        reason: 'Pengaktifan tahun pelajaran & semester baru',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `academicYears/${ay.id}`);
    }
  };

  const handleUpdateUserAccount = async (
    targetUser: UserProfile,
    updates: Partial<Pick<UserProfile, 'role' | 'active' | 'assignedClassId' | 'assignedClassName'>>
  ) => {
    const nextUser: UserProfile = {
      ...targetUser,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'users', targetUser.uid), nextUser);
      await writeAuditEntry({
        action: 'UPDATE_AKUN_PENGGUNA',
        targetCollection: 'users',
        targetId: targetUser.uid,
        targetName: targetUser.name,
        previousValue: `${targetUser.role} · ${targetUser.active ? 'AKTIF' : 'NONAKTIF'}`,
        newValue: `${nextUser.role} · ${nextUser.active ? 'AKTIF' : 'NONAKTIF'}`,
        reason: 'Pembaruan hak akses atau status akun pengguna portal',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.uid}`);
    }
  };

  const handleUpdateProfile = async (
    updates: Partial<
      Pick<
        UserProfile,
        'name' | 'nip' | 'phone' | 'assignedClassId' | 'assignedClassName' | 'role'
      >
    >
  ) => {
    if (!userProfile) return;
    const nextProfile: UserProfile = {
      ...userProfile,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'users', userProfile.uid), nextProfile);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}`);
    }
  };

  const visibleNavItems = useMemo(() => {
    if (!userProfile) return [];
    return NAV_ITEMS.filter((item) => item.allowedRoles.includes(userProfile.role));
  }, [userProfile]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F5F8FF] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-sm w-full">
          <div className="w-12 h-12 rounded-xl bg-[#0A3D91] text-[#D4AF37] flex items-center justify-center mx-auto mb-3">
            <QrCode className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold font-display text-slate-900">
            ASRODUA SMART ATTENDANCE
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Menghubungkan ke server Cloud Firestore...
          </p>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !userProfile) {
    return (
      <LoginView
        onGoogleLogin={handleGoogleLogin}
        isLoggingIn={isLoggingIn}
        authError={authError}
        siteContent={siteContent}
        announcements={announcements}
      />
    );
  }

  const currentNavLabel =
    NAV_ITEMS.find((n) => n.id === activePage)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-[#F5F8FF] flex flex-col lg:flex-row">
      {/* Desktop Sidebar Navigation (264px width) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0A3D91] text-white border-r border-[#082f70] no-print z-30">
        {/* School Brand Header */}
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white p-1 shrink-0 flex items-center justify-center overflow-hidden">
            <img
              src="/assets/aistudio/EB607786-7417-4AF8-93A0-7453467400F4_9963c46a.png"
              alt={`Logo ${siteContent.schoolName}`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold font-display text-[#D4AF37] tracking-wide truncate">
              {siteContent.appTitle}
            </p>
            <p className="text-xs font-semibold text-white truncate">
              {siteContent.schoolName}
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#0A3D91] shadow-xs'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-[#0A3D91]' : 'text-[#D4AF37]'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Account Footer */}
        <div className="p-4 border-t border-white/10 bg-[#082f70]/60">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{userProfile.name}</p>
              <p className="text-[11px] text-[#D4AF37] font-medium truncate">
                {userProfile.role.replace('_', ' ')} · {userProfile.assignedClassName}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2 px-3 text-xs font-semibold text-white bg-white/10 hover:bg-rose-600 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Sesi</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract (SaaS Workspace Breadcrumb + Primary Action) */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs sm:text-sm font-medium text-slate-500 truncate">
              <span className="text-slate-800 font-semibold">{siteContent.schoolName}</span>
              <span className="mx-2 text-slate-300">/</span>
              <span className="text-[#0A3D91] font-bold">{currentNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActivePage('profile')}
              className="hidden sm:flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <span className="font-semibold text-slate-900">{userProfile.name}</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#0A3D91] font-semibold">
                {userProfile.role.replace('_', ' ')}
              </span>
            </button>

            <button
              onClick={() => setActivePage('scan-attendance')}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0A3D91] hover:bg-[#082f70] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ScanLine className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Scan QR</span>
            </button>
          </div>
        </header>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/50"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-72 max-w-full bg-[#0A3D91] text-white flex flex-col justify-between z-10">
              <div>
                <div className="p-4 border-b border-white/10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white p-0.5 shrink-0 flex items-center justify-center overflow-hidden">
                      <img
                        src="/assets/aistudio/EB607786-7417-4AF8-93A0-7453467400F4_9963c46a.png"
                        alt={`Logo ${siteContent.schoolName}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="text-sm font-bold font-display text-[#D4AF37] truncate">
                      {siteContent.appTitle}
                    </span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 text-white/80 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <nav className="p-3 space-y-1">
                  {visibleNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActivePage(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl ${
                          isActive
                            ? 'bg-white text-[#0A3D91]'
                            : 'text-blue-100 hover:bg-white/10'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
              <div className="p-4 border-t border-white/10">
                <button
                  onClick={handleLogout}
                  className="w-full py-2 px-3 text-xs font-semibold text-white bg-rose-600 rounded-lg flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Error Banner if any */}
        {globalError && (
          <div className="mx-4 lg:mx-8 mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{globalError}</span>
            </div>
            <button onClick={() => setGlobalError(null)} className="font-bold">
              Tutup
            </button>
          </div>
        )}

        {/* Active View Viewport */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {(activePage === 'principal-dashboard' ||
            (activePage === 'dashboard' && userProfile.role === 'KEPALA_SEKOLAH')) && (
            <PrincipalDashboardView
              userProfile={userProfile}
              students={students}
              teachers={teachers}
              classes={classes}
              attendance={attendance}
              teacherAttendance={teacherAttendance}
              notificationLogs={notificationLogs}
              auditLogs={auditLogs}
              announcements={announcements}
              settings={settings}
              onNavigate={setActivePage}
              onSavePrincipalConfig={handleSavePrincipalConfig}
            />
          )}

          {activePage === 'dashboard' && userProfile.role !== 'KEPALA_SEKOLAH' && (
            <DashboardView
              userProfile={userProfile}
              students={students}
              teachers={teachers}
              classes={classes}
              attendance={attendance}
              teacherAttendance={teacherAttendance}
              settings={settings}
              siteContent={siteContent}
              announcements={announcements}
              onNavigate={setActivePage}
              onSeedDatabase={async () => {
                setIsSeeding(true);
                try {
                  await seedSchoolDatabase(userProfile.uid, userProfile.name);
                } finally {
                  setIsSeeding(false);
                }
              }}
              isSeeding={isSeeding}
              onQuickSaveSiteContent={handleSaveSiteContent}
              onQuickMarkStatus={(std, st, notes) =>
                handleUpdateAttendanceManual(
                  std,
                  getTodayDateString(),
                  st,
                  st === 'HADIR' ? getCurrentTimeString() : '-',
                  '',
                  notes
                )
              }
            />
          )}

          {activePage === 'website-cms' && (
            <WebsiteCmsView
              userProfile={userProfile}
              siteContent={siteContent}
              announcements={announcements}
              students={students}
              teachers={teachers}
              classes={classes}
              usersList={usersList}
              onSaveSiteContent={handleSaveSiteContent}
              onSaveAnnouncement={handleSaveAnnouncement}
              onDeleteAnnouncement={handleDeleteAnnouncement}
              onUpdateUserAccount={handleUpdateUserAccount}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'students' && (
            <StudentsView
              userProfile={userProfile}
              students={students}
              classes={classes}
              onSaveStudent={handleSaveStudent}
              onDeleteStudent={handleDeleteStudent}
              onResetStudents={(inc) => handleResetData('STUDENTS', inc)}
              onBulkImportStudents={handleBulkImportStudents}
            />
          )}

          {activePage === 'teachers' && (
            <TeachersView
              userProfile={userProfile}
              teachers={teachers}
              classes={classes}
              schoolName={siteContent.schoolName}
              onSaveTeacher={handleSaveTeacher}
              onDeleteTeacher={handleDeleteTeacher}
              onResetTeachers={(inc) => handleResetData('TEACHERS', inc)}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'teacher-attendance' && (
            <TeacherAttendanceView
              userProfile={userProfile}
              teachers={teachers}
              teacherAttendance={teacherAttendance}
              settings={settings}
              onRecordTeacherScanOrSelf={handleRecordTeacherScanOrSelf}
              onUpdateTeacherAttendanceManual={handleUpdateTeacherAttendanceManual}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'classes' && (
            <ClassesView
              userProfile={userProfile}
              classes={classes}
              teachers={teachers}
              students={students}
              onSaveClass={handleSaveClass}
              onDeleteClass={handleDeleteClass}
              onSyncParallelRombel={handleSyncParallelRombel}
            />
          )}

          {activePage === 'qr-generator' && (
            <QrGeneratorView
              userProfile={userProfile}
              students={students}
              teachers={teachers}
              classes={classes}
              qrTokens={qrTokens}
              schoolName={siteContent.schoolName}
              onRegenerateStudentQr={handleRegenerateStudentQr}
              onBulkRegenerateQr={handleBulkRegenerateQr}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'id-cards' && (
            <StudentIdCardsView
              students={students}
              teachers={teachers}
              classes={classes}
              settings={settings}
              tagline={siteContent.tagline}
            />
          )}

          {activePage === 'scan-attendance' && (
            <ScannerView
              userProfile={userProfile}
              students={students}
              teachers={teachers}
              classes={classes}
              qrTokens={qrTokens}
              attendance={attendance}
              teacherAttendance={teacherAttendance}
              settings={settings}
              onProcessQrScan={handleProcessQrScan}
            />
          )}

          {activePage === 'attendance-data' && (
            <AttendanceDataView
              userProfile={userProfile}
              students={students}
              teachers={teachers}
              classes={classes}
              attendance={attendance}
              teacherAttendance={teacherAttendance}
              auditLogs={auditLogs}
              settings={settings}
              onUpdateAttendanceManual={handleUpdateAttendanceManual}
              onRecordTeacherScanOrSelf={handleRecordTeacherScanOrSelf}
              onUpdateTeacherAttendanceManual={handleUpdateTeacherAttendanceManual}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'attendance-reports' && (
            <AttendanceReportsView
              userProfile={userProfile}
              students={students}
              teachers={teachers}
              classes={classes}
              attendance={attendance}
              teacherAttendance={teacherAttendance}
              settings={settings}
            />
          )}

          {activePage === 'notifications' && (
            <NotificationsView
              userProfile={userProfile}
              notificationLogs={notificationLogs}
              settings={settings}
              onRetryNotification={handleRetryNotification}
              onSaveTemplate={handleSaveTemplate}
            />
          )}

          {activePage === 'settings' && (
            <SettingsView
              userProfile={userProfile}
              settings={settings}
              academicYears={academicYears}
              auditLogs={auditLogs}
              onSaveSettings={handleSaveSettings}
              onAddAcademicYear={handleAddAcademicYear}
              onActivateAcademicYear={handleActivateAcademicYear}
              teacherCount={teachers.length}
              studentCount={students.length}
              onResetSchoolData={handleResetData}
            />
          )}

          {activePage === 'profile' && (
            <ProfileView
              userProfile={userProfile}
              classes={classes}
              onUpdateProfile={handleUpdateProfile}
            />
          )}
        </main>

        <footer className="px-4 lg:px-8 py-4 bg-white border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 no-print">
          <span>
            © 2026 {siteContent.schoolName} — {siteContent.appTitle}
          </span>
          <span>
            Tagline: &ldquo;{siteContent.tagline}&rdquo; · NPSN {siteContent.npsn}
          </span>
        </footer>
      </div>
    </div>
  );
}
