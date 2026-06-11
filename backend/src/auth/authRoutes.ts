import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../../models";

function getJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  return jwtSecret;
}

function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  try {
    const rawUsername = req.body?.username;
    const rawPassword = req.body?.password;

    if (typeof rawUsername !== "string" || typeof rawPassword !== "string") {
      return res.status(400).json({
        error: "Bad Request",
        message: "Username and password are required",
      });
    }

    const email = rawUsername.trim().toLowerCase();
    const password = rawPassword.trim();

    if (!email || !password) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Username and password are required",
      });
    }

    const user = await User.findOne({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid credentials",
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      getJwtSecret(),
      { expiresIn: "1d" },
    );

    return res.status(200).json({
      token,
      user: serializeUser(user),
    });
  } catch {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Login failed",
    });
  }
});