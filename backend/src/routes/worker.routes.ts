import { randomUUID } from "crypto";
import { Router } from "express";
import { query } from "../db";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

const router = Router();
router.use(requireAuth);

const audit = (userId: string, action: string, entityId: string, entityName: string, details = "") =>
  query(
    "INSERT INTO admin_audit_logs (id, user_id, action, entity_type, entity_id, entity_name, details, created_at) VALUES ($1,$2,$3,'worker',$4,$5,$6,NOW())",
    [randomUUID(), userId, action, entityId, entityName, details]
  ).catch((e) => console.error("Audit log error:", e));

// GET /api/workers — admin sees all, brigade_leader sees own team
router.get("/", async (req, res) => {
  try {
    const user = req.user!;
    let sql = "SELECT w.*, t.name AS team_name FROM workers w LEFT JOIN teams t ON t.id = w.team_id";
    const params: unknown[] = [];
    if (user.role === "brigade_leader" && user.teamId) {
      sql += " WHERE w.team_id = $1";
      params.push(user.teamId);
    }
    sql += " ORDER BY t.name, w.full_name";
    const result = await query<Record<string, unknown>>(sql, params);
    res.json({
      ok: true,
      workers: result.rows.map((r) => ({
        id: r.id, fullName: r.full_name, phone: r.phone,
        position: r.position, teamId: r.team_id, teamName: r.team_name,
        notes: r.notes, createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

// POST /api/workers
router.post("/", requireRole("admin", "brigade_leader"), async (req, res) => {
  try {
    const user = req.user!;
    const { fullName, phone, position, teamId, notes } = req.body as {
      fullName: string; phone?: string; position?: string; teamId: string; notes?: string;
    };
    if (!fullName?.trim() || !teamId) {
      res.status(400).json({ ok: false, message: "Нэр болон бригад шаардлагатай" });
      return;
    }
    if (user.role === "brigade_leader" && user.teamId !== teamId) {
      res.status(403).json({ ok: false, message: "Өөр бригадад ажилтан нэмэх эрхгүй" });
      return;
    }
    const id = randomUUID();
    await query(
      "INSERT INTO workers (id, full_name, phone, position, team_id, notes) VALUES ($1,$2,$3,$4,$5,$6)",
      [id, fullName.trim(), phone?.trim() || "", position?.trim() || "", teamId, notes?.trim() || ""]
    );
    await audit(user.id, "create", id, fullName.trim());
    res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

// PUT /api/workers/:id
router.put("/:id", requireRole("admin", "brigade_leader"), async (req, res) => {
  try {
    const user = req.user!;
    const id = String(req.params.id);
    const { fullName, phone, position, notes } = req.body as {
      fullName: string; phone?: string; position?: string; notes?: string;
    };

    const existing = await query<{ team_id: string }>("SELECT team_id FROM workers WHERE id=$1", [id]);
    if (!existing.rows[0]) { res.status(404).json({ ok: false, message: "Ажилтан олдсонгүй" }); return; }
    if (user.role === "brigade_leader" && existing.rows[0].team_id !== user.teamId) {
      res.status(403).json({ ok: false, message: "Энэ ажилтныг засах эрхгүй" }); return;
    }

    await query(
      "UPDATE workers SET full_name=$1, phone=$2, position=$3, notes=$4, updated_at=NOW() WHERE id=$5",
      [fullName.trim(), phone?.trim() || "", position?.trim() || "", notes?.trim() || "", id]
    );
    await audit(user.id, "update", id, fullName.trim());
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

// DELETE /api/workers/:id
router.delete("/:id", requireRole("admin", "brigade_leader"), async (req, res) => {
  try {
    const user = req.user!;
    const id = String(req.params.id);
    const existing = await query<{ team_id: string; full_name: string }>(
      "SELECT team_id, full_name FROM workers WHERE id=$1", [id]
    );
    if (!existing.rows[0]) { res.status(404).json({ ok: false, message: "Ажилтан олдсонгүй" }); return; }
    if (user.role === "brigade_leader" && existing.rows[0].team_id !== user.teamId) {
      res.status(403).json({ ok: false, message: "Энэ ажилтныг устгах эрхгүй" }); return;
    }
    await query("DELETE FROM workers WHERE id=$1", [id]);
    await audit(user.id, "delete", id, existing.rows[0].full_name);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

export default router;
