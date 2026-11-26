import bcrypt from "bcrypt";
import { createHash, randomBytes, randomUUID } from "crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { pool, query } from "../db";
import { requireAuth, signToken } from "../middleware/auth.middleware";
import { sendPasswordResetEmail } from "../mailer";

const router = Router();

// Хэрэглэгчийн өөрөө сонгох нууц үгийн доод урт
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_LENGTH_MESSAGE = `Нууц үг хамгийн багадаа ${MIN_PASSWORD_LENGTH} тэмдэгт байна`;

// Reset холбоосын token-ийг өгөгдлийн санд hash хэлбэрээр хадгална (DB алдагдсан ч ашиглах боломжгүй)
const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Нууц үг солигдсоны дараа хуучин token хүчингүй болдог тул шинэ token олгоно
const freshTokenFor = async (userId: string) => {
  const r = await query<{ id: string; role: string; department_id: string | null; team_id: string | null }>(
    "SELECT id, role, department_id, team_id FROM users WHERE id = $1",
    [userId]
  );
  return r.rows[0] ? signToken(r.rows[0]) : undefined;
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Хэт олон оролдлого. 15 минутын дараа дахин оролдоно уу." },
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body as { username: string; password: string };
    if (!username || !password) {
      res.status(400).json({ ok: false, message: "Нэвтрэх нэр болон нууц үгийг оруулна уу" });
      return;
    }

    const result = await query<{
      id: string; full_name: string; username: string; password_hash: string;
      role: string; department_id: string | null; team_id: string | null;
      phone: string; email: string | null; profile_complete: boolean;
    }>(
      "SELECT id, full_name, username, password_hash, role, department_id, team_id, phone, email, profile_complete FROM users WHERE username = $1 AND deleted_at IS NULL",
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

    const token = signToken(user);

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
        email: user.email,
        profileComplete: user.profile_complete,
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
      role: string; department_id: string | null; team_id: string | null;
      phone: string; email: string | null; profile_complete: boolean;
    }>(
      "SELECT id, full_name, username, role, department_id, team_id, phone, email, profile_complete FROM users WHERE id = $1",
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
        email: user.email,
        profileComplete: user.profile_complete,
      },
    });
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.patch("/setup-profile", requireAuth, async (req, res) => {
  try {
    const { fullName, username, email, phone, newPassword } = req.body as {
      fullName: string; username?: string; email?: string; phone: string; newPassword: string;
    };

    if (!fullName?.trim() || !username?.trim() || !phone?.trim() || !newPassword?.trim()) {
      res.status(400).json({ ok: false, message: "Овог нэр, нэвтрэх нэр, утасны дугаар болон нууц үгээ оруулна уу" });
      return;
    }
    // Энэ зам зөвхөн анх нэвтрэх (эсвэл админ нууц үг шинэчилсний дараах) тохиргоонд зориулагдсан.
    // Профайл бүрэн болсон хэрэглэгч одоогийн нууц үгээ оруулахгүйгээр солиж чадахгүй — /profile ашиглана.
    const stateRes = await query<{ profile_complete: boolean }>(
      "SELECT profile_complete FROM users WHERE id = $1",
      [req.user!.id]
    );
    if (stateRes.rows[0]?.profile_complete) {
      res.status(409).json({ ok: false, message: "Профайл аль хэдийн тохируулагдсан. Нууц үг солихдоо одоогийн нууц үгээ оруулна уу." });
      return;
    }
    const cleanUsername = username.trim();
    if (!/^[A-Za-z0-9._-]{3,50}$/.test(cleanUsername)) {
      res.status(400).json({ ok: false, message: "Нэвтрэх нэр 3-50 тэмдэгт, латин үсэг/тоо/._- тэмдэгтээс бүрдэнэ" });
      return;
    }
    const usernameRes = await query<{ id: string }>(
      "SELECT id FROM users WHERE username = $1 AND id <> $2 AND deleted_at IS NULL",
      [cleanUsername, req.user!.id]
    );
    if (usernameRes.rows[0]) {
      res.status(409).json({ ok: false, message: "Энэ нэвтрэх нэр бүртгэлтэй байна" });
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ ok: false, message: PASSWORD_LENGTH_MESSAGE });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await query(
      "UPDATE users SET full_name=$1, username=$2, email=$3, phone=$4, password_hash=$5, profile_complete=true WHERE id=$6",
      [fullName.trim(), cleanUsername, email?.trim() || null, phone.trim(), hash, req.user!.id]
    );

    res.json({ ok: true, token: await freshTokenFor(req.user!.id) });
  } catch (err) {
    console.error("Setup profile error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.patch("/profile", requireAuth, async (req, res) => {
  try {
    const { fullName, username, email, phone, currentPassword, newPassword } = req.body as {
      fullName: string; username?: string; email?: string; phone: string; currentPassword?: string; newPassword?: string;
    };

    if (!fullName?.trim() || !username?.trim() || !phone?.trim()) {
      res.status(400).json({ ok: false, message: "Овог нэр, нэвтрэх нэр болон утасны дугаараа оруулна уу" });
      return;
    }
    const cleanUsername = username.trim();
    if (!/^[A-Za-z0-9._-]{3,50}$/.test(cleanUsername)) {
      res.status(400).json({ ok: false, message: "Нэвтрэх нэр 3-50 тэмдэгт, латин үсэг/тоо/._- тэмдэгтээс бүрдэнэ" });
      return;
    }
    const usernameRes = await query<{ id: string }>(
      "SELECT id FROM users WHERE username = $1 AND id <> $2 AND deleted_at IS NULL",
      [cleanUsername, req.user!.id]
    );
    if (usernameRes.rows[0]) {
      res.status(409).json({ ok: false, message: "Энэ нэвтрэх нэр бүртгэлтэй байна" });
      return;
    }
    if (newPassword && newPassword.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ ok: false, message: PASSWORD_LENGTH_MESSAGE });
      return;
    }

    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({ ok: false, message: "Нууц үг солихын тулд одоогийн нууц үгээ оруулна уу" });
        return;
      }
      const passwordRes = await query<{ password_hash: string }>(
        "SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL",
        [req.user!.id]
      );
      const currentUser = passwordRes.rows[0];
      if (!currentUser || !(await bcrypt.compare(currentPassword, currentUser.password_hash))) {
        res.status(400).json({ ok: false, message: "Одоогийн нууц үг буруу байна" });
        return;
      }
      const hash = await bcrypt.hash(newPassword, 10);
      await query(
        "UPDATE users SET full_name=$1, username=$2, email=$3, phone=$4, password_hash=$5, profile_complete=true WHERE id=$6",
        [fullName.trim(), cleanUsername, email?.trim() || null, phone.trim(), hash, req.user!.id]
      );
    } else {
      await query(
        "UPDATE users SET full_name=$1, username=$2, email=$3, phone=$4, profile_complete=true WHERE id=$5",
        [fullName.trim(), cleanUsername, email?.trim() || null, phone.trim(), req.user!.id]
      );
    }

    res.json({
      ok: true,
      token: newPassword ? await freshTokenFor(req.user!.id) : undefined,
      user: {
        id: req.user!.id,
        fullName: fullName.trim(),
        username: cleanUsername,
        email: email?.trim() || null,
        phone: phone.trim(),
        profileComplete: true,
      },
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { ok: false, message: "Хэт олон оролдлого. 15 минутын дараа дахин оролдоно уу." },
});

router.post("/forgot-password", forgotLimiter, async (req, res) => {
  const { email } = req.body as { email: string };
  if (!email?.trim()) {
    res.status(400).json({ ok: false, message: "Имэйл хаягаа оруулна уу" });
    return;
  }

  try {
    const result = await query<{ id: string; full_name: string; email: string }>(
      "SELECT id, full_name, email FROM users WHERE LOWER(email) = $1 AND deleted_at IS NULL",
      [email.trim().toLowerCase()]
    );
    // Always return success to avoid user enumeration
    if (!result.rows[0]) {
      res.json({ ok: true });
      return;
    }
    const user = result.rows[0];
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Өмнө илгээсэн ашиглагдаагүй холбоосуудыг хүчингүй болгоно — зөвхөн хамгийн сүүлийнх нь ажиллана
    await query(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
      [user.id]
    );
    await query(
      "INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)",
      [randomUUID(), user.id, hashResetToken(token), expiresAt.toISOString()]
    );

    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:4000";
    const resetUrl = `${baseUrl}/reset-password.html?token=${token}`;
    await sendPasswordResetEmail(user.email, resetUrl, user.full_name);

    res.json({ ok: true });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body as { token: string; newPassword: string };
  if (!token || !newPassword) {
    res.status(400).json({ ok: false, message: "Холбоосын код болон шинэ нууц үгээ оруулна уу" });
    return;
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ ok: false, message: PASSWORD_LENGTH_MESSAGE });
    return;
  }
  const tokenHash = hashResetToken(String(token));
  const hash = await bcrypt.hash(newPassword, 10);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Нэг алхамд "ашигласан" гэж тэмдэглэнэ — нэг холбоосыг зэрэг хоёр удаа ашиглах боломжгүй
    const claim = await client.query<{ user_id: string }>(
      `UPDATE password_reset_tokens SET used_at = NOW()
       WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING user_id`,
      [tokenHash]
    );
    const rec = claim.rows[0];
    if (!rec) {
      await client.query("ROLLBACK");
      const info = await query<{ used_at: Date | null; expires_at: Date }>(
        "SELECT used_at, expires_at FROM password_reset_tokens WHERE token = $1",
        [tokenHash]
      );
      const row = info.rows[0];
      const message = !row
        ? "Холбоос буруу эсвэл хүчингүй байна. Нууц үг сэргээх хүсэлтээ дахин илгээнэ үү."
        : row.used_at
          ? "Энэ холбоосыг аль хэдийн ашигласан эсвэл шинэ холбоосоор солигдсон байна"
          : "Энэ холбоосын хүчинтэй хугацаа дууссан байна. Нууц үг сэргээх хүсэлтээ дахин илгээнэ үү.";
      res.status(400).json({ ok: false, message });
      return;
    }

    await client.query("UPDATE users SET password_hash = $1, profile_complete = true WHERE id = $2", [hash, rec.user_id]);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Reset password error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  } finally {
    client.release();
  }
});

export default router;
