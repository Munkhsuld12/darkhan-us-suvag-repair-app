import { Router } from "express";
import { query } from "../db";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// GET /api/meta — master data for all authenticated internal users
router.get("/", requireAuth, async (_req, res) => {
  try {
    const [depts, teams, users, stations] = await Promise.all([
      query("SELECT id, name FROM departments ORDER BY name"),
      query("SELECT id, name, department_id, leader_user_id FROM teams ORDER BY name"),
      query("SELECT id, full_name, username, role, department_id, team_id, phone FROM users ORDER BY full_name"),
      query("SELECT id, code, name, bag_no, location, caretaker_name, caretaker_phone FROM water_stations ORDER BY bag_no, code"),
    ]);

    res.json({
      ok: true,
      departments: depts.rows.map((r: Record<string, unknown>) => ({ id: r.id, name: r.name })),
      teams: teams.rows.map((r: Record<string, unknown>) => ({
        id: r.id, name: r.name, departmentId: r.department_id, leaderUserId: r.leader_user_id,
      })),
      users: users.rows.map((r: Record<string, unknown>) => ({
        id: r.id, fullName: r.full_name, username: r.username,
        role: r.role, departmentId: r.department_id, teamId: r.team_id, phone: r.phone,
      })),
      stations: stations.rows.map((r: Record<string, unknown>) => ({
        id: r.id, code: r.code, name: r.name, bagNo: r.bag_no,
        location: r.location, caretakerName: r.caretaker_name, caretakerPhone: r.caretaker_phone,
      })),
    });
  } catch (err) {
    console.error("Meta error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

export default router;
