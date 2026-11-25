# Database Schema & Data Dictionary

## 1. Storage & Engine Overview
- **RDBMS**: PostgreSQL 19
- **ORM**: Prisma Client
- **Primary Keys**: UUID v4
- **Timestamps**: `TIMESTAMPTZ` (UTC)
- **Monetary Values**: `DECIMAL(14, 2)` (Fixed-point, floating point is strictly forbidden)

## 2. Database Entities

### 2.1 User
- `id` (UUID, PK)
- `fullName` (VARCHAR(100), NOT NULL)
- `email` (VARCHAR(255), UNIQUE, NOT NULL, Lowercase normalized)
- `phone` (VARCHAR(20), NULLABLE)
- `passwordHash` (VARCHAR(255), NOT NULL)
- `role` (ENUM: `USER`, `AGENT`, `ADMIN`, `SUPER_ADMIN`, DEFAULT: `USER`)
- `accountStatus` (ENUM: `ACTIVE`, `SUSPENDED`, `DEACTIVATED`, DEFAULT: `ACTIVE`)
- `emailVerified` (BOOLEAN, DEFAULT: FALSE)
- `phoneVerified` (BOOLEAN, DEFAULT: FALSE)
- `profileImage` (TEXT, NULLABLE)
- `createdAt` (TIMESTAMPTZ, DEFAULT: NOW())
- `updatedAt` (TIMESTAMPTZ, AUTO)
- `deletedAt` (TIMESTAMPTZ, NULLABLE, Soft Delete)

### 2.2 RefreshSession
- `id` (UUID, PK)
- `userId` (UUID, FK -> User.id ON DELETE CASCADE)
- `tokenHash` (VARCHAR(64), NOT NULL)
- `deviceInfo` (VARCHAR(255), NULLABLE)
- `ipAddress` (VARCHAR(45), NULLABLE)
- `expiresAt` (TIMESTAMPTZ, NOT NULL)
- `revokedAt` (TIMESTAMPTZ, NULLABLE)
- `createdAt` (TIMESTAMPTZ, DEFAULT: NOW())
- `updatedAt` (TIMESTAMPTZ, AUTO)

### 2.3 Property
- `id` (UUID, PK)
- `ownerId` (UUID, FK -> User.id ON DELETE RESTRICT)
- `title` (VARCHAR(255), NOT NULL)
- `slug` (VARCHAR(300), UNIQUE, NOT NULL)
- `description` (TEXT, NOT NULL)
- `propertyType` (ENUM: `APARTMENT`, `HOUSE`, `VILLA`, `PLOT`, `COMMERCIAL`, `OFFICE`, `SHOP`, `OTHER`)
- `listingType` (ENUM: `SALE`, `RENT`, `LEASE`)
- `price` (DECIMAL(14, 2), NOT NULL)
- `negotiable` (BOOLEAN, DEFAULT: FALSE)
- `bedrooms` (INT, DEFAULT: 0)
- `bathrooms` (INT, DEFAULT: 0)
- `balconies` (INT, DEFAULT: 0)
- `builtUpArea` (DECIMAL(10, 2), NULLABLE)
- `carpetArea` (DECIMAL(10, 2), NOT NULL)
- `plotArea` (DECIMAL(10, 2), NULLABLE)
- `areaUnit` (VARCHAR(20), DEFAULT: 'sqft')
- `floorNumber` (INT, NULLABLE)
- `totalFloors` (INT, NULLABLE)
- `furnishingStatus` (ENUM: `UNFURNISHED`, `SEMI_FURNISHED`, `FULLY_FURNISHED`)
- `possessionStatus` (ENUM: `READY_TO_MOVE`, `UNDER_CONSTRUCTION`)
- `constructionStatus` (VARCHAR(50), NULLABLE)
- `propertyAge` (VARCHAR(50), NULLABLE)
- `facing` (VARCHAR(50), NULLABLE)
- `parkingSpaces` (INT, DEFAULT: 0)
- `city` (VARCHAR(100), NOT NULL)
- `locality` (VARCHAR(100), NOT NULL)
- `state` (VARCHAR(100), NOT NULL)
- `country` (VARCHAR(100), DEFAULT: 'India')
- `postalCode` (VARCHAR(20), NOT NULL)
- `latitude` (DECIMAL(10, 7), NULLABLE)
- `longitude` (DECIMAL(10, 7), NULLABLE)
- `address` (TEXT, NOT NULL)
- `landmark` (VARCHAR(255), NULLABLE)
- `status` (ENUM: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `SOLD`, `RENTED`, `ARCHIVED`, DEFAULT: `DRAFT`)
- `rejectionReason` (TEXT, NULLABLE)
- `verifiedAt` (TIMESTAMPTZ, NULLABLE)
- `publishedAt` (TIMESTAMPTZ, NULLABLE)
- `createdAt` (TIMESTAMPTZ, DEFAULT: NOW())
- `updatedAt` (TIMESTAMPTZ, AUTO)
- `deletedAt` (TIMESTAMPTZ, NULLABLE)

### 2.4 PropertyImage
- `id` (UUID, PK)
- `propertyId` (UUID, FK -> Property.id ON DELETE CASCADE)
- `storageKey` (VARCHAR(255), NOT NULL)
- `imageUrl` (TEXT, NOT NULL)
- `thumbnailUrl` (TEXT, NULLABLE)
- `altText` (VARCHAR(255), NULLABLE)
- `displayOrder` (INT, DEFAULT: 0)
- `isPrimary` (BOOLEAN, DEFAULT: FALSE)
- `createdAt` (TIMESTAMPTZ, DEFAULT: NOW())

### 2.5 Amenity & PropertyAmenity
- `Amenity`: `id` (UUID), `name` (UNIQUE), `slug` (UNIQUE), `icon` (NULLABLE)
- `PropertyAmenity`: `propertyId`, `amenityId` (Composite PK: `[propertyId, amenityId]`)

### 2.6 Favorite
- `id` (UUID, PK)
- `userId` (UUID, FK -> User.id ON DELETE CASCADE)
- `propertyId` (UUID, FK -> Property.id ON DELETE CASCADE)
- `createdAt` (TIMESTAMPTZ, DEFAULT: NOW())
- **Constraint**: UNIQUE(`userId`, `propertyId`)

### 2.7 Inquiry
- `id` (UUID, PK)
- `propertyId` (UUID, FK -> Property.id ON DELETE CASCADE)
- `buyerId` (UUID, FK -> User.id ON DELETE SET NULL, NULLABLE)
- `ownerId` (UUID, FK -> User.id ON DELETE CASCADE)
- `name` (VARCHAR(100), NOT NULL)
- `email` (VARCHAR(255), NOT NULL)
- `phone` (VARCHAR(20), NOT NULL)
- `message` (TEXT, NOT NULL)
- `inquiryStatus` (ENUM: `NEW`, `CONTACTED`, `IN_PROGRESS`, `CLOSED`, `SPAM`, DEFAULT: `NEW`)
- `source` (VARCHAR(50), DEFAULT: 'WEBSITE')
- `createdAt` (TIMESTAMPTZ, DEFAULT: NOW())
- `updatedAt` (TIMESTAMPTZ, AUTO)

### 2.8 ModerationHistory & AuditLog & Notification
- `ModerationHistory`: `propertyId`, `adminId`, `action`, `previousStatus`, `newStatus`, `reason`, `createdAt`.
- `AuditLog`: `actorId`, `action`, `entityType`, `entityId`, `metadata` (JSONB), `ipAddress`, `createdAt`.
- `Notification`: `userId`, `type`, `title`, `message`, `metadata` (JSONB), `readAt`, `createdAt`.

