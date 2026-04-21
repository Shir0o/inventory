# Security Measures: Authentication & Authorization

This document outlines the security measures implemented to protect the Inventory System from unauthorized access.

## 1. Strict Authentication Policy

The system follows a "Deny by Default" approach for all authentication attempts.

- **Pre-Authorized Access Only**: Users cannot simply sign up or register. An administrator must first add the user's Google account email to the `authorized_emails` collection in Firestore.
- **Immediate Rejection**: Any user not found in the `authorized_emails` list (or not the primary administrator) is immediately signed out of Firebase Auth upon their first login attempt.
- **No Guest Auto-Registration**: Previous "guest" auto-registration has been disabled. Unauthorized users are never granted a profile or access to any part of the application beyond the login page.

## 2. Role-Based Access Control (RBAC)

Authorization is determined by roles assigned *at the time of invitation*.

- **Pre-Assigned Roles**: When an admin authorizes an email, they must specify a role (`admin` or `user`).
- **Profile Integrity**: During the first successful login, the system creates the user's profile with the exact role pre-assigned by the administrator. This role cannot be modified by the user.
- **Administrative Override**: A primary administrator email (`yilongwang05@gmail.com`) is hardcoded in security rules as a root admin to ensure system recoverability.

## 3. Firestore Security Rules

Security is enforced at the database level to ensure that even if the frontend is bypassed, data remains protected.

- **User Profile Creation**: Rules strictly enforce that a document in the `users` collection can only be created if:
    1. The requester is authenticated.
    2. The requester owns the UID of the document.
    3. The requester's email is present in the `authorized_emails` collection.
    4. The `role` being set matches the role pre-authorized by the administrator.
- **Data Isolation**:
    - **Inventory/Events**: Read access is restricted to `admin` and `user` roles. Write access is restricted to `admin` only.
    - **Authorized Emails**: Only `admin` roles can read/write the list of authorized emails.
    - **Audit Logs**: Only `admin` roles can read the paper trail.

## 4. Automated Security Testing

A Vitest suite has been integrated to ensure these security measures remain effective during future development.

- **Tests Location**: `src/context/FirebaseContext.test.tsx`
- **Coverage**:
    - Verifies unauthenticated users are redirected to login.
    - Verifies unauthorized users are immediately signed out.
    - Verifies authorized users are correctly identified and granted access.
    - Verifies role-based UI restriction (e.g., hiding admin-only tabs from regular users).

## 5. Deployment Instructions

When deploying changes to Firestore, ensure the `firestore.rules` file is updated to include the new logic:

```bash
firebase deploy --only firestore:rules
```
