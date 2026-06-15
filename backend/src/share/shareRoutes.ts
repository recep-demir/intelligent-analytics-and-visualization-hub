import { randomUUID } from "crypto";
import { Router, type Request } from "express";
import { SharedState } from "../../models";
import {
  requireAdminOrAnalystJWT,
  requireAuthenticatedJWT,
} from "../auth/rbacMiddleware";
import type { JWTPayload } from "../auth/types";

type RequestWithUser = Request & {
  user?: JWTPayload;
};

const BLOCKED_STATE_KEYS = new Set([
  "data",
  "rows",
  "result",
  "results",
  "rawData",
  "chartData",
  "metrics",
  "totalOrders",
  "insights",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRequester(req: Request): JWTPayload {
  return (req as RequestWithUser).user as JWTPayload;
}

function containsBlockedAnalyticalData(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsBlockedAnalyticalData(item));
  }

  if (!isObject(value)) {
    return false;
  }

  return Object.entries(value).some(([key, nestedValue]) => {
    if (BLOCKED_STATE_KEYS.has(key)) {
      return true;
    }

    return containsBlockedAnalyticalData(nestedValue);
  });
}

function parseStateJson(stateJson: string): unknown {
  try {
    return JSON.parse(stateJson);
  } catch {
    return null;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export const shareRouter = Router();

shareRouter.post("/", requireAdminOrAnalystJWT, async (req, res) => {
  try {
    const requester = getRequester(req);
    const state = req.body?.state;

    if (!isObject(state)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "state object is required",
      });
    }

    if (containsBlockedAnalyticalData(state)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Share state must not contain raw analytical data or metrics",
      });
    }

    const uuid = randomUUID();

    await SharedState.create({
      uuid,
      stateJson: JSON.stringify(state),
      createdByUserId: requester.userId,
    });

    return res.status(201).json({
      id: uuid,
    });
  } catch {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to create shared state",
    });
  }
});

shareRouter.get("/:id", requireAuthenticatedJWT, async (req, res) => {
  try {
    const id = req.params.id;

    if (!isUuid(id)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Valid share id is required",
      });
    }

    const sharedState = await SharedState.findByPk(id);

    if (!sharedState) {
      return res.status(404).json({
        error: "Not Found",
        message: "Shared state not found",
      });
    }

    return res.status(200).json({
      id: sharedState.uuid,
      state: parseStateJson(sharedState.stateJson),
      createdAt: sharedState.createdAt,
      updatedAt: sharedState.updatedAt,
    });
  } catch {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to load shared state",
    });
  }
});