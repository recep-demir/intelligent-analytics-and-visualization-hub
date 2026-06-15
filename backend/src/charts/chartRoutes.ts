import { randomBytes } from "crypto";
import { Router, type Request } from "express";
import { Op } from "sequelize";
import { SavedChart, SharedChartLink } from "../../models";
import {
  requireAdminOrAnalystJWT,
  requireAuthenticatedJWT,
} from "../auth/rbacMiddleware";
import type { JWTPayload } from "../auth/types";

type RequestWithUser = Request & {
  user?: JWTPayload;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonField(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getRequester(req: Request): JWTPayload {
  return (req as RequestWithUser).user as JWTPayload;
}

function canAccessChart(requester: JWTPayload, chart: SavedChart): boolean {
  return requester.role === "admin" || chart.createdByUserId === requester.userId;
}

function serializeSavedChart(chart: SavedChart) {
  return {
    id: chart.id,
    title: chart.title,
    question: chart.question,
    chartConfig: parseJsonField(chart.chartConfigJson),
    data: parseJsonField(chart.dataJson),
    createdByUserId: chart.createdByUserId,
    createdAt: chart.createdAt,
    updatedAt: chart.updatedAt,
  };
}

function serializeSharedChartLink(link: SharedChartLink) {
  return {
    id: link.id,
    savedChartId: link.savedChartId,
    shareToken: link.shareToken,
    shareUrl: `/api/shared-charts/${link.shareToken}`,
    createdByUserId: link.createdByUserId,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  };
}

function generateShareToken(): string {
  return randomBytes(16).toString("hex");
}

export const chartRouter = Router();
export const sharedChartRouter = Router();

chartRouter.use(requireAdminOrAnalystJWT);

chartRouter.post("/", async (req, res) => {
  try {
    const requester = getRequester(req);
    const rawTitle = req.body?.title;
    const rawQuestion = req.body?.question;
    const chartConfig = req.body?.chartConfig;
    const data = req.body?.data ?? [];

    if (!isObject(chartConfig)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "chartConfig is required",
      });
    }

    const title =
      typeof rawTitle === "string" && rawTitle.trim()
        ? rawTitle.trim()
        : "Untitled chart";

    const question =
      typeof rawQuestion === "string" && rawQuestion.trim()
        ? rawQuestion.trim()
        : null;

    const chart = await SavedChart.create({
      title,
      question,
      chartConfigJson: JSON.stringify(chartConfig),
      dataJson: JSON.stringify(data),
      createdByUserId: requester.userId,
    });

    return res.status(201).json({
      chart: serializeSavedChart(chart),
    });
  } catch {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to save chart",
    });
  }
});

chartRouter.get("/", async (req, res) => {
  try {
    const requester = getRequester(req);

    const where =
      requester.role === "admin"
        ? {}
        : {
            createdByUserId: requester.userId,
          };

    const charts = await SavedChart.findAll({
      where,
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      charts: charts.map(serializeSavedChart),
    });
  } catch {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to load charts",
    });
  }
});

chartRouter.get("/:id", async (req, res) => {
  try {
    const requester = getRequester(req);
    const chartId = Number(req.params.id);

    if (!Number.isInteger(chartId) || chartId <= 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Valid chart id is required",
      });
    }

    const chart = await SavedChart.findByPk(chartId);

    if (!chart || !canAccessChart(requester, chart)) {
      return res.status(404).json({
        error: "Not Found",
        message: "Chart not found",
      });
    }

    return res.status(200).json({
      chart: serializeSavedChart(chart),
    });
  } catch {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to load chart",
    });
  }
});

chartRouter.post("/:id/share", async (req, res) => {
  try {
    const requester = getRequester(req);
    const chartId = Number(req.params.id);

    if (!Number.isInteger(chartId) || chartId <= 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Valid chart id is required",
      });
    }

    const chart = await SavedChart.findByPk(chartId);

    if (!chart || !canAccessChart(requester, chart)) {
      return res.status(404).json({
        error: "Not Found",
        message: "Chart not found",
      });
    }

    let shareToken = generateShareToken();

    while (
      await SharedChartLink.findOne({
        where: { shareToken },
      })
    ) {
      shareToken = generateShareToken();
    }

    const shareLink = await SharedChartLink.create({
      savedChartId: chart.id,
      shareToken,
      createdByUserId: requester.userId,
    });

    return res.status(201).json({
      share: serializeSharedChartLink(shareLink),
    });
  } catch {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to create share link",
    });
  }
});

sharedChartRouter.use(requireAuthenticatedJWT);

sharedChartRouter.get("/:shareToken", async (req, res) => {
  try {
    const shareToken = req.params.shareToken;

    if (!shareToken) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Share token is required",
      });
    }

    const shareLink = await SharedChartLink.findOne({
      where: {
        shareToken: {
          [Op.eq]: shareToken,
        },
      },
    });

    if (!shareLink) {
      return res.status(404).json({
        error: "Not Found",
        message: "Shared chart not found",
      });
    }

    const chart = await SavedChart.findByPk(shareLink.savedChartId);

    if (!chart) {
      return res.status(404).json({
        error: "Not Found",
        message: "Shared chart not found",
      });
    }

    return res.status(200).json({
      chart: serializeSavedChart(chart),
      share: serializeSharedChartLink(shareLink),
    });
  } catch {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to load shared chart",
    });
  }
});