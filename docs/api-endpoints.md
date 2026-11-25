# REST API Endpoint Catalog

All routes are versioned under `/api/v1`.

## 1. Authentication (`/api/v1/auth`)
- `POST /register` — Register a new user (Role: USER or AGENT).
- `POST /login` — Authenticate credentials, issues JWT access token & sets HTTP-only refresh token.
- `POST /refresh` — Rotate refresh token & obtain a new access token.
- `POST /logout` — Revoke active refresh session and clear cookie.
- `POST /logout-all` — Revoke all sessions across all devices for the current user.
- `GET /me` — Retrieve authenticated user profile.
- `PATCH /change-password` — Change password with current password verification.
- `POST /forgot-password` — Issue secure, time-limited password reset token.
- `POST /reset-password` — Reset password using token.

## 2. Properties (`/api/v1/properties`)
- `GET /` — Public search and listing directory with comprehensive filters and pagination.
- `GET /:id` — Get single property details by ID (public only approved; owners/admins can view draft/pending).
- `GET /slug/:slug` — Get single property details by unique slug.
- `GET /:id/similar` — Retrieve similar listings based on location, type, and price bracket.
- `POST /` — Create property listing (Authenticated).
- `PATCH /:id` — Update property listing (Owner or Admin).
- `DELETE /:id` — Soft-delete property listing (Owner or Admin).
- `PATCH /:id/submit-for-approval` — Move DRAFT to PENDING_APPROVAL.
- `PATCH /:id/status` — Owner updates availability (APPROVED <-> SOLD / RENTED / ARCHIVED).

## 3. Property Images (`/api/v1/properties/:propertyId/images`)
- `POST /` — Upload one or multiple property images (Owner or Admin).
- `DELETE /:imageId` — Delete property image.
- `PATCH /:imageId/primary` — Designate image as primary.
- `PATCH /reorder` — Reorder gallery images.

## 4. Favorites (`/api/v1/favorites`)
- `GET /` — Get current user's favorited properties (Paginated).
- `POST /:propertyId` — Add property to favorites.
- `DELETE /:propertyId` — Remove property from favorites.

## 5. Inquiries (`/api/v1/inquiries` and `/api/v1/properties/:propertyId/inquiries`)
- `POST /api/v1/properties/:propertyId/inquiries` — Submit inquiry (Guest or Authenticated).
- `GET /api/v1/inquiries/my-inquiries` — Buyer views sent inquiries.
- `GET /api/v1/inquiries/received` — Property owner views received inquiries.
- `GET /api/v1/inquiries/:id` — View single inquiry details (Buyer, Owner, or Admin).
- `PATCH /api/v1/inquiries/:id/status` — Owner or Admin updates status (CONTACTED, CLOSED, SPAM).

## 6. Admin & Moderation (`/api/v1/admin`)
- `GET /dashboard` — System statistics, property breakdown, inquiry metrics, user counts.
- `GET /users` — Admin view of all users with search, status, and role filters.
- `PATCH /users/:id/status` — Suspend or activate user account.
- `PATCH /users/:id/role` — Update user role (SUPER_ADMIN only).
- `GET /properties` — Moderation queue of all listings with status filters.
- `PATCH /properties/:id/approve` — Approve listing.
- `PATCH /properties/:id/reject` — Reject listing with mandatory reason.
- `GET /properties/:id/moderation-history` — Complete moderation audit trail.
- `GET /inquiries` — Global inquiry monitoring.
- `GET /audit-logs` — Administrative audit events log.
- `GET /analytics` — Platform growth, regional listings, and inquiry volume.

## 7. User Profile (`/api/v1/users`)
- `GET /me` — Current user profile.
- `PATCH /me` — Update user profile.
- `GET /me/properties` — Retrieve owner's listings (including drafts, pending, etc.).

## 8. Locations (`/api/v1/locations`)
- `GET /search` — Autocomplete search for cities and localities with property count summaries.

## 9. Notifications (`/api/v1/notifications`)
- `GET /` — User notifications list.
- `PATCH /:id/read` — Mark notification as read.
- `PATCH /read-all` — Mark all notifications as read.

## 10. Health & Diagnostics
- `GET /api/v1/health` — Application health check, database ping, uptime.
- `GET /api-docs` — Swagger / OpenAPI documentation UI.

