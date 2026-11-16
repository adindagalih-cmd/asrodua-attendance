# Security Specification — ASRODUA SMART ATTENDANCE

## 1. Data Invariants
1. **No Unauthenticated Access to Sensitive Data**: Every read and write across `/users`, `/students`, `/teachers`, `/classes`, `/qrTokens`, `/attendance`, `/teacherAttendance`, `/attendanceSettings`, `/notificationLogs`, `/auditLogs`, and `/academicYears` requires `request.auth != null` and `request.auth.token.email_verified == true`. Non-PII public portal metadata in `/siteContent` and published school notices in `/announcements` (`isPublished == true`) are readable on the public portal while writes strictly require `ADMIN_SEKOLAH` or `SUPER_ADMIN`.
2. **Role-Based Access Control (RBAC)**:
   - Bootstrapped Super Admin (`adindagalih@gmail.com`) and users with `role == 'SUPER_ADMIN'` in `/users/$(request.auth.uid)` have full administrative access including user role management.
   - `ADMIN_SEKOLAH` can manage `siteContent`, `announcements`, `students`, `teachers`, `classes`, `qrTokens`, `attendance`, `teacherAttendance`, `attendanceSettings` (including `principalEmail`), `academicYears`, and `notificationLogs`.
   - `KEPALA_SEKOLAH` (verified via `users` role or matching `attendanceSettings/global.principalEmail` with `email_verified == true`) has school-wide read/monitoring access across dashboards, student & teacher attendance, students, teachers, classes, notifications, and audit logs, and can record teacher attendance or update their own profile.
   - `GURU` can read school data, scan QR tokens, record/update student & teacher attendance (`verifiedByUid == request.auth.uid`), and create audit/notification logs.
3. **Strict Schema & Key Validation**: Every `create` and `update` must pass its corresponding `isValid[Entity](incoming())` helper, enforcing exact keys (`hasAll` + `hasOnly`), string length bounds (`.size() <= MAX`), and enum constraints.
4. **Immutable Audit Trail**: `auditLogs` are append-only (`allow update, delete: if false;`) and `actorUid` must match `request.auth.uid`.
5. **Path Variable Hardening**: Every single-document operation (`get`, `create`, `update`, `delete`) validates its path ID using `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).

## 2. The "Dirty Dozen" Payloads

1. **Unverified Email Admin Spoof**:
   `{ "auth": { "uid": "attacker1", "token": { "email": "adindagalih@gmail.com", "email_verified": false } }, "collection": "users/attacker1", "payload": { "role": "SUPER_ADMIN" } }` -> `PERMISSION_DENIED`
2. **Self-Privilege Escalation on User Update**:
   `{ "auth": { "uid": "guru1" }, "collection": "users/guru1", "payload": { "role": "SUPER_ADMIN" } }` -> `PERMISSION_DENIED`
3. **Shadow Field Injection on Student**:
   `{ "collection": "students/std_01", "payload": { "...validFields", "isHacked": true } }` -> `PERMISSION_DENIED`
4. **Oversized String DoS on Student Name**:
   `{ "collection": "students/std_01", "payload": { "fullName": "A".repeat(500) } }` -> `PERMISSION_DENIED`
5. **Invalid Gender Enum on Student**:
   `{ "collection": "students/std_01", "payload": { "gender": "X" } }` -> `PERMISSION_DENIED`
6. **Public Unauthenticated QR Token Read**:
   `{ "auth": null, "collection": "qrTokens/tok_01", "op": "get" }` -> `PERMISSION_DENIED`
7. **Invalid Attendance Status Enum**:
   `{ "collection": "attendance/2026-11-15_std_01", "payload": { "status": "BOLOS" } }` -> `PERMISSION_DENIED`
8. **Attendance Actor Spoofing**:
   `{ "auth": { "uid": "guru1" }, "collection": "attendance/2026-11-15_std_01", "payload": { "verifiedByUid": "admin99" } }` -> `PERMISSION_DENIED`
9. **Audit Log Tampering (Update)**:
   `{ "auth": { "uid": "admin1" }, "collection": "auditLogs/aud_01", "op": "update", "payload": { "reason": "covered up" } }` -> `PERMISSION_DENIED`
10. **Audit Log Deletion**:
    `{ "auth": { "uid": "admin1" }, "collection": "auditLogs/aud_01", "op": "delete" }` -> `PERMISSION_DENIED`
11. **Audit Log Identity Spoofing**:
    `{ "auth": { "uid": "guru1" }, "collection": "auditLogs/aud_02", "op": "create", "payload": { "actorUid": "other_uid" } }` -> `PERMISSION_DENIED`
12. **Teacher Modifying School Operational Hours**:
    `{ "auth": { "uid": "guru1" }, "collection": "attendanceSettings/global", "op": "update", "payload": { "checkInDeadline": "10:00" } }` -> `PERMISSION_DENIED`
