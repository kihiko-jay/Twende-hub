import type { Request, Response, NextFunction, Express } from 'express';

export interface AppUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
  phone?: string | null;
}

export interface AuthedRequest extends Request {
  user: AppUser;
}

export type AuthMiddleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
export type AdminRequest = AuthedRequest;
export type RegisterRoutes = (app: Express) => void;
