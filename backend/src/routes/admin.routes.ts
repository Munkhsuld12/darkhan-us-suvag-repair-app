import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { Router } from "express";
import { query } from "../db";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

const router = Router();
router.use(requireAuth, requireRole("admin"));

const audit = (userId: string, action: string, entityType: string, entityId: string, entityName: string, details = "") =>
  query(
    "INSERT INTO admin_audit_logs (id, user_id, action, entity_type, entity_id, entity_name, details, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())",
    [randomUUID(), userId, action, entityType, entityId, entityName, details]
  ).catch((e) => console.error("Audit log error:", e));

// ──────────── META ────────────
router.get("/meta", async (_req, res) => {
  try {
    const [depts, teams, users, stations] = await Promise.all([
      query("SELECT id, name FROM departments WHERE deleted_at IS NULL ORDER BY name"),
      query("SELECT id, name, department_id, leader_user_id FROM teams WHERE deleted_at IS NULL ORDER BY name"),
      query("SELECT id, full_name, username, role, department_id, team_id, phone, email, profile_complete FROM users WHERE deleted_at IS NULL ORDER BY full_name"),
      query("SELECT id, code, name, bag_no, location, caretaker_name, caretaker_phone FROM water_stations WHERE deleted_at IS NULL ORDER BY bag_no, code"),
    ]);
    res.json({
      ok: true,
      departments: depts.rows.map((r: Record<string, unknown>) => ({ id: r.id, name: r.name })),
      teams: teams.rows.map((r: Record<string, unknown>) => ({
        id: r.id, name: r.name, departmentId: r.department_id, leaderUserId: r.leader_user_id,
      })),
      users: users.rows.map((r: Record<string, unknown>) => ({
        id: r.id, fullName: r.full_name, username: r.username,
        role: r.role, departmentId: r.department_id, teamId: r.team_id,
        phone: r.phone, email: r.email, profileComplete: r.profile_complete,
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

// ──────────── ARCHIVE ────────────
router.get("/archive", async (_req, res) => {
  try {
    const [depts, teams, users, stations] = await Promise.all([
      query("SELECT id, name, deleted_at FROM departments WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"),
      query("SELECT id, name, department_id, deleted_at FROM teams WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"),
      query("SELECT id, full_name, username, role, deleted_at FROM users WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"),
      query("SELECT id, code, bag_no, location, caretaker_name, deleted_at FROM water_stations WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"),
    ]);
    res.json({
      ok: true,
      departments: depts.rows.map((r: Record<string, unknown>) => ({ id: r.id, name: r.name, deletedAt: r.deleted_at })),
      teams: teams.rows.map((r: Record<string, unknown>) => ({ id: r.id, name: r.name, departmentId: r.department_id, deletedAt: r.deleted_at })),
      users: users.rows.map((r: Record<string, unknown>) => ({ id: r.id, fullName: r.full_name, username: r.username, role: r.role, deletedAt: r.deleted_at })),
      stations: stations.rows.map((r: Record<string, unknown>) => ({ id: r.id, code: r.code, bagNo: r.bag_no, location: r.location, caretakerName: r.caretaker_name, deletedAt: r.deleted_at })),
    });
  } catch (err) {
    console.error("Archive error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

// ──────────── AUDIT LOGS ────────────
router.get("/audit-logs", async (_req, res) => {
  try {
    const result = await query(
      `SELECT al.id, al.action, al.entity_type, al.entity_id, al.entity_name, al.details, al.created_at,
              u.full_name AS user_name, u.username
       FROM admin_audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC
       LIMIT 500`
    );
    res.json({
      ok: true,
      logs: result.rows.map((r: Record<string, unknown>) => ({
        id: r.id, action: r.action, entityType: r.entity_type,
        entityId: r.entity_id, entityName: r.entity_name, details: r.details,
        createdAt: r.created_at, userName: r.user_name, username: r.username,
      })),
    });
  } catch (err) {
    console.error("Audit logs error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

// ──────────── DEPARTMENTS ────────────
router.post("/departments", async (req, res) => {
  try {
    const { id, name } = req.body as { id?: string; name: string };
    if (!name?.trim()) { res.status(400).json({ ok: false, message: "Нэрийг оруулна уу" }); return; }
    const newId = id?.trim() || randomUUID();
    const isUpdate = !!id?.trim();
    await query(
      "INSERT INTO departments (id, name) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET name=$2, deleted_at=NULL",
      [newId, name.trim()]
    );
    await audit(req.user!.id, isUpdate ? "update" : "create", "department", newId, name.trim());
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
    const oldRes = await query<{ name: string }>("SELECT name FROM departments WHERE id=$1", [req.params.id]);
    const old = oldRes.rows[0];
    const diff: Record<string, { from: string; to: string }> = {};
    if (old && old.name !== name.trim()) diff["Нэр"] = { from: old.name, to: name.trim() };
    const deptResult = await query("UPDATE departments SET name=$1 WHERE id=$2", [name.trim(), req.params.id]);
    if ((deptResult.rowCount ?? 0) === 0) {
      res.status(404).json({ ok: false, message: "Алба олдсонгүй" });
      return;
    }
    await audit(req.user!.id, "update", "department", req.params.id, name.trim(), JSON.stringify(diff));
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
      res.status(409).json({ ok: false, message: "Энэ албанд идэвхтэй засварын хүсэлт байгаа тул архивлах боломжгүй" });
      return;
    }
    const nameRes = await query<{ name: string }>("SELECT name FROM departments WHERE id=$1", [req.params.id]);
    await query("UPDATE departments SET deleted_at = NOW() WHERE id=$1", [req.params.id]);
    await audit(req.user!.id, "archive", "department", req.params.id, nameRes.rows[0]?.name ?? "");
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.post("/departments/:id/restore", async (req, res) => {
  try {
    const nameRes = await query<{ name: string }>("SELECT name FROM departments WHERE id=$1", [req.params.id]);
    await query("UPDATE departments SET deleted_at = NULL WHERE id=$1", [req.params.id]);
    await audit(req.user!.id, "restore", "department", req.params.id, nameRes.rows[0]?.name ?? "");
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
    const isUpdate = !!id?.trim();
    await query(
      "INSERT INTO teams (id, name, department_id, leader_user_id) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET name=$2, department_id=$3, leader_user_id=$4, deleted_at=NULL",
      [newId, name.trim(), departmentId, leaderUserId]
    );
    await audit(req.user!.id, isUpdate ? "update" : "create", "team", newId, name.trim());
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
    const oldRes = await query<{ name: string; department_id: string; leader_user_id: string }>(
      "SELECT name, department_id, leader_user_id FROM teams WHERE id=$1", [req.params.id]
    );
    const old = oldRes.rows[0];
    const diff: Record<string, { from: string; to: string }> = {};
    if (old) {
      if (old.name !== name.trim()) diff["Нэр"] = { from: old.name, to: name.trim() };
      if (old.department_id !== departmentId) {
        const [od, nd] = await Promise.all([
          query<{ name: string }>("SELECT name FROM departments WHERE id=$1", [old.department_id]),
          query<{ name: string }>("SELECT name FROM departments WHERE id=$1", [departmentId]),
        ]);
        diff["Алба"] = { from: od.rows[0]?.name ?? old.department_id, to: nd.rows[0]?.name ?? departmentId };
      }
      if (old.leader_user_id !== leaderUserId) {
        const [ou, nu] = await Promise.all([
          query<{ full_name: string }>("SELECT full_name FROM users WHERE id=$1", [old.leader_user_id]),
          query<{ full_name: string }>("SELECT full_name FROM users WHERE id=$1", [leaderUserId]),
        ]);
        diff["Ахлагч"] = { from: ou.rows[0]?.full_name ?? old.leader_user_id, to: nu.rows[0]?.full_name ?? leaderUserId };
      }
    }
    const teamResult = await query(
      "UPDATE teams SET name=$1, department_id=$2, leader_user_id=$3 WHERE id=$4",
      [name.trim(), departmentId, leaderUserId, req.params.id]
    );
    if ((teamResult.rowCount ?? 0) === 0) {
      res.status(404).json({ ok: false, message: "Бригад олдсонгүй" });
      return;
    }
    await audit(req.user!.id, "update", "team", req.params.id, name.trim(), JSON.stringify(diff));
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
      res.status(409).json({ ok: false, message: "Энэ бригадад идэвхтэй засварын хүсэлт байгаа тул архивлах боломжгүй" });
      return;
    }
    const activeTasks = await query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM tasks WHERE team_id=$1 AND status != 'done'",
      [req.params.id]
    );
    if (Number(activeTasks.rows[0]?.count) > 0) {
      res.status(409).json({ ok: false, message: "Энэ бригадад идэвхтэй төлөвлөгөөт ажил байгаа тул архивлах боломжгүй" });
      return;
    }
    const nameRes = await query<{ name: string }>("SELECT name FROM teams WHERE id=$1", [req.params.id]);
    await query("UPDATE teams SET deleted_at = NOW() WHERE id=$1", [req.params.id]);
    await audit(req.user!.id, "archive", "team", req.params.id, nameRes.rows[0]?.name ?? "");
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.post("/teams/:id/restore", async (req, res) => {
  try {
    const nameRes = await query<{ name: string }>("SELECT name FROM teams WHERE id=$1", [req.params.id]);
    await query("UPDATE teams SET deleted_at = NULL WHERE id=$1", [req.params.id]);
    await audit(req.user!.id, "restore", "team", req.params.id, nameRes.rows[0]?.name ?? "");
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
    const isUpdate = !!id?.trim();
    await query(
      `INSERT INTO users (id, full_name, username, password_hash, role, department_id, team_id, phone, profile_complete)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)
       ON CONFLICT (id) DO UPDATE SET full_name=$2, username=$3, password_hash=$4, role=$5, department_id=$6, team_id=$7, phone=$8, deleted_at=NULL`,
      [newId, fullName.trim(), username.trim(), hash, role, departmentId || null, teamId || null, phone || ""]
    );
    await audit(req.user!.id, isUpdate ? "update" : "create", "user", newId, `${fullName.trim()} (${username.trim()})`);
    res.json({ ok: true, id: newId });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ ok: false, message: "Энэ нэвтрэх нэр аль хэдийн бүртгэлтэй байна" });
      return;
    }
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.put("/users/:id", async (req, res) => {
  try {
    const { fullName, username, password, role, departmentId, teamId, phone, email } = req.body as {
      fullName: string; username: string; password?: string;
      role: string; departmentId?: string; teamId?: string; phone?: string; email?: string;
    };
    const oldRes = await query<{ full_name: string; username: string; role: string; department_id: string | null; team_id: string | null; phone: string; email: string | null }>(
      "SELECT full_name, username, role, department_id, team_id, phone, email FROM users WHERE id=$1", [req.params.id]
    );
    const old = oldRes.rows[0];
    const diff: Record<string, { from: string; to: string }> = {};
    if (old) {
      if (old.full_name !== fullName.trim()) diff["Бүтэн нэр"] = { from: old.full_name, to: fullName.trim() };
      if (old.username !== username.trim()) diff["Нэвтрэх нэр"] = { from: old.username, to: username.trim() };
      if (old.role !== role) diff["Эрх"] = { from: old.role, to: role };
      if ((old.department_id ?? null) !== (departmentId || null)) {
        const [od, nd] = await Promise.all([
          old.department_id ? query<{ name: string }>("SELECT name FROM departments WHERE id=$1", [old.department_id]) : Promise.resolve({ rows: [] as { name: string }[] }),
          departmentId ? query<{ name: string }>("SELECT name FROM departments WHERE id=$1", [departmentId]) : Promise.resolve({ rows: [] as { name: string }[] }),
        ]);
        diff["Алба"] = { from: od.rows[0]?.name ?? old.department_id ?? "—", to: nd.rows[0]?.name ?? departmentId ?? "—" };
      }
      if ((old.team_id ?? null) !== (teamId || null)) {
        const [ot, nt] = await Promise.all([
          old.team_id ? query<{ name: string }>("SELECT name FROM teams WHERE id=$1", [old.team_id]) : Promise.resolve({ rows: [] as { name: string }[] }),
          teamId ? query<{ name: string }>("SELECT name FROM teams WHERE id=$1", [teamId]) : Promise.resolve({ rows: [] as { name: string }[] }),
        ]);
        diff["Бригад"] = { from: ot.rows[0]?.name ?? old.team_id ?? "—", to: nt.rows[0]?.name ?? teamId ?? "—" };
      }
      if ((old.phone ?? "") !== (phone ?? "")) diff["Утас"] = { from: old.phone ?? "", to: phone ?? "" };
      if (password?.trim()) diff["Нууц үг"] = { from: "***", to: "***" };
    }
    let userResult;
    if (password?.trim()) {
      const hash = await bcrypt.hash(password, 10);
      userResult = await query(
        "UPDATE users SET full_name=$1, username=$2, password_hash=$3, role=$4, department_id=$5, team_id=$6, phone=$7, email=$8 WHERE id=$9",
        [fullName.trim(), username.trim(), hash, role, departmentId || null, teamId || null, phone || "", email || null, req.params.id]
      );
    } else {
      userResult = await query(
        "UPDATE users SET full_name=$1, username=$2, role=$3, department_id=$4, team_id=$5, phone=$6, email=$7 WHERE id=$8",
        [fullName.trim(), username.trim(), role, departmentId || null, teamId || null, phone || "", email || null, req.params.id]
      );
    }
    if ((userResult.rowCount ?? 0) === 0) {
      res.status(404).json({ ok: false, message: "Хэрэглэгч олдсонгүй" });
      return;
    }
    await audit(req.user!.id, "update", "user", req.params.id, `${fullName.trim()} (${username.trim()})`, JSON.stringify(diff));
    res.json({ ok: true });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ ok: false, message: "Энэ нэвтрэх нэр аль хэдийн бүртгэлтэй байна" });
      return;
    }
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const nameRes = await query<{ full_name: string; username: string }>(
      "SELECT full_name, username FROM users WHERE id=$1", [req.params.id]
    );
    await query("UPDATE users SET deleted_at = NOW() WHERE id=$1", [req.params.id]);
    const u = nameRes.rows[0];
    await audit(req.user!.id, "archive", "user", req.params.id, u ? `${u.full_name} (${u.username})` : "");
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.post("/users/:id/restore", async (req, res) => {
  try {
    const nameRes = await query<{ full_name: string; username: string }>(
      "SELECT full_name, username FROM users WHERE id=$1", [req.params.id]
    );
    await query("UPDATE users SET deleted_at = NULL WHERE id=$1", [req.params.id]);
    const u = nameRes.rows[0];
    await audit(req.user!.id, "restore", "user", req.params.id, u ? `${u.full_name} (${u.username})` : "");
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
    const isUpdate = !!id?.trim();
    await query(
      `INSERT INTO water_stations (id, code, name, bag_no, location, caretaker_name, caretaker_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET code=$2, name=$3, bag_no=$4, location=$5, caretaker_name=$6, caretaker_phone=$7, deleted_at=NULL`,
      [newId, code.trim(), name || "", bagNo, location || "", caretakerName || "", caretakerPhone || ""]
    );
    await audit(req.user!.id, isUpdate ? "update" : "create", "station", newId, code.trim());
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
    const oldRes = await query<{ code: string; name: string; bag_no: number; location: string; caretaker_name: string; caretaker_phone: string }>(
      "SELECT code, name, bag_no, location, caretaker_name, caretaker_phone FROM water_stations WHERE id=$1", [req.params.id]
    );
    const old = oldRes.rows[0];
    const diff: Record<string, { from: string; to: string }> = {};
    if (old) {
      if (old.code !== code.trim()) diff["Код"] = { from: old.code, to: code.trim() };
      if ((old.name ?? "") !== (name ?? "")) diff["Нэр"] = { from: old.name ?? "", to: name ?? "" };
      if (old.bag_no !== bagNo) diff["Баг"] = { from: String(old.bag_no), to: String(bagNo) };
      if ((old.location ?? "") !== (location ?? "")) diff["Байршил"] = { from: old.location ?? "", to: location ?? "" };
      if ((old.caretaker_name ?? "") !== (caretakerName ?? "")) diff["Хянагч"] = { from: old.caretaker_name ?? "", to: caretakerName ?? "" };
      if ((old.caretaker_phone ?? "") !== (caretakerPhone ?? "")) diff["Хянагчийн утас"] = { from: old.caretaker_phone ?? "", to: caretakerPhone ?? "" };
    }
    const stationResult = await query(
      "UPDATE water_stations SET code=$1, name=$2, bag_no=$3, location=$4, caretaker_name=$5, caretaker_phone=$6 WHERE id=$7",
      [code.trim(), name || "", bagNo, location || "", caretakerName || "", caretakerPhone || "", req.params.id]
    );
    if ((stationResult.rowCount ?? 0) === 0) {
      res.status(404).json({ ok: false, message: "Станц олдсонгүй" });
      return;
    }
    await audit(req.user!.id, "update", "station", req.params.id, code.trim(), JSON.stringify(diff));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.delete("/stations/:id", async (req, res) => {
  try {
    const nameRes = await query<{ code: string }>("SELECT code FROM water_stations WHERE id=$1", [req.params.id]);
    await query("UPDATE water_stations SET deleted_at = NOW() WHERE id=$1", [req.params.id]);
    await audit(req.user!.id, "archive", "station", req.params.id, nameRes.rows[0]?.code ?? "");
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.post("/stations/:id/restore", async (req, res) => {
  try {
    const nameRes = await query<{ code: string }>("SELECT code FROM water_stations WHERE id=$1", [req.params.id]);
    await query("UPDATE water_stations SET deleted_at = NULL WHERE id=$1", [req.params.id]);
    await audit(req.user!.id, "restore", "station", req.params.id, nameRes.rows[0]?.code ?? "");
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

export default router;
