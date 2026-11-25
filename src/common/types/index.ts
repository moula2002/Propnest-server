import { Role, AccountStatus } from '@prisma/client';

export interface AuthenticatedUserPayload {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  accountStatus: AccountStatus;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserPayload;
      requestId?: string;
    }
  }
}

