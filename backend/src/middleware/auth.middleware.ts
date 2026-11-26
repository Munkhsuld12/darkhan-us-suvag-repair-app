import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { query } from "../db";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in backend/.env");
}

export const TOKEN_EXPIRES_IN = "7d";

export interface JwtPayload {
  id: string;
  role: string;
  departmentId?: string;
  teamId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const signToken = (user: { id: string; role: string; department_id: string | null; team_id: string | null }) =>
  jwt.sign(
    {
      id: user.id,
      role: user.role,
      departmentId: user.department_id ?? undefined,
      teamId: user.team_id ?? undefined,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );

/**
 * Token-ийг шалгаад хэрэглэгчийн ОДООГИЙН мэдээллийг өгөгдлийн сангаас уншина.
 * Устгагдсан хэрэглэгч, эсвэл token олгосны дараа нууц үг солигдсон бол null буцаана.
 * Эрх (role), бригад, алба өөрчлөгдсөн бол шинэ утгыг шууд хэрэглэнэ.
 */
const resolveUser = async (header: string | undefined): Promise<JwtPayload | null> => {
  if (!header || !header.startsWith("Bearer ")) return null;
  let payload: jwt.JwtPayload & Partial<JwtPayload>;
  try {
    payload = jwt.verify(header.slice(7), JWT_SECRET) as jwt.JwtPayload & Partial<JwtPayload>;
  } catch {
    return null;
  }
  if (!payload.id) return null;

  const result = await query<{
    id: string; role: string; department_id: string | null; team_id: string | null; password_changed_at: Date;
  }>(
    "SELECT id, role, department_id, team_id, password_changed_at FROM users WHERE id = $1 AND deleted_at IS NULL",
    [payload.id]
  );
  const user = result.rows[0];
  if (!user) return null;

  const changedAtSec = Math.floor(new Date(user.password_changed_at).getTime() / 1000);
  if (!payload.iat || payload.iat < changedAtSec) return null;

  return {
    id: user.id,
    role: user.role,
    departmentId: user.department_id ?? undefined,
    teamId: user.team_id ?? undefined,
  };
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ ok: false, message: "Нэвтрээгүй байна" });
    return;
  }
  try {
    const user = await resolveUser(header);
    if (!user) {
      res.status(401).json({ ok: false, message: "Token хүчингүй" });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
};

/** Нэвтрэлт заавал биш: хүчинтэй token байвал req.user-ийг тохируулна, үгүй бол зочин гэж үзнэ. */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    req.user = (await resolveUser(req.headers.authorization)) ?? undefined;
  } catch (err) {
    console.error("Optional auth error:", err);
    req.user = undefined;
  }
  next();
};

export const requireRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ ok: false, message: "Эрх хүрэлцэхгүй байна" });
      return;
    }
    next();
  };
