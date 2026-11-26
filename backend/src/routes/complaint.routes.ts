import { randomBytes, randomUUID } from "crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import fs from "fs/promises";
import multer from "multer";
import path from "path";
import { query } from "../db";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.middleware";

const router = Router();

const toComplaint = (row: Record<string, unknown>) => ({
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
});

// Зөвхөн эдгээр зургийн төрлийг зөвшөөрнө. Өргөтгөлийг сервер өөрөө сонгоно —
// хэрэглэгчийн өгсөн файлын нэрийн өргөтгөлийг (.html, .js гэх мэт) хэзээ ч ашиглахгүй.
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

// Файлын эхний байтуудаар (magic bytes) жинхэнэ зураг мөн эсэхийг шалгана
const looksLikeImage = (buf: Buffer, mimetype: string) => {
  switch (mimetype) {
    case "image/jpeg": return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case "image/png":  return buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/gif":  return buf.length > 6 && (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a");
    case "image/webp": return buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
    default: return false;
  }
};

const uploadDir = path.resolve(__dirname, "../../../frontend/uploads");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB
  fileFilter: (_req, file, cb) => {
    cb(null, Object.prototype.hasOwnProperty.call(ALLOWED_IMAGE_TYPES, file.mimetype));
  },
});

// Санах ойд байгаа зургийг шалгаад дискэнд хадгална. Зураг биш бол алдаа шиднэ.
const savePhoto = async (file?: Express.Multer.File): Promise<string | null> => {
  if (!file) return null;
  if (!looksLikeImage(file.buffer, file.mimetype)) {
    throw new InvalidPhotoError();
  }
  const name = `${randomUUID()}${ALLOWED_IMAGE_TYPES[file.mimetype]}`;
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, name), file.buffer);
  return name;
};

class InvalidPhotoError extends Error {}

// Олон нийтийн гомдол илгээх хязгаар (spam-аас хамгаална)
const complaintLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Хэт олон хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу." },
});

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
        ...toComplaint(row),
      })),
    });
  } catch (err) {
    console.error("Get complaints error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.get("/:id/edit", async (req, res) => {
  try {
    const { id } = req.params;
    const token = String(req.query.token ?? "");
    if (!token) {
      res.status(400).json({ ok: false, message: "Засах token шаардлагатай" });
      return;
    }

    const result = await query<Record<string, unknown>>(
      `SELECT c.*, ws.code AS station_code
       FROM complaints c
       LEFT JOIN water_stations ws ON ws.id = c.station_id
       WHERE c.id = $1 AND c.edit_token = $2`,
      [id, token]
    );
    const complaint = result.rows[0];
    if (!complaint) {
      res.status(404).json({ ok: false, message: "Хүсэлт олдсонгүй эсвэл засах холбоос буруу байна" });
      return;
    }

    res.json({ ok: true, complaint: toComplaint(complaint) });
  } catch (err) {
    console.error("Get editable complaint error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.post("/", complaintLimiter, optionalAuth, upload.single("photo"), async (req, res) => {
  try {
    const { stationId, issueType, description, citizenName, phoneNumber } = req.body as {
      stationId: string; issueType: string; description: string; citizenName: string;
      phoneNumber: string; source?: string; createdByLabel?: string;
    };

    if (!stationId || !issueType) {
      res.status(400).json({ ok: false, message: "Шаардлагатай талбарыг бөглөнө үү" });
      return;
    }

    // Зөвхөн нэвтэрсэн ажилтан утасны дуудлага бүртгэж, өөрийн нэрээр тэмдэглэнэ.
    // Нэвтрээгүй хүн үргэлж "вэб / Иргэн" гэж бүртгэгдэнэ.
    const staff = req.user && ["admin", "dispatcher"].includes(req.user.role) ? req.user : null;
    const source = staff && req.body.source === "phone" ? "phone" : "web";
    const createdByLabel = staff
      ? String(req.body.createdByLabel || "").trim().slice(0, 100) || "Диспетчер"
      : "Иргэн";

    const photoName = await savePhoto(req.file);
    const id = randomUUID();
    const editToken = randomBytes(24).toString("hex");
    const now = new Date().toISOString();

    await query(
      `INSERT INTO complaints (id, station_id, issue_type, description, citizen_name, phone_number, source, photo_name, status, created_at, created_by_label, edit_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'new',$9,$10,$11)`,
      [id, stationId, issueType, description || "", citizenName || "", phoneNumber || "", source, photoName, now, createdByLabel, editToken]
    );

    res.status(201).json({ ok: true, id, editToken });
  } catch (err) {
    if (err instanceof InvalidPhotoError) {
      res.status(400).json({ ok: false, message: "Зөвхөн JPG, PNG, WEBP, GIF зураг хавсаргана уу" });
      return;
    }
    console.error("Create complaint error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.patch("/:id", complaintLimiter, upload.single("photo"), async (req, res) => {
  try {
    const { id } = req.params;
    const { token, stationId, issueType, description, citizenName, phoneNumber } = req.body as {
      token: string; stationId: string; issueType: string; description: string; citizenName: string; phoneNumber: string;
    };

    if (!token || !stationId || !issueType) {
      res.status(400).json({ ok: false, message: "Шаардлагатай талбарыг бөглөнө үү" });
      return;
    }

    const existing = await query<{ status: string }>(
      "SELECT status FROM complaints WHERE id = $1 AND edit_token = $2",
      [id, token]
    );
    const complaint = existing.rows[0];
    if (!complaint) {
      res.status(404).json({ ok: false, message: "Хүсэлт олдсонгүй эсвэл засах холбоос буруу байна" });
      return;
    }
    if (complaint.status !== "new") {
      res.status(409).json({ ok: false, message: "Энэ хүсэлт аль хэдийн бүртгэгдсэн тул засах боломжгүй" });
      return;
    }

    const photoName = await savePhoto(req.file);
    await query(
      `UPDATE complaints
       SET station_id=$1, issue_type=$2, description=$3, citizen_name=$4, phone_number=$5,
           photo_name=COALESCE($6, photo_name)
       WHERE id=$7 AND edit_token=$8`,
      [stationId, issueType, description || "", citizenName || "", phoneNumber || "", photoName, id, token]
    );

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof InvalidPhotoError) {
      res.status(400).json({ ok: false, message: "Зөвхөн JPG, PNG, WEBP, GIF зураг хавсаргана уу" });
      return;
    }
    console.error("Update complaint error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

export default router;
