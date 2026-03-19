import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  shopId: string;
  role: 'admin' | 'leader' | 'professional';
  professionalId?: string;
}

const secret = process.env.JWT_SECRET || 'fallback-secret';

export function signToken(payload: AuthUser): string {
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, secret) as AuthUser;
}
