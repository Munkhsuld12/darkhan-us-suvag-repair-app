import { Router } from "express";
import { query } from "../db";

const router = Router();

// GET /api/stations — public list
router.get("/", async (req, res) => {
  try {
    const { bag, search } = req.query as { bag?: string; search?: string };
    let sql = "SELECT id, code, name, bag_no, location, caretaker_name, caretaker_phone FROM water_stations WHERE deleted_at IS NULL";
    const params: unknown[] = [];
    let pi = 1;

    if (bag && bag !== "all") {
      sql += ` AND bag_no = $${pi++}`;
      params.push(Number(bag));
    }

    if (search?.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(code) LIKE $${pi} OR LOWER(name) LIKE $${pi} OR LOWER(location) LIKE $${pi} OR LOWER(caretaker_name) LIKE $${pi})`;
      params.push(q);
      pi++;
    }

    sql += " ORDER BY bag_no, code";
    const result = await query<Record<string, unknown>>(sql, params);

    res.json({
      ok: true,
      stations: result.rows.map((r) => ({
        id: r.id, code: r.code, name: r.name, bagNo: r.bag_no,
        location: r.location, caretakerName: r.caretaker_name, caretakerPhone: r.caretaker_phone,
      })),
    });
  } catch (err) {
    console.error("Get stations error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

// GET /api/stations/:id — station detail + recent maintenance
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const stationRes = await query<Record<string, unknown>>(
      "SELECT id, code, name, bag_no, location, caretaker_name, caretaker_phone FROM water_stations WHERE id = $1",
      [id]
    );

    if (!stationRes.rows.length) {
      res.status(404).json({ ok: false, message: "Ус түгээх байр олдсонгүй" });
      return;
    }

    const s = stationRes.rows[0];
    const station = {
      id: s.id, code: s.code, name: s.name, bagNo: s.bag_no,
      location: s.location, caretakerName: s.caretaker_name, caretakerPhone: s.caretaker_phone,
    };

    const ticketsRes = await query<Record<string, unknown>>(
      "SELECT * FROM tickets WHERE station_id = $1 ORDER BY created_at DESC LIMIT 20",
      [id]
    );

    const maintenanceRes = await query<Record<string, unknown>>(
      `SELECT ml.*, t.name AS team_name
       FROM maintenance_logs ml
       LEFT JOIN teams t ON t.id = ml.team_id
       WHERE ml.ticket_id IN (SELECT id FROM tickets WHERE station_id = $1)
          OR ml.task_id IN (SELECT id FROM tasks WHERE station_id = $1)
       ORDER BY ml.created_at DESC LIMIT 20`,
      [id]
    );

    res.json({
      ok: true,
      station,
      tickets: ticketsRes.rows.map((r) => ({
        id: r.id, ticketNo: r.ticket_no, issueType: r.issue_type,
        description: r.description, status: r.status, priority: r.priority,
        createdAt: r.created_at, finishedAt: r.finished_at,
      })),
      maintenanceLogs: maintenanceRes.rows.map((r) => ({
        id: r.id, teamName: r.team_name, description: r.description,
        materialsUsed: r.materials_used, startedAt: r.started_at,
        finishedAt: r.finished_at, createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error("Get station detail error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

export default router;
