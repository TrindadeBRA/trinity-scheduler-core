import { AuthUser } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      shopId?: string;
    }
  }
}
