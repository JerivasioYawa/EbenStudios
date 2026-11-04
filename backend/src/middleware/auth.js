import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
    }

    let session;
    try {
        session = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    } catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (!Number.isSafeInteger(session.sub) || session.sub <= 0) {
        return res.status(401).json({ message: "Invalid session" });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.sub }, select: { id: true, email: true, role: true },
        });
        if (!user) return res.status(401).json({ message: "Session is no longer valid" });
        req.user = { sub: user.id, email: user.email, role: user.role };
        next();
    } catch (error) {
        next(error);
    }
}

export function requireAdmin(req, res, next) {
    if (req.user?.role !== "ADMIN") {
        return res.status(403).json({ message: "Admin access required" });
    }

    next();
}
