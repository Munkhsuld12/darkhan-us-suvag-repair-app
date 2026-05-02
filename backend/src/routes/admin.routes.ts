import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { Router } from "express";
import { query } from "../db";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

const router = Router();
router.use(requireAuth, requireRole("admin"));

router.get("/meta", async (_req, res) => {
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
    console.error("Admin meta error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

// ──────────── DEPARTMENTS ────────────
router.post("/departments", async (req, res) => {
  try {
    const { id, name } = req.body as { id?: string; name: string };
    if (!name?.trim()) { res.status(400).json({ ok: false, message: "Нэрийг оруулна уу" }); return; }
    const newId = id?.trim() || randomUUID();
    await query(
      "INSERT INTO departments (id, name) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET name=$2",
      [newId, name.trim()]
    );
    res.json({ ok: true, id: newId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.put("/departments/:id", async (req, res) => {
  try {
    const { name } = req.body as { name: string };
    if (!name?.trim()) { res.status(400).json({ ok: false, message: "Нэрийг оруулна уу" }); return; }
    await query("UPDATE departments SET name=$1 WHERE id=$2", [name.trim(), req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.delete("/departments/:id", async (req, res) => {
  try {
    const active = await query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM tickets WHERE department_id=$1 AND status != 'done'",
      [req.params.id]
    );
    if (Number(active.rows[0]?.count) > 0) {
      res.status(409).json({ ok: false, message: "Энэ албанд идэвхтэй засварын хүсэлт байгаа тул устгах боломжгүй" });
      return;
    }
    await query("DELETE FROM departments WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

// ──────────── TEAMS ────────────
router.post("/teams", async (req, res) => {
  try {
    const { id, name, departmentId, leaderUserId } = req.body as {
      id?: string; name: string; departmentId: string; leaderUserId: string;
    };
    if (!name?.trim() || !departmentId || !leaderUserId) {
      res.status(400).json({ ok: false, message: "Шаардлагатай талбарыг бөглөнө үү" }); return;
    }
    const newId = id?.trim() || randomUUID();
    await query(
      "INSERT INTO teams (id, name, department_id, leader_user_id) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET name=$2, department_id=$3, leader_user_id=$4",
      [newId, name.trim(), departmentId, leaderUserId]
    );
    res.json({ ok: true, id: newId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.put("/teams/:id", async (req, res) => {
  try {
    const { name, departmentId, leaderUserId } = req.body as {
      name: string; departmentId: string; leaderUserId: string;
    };
    await query(
      "UPDATE teams SET name=$1, department_id=$2, leader_user_id=$3 WHERE id=$4",
      [name.trim(), departmentId, leaderUserId, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.delete("/teams/:id", async (req, res) => {
  try {
    const activeTickets = await query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM tickets WHERE team_id=$1 AND status != 'done'",
      [req.params.id]
    );
    if (Number(activeTickets.rows[0]?.count) > 0) {
      res.status(409).json({ ok: false, message: "Энэ бригадад идэвхтэй засварын хүсэлт байгаа тул устгах боломжгүй" });
      return;
    }
    const activeTasks = await query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM tasks WHERE team_id=$1 AND status != 'done'",
      [req.params.id]
    );
    if (Number(activeTasks.rows[0]?.count) > 0) {
      res.status(409).json({ ok: false, message: "Энэ бригадад идэвхтэй төлөвлөгөөт ажил байгаа тул устгах боломжгүй" });
      return;
    }
    await query("DELETE FROM teams WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

// ──────────── USERS ────────────
router.post("/users", async (req, res) => {
  try {
    const { id, fullName, username, password, role, departmentId, teamId, phone } = req.body as {
      id?: string; fullName: string; username: string; password: string;
      role: string; departmentId?: string; teamId?: string; phone?: string;
    };
    if (!fullName?.trim() || !username?.trim() || !password?.trim()) {
      res.status(400).json({ ok: false, message: "Шаардлагатай талбарыг бөглөнө үү" }); return;
    }
    const hash = await bcrypt.hash(password, 10);
    const newId = id?.trim() || randomUUID();
    await query(
      `INSERT INTO users (id, full_name, username, password_hash, role, department_id, team_id, phone, profile_complete)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)
       ON CONFLICT (id) DO UPDATE SET full_name=$2, username=$3, password_hash=$4, role=$5, department_id=$6, team_id=$7, phone=$8`,
      [newId, fullName.trim(), username.trim(), hash, role, departmentId || null, teamId || null, phone || ""]
    );
    res.json({ ok: true, id: newId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.put("/users/:id", async (req, res) => {
  try {
    const { fullName, username, password, role, departmentId, teamId, phone } = req.body as {
      fullName: string; username: string; password?: string;
      role: string; departmentId?: string; teamId?: string; phone?: string;
    };
    if (password?.trim()) {
      const hash = await bcrypt.hash(password, 10);
      await query(
        "UPDATE users SET full_name=$1, username=$2, password_hash=$3, role=$4, department_id=$5, team_id=$6, phone=$7 WHERE id=$8",
        [fullName.trim(), username.trim(), hash, role, departmentId || null, teamId || null, phone || "", req.params.id]
      );
    } else {
      await query(
        "UPDATE users SET full_name=$1, username=$2, role=$3, department_id=$4, team_id=$5, phone=$6 WHERE id=$7",
        [fullName.trim(), username.trim(), role, departmentId || null, teamId || null, phone || "", req.params.id]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    await query("DELETE FROM users WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

// ──────────── STATIONS ────────────
router.post("/stations", async (req, res) => {
  try {
    const { id, code, name, bagNo, location, caretakerName, caretakerPhone } = req.body as {
      id?: string; code: string; name?: string; bagNo: number;
      location?: string; caretakerName?: string; caretakerPhone?: string;
    };
    if (!code?.trim() || !bagNo) {
      res.status(400).json({ ok: false, message: "Код болон баг дугаарыг оруулна уу" }); return;
    }
    const newId = id?.trim() || randomUUID();
    await query(
      `INSERT INTO water_stations (id, code, name, bag_no, location, caretaker_name, caretaker_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET code=$2, name=$3, bag_no=$4, location=$5, caretaker_name=$6, caretaker_phone=$7`,
      [newId, code.trim(), name || "", bagNo, location || "", caretakerName || "", caretakerPhone || ""]
    );
    res.json({ ok: true, id: newId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.put("/stations/:id", async (req, res) => {
  try {
    const { code, name, bagNo, location, caretakerName, caretakerPhone } = req.body as {
      code: string; name?: string; bagNo: number;
      location?: string; caretakerName?: string; caretakerPhone?: string;
    };
    await query(
      "UPDATE water_stations SET code=$1, name=$2, bag_no=$3, location=$4, caretaker_name=$5, caretaker_phone=$6 WHERE id=$7",
      [code.trim(), name || "", bagNo, location || "", caretakerName || "", caretakerPhone || "", req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.delete("/stations/:id", async (req, res) => {
  try {
    await query("DELETE FROM water_stations WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

export default router;
