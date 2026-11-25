import { z } from 'zod';
import { InquiryStatus } from '@prisma/client';

export const createInquirySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    phone: z.string().trim().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format'),
    message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000),
    source: z.string().max(50).optional().default('WEBSITE'),
  }),
});

export const createContactInquirySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    phone: z.string().trim().min(7, 'Phone number is required').max(20),
    subject: z.string().trim().max(150).optional(),
    message: z.string().trim().min(5, 'Message must be at least 5 characters').max(2000),
  }),
});

export const updateInquiryStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(InquiryStatus),
  }),
});

