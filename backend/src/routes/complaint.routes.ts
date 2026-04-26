import { Router } from "express";
import { query } from "../db";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

const router = Router();

const createId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

// GET /api/complaints
router.get("/", requireAuth, requireRole("admin", "dispatcher"), async (_req, res) => {
  try {
    const result = await query<Record<string, unknown>>(`
      SELECT c.*, ws.code AS station_code
      FROM complaints c
      LEFT JOIN water_stations ws ON ws.id = c.station_id
      ORDER BY c.created_at DESC
    `);

    res.json({
      ok: true,
      complaints: result.rows.map((row) => ({
        id: row.id,
        stationId: row.station_id,
        issueType: row.issue_type,
        description: row.description,
        citizenName: row.citizen_name,
        phoneNumber: row.phone_number,
        source: row.source,
        photoName: row.photo_name,
        status: row.status,
        createdAt: row.created_at,
        createdByLabel: row.created_by_label,
        stationCode: row.station_code,
      })),
    });
  } catch (err) {
    console.error("Get complaints error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

// POST /api/complaints (public — no auth required)
router.post("/", async (req, res) => {
  try {
    const {
      stationId, issueType, description, citizenName,
      phoneNumber, source, photoName, createdByLabel,
    } = req.body as {
      stationId: string; issueType: string; description: string; citizenName: string;
      phoneNumber: string; source: "web" | "phone"; photoName?: string; createdByLabel?: string;
    };

    if (!stationId || !issueType || !source) {
      res.status(400).json({ ok: false, message: "Шаардлагатай талбарыг бөглөнө үү" });
      return;
    }

    const id = createId("complaint");
    const now = new Date().toISOString();

    await query(
      `INSERT INTO complaints (id, station_id, issue_type, description, citizen_name, phone_number, source, photo_name, status, created_at, created_by_label)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'new',$9,$10)`,
      [id, stationId, issueType, description || "", citizenName || "", phoneNumber || "", source, photoName || null, now, createdByLabel || "Иргэн"]
    );

    res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error("Create complaint error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

export default router;
