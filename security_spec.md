# Security Specification - Lit-Ledger Matrix

## 1. Data Invariants
- **Inventory Integrity**: Stock levels must never be negative.
- **Relational Consistency**: An Event Material cannot exist without a valid Item ID in the inventory.
- **Identity Lock**: Once a user is created, their `email` is immutable.
- **Role Authority**: Only Admins can modify stock levels or create events. Users are read-only for primary ledger data.
- **Admin Bootstrapping**: `YilongWang05@gmail.com` (Verified) is the root administrator.

## 2. The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempting to create a user profile with `role: 'admin'` as a guest.
2. **Shadow Field Injection**: Adding `isAuthorized: true` to an Inventory Item creation.
3. **Negative Stock**: Updating an item with `stockLevel: -10`.
4. **Stale Timestamp**: Sending a `createdAt` or `updatedAt` that is in the past or future (not `request.time`).
5. **ID Poisoning**: Using a 10KB string as a `materialId` to cause storage bloating.
6. **Self-Promotion**: An existing 'user' attempting to update their own `role` to 'admin'.
7. **Orphaned Material**: Creating an `EventMaterial` that references a non-existent `itemId`.
8. **Malicious Regex**: Injecting script tags into `displayName` or `location`.
9. **Status Jumping**: Updating an event status from 'Scheduled' to 'Completed' without passing through intermediate logic (if enforced).
10. **Bulk Scrape**: Attempting to list all `users` as a non-admin (PII Leak).
11. **System Setting Sabotage**: A non-admin attempting to change the `orgName`.
12. **Circular Auth**: Exploiting registration to bypass the `authorized_emails` whitelist.

## 3. Test Runner Concept
The `firestore.rules` will be verified against these scenarios using the Firebase Emulator suite (local).

---

## Conflict Report & Audit

| Risk | Status | Mitigation Strategy |
| :--- | :--- | :--- |
| **Identity Spoofing** | AT RISK | Rules currently use `hasAll` but lack `hasOnly` on identity objects. |
| **State Shortcutting** | PARTIAL | Basic enums used, but terminal state locking is missing. |
| **Resource Poisoning** | AT RISK | `isValidId()` helper is missing for path variables. |
| **Value Poisoning** | AT RISK | Missing `.size()` checks on many string fields. |
| **Temporal Integrity** | FAIL | Timestamps are not validated against `request.time`. |
