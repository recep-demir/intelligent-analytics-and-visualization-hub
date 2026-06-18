import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import { User } from "../../models";
import { requireAdminJWT } from "../auth/rbacMiddleware";
import type { JWTPayload, UserRole } from "../auth/types";

type AssignableRole = "analyst" | "viewer";

type RequestWithUser = Request & {
  user?: JWTPayload;
};

const PASSWORD_SALT_ROUNDS = 10;
const ASSIGNABLE_ROLES: AssignableRole[] = ["analyst", "viewer"];

function isAssignableRole(role: unknown): role is AssignableRole {
  return (
    typeof role === "string" &&
    ASSIGNABLE_ROLES.includes(role as AssignableRole)
  );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const adminUserRouter = Router();

adminUserRouter.use(requireAdminJWT);

adminUserRouter.get("/", async (_req, res) => {
  try {
    const users = await User.findAll({
      order: [["id", "ASC"]],
    });

    return res.status(200).json({
      users: users.map(serializeUser),
    });
  } catch {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to load users",
    });
  }
});

adminUserRouter.post("/", async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    const rawPassword = req.body?.password;
    const rawRole = req.body?.role ?? "viewer";

    if (typeof rawEmail !== "string" || typeof rawPassword !== "string") {
      return res.status(400).json({
        error: "Bad Request",
        message: "Email and password are required",
      });
    }

    const email = rawEmail.trim().toLowerCase();
    const password = rawPassword.trim();

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "A valid email is required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Password must be at least 8 characters long",
      });
    }

    if (!isAssignableRole(rawRole)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Role must be analyst or viewer",
      });
    }

    const existingUser = await User.findOne({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        error: "Conflict",
        message: "User with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

    const user = await User.create({
      email,
      passwordHash,
      role: rawRole as UserRole,
    });

    return res.status(201).json({
      user: serializeUser(user),
    });
  } catch {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to create user",
    });
  }
});

adminUserRouter.patch("/:id/role", async (req, res) => {
  try {
    const requester = (req as RequestWithUser).user;
    const userId = Number(req.params.id);
    const rawRole = req.body?.role;

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Valid user id is required",
      });
    }

    if (!isAssignableRole(rawRole)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Role must be analyst or viewer",
      });
    }

    if (requester?.userId === userId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Admin cannot change their own role",
      });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: "User not found",
      });
    }

    user.role = rawRole;
    await user.save();

    return res.status(200).json({
      user: serializeUser(user),
    });
  } catch {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to update user role",
    });
  }
});

adminUserRouter.delete("/:id", async (req, res) => {
  try {
    const requester = (req as RequestWithUser).user;
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Valid user id is required",
      });
    }

    if (requester?.userId === userId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Admin cannot delete their own account",
      });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: "User not found",
      });
    }

    if (user.role === "admin") {
      return res.status(403).json({
        error: "Forbidden",
        message: "Admin accounts cannot be deleted",
      });
    }

    await user.destroy();

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to delete user",
    });
  }
});