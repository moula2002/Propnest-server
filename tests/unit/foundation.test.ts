import { parsePagination, buildPaginationMeta } from '../../src/common/utils/pagination.js';
import { TokenService } from '../../src/services/security/tokenService.js';
import { registerSchema, passwordRegex } from '../../src/modules/auth/auth.validation.js';
import { Role, AccountStatus } from '@prisma/client';

describe('Unit Tests: Core Foundation & Validation', () => {
  describe('Pagination Utilities', () => {
    it('should default to page 1 and limit 20 when parameters are empty', () => {
      const result = parsePagination({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.skip).toBe(0);
    });

    it('should correctly clamp limit to 100 maximum', () => {
      const result = parsePagination({ page: '2', limit: '500' });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(100);
      expect(result.skip).toBe(100);
    });

    it('should calculate hasNextPage and totalPages accurately', () => {
      const meta = buildPaginationMeta(45, 1, 20);
      expect(meta.totalPages).toBe(3);
      expect(meta.hasNextPage).toBe(true);
      expect(meta.hasPreviousPage).toBe(false);

      const lastPageMeta = buildPaginationMeta(45, 3, 20);
      expect(lastPageMeta.hasNextPage).toBe(false);
      expect(lastPageMeta.hasPreviousPage).toBe(true);
    });
  });

  describe('Password Strength Regex', () => {
    it('should accept strong passwords', () => {
      expect(passwordRegex.test('SecurePass@2026')).toBe(true);
      expect(passwordRegex.test('P@ssword123')).toBe(true);
    });

    it('should reject weak passwords lacking required character classes', () => {
      expect(passwordRegex.test('short')).toBe(false); // too short
      expect(passwordRegex.test('nouppercase123!')).toBe(false);
      expect(passwordRegex.test('NOLOWERCASE123!')).toBe(false);
      expect(passwordRegex.test('NoSpecialChar123')).toBe(false);
    });
  });

  describe('TokenService Security', () => {
    const claims = {
      sub: '11111111-1111-1111-1111-111111111111',
      email: 'test@example.com',
      role: Role.USER,
      fullName: 'Test User',
      accountStatus: AccountStatus.ACTIVE,
    };

    it('should sign and verify access token correctly', () => {
      const token = TokenService.signAccessToken(claims);
      expect(typeof token).toBe('string');

      const verified = TokenService.verifyAccessToken(token);
      expect(verified.id).toBe(claims.sub);
      expect(verified.email).toBe(claims.email);
      expect(verified.role).toBe(Role.USER);
    });

    it('should generate distinct hashes for different tokens', () => {
      const hash1 = TokenService.hashToken('token-one');
      const hash2 = TokenService.hashToken('token-two');
      expect(hash1).not.toBe(hash2);
      expect(hash1.length).toBe(64); // SHA-256 hex length
    });
  });

  describe('Registration Zod Validation Schema', () => {
    it('should reject registration when confirmPassword does not match', async () => {
      const invalidData = {
        body: {
          fullName: 'Test User',
          email: 'test@example.com',
          password: 'Password@123',
          confirmPassword: 'Password@456',
        },
      };

      const result = await registerSchema.safeParseAsync(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept valid registration input', async () => {
      const validData = {
        body: {
          fullName: 'Test User',
          email: 'valid@example.com',
          password: 'Password@123',
          confirmPassword: 'Password@123',
          role: Role.AGENT,
        },
      };

      const result = await registerSchema.safeParseAsync(validData);
      expect(result.success).toBe(true);
    });
  });
});

