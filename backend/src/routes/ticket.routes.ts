import { Router } from "express";
import { query } from "../db";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

const router = Router();

const createId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const generateTicketNo = async () => {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const countResult = await query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM tickets WHERE ticket_no LIKE $1",
    [`TKT-${datePart}-%`]
  );
  const count = Number(countResult.rows[0]?.count ?? 0) + 1;
  return `TKT-${datePart}-${String(count).padStart(3, "0")}`;
};

const buildStatus = (priority: string, hasTeam: boolean) => {
  if (priority === "urgent") return "urgent";
  return hasTeam ? "assigned" : "new";
};

const toTicket = (row: Record<string, unknown>) => ({
  id: row.id,
  complaintId: row.complaint_id ?? undefined,
  ticketNo: row.ticket_no,
  stationId: row.station_id,
  departmentId: row.department_id ?? undefined,
  teamId: row.team_id ?? undefined,
  issueType: row.issue_type,
  description: row.description,
  priority: row.priority,
  status: row.status,
  source: row.source,
  createdBy: row.created_by,
  assignedBy: row.assigned_by ?? undefined,
  assignedAt: row.assigned_at ?? undefined,
  createdAt: row.created_at,
  startedAt: row.started_at ?? undefined,
  finishedAt: row.finished_at ?? undefined,
});

// GET /api/tickets
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    let sql = "SELECT * FROM tickets";
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
    res.json({ ok: true, tickets: result.rows.map(toTicket) });
  } catch (err) {
    console.error("Get tickets error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

// POST /api/tickets
router.post("/", requireAuth, requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const { complaintId, stationId, departmentId, teamId, issueType, description, priority, source, createdBy } =
      req.body as {
        complaintId?: string; stationId: string; departmentId?: string; teamId?: string;
        issueType: string; description: string; priority: string; source: string; createdBy: string;
      };

    if (!stationId || !issueType || !source) {
      res.status(400).json({ ok: false, message: "Шаардлагатай талбарыг бөглөнө үү" });
      return;
    }

    const id = createId("ticket");
    const ticketNo = await generateTicketNo();
    const status = buildStatus(priority || "normal", Boolean(teamId));
    const now = new Date().toISOString();

    await query(
      `INSERT INTO tickets (id, complaint_id, ticket_no, station_id, department_id, team_id, issue_type, description, priority, status, source, created_by, assigned_by, assigned_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [id, complaintId || null, ticketNo, stationId, departmentId || null, teamId || null,
        issueType, description || "", priority || "normal", status, source,
        createdBy, teamId ? createdBy : null, teamId ? now : null, now]
    );

    await query(
      "INSERT INTO ticket_logs (id, ticket_id, user_id, action, note, logged_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [createId("tl"), id, createdBy, "Засварын хүсэлт үүсгэсэн", `${ticketNo} дугаартай засварын хүсэлт бүртгэлээ.`, now]
    );

    if (teamId && departmentId) {
      await query(
        "INSERT INTO ticket_logs (id, ticket_id, user_id, action, note, logged_at) VALUES ($1,$2,$3,$4,$5,$6)",
        [createId("tl"), id, createdBy, "Багт хуваарилсан", "Шинэ засварын хүсэлтийг бригад руу хуваарилсан.", now]
      );
    }

    if (complaintId) {
      await query("UPDATE complaints SET status = 'converted' WHERE id = $1", [complaintId]);
    }

    res.status(201).json({ ok: true, id, ticketNo });
  } catch (err) {
    console.error("Create ticket error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

// PATCH /api/tickets/:id/assign
router.patch("/:id/assign", requireAuth, requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const { id } = req.params;
    const { departmentId, teamId, priority, assignedBy } = req.body as {
      departmentId: string; teamId: string; priority: string; assignedBy: string;
    };
    const status = buildStatus(priority || "normal", Boolean(teamId));
    const now = new Date().toISOString();

    await query(
      "UPDATE tickets SET department_id=$1, team_id=$2, priority=$3, status=$4, assigned_by=$5, assigned_at=$6 WHERE id=$7",
      [departmentId || null, teamId || null, priority || "normal", status, assignedBy, now, id]
    );

    await query(
      "INSERT INTO ticket_logs (id, ticket_id, user_id, action, note, logged_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [createId("tl"), id, assignedBy, "Хуваарилалт шинэчилсэн", "Засварын хүсэлтийн хуваарилалт шинэчлэгдлээ.", now]
    );

    if (priority === "urgent") {
      await query(
        "INSERT INTO ticket_logs (id, ticket_id, user_id, action, note, logged_at) VALUES ($1,$2,$3,$4,$5,$6)",
        [createId("tl"), id, assignedBy, "Яаралтай болгосон", "Засварын хүсэлтийг яаралтай ангилалд орууллаа.", now]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Assign ticket error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

// PATCH /api/tickets/:id/start
router.patch("/:id/start", requireAuth, requireRole("brigade_leader"), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const now = new Date().toISOString();

    await query(
      "UPDATE tickets SET status='in_progress', started_at=COALESCE(started_at,$1) WHERE id=$2",
      [now, id]
    );
    await query(
      "INSERT INTO ticket_logs (id, ticket_id, user_id, action, note, logged_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [createId("tl"), id, userId, "Ажил эхэлсэн", "Ажил эхлүүлэв.", now]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Start ticket error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

// PATCH /api/tickets/:id/finish
router.patch("/:id/finish", requireAuth, requireRole("brigade_leader"), async (req, res) => {
  try {
    const { id } = req.params;
    const { reportDescription, materialsUsed, workerIds } = req.body as {
      reportDescription: string; materialsUsed?: string; workerIds?: string[];
    };
    const userId = req.user!.id;
    const now = new Date().toISOString();

    const ticketRes = await query<{ team_id: string; started_at: string | null }>(
      "SELECT team_id, started_at FROM tickets WHERE id = $1", [id]
    );
    const ticket = ticketRes.rows[0];
    if (!ticket) {
      res.status(404).json({ ok: false, message: "Засварын хүсэлт олдсонгүй" });
      return;
    }

    await query(
      "UPDATE tickets SET status='done', finished_at=$1, started_at=COALESCE(started_at,$1) WHERE id=$2",
      [now, id]
    );
    await query(
      "INSERT INTO ticket_logs (id, ticket_id, user_id, action, note, logged_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [createId("tl"), id, userId, "Ажил дууссан", reportDescription, now]
    );
    await query(
      "INSERT INTO maintenance_logs (id, ticket_id, team_id, description, materials_used, started_at, finished_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [createId("ml"), id, ticket.team_id, reportDescription, materialsUsed || "Материал тэмдэглээгүй", ticket.started_at || now, now, now]
    );

    await query("DELETE FROM ticket_workers WHERE ticket_id = $1", [id]);
    for (const workerId of workerIds ?? []) {
      await query(
        "INSERT INTO ticket_workers (id, ticket_id, user_id) VALUES ($1,$2,$3)",
        [createId("tw"), id, workerId]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Finish ticket error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

export default router;
