import type { NextFunction, Request, Response } from 'express';

import { adminAuth } from '../firebase-admin';
import { config } from '../config';

export interface AuthedRequest extends Request {
  user?: {
    uid: string;
    email: string | null;
    name: string | null;
    isAdmin: boolean;
  };
}

const getBearerToken = (req: Request) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length);
};

export const requireAuth = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email ?? null;

    req.user = {
      uid: decoded.uid,
      email,
      name: (decoded.name as string | undefined) ?? null,
      isAdmin: email ? config.adminEmails.includes(email.toLowerCase()) : false,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid authorization token' });
  }
};

export const requireAdmin = (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};
