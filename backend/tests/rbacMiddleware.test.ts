import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import jwt = require("jsonwebtoken");
import { requireAdminOrAnalystJWT } from "../src/auth/rbacMiddleware";

const TEST_SECRET = "test-secret";

type MockResponse = Partial<Response> & {
  status: jest.MockedFunction<(code: number) => Response>;
  json: jest.MockedFunction<(body: unknown) => Response>;
};

function createMockResponse(): MockResponse {
  const res = {} as MockResponse;

  res.status = jest.fn((_: number) => res as Response);
  res.json = jest.fn((_: unknown) => res as Response);

  return res;
}

function createMockRequest(token?: string): Partial<Request> {
  return {
    headers: token
      ? {
          authorization: `Bearer ${token}`,
        }
      : {},
  };
}

function createToken(
  role: "admin" | "analyst" | "viewer",
  expiresInSeconds = 3600,
): string {
  return jwt.sign(
    {
      userId: 1,
      email: `${role}.user@company.com`,
      role,
    },
    TEST_SECRET,
    { expiresIn: expiresInSeconds },
  );
}

describe("requireAdminOrAnalystJWT", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it("allows requests with a valid admin JWT", () => {
    const token = createToken("admin");
    const req = createMockRequest(token) as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    requireAdminOrAnalystJWT(req, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("allows requests with a valid analyst JWT", () => {
    const token = createToken("analyst");
    const req = createMockRequest(token) as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    requireAdminOrAnalystJWT(req, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("returns 403 for a valid viewer JWT", () => {
    const token = createToken("viewer");
    const req = createMockRequest(token) as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    requireAdminOrAnalystJWT(req, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Forbidden",
      message: "Admin or Analyst role required",
    });
  });

  it("returns 401 when Authorization header is missing", () => {
    const req = createMockRequest() as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    requireAdminOrAnalystJWT(req, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unauthorized",
      message: "Authentication required",
    });
  });

  it("returns 401 for a malformed JWT", () => {
    const req = createMockRequest("not-a-valid-token") as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    requireAdminOrAnalystJWT(req, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unauthorized",
      message: "Authentication required",
    });
  });

  it("returns 401 for an expired JWT without leaking internal details", () => {
    const token = createToken("admin", -1);
    const req = createMockRequest(token) as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    requireAdminOrAnalystJWT(req, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unauthorized",
      message: "Authentication required",
    });
  });
});