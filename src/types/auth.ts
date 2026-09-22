export interface AuthUser {
  id: string;
  customId: string;
  name: string;
  username: string;
  role: 'Super Admin' | 'Floor Admin';
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
