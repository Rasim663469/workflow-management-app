export interface TokenPayload {
  id: number;
  role: string;
  iat?: number; // issued at
  exp?: number; // expiration
}
