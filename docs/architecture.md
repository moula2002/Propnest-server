# System Architecture & Technical Specifications

## 1. Architectural Style
The backend follows a layered, modular domain-driven architecture built with Node.js, Express, TypeScript, and Prisma ORM backed by PostgreSQL.

### Core Modules
- **Auth & Identity**: Registration, authentication, token rotation, sessions, profile management.
- **Properties**: Listing lifecycle management, status state machine, soft-deletion, slug generation.
- **Media**: Local & Cloud storage abstraction, property image gallery, ordering, primary flags.
- **Amenities**: Normalized directory and property-amenity associations.
- **Search & Discovery**: Compound indexed filtering, full-text / trigram keyword matching, similar property heuristics.
- **Inquiries & Leads**: Secure lead delivery, guest & user inquiries, spam & frequency rate limiting.
- **Favorites**: User property bookmarking with duplicate protection.
- **Notifications**: System, inquiry, and moderation notifications.
- **Admin & Moderation**: Property approval/rejection workflows, user status and role management, audit logging, analytics aggregation.
- **Health & Monitoring**: Detailed connection and service availability probes.

## 2. Directory Layout
```
backend/
├── src/
│   ├── app.ts                 # Express application configuration & middleware pipeline
│   ├── server.ts              # HTTP server listener and graceful shutdown
│   ├── config/                # Environment validation, database client, logger
│   ├── common/                # Shared middleware, utilities, error handling, responses
│   ├── modules/               # Domain modules (controllers, services, routes, schemas)
│   ├── services/              # Infrastructure services (storage, email, security)
│   └── routes/                # Consolidated API v1 routing registry
├── prisma/                    # Schema, migrations, dev seeds, and 50k bulk generator
├── tests/                     # Unit, integration, and security test suites
├── docs/                      # Architectural and technical documentation
└── uploads/                   # Local file storage target for development
```

