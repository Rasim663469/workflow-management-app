import type { TokenPayload } from './token-payload';

declare global {
  namespace Express {
    interface Request {
      cookies?: Record<string, string>;
      user?: TokenPayload;
      festival?: any;
    }
  }
}

export {};
