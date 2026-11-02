import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validateRegistration, validateLogin } from "../lib/validation.js";

const router = Router();

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = validateRegistration(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email is already registered.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // A caller cannot choose an administrator role.
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "CUSTOMER",
      },
    });

    res.status(201).json({
      user: toPublicUser(user),
      token: signToken(user),
    });
  } catch (error) {
    // Handle simultaneous registrations using the same email.
    if (error.code === "P2002") {
      return res.status(409).json({
        message: "Email is already registered.",
      });
    }

    next(error);
  }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = validateLogin(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    res.json({
      user: toPublicUser(user),
      token: signToken(user),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.sub,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    res.json({
      user: toPublicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
