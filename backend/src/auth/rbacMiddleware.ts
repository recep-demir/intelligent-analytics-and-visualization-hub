import type { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { JWTPayload } from "./types";

type UserRole = JWTPayload["role"];

type RequestWithUser = Request & {
  user?: JWTPayload;
};

const UNAUTHORIZED_RESPONSE = {
  error: "Unauthorized",
  message: "Authentication required",
};

function getForbiddenResponse(roles: UserRole[]) {
  return {
    error: "Forbidden",
    message:
      roles.length === 1
        ? "Admin role required"
        : "Admin or Analyst role required",
  };
}

function getJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  return jwtSecret;
}

function isJWTPayload(payload: unknown): payload is JWTPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<JWTPayload>;

  return (
    typeof candidate.userId === "number" &&
    typeof candidate.email === "string" &&
    ["admin", "analyst", "viewer"].includes(candidate.role ?? "") &&
    typeof candidate.iat === "number" &&
    typeof candidate.exp === "number"
  );
}

function createRoleMiddleware(allowedRoles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json(UNAUTHORIZED_RESPONSE);
    }

    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);

    if (!bearerMatch) {
      return res.status(401).json(UNAUTHORIZED_RESPONSE);
    }

    const token = bearerMatch[1].trim();

    if (!token) {
      return res.status(401).json(UNAUTHORIZED_RESPONSE);
    }

    try {
      const decodedPayload = jwt.verify(token, getJwtSecret());

      if (!isJWTPayload(decodedPayload)) {
        return res.status(401).json(UNAUTHORIZED_RESPONSE);
      }

      if (!allowedRoles.includes(decodedPayload.role)) {
        return res.status(403).json(getForbiddenResponse(allowedRoles));
      }

      (req as RequestWithUser).user = decodedPayload;

      return next();
    } catch {
      return res.status(401).json(UNAUTHORIZED_RESPONSE);
    }
  };
}

export const requireAdminJWT = createRoleMiddleware(["admin"]);

export const requireAdminOrAnalystJWT = createRoleMiddleware([
  "admin",
  "analyst",
]);