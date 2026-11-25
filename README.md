# Real Estate Platform API & PostgreSQL Database

A production-ready, scalable, and secure RESTful backend API and PostgreSQL database engineered for high-volume real-estate listing platforms (inspired by 99acres, NoBroker, and MagicBricks).

Designed for seamless integration with both a public user-facing web portal and a dedicated administrative panel.

---

## 🌟 Key Architecture & Capabilities

- **Strict TypeScript & Express.js**: Modular domain-driven layered architecture.
- **PostgreSQL 19 & Prisma ORM**: Foreign keys, check constraints, composite unique indexes, and compound search indexes supporting 50,000+ listings.
- **Enterprise Authentication**:
  - JWT Access Tokens (15-minute expiration) with claims.
  - Refresh-token rotation stored as SHA-256 hashes in PostgreSQL.
  - Session compromise detection (immediate revocation of token family on reuse).
  - HttpOnly, Secure, SameSite=Strict cookie handling.
  - Bcrypt password hashing (12 salt rounds) with complexity enforcement.
  - Password reset flows via single-use hashed tokens.
- **Role-Based Access Control (RBAC)**:
  - Strict hierarchical permissions: `USER`, `AGENT`, `ADMIN`, `SUPER_ADMIN`.
  - IDOR & Ownership validation middleware for properties and inquiries.
- **Property Lifecycle & Media**:
  - Listing state machine (`DRAFT` → `PENDING_APPROVAL` → `APPROVED` → `SOLD` / `RENTED` / `ARCHIVED`).
  - Image gallery management (upload, reorder, primary image designation) with Local & Cloud storage abstraction.
  - Normalized many-to-many amenities catalog.
- **Search & Discovery Engine**:
  - Multi-attribute filtering (City, Locality, Property Type, Listing Type, Price ranges, Bedrooms, Carpet area, Amenities, Verified status).
  - Sort orders: Newest, Oldest, Price (low-to-high, high-to-low), Area (low-to-high, high-to-low).
  - Heuristic similar property recommendations.
- **Engagement & Anti-Spam**:
  - Favorites with duplicate protection.
  - Property inquiries with a 5-minute spam prevention window and IP rate limiting.
  - In-app notification event delivery to property owners.
- **Administrative Portal & Moderation**:
  - Statistical dashboard metrics with aggregated grouping.
  - Moderation queue with approve/reject workflows and audit trail.
  - User suspension and role elevation guards (super-admin only).
- **Swagger / OpenAPI Documentation**: Available at `/api-docs`.
- **Automated Testing Suite**: 30 automated unit, integration, and security tests.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Runtime & Language** | Node.js (v20+ LTS), TypeScript 5.8 (Strict Mode) |
| **Framework** | Express.js 4.21 |
| **Database & ORM** | PostgreSQL 19, Prisma Client 6.x |
| **Validation** | Zod 3.x |
| **Security** | Helmet, CORS, Express-Rate-Limit, Cookie-Parser, Bcrypt, JWT |
| **Documentation** | Swagger UI Express (OpenAPI 3.0) |
| **Testing** | Jest, Ts-Jest, Supertest |
| **Deployment** | Docker, Docker Compose |

---

## 📂 Project Structure

```
.
├── src/
│   ├── app.ts                 # Express application configuration & security middleware
│   ├── server.ts              # Server lifecycle and graceful shutdown hooks
│   ├── config/                # Environment validation, database client, logger, CORS
│   ├── common/
│   │   ├── middleware/        # Authenticate, authorize, validateRequest, rateLimiter, errorHandler
│   │   ├── utils/             # ApiResponse, ApiError, pagination, asyncHandler
│   │   └── types/             # Declaration merging and shared types
│   ├── modules/
│   │   ├── auth/              # Registration, login, token rotation, sessions
│   │   ├── users/             # Profile management, owner listings
│   │   ├── properties/        # Property CRUD, status transitions, images
│   │   ├── amenities/         # Amenities directory
│   │   ├── favorites/         # Bookmark management
│   │   ├── inquiries/         # Leads and anti-spam duplicate prevention
│   │   ├── locations/         # Indexed location search and autocomplete
│   │   ├── notifications/     # Notification events
│   │   ├── admin/             # Dashboard metrics, moderation, audit logs
│   │   └── health/            # Liveness and database connectivity probes
│   ├── services/
│   │   ├── storage/           # Local and cloud storage provider adapters
│   │   ├── email/             # Email delivery provider abstraction
│   │   └── security/          # JWT signing, cryptographic hashing
│   └── routes/                # Central API v1 routing registry
├── prisma/
│   ├── schema.prisma          # PostgreSQL schema and compound indexes
│   ├── migrations/            # Version-controlled migrations
│   ├── seed.ts                # Development seed (Admin, Agent, Users, Properties)
│   └── seed-50k.ts            # High-scale 50,000+ synthetic records generator
├── tests/
│   ├── unit/                  # Pagination, token hashing, regex validation tests
│   ├── integration/           # Auth, property lifecycle, favorites, inquiry tests
│   ├── security/              # 401 unauthenticated, 403 RBAC, IDOR, privilege escalation tests
│   └── helpers/               # Test database setup and isolation utilities
├── docs/                      # Architecture, database schema, endpoints, and deployment guides
├── Dockerfile                 # Multi-stage production container image
├── docker-compose.yml         # Containerized backend & PostgreSQL orchestration
└── package.json
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js >= 20.x LTS
- PostgreSQL >= 15.x (or Docker)

### 2. Installation
```bash
# Clone the repository
cd real-estate-Server

# Install dependencies
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` and configure your credentials:
```bash
cp .env.example .env
```

### 4. Database Migrations & Seeding
```bash
# Run migrations
npx prisma migrate dev

# Seed standard development data (Admin, Agents, Users, Properties, Inquiries)
npm run seed
```

### 5. Running the Application
```bash
# Development mode with hot-reload
npm run dev

# Production build and run
npm run build
npm start
```

### 6. Interactive Documentation & Health Probe
- **Swagger Documentation**: [http://localhost:5000/api-docs](http://localhost:5000/api-docs)
- **Health Check Probe**: [http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health)

---

## 🧪 Automated Testing

The project includes 30 automated tests spanning unit, integration, and security layers:
```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run security & RBAC tests
npm run test:security
```

---

## 📦 High-Scale 50,000+ Property Seed

To benchmark performance, run the synthetic data generator:
```bash
# Generates 50,000 realistic property records in bulk batches
npm run seed:50k
```
This leverages PostgreSQL compound indexes:
- `(status, city, listingType)`
- `(status, city, propertyType)`
- `(status, listingType, price)`
- `(city, locality, status)`
- `(ownerId, createdAt)`

---

## 🐳 Docker Setup

Run PostgreSQL and the API server using Docker Compose:
```bash
docker compose up --build -d
```
The API will be available at `http://localhost:5000` and PostgreSQL at port `5432`.

---

## 🔑 Default Development Credentials (from Seed)

| Role | Email | Password |
|---|---|---|
| **Super Admin** | `admin@realestateplatform.com` | `AdminSecurePass@2026` |
| **Moderator (Admin)** | `moderator@realestateplatform.com` | `Password@123` |
| **Agent** | `agent.vikram@primerealty.com` | `Password@123` |
| **Regular User** | `ananya.verma@example.com` | `Password@123` |

