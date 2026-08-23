import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function signToken(user) {
    return jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
}

function toPublicUser(user) {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
}

router.post("/register", async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email, and password are required" });
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ message: "Email is already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { name, email, password: hashedPassword },
        });

        res.status(201).json({ user: toPublicUser(user), token: signToken(user) });
    } catch (err) {
        next(err);
    }
});

router.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        res.json({ user: toPublicUser(user), token: signToken(user) });
    } catch (err) {
        next(err);
    }
});

router.get("/me", requireAuth, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.sub } });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ user: toPublicUser(user) });
    } catch (err) {
        next(err);
    }
});

export default router;
