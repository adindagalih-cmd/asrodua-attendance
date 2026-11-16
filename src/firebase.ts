import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { FirestoreErrorInfo, OperationType } from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Validate connection to Firestore on boot as required by firebase-integration-rpc skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Defensive Payload Sanitization Helpers matching firebase-blueprint.json
export function sanitizeString(val: unknown, maxLength: number, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  return val.trim().slice(0, maxLength);
}

export function sanitizeId(val: string): string {
  const cleaned = val.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}

export function generateSecureQrToken(studentId: string, version = 1): {
  tokenId: string;
  tokenString: string;
} {
  const randomBytes = new Uint8Array(12);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 12; i++) randomBytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  const cleanStd = sanitizeId(studentId).slice(0, 20);
  const tokenId = sanitizeId(`ASR2_${cleanStd}_V${version}_${hex.slice(0, 12)}`);
  // QR payload never contains personal student data — only opaque cryptographic verification token
  const tokenString = `ASRODUA::v${version}::${tokenId}::${hex}`;
  return { tokenId, tokenString };
}

export function getTeacherQrCodeId(teacherId: string, nip = ''): string {
  const cleanId = sanitizeId(teacherId).toUpperCase().slice(0, 24);
  const nipSuffix = nip.replace(/[^0-9]/g, '').slice(-4) || '0063';
  return sanitizeId(`QRT_GURU_${cleanId}_${nipSuffix}`);
}

export function getTeacherQrToken(teacherId: string, nip = ''): string {
  const qrCodeId = getTeacherQrCodeId(teacherId, nip);
  const cleanId = sanitizeId(teacherId);
  return `ASRODUA::GURU::${cleanId}::${qrCodeId}`;
}

export function generateSecureTeacherQrToken(teacherId: string, version = 1): {
  tokenId: string;
  tokenString: string;
} {
  const randomBytes = new Uint8Array(12);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 12; i++) randomBytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  const cleanTch = sanitizeId(teacherId).slice(0, 20);
  const tokenId = sanitizeId(`ASR2_GURU_${cleanTch}_V${version}_${hex.slice(0, 12)}`);
  const tokenString = `ASRODUA::GURU::v${version}::${tokenId}::${hex}`;
  return { tokenId, tokenString };
}

export function resolveTeacherQrData(teacher: {
  id: string;
  nip?: string;
  qrCodeId?: string;
  qrToken?: string;
}): {
  qrCodeId: string;
  qrToken: string;
  isPersistent: boolean;
} {
  if (teacher.qrCodeId && teacher.qrToken) {
    return {
      qrCodeId: teacher.qrCodeId,
      qrToken: teacher.qrToken,
      isPersistent: true,
    };
  }
  return {
    qrCodeId: getTeacherQrCodeId(teacher.id, teacher.nip || ''),
    qrToken: getTeacherQrToken(teacher.id, teacher.nip || ''),
    isPersistent: false,
  };
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeString(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function formatIndonesianDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const months = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    if (!y || !m || !d) return dateStr;
    return `${d} ${months[m - 1]} ${y}`;
  } catch {
    return dateStr;
  }
}

export function formatWhatsAppMessage(
  template: string,
  params: {
    studentName: string;
    className: string;
    status: string;
    time: string;
    date: string;
  }
): string {
  return template
    .replace(/\[Nama Siswa\]/g, params.studentName)
    .replace(/\[Kelas\]/g, params.className)
    .replace(/\[Status\]/g, params.status)
    .replace(/HADIR/g, params.status)
    .replace(/\[Jam Kehadiran\]/g, params.time)
    .replace(/\[Tanggal\]/g, formatIndonesianDate(params.date))
    .slice(0, 1500);
}
