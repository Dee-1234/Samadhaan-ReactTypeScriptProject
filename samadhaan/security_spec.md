# Security Specification: Samadhaan (Hyperlocal Problem Solver)

## 1. Data Invariants

1. **Identity & Profile Integrity**:
   - A user's profile under `/users/{userId}` can only be created or modified if `{userId}` is identical to `request.auth.uid`.
   - The user's `role` cannot be modified by the user themselves once set, or can only be set to `citizen` initially by the client. Role promotion to `municipal_agent` or `admin` is forbidden for self-service profiles.

2. **Report (Issue) Lifecycle & State Transitions**:
   - Creating a report under `/reports/{reportId}` requires `reporterId` to match the authenticated user's ID.
   - `status` must be initialized to `"Reported"` upon creation.
   - Citizens can never update the `status` or edit the municipal responses once created. Only users with the role `municipal_agent` or `admin` can transition status (e.g., `"Reported"` -> `"Investigating"` -> `"In Progress"` -> `"Resolved"`).
   - Once an issue's status is set to `"Resolved"`, it enters a terminal state and cannot be changed back by citizens.

3. **Verifications & Comments Security**:
   - Subcollections under `/reports/{reportId}` inherit access rules from parent reports.
   - Adding a verification under `/reports/{reportId}/verifications/{verificationId}` requires that the verification `userId` matches the signed-in user's UID.
   - Citizens cannot modify or delete other citizens' verifications or comments.

---

## 2. The "Dirty Dozen" Payloads

Here are 12 malicious or invalid payloads designed to break these invariants and exploit security. The `firestore.rules` must reject all of them with `PERMISSION_DENIED`.

### Payload 1: Self-Promote to Municipal Agent (Identity Spoofing)
*Attempt*: Citizen tries to register/update their profile with `role: "municipal_agent"`.
```json
// path: /users/citizen_uid_123 (by request.auth.uid = "citizen_uid_123")
{
  "uid": "citizen_uid_123",
  "email": "malicious@gmail.com",
  "displayName": "Malicious User",
  "photoURL": "https://avatar.com/1",
  "role": "municipal_agent",
  "points": 5000,
  "reportsCount": 0,
  "verificationsCount": 0,
  "createdAt": "2026-06-25T20:00:00Z",
  "updatedAt": "2026-06-25T20:00:00Z"
}
```

### Payload 2: Write User Profile for Someone Else (Identity Hijacking)
*Attempt*: User `uid_A` tries to update the profile of User `uid_B`.
```json
// path: /users/uid_B (by request.auth.uid = "uid_A")
{
  "displayName": "Hijacked Name"
}
```

### Payload 3: Issue Report with Someone Else's Reporter ID (Identity Spoofing)
*Attempt*: User `uid_A` reports an issue but sets `reporterId` to `uid_B` to frame them or steal credit.
```json
// path: /reports/report_456 (by request.auth.uid = "uid_A")
{
  "id": "report_456",
  "title": "Blocked Sewer Line",
  "description": "Nasty sewage overflow on Elm Street.",
  "category": "Water Leakage",
  "imageUrl": "https://images.com/leak.jpg",
  "latitude": 13.7563,
  "longitude": 100.5018,
  "address": "Elm St",
  "status": "Reported",
  "severity": "High",
  "reporterId": "uid_B",
  "reporterName": "Innocent Bystander",
  "upvotes": 0,
  "createdAt": "2026-06-25T20:00:00Z",
  "updatedAt": "2026-06-25T20:00:00Z"
}
```

### Payload 4: Premature Resolution of Issue (State Shortcut)
*Attempt*: Citizen creates an issue but sets status to `"Resolved"` immediately to artificially boost completion metrics.
```json
// path: /reports/report_789 (by request.auth.uid = "uid_A")
{
  "id": "report_789",
  "title": "Broken Sidewalk",
  "description": "Sidewalk tiles are cracked.",
  "category": "Public Infrastructure",
  "imageUrl": "https://images.com/crack.jpg",
  "latitude": 13.7563,
  "longitude": 100.5018,
  "address": "45 Oak Road",
  "status": "Resolved",
  "severity": "Medium",
  "reporterId": "uid_A",
  "reporterName": "User A",
  "upvotes": 0,
  "createdAt": "2026-06-25T20:00:00Z",
  "updatedAt": "2026-06-25T20:00:00Z"
}
```

### Payload 5: Deny-of-Wallet Resource Poisoning (ID Injection)
*Attempt*: Attacker attempts to inject an extremely long, malicious string as a document ID.
```json
// path: /reports/VERY_LONG_STRING_OF_1000_CHARACTERS...
{
  "title": "Spam Issue"
}
```

### Payload 6: Mutate CreatedAt Timestamp (Temporal Tampering)
*Attempt*: User tries to update `createdAt` to backdate an issue reporting time.
```json
// path: /reports/report_111 (by request.auth.uid = "uid_A")
{
  "createdAt": "2020-01-01T00:00:00Z"
}
```

### Payload 7: Upvote count manipulation
*Attempt*: Citizen directly updates the report's `upvotes` field by adding 100 votes themselves.
```json
// path: /reports/report_111 (by request.auth.uid = "uid_A")
{
  "upvotes": 100
}
```

### Payload 8: Fake verification from another user (Identity Spoofing)
*Attempt*: User `uid_A` tries to log a verification under another user's identity.
```json
// path: /reports/report_111/verifications/v_111 (by request.auth.uid = "uid_A")
{
  "id": "v_111",
  "userId": "uid_B",
  "userName": "User B",
  "createdAt": "2026-06-25T20:00:00Z"
}
```

### Payload 9: Hijack comment under another user's identity
*Attempt*: User `uid_A` posts a comment pretending to be a municipal agent.
```json
// path: /reports/report_111/comments/c_111 (by request.auth.uid = "uid_A")
{
  "id": "c_111",
  "userId": "uid_A",
  "userName": "User A",
  "userRole": "municipal_agent",
  "text": "Issue resolved, thanks!",
  "createdAt": "2026-06-25T20:00:00Z"
}
```

### Payload 10: Inject invalid category type (Resource Poisoning)
*Attempt*: User submits a report with an unapproved or massive text category.
```json
// path: /reports/report_111 (by request.auth.uid = "uid_A")
{
  "category": "ExtremelyLongInvalidCategoryNameThatDoesNotMatchAnyExpectedPotholeOrInfrastructureValues..."
}
```

### Payload 11: Spoofed Server Timestamps
*Attempt*: User tries to submit local client timestamp instead of server timestamp.
```json
// path: /reports/report_111 (by request.auth.uid = "uid_A")
{
  "updatedAt": "2026-06-25T00:00:00Z" // Expecting request.time
}
```

### Payload 12: Read Private PII User Profile (PII Leak)
*Attempt*: Citizen trying to perform blanket reads or read private fields of other users' profiles.
```json
// path: /users/other_user_uid (by request.auth.uid = "citizen_uid_123")
// Action: get / read
```

---

## 3. Test Runner Specification

The Firestore security rules will be tested to verify that all the "Dirty Dozen" payloads fail validation and result in `PERMISSION_DENIED` errors. This is enforced directly within `firestore.rules` by matching keys, values, roles, and temporal invariants.
