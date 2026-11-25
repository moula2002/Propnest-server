import { z } from 'zod';
import { Role, AccountStatus, PropertyStatus, InquiryStatus } from '@prisma/client';

export const adminLoginSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const updateUserStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(AccountStatus, {
      errorMap: () => ({ message: 'Invalid account status' }),
    }),
    reason: z.string().max(500).optional(),
  }),
});

export const updateUserRoleSchema = z.object({
  body: z.object({
    role: z.nativeEnum(Role, {
      errorMap: () => ({ message: 'Invalid role' }),
    }),
  }),
});

export const rejectPropertySchema = z.object({
  body: z.object({
    reason: z.string().trim().min(5, 'Rejection reason must be at least 5 characters').max(1000),
  }),
});

export const updatePropertyStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(PropertyStatus, {
      errorMap: () => ({ message: 'Invalid property status' }),
    }),
    reason: z.string().max(1000).optional(),
  }),
});

export const updateInquiryStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(InquiryStatus, {
      errorMap: () => ({ message: 'Invalid inquiry status' }),
    }),
  }),
});

export const updateAdminProfileSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
    phone: z.string().trim().max(20).optional().nullable(),
  }),
});

export const changeAdminPasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters long')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).*$/,
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      ),
  }),
});
