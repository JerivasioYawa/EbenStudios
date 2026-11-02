import { prisma } from "../lib/prisma.js";
import jwt from "jsonwebtoken";

export async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
    }

    try {
        const claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
        if (!Number.isSafeInteger(claims.sub)) return res.status(401).json({message:"Invalid token"});
        const user = await prisma.user.findUnique({where:{id:claims.sub},select:{id:true,role:true}});
        if (!user) return res.status(401).json({message:"Account no longer exists"});
        req.user = {sub:user.id, role:user.role};
        next();
    } catch {
        res.status(401).json({ message: "Invalid or expired token" });
    }
}

export function requireAdmin(req, res, next) {
    if (req.user?.role !== "ADMIN") {
        return res.status(403).json({ message: "Admin access required" });
    }

    next();
}
