import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendPasswordResetEmail(to: string, resetUrl: string, fullName: string) {
  await transporter.sendMail({
    from: `"Дархан-Ус Суваг ХК" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Нууц үг сэргээх холбоос",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1e3a5f;margin-bottom:8px">Нууц үг сэргээх</h2>
        <p style="color:#444">Сайн байна уу, <strong>${fullName}</strong>.</p>
        <p style="color:#444">Таны бүртгэлд нууц үг сэргээх хүсэлт ирсэн байна. Шинэ нууц үг тохируулах бол доорх товчийг дарна уу.</p>
        <a href="${resetUrl}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
          Шинэ нууц үг тохируулах
        </a>
        <p style="color:#888;font-size:13px">Холбоосыг нэг цагийн дотор ашиглана уу.</p>
        <p style="color:#888;font-size:13px">Хэрэв та нууц үг сэргээх хүсэлт гаргаагүй бол энэ имэйлийг үл тоогоорой. Таны нууц үг хэвээр үлдэнэ.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="color:#aaa;font-size:12px">Дархан-Ус Суваг ХК</p>
      </div>
    `,
  });
}
