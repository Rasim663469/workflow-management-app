import 'dotenv/config';

export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '15m';
export const REFRESH_EXPIRATION = process.env.REFRESH_EXPIRATION || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is missing in .env');
}
