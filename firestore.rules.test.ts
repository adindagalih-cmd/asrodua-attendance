/**
 * Security Rules Dirty Dozen Verification Suite — ASRODUA SMART ATTENDANCE
 */
export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unverified Email Admin Spoof',
    collection: 'users/attacker1',
    operation: 'create',
    auth: { uid: 'attacker1', email: 'adindagalih@gmail.com', email_verified: false },
    payload: { uid: 'attacker1', role: 'SUPER_ADMIN' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Self-Privilege Escalation on User Update',
    collection: 'users/guru1',
    operation: 'update',
    auth: { uid: 'guru1', email: 'guru1@sdnasemrowo2.sch.id', email_verified: true },
    payload: { role: 'SUPER_ADMIN' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Student',
    collection: 'students/std_01',
    operation: 'create',
    auth: { uid: 'admin1', email: 'adindagalih@gmail.com', email_verified: true },
    payload: { id: 'std_01', isHacked: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Oversized String DoS on Student Name',
    collection: 'students/std_01',
    operation: 'create',
    auth: { uid: 'admin1', email: 'adindagalih@gmail.com', email_verified: true },
    payload: { id: 'std_01', fullName: 'X'.repeat(500) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Invalid Gender Enum on Student',
    collection: 'students/std_01',
    operation: 'create',
    auth: { uid: 'admin1', email: 'adindagalih@gmail.com', email_verified: true },
    payload: { id: 'std_01', gender: 'INVALID' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Public Unauthenticated QR Token Read',
    collection: 'qrTokens/tok_01',
    operation: 'get',
    auth: null,
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Invalid Attendance Status Enum',
    collection: 'attendance/2026-11-15_std_01',
    operation: 'create',
    auth: { uid: 'guru1', email: 'guru1@sdnasemrowo2.sch.id', email_verified: true },
    payload: { id: '2026-11-15_std_01', status: 'BOLOS' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Attendance Actor Spoofing',
    collection: 'attendance/2026-11-15_std_01',
    operation: 'create',
    auth: { uid: 'guru1', email: 'guru1@sdnasemrowo2.sch.id', email_verified: true },
    payload: { id: '2026-11-15_std_01', verifiedByUid: 'spoofed_uid' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Audit Log Tampering (Update)',
    collection: 'auditLogs/aud_01',
    operation: 'update',
    auth: { uid: 'admin1', email: 'adindagalih@gmail.com', email_verified: true },
    payload: { reason: 'modified' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Audit Log Deletion',
    collection: 'auditLogs/aud_01',
    operation: 'delete',
    auth: { uid: 'admin1', email: 'adindagalih@gmail.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Audit Log Identity Spoofing',
    collection: 'auditLogs/aud_02',
    operation: 'create',
    auth: { uid: 'guru1', email: 'guru1@sdnasemrowo2.sch.id', email_verified: true },
    payload: { id: 'aud_02', actorUid: 'admin1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Teacher Modifying School Operational Hours',
    collection: 'attendanceSettings/global',
    operation: 'update',
    auth: { uid: 'guru1', email: 'guru1@sdnasemrowo2.sch.id', email_verified: true },
    payload: { checkInDeadline: '10:00' },
    expectedResult: 'PERMISSION_DENIED',
  },
];
