import { AdminRole } from '@pingme/db';

export interface AdminJwtPayload {
  sub: string;
  email: string;
  role: AdminRole;
  type: 'admin';
}
