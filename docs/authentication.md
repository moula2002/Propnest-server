# Authentication & Authorization Architecture

## 1. Dual Token Architecture
The platform implements standard OAuth2-inspired JWT dual-token architecture:
- **Access Token**: Short-lived (15 minutes). Transmitted via the `Authorization: Bearer <token>` HTTP header. Contains user claims (`sub`, `email`, `role`, `accountStatus`).
- **Refresh Token**: Long-lived (7 days). Stored in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie (`refreshToken`), preventing XSS access.

## 2. Refresh Token Rotation & Reuse Detection
1. When the client calls `POST /api/v1/auth/refresh`, the token hash (`SHA-256`) is verified against the database `RefreshSession` table.
2. If valid, the current session record is marked `revokedAt = NOW()`.
3. A new refresh token is generated, hashed, and persisted. A new access token is returned.
4. **Reuse Detection (Compromise Detection)**: If a revoked refresh token is presented, this indicates token theft. All active sessions for that user are immediately revoked, forcing the genuine user to re-authenticate.

## 3. Password Security & Reset
- Passwords are salted and hashed using `bcrypt` (12 rounds).
- Password Reset tokens are generated using cryptographically secure random bytes (`crypto.randomBytes(32)`), stored as a SHA-256 hash in PostgreSQL with a 1-hour expiration timestamp.

