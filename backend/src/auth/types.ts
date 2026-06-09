export interface JWTPayload {
  userId: number;
  email: string;
  role: "admin" | "analyst" | "viewer";
  iat: number;
  exp: number;
}
