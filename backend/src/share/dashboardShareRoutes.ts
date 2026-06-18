import { Router } from 'express';
import { randomUUID } from 'crypto';
import { SharedDashboard } from '../../models';
import { requireAdminOrAnalystJWT, requireAuthenticatedJWT } from '../auth/rbacMiddleware';
import type { JWTPayload } from '../auth/types';
import type { Request } from 'express';

type AuthRequest = Request & { user?: JWTPayload };

export const dashboardShareRouter = Router();

// POST /api/dashboard-shares
// Only Analyst and Admin can create share links.
dashboardShareRouter.post('/', requireAdminOrAnalystJWT, async (req: AuthRequest, res) => {
  const { filtersJson, title } = req.body ?? {};

  if (typeof filtersJson !== 'string') {
    return res.status(400).json({ error: 'filtersJson is required' });
  }

  const id = randomUUID();
  await SharedDashboard.create({
    id,
    filtersJson,
    title: title ?? null,
    createdByUserId: req.user!.userId,
  });

  return res.status(201).json({ shareId: id });
});

// GET /api/dashboard-shares/:id
// Any authenticated user can open a share link.
// The response shape differs by role — Viewers get interactive: false.
dashboardShareRouter.get('/:id', requireAuthenticatedJWT, async (req: AuthRequest, res) => {
  const record = await SharedDashboard.findByPk(req.params.id);

  if (!record) {
    return res.status(404).json({ error: 'Share link not found' });
  }

  const role = req.user!.role;

  if (role === 'viewer') {
    return res.status(200).json({
      shareId: record.id,
      filtersJson: record.filtersJson,
      title: record.title,
      role,
      interactive: false,
    });
  }

  return res.status(200).json({
    shareId: record.id,
    filtersJson: record.filtersJson,
    title: record.title,
    role,
    interactive: true,
  });
});