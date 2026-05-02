import { randomUUID } from "crypto";
import { Router } from "express";
import { pool, query } from "../db";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

const router = Router();

const toTask = (row: Record<string, unknown>) => ({
  id: row.id,
  stationId: row.station_id,
  teamId: row.team_id,
  departmentId: row.department_id,
  createdBy: row.created_by,
  description: row.description,
  status: row.status,
  taskDate: typeof row.task_date === "object" && row.task_date !== null
    ? (row.task_date as Date).toISOString().slice(0, 10)
    : String(row.task_date).slice(0, 10),
  startedAt: row.started_at ?? undefined,
  finishedAt: row.finished_at ?? undefined,
  workReport: row.work_report ?? undefined,
  createdAt: row.created_at,
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    let sql = "SELECT * FROM tasks";
    const params: unknown[] = [];

    if (user.role === "brigade_leader" && user.teamId) {
      sql += " WHERE team_id = $1";
      params.push(user.teamId);
    } else if (user.role === "department_engineer" && user.departmentId) {
      sql += " WHERE department_id = $1";
      params.push(user.departmentId);
    }

    sql += " ORDER BY created_at DESC";
    const result = await query<Record<string, unknown>>(sql, params);
    res.json({ ok: true, tasks: result.rows.map(toTask) });
  } catch (err) {
    console.error("Get tasks error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.post("/", requireAuth, requireRole("admin", "general_engineer", "department_engineer"), async (req, res) => {
  try {
    const { stationId, teamId, departmentId, createdBy, description, taskDate } = req.body as {
      stationId: string; teamId: string; departmentId: string;
      createdBy: string; description: string; taskDate: string;
    };

    if (!stationId || !teamId || !departmentId || !description || !taskDate) {
      res.status(400).json({ ok: false, message: "Шаардлагатай талбарыг бөглөнө үү" });
      return;
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    await query(
      "INSERT INTO tasks (id, station_id, team_id, department_id, created_by, description, status, task_date, created_at) VALUES ($1,$2,$3,$4,$5,$6,'assigned',$7,$8)",
      [id, stationId, teamId, departmentId, createdBy, description, taskDate, now]
    );

    res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error("Create task error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.patch("/:id/start", requireAuth, requireRole("brigade_leader"), async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date().toISOString();
    await query(
      "UPDATE tasks SET status='in_progress', started_at=COALESCE(started_at,$1) WHERE id=$2",
      [now, id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Start task error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.patch("/:id/finish", requireAuth, requireRole("brigade_leader"), async (req, res) => {
  const { id } = req.params;
  const { reportDescription, materialsUsed } = req.body as {
    reportDescription: string; materialsUsed?: string;
  };
  const userTeamId = req.user!.teamId;
  const now = new Date().toISOString();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const taskRes = await client.query<{ team_id: string; started_at: string | null; status: string }>(
      "SELECT team_id, started_at, status FROM tasks WHERE id = $1 FOR UPDATE", [id]
    );
    const task = taskRes.rows[0];
    if (!task) {
      await client.query("ROLLBACK");
      res.status(404).json({ ok: false, message: "Ажил олдсонгүй" });
      return;
    }
    if (task.team_id !== userTeamId) {
      await client.query("ROLLBACK");
      res.status(403).json({ ok: false, message: "Энэ ажил таны бригадад хуваарилагдаагүй" });
      return;
    }
    // Idempotent: аль хэдийн дуусгасан бол давхар maintenance_log үүсгэхгүй
    if (task.status === "done") {
      await client.query("ROLLBACK");
      res.json({ ok: true });
      return;
    }

    await client.query(
      "UPDATE tasks SET status='done', finished_at=$1, started_at=COALESCE(started_at,$1), work_report=$2 WHERE id=$3",
      [now, reportDescription, id]
    );
    await client.query(
      "INSERT INTO maintenance_logs (id, task_id, team_id, description, materials_used, started_at, finished_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [randomUUID(), id, task.team_id, reportDescription, materialsUsed || "Материал тэмдэглээгүй", task.started_at || now, now, now]
    );

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Finish task error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  } finally {
    client.release();
  }
});

export default router;
