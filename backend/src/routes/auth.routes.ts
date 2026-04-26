import bcrypt from "bcrypt";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { query } from "../db";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body as { username: string; password: string };
    if (!username || !password) {
      res.status(400).json({ ok: false, message: "Нэвтрэх нэр болон нууц үгийг оруулна уу" });
      return;
    }

    const result = await query<{
      id: string; full_name: string; username: string; password_hash: string;
      role: string; department_id: string | null; team_id: string | null; phone: string;
    }>(
      "SELECT id, full_name, username, password_hash, role, department_id, team_id, phone FROM users WHERE username = $1",
      [username.trim()]
    );

    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ ok: false, message: "Нэвтрэх нэр эсвэл нууц үг буруу" });
      return;
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      res.status(401).json({ ok: false, message: "Нэвтрэх нэр эсвэл нууц үг буруу" });
      return;
    }

    const payload = {
      id: user.id,
      role: user.role,
      departmentId: user.department_id ?? undefined,
      teamId: user.team_id ?? undefined,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET || "secret", { expiresIn: "8h" });

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        role: user.role,
        departmentId: user.department_id,
        teamId: user.team_id,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await query<{
      id: string; full_name: string; username: string;
      role: string; department_id: string | null; team_id: string | null; phone: string;
    }>(
      "SELECT id, full_name, username, role, department_id, team_id, phone FROM users WHERE id = $1",
      [req.user!.id]
    );

    const user = result.rows[0];
    if (!user) {
      res.status(404).json({ ok: false, message: "Хэрэглэгч олдсонгүй" });
      return;
    }

    res.json({
      ok: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        role: user.role,
        departmentId: user.department_id,
        teamId: user.team_id,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

export default router;
