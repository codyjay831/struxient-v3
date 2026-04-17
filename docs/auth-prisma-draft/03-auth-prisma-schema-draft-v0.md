# Auth Prisma Schema Draft v0

**Status:** First draft of the auth models in Prisma syntax.

```prisma
// -----------------------------------------------------------------------------
// ENUMS
// -----------------------------------------------------------------------------

enum AccountStatus {
  ACTIVE
  SUSPENDED
}

enum MembershipStatus {
  ACTIVE
  DEACTIVATED
}

enum PortalAccountStatus {
  INVITED
  ACTIVE
  DISABLED
}

enum InviteStatus {
  PENDING
  ACCEPTED
  REVOKED
  EXPIRED
}

enum InviteType {
  STAFF
  PORTAL
}

enum AuthTokenPurpose {
  INVITE
  MAGIC_LINK
  PASSWORD_RESET
  EMAIL_VERIFY
}

enum CredentialType {
  PASSWORD
  OAUTH_GOOGLE
  OAUTH_MICROSOFT
}

enum AuthEventType {
  LOGIN_SUCCESS
  LOGIN_FAILURE
  PASSWORD_CHANGE
  MFA_SETUP
  INVITE_SENT
  INVITE_ACCEPTED
}

// -----------------------------------------------------------------------------
// INTERNAL AUTH MODELS (STAFF)
// -----------------------------------------------------------------------------

model Account {
  id          String         @id @default(cuid())
  email       String         @unique
  name        String
  status      AccountStatus  @default(ACTIVE)
  mfaSecret   String?        // Encrypted at rest
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  credentials AccountCredential[]
  memberships TenantMembership[]
  sessions    InternalSession[]
  tokens      AuthToken[]
}

model AccountCredential {
  id          String         @id @default(cuid())
  accountId   String
  hashedValue String
  type        CredentialType @default(PASSWORD)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  account     Account        @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([accountId, type])
}

model TenantMembership {
  id          String           @id @default(cuid())
  accountId   String
  tenantId    String
  status      MembershipStatus @default(ACTIVE)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  account     Account          @relation(fields: [accountId], references: [id], onDelete: Cascade)
  tenant      Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  roles       MembershipRole[]
  sessions    InternalSession[]

  @@unique([accountId, tenantId])
  @@index([tenantId, status])
}

model MembershipRole {
  id           String           @id @default(cuid())
  membershipId String
  roleKey      String           // e.g., "ADMIN", "OFFICE", "ESTIMATOR", "FIELD"
  createdAt    DateTime         @default(now())

  membership   TenantMembership @relation(fields: [membershipId], references: [id], onDelete: Cascade)

  @@unique([membershipId, roleKey])
}

model InternalSession {
  id           String           @id @default(cuid())
  tokenHash    String           @unique
  accountId    String
  membershipId String
  tenantId     String
  expiresAt    DateTime
  ipAddress    String?
  userAgent    String?
  createdAt    DateTime         @default(now())

  account      Account          @relation(fields: [accountId], references: [id], onDelete: Cascade)
  membership   TenantMembership @relation(fields: [membershipId], references: [id], onDelete: Cascade)

  @@index([accountId, expiresAt])
  @@index([membershipId])
}

// -----------------------------------------------------------------------------
// CUSTOMER PORTAL MODELS
// -----------------------------------------------------------------------------

model PortalAccount {
  id            String              @id @default(cuid())
  contactId     String              @unique
  customerId    String
  tenantId      String
  status        PortalAccountStatus @default(INVITED)
  lastLoginAt   DateTime?
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  contact       Contact             @relation(fields: [contactId], references: [id], onDelete: Cascade)
  customer      Customer            @relation(fields: [customerId], references: [id], onDelete: Cascade)
  tenant        Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  sessions      PortalSession[]
  tokens        AuthToken[]

  @@index([customerId, status])
}

model PortalSession {
  id              String        @id @default(cuid())
  tokenHash       String        @unique
  portalAccountId String
  customerId      String
  tenantId        String
  expiresAt       DateTime
  ipAddress       String?
  userAgent       String?
  createdAt       DateTime      @default(now())

  portalAccount   PortalAccount @relation(fields: [portalAccountId], references: [id], onDelete: Cascade)

  @@index([portalAccountId, expiresAt])
}

// -----------------------------------------------------------------------------
// ONBOARDING & SHARED UTILITIES
// -----------------------------------------------------------------------------

model Invite {
  id              String       @id @default(cuid())
  email           String
  tenantId        String
  type            InviteType
  targetRoles     String[]     // For STAFF type
  targetContactId String?      // For PORTAL type
  status          InviteStatus @default(PENDING)
  expiresAt       DateTime
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  tenant          Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([email, tenantId, type])
}

model AuthToken {
  id              String           @id @default(cuid())
  tokenHash       String           @unique
  purpose         AuthTokenPurpose
  email           String           // Email for fallback lookup
  accountId       String?
  portalAccountId String?
  usedAt          DateTime?
  expiresAt       DateTime
  createdAt       DateTime         @default(now())

  account         Account?         @relation(fields: [accountId], references: [id], onDelete: SetNull)
  portalAccount   PortalAccount?   @relation(fields: [portalAccountId], references: [id], onDelete: SetNull)

  @@index([tokenHash, usedAt])
}

model AuthAuditEvent {
  id              String        @id @default(cuid())
  type            AuthEventType
  accountId       String?
  portalAccountId String?
  tenantId        String?
  ipAddress       String?
  metadata        Json?
  createdAt       DateTime      @default(now())

  @@index([accountId, createdAt])
  @@index([portalAccountId, createdAt])
}

// -----------------------------------------------------------------------------
// MINIMAL EXTERNAL REFERENCES (Placeholder/Existing)
// -----------------------------------------------------------------------------

// model Tenant {
//   id        String             @id
//   memberships TenantMembership[]
//   invites     Invite[]
//   portalAccounts PortalAccount[]
// }

// model Customer {
//   id        String             @id
//   portalAccounts PortalAccount[]
// }

// model Contact {
//   id        String             @id
//   portalAccount PortalAccount?
// }
```
