export type UserRole = "admin" | "analyst" | "viewer";

export interface JWTPayload {
  userId: number;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}