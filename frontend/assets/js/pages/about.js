import { login as apiLogin } from "../api.js";
import { setSession, getRoleRedirect } from "../auth.js";

// Fill dynamic stats
fetch("/api/stations")
  .then((r) => r.json())
  .then(({ stations }) => {
    if (!stations?.length) return;
    const stEl = document.getElementById("stat-stations");
    const bgEl = document.getElementById("stat-bags");
    if (stEl) stEl.textContent = stations.length;
    if (bgEl) bgEl.textContent = new Set(stations.map((s) => s.bagNo)).size;
  })
  .catch(() => {
    ["stat-stations", "stat-bags"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = "—";
    });
  });

const modal      = document.getElementById("login-modal");
const form       = document.getElementById("login-modal-form");
const errEl      = document.getElementById("lm-error");
const submitBtn  = document.getElementById("lm-submit");
const forgotForm = document.getElementById("forgot-form");
const forgotMsg  = document.getElementById("forgot-msg");

const showLogin  = () => { form.style.display = ""; forgotForm.style.display = "none"; };
const showForgot = () => { form.style.display = "none"; forgotForm.style.display = ""; forgotMsg.style.display = "none"; };

const openModal  = () => {
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
  form.reset(); errEl.style.display = "none"; showLogin();
};
const closeModal = () => { modal.style.display = "none"; document.body.style.overflow = ""; };

document.getElementById("open-login-btn").addEventListener("click", openModal);
document.getElementById("close-login-btn").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
if (new URLSearchParams(location.search).get("login") === "1") openModal();

document.getElementById("lm-forgot-link").addEventListener("click", (e) => { e.preventDefault(); showForgot(); });
document.getElementById("lm-back-link").addEventListener("click",   (e) => { e.preventDefault(); showLogin(); });

document.getElementById("lm-toggle-password").addEventListener("click", () => {
  const inp = document.getElementById("lm-password");
  inp.type = inp.type === "password" ? "text" : "password";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errEl.style.display = "none";
  submitBtn.disabled = true; submitBtn.textContent = "Нэвтэрч байна…";
  try {
    const data = await apiLogin(
      document.getElementById("lm-username").value.trim(),
      document.getElementById("lm-password").value
    );
    setSession(data.token, data.user);
    location.href = data.user.profileComplete === false
      ? "/profile-setup.html"
      : getRoleRedirect(data.user.role);
  } catch (err) {
    errEl.textContent = err.message || "Нэвтрэхэд алдаа гарлаа";
    errEl.style.display = "";
  } finally {
    submitBtn.disabled = false; submitBtn.textContent = "Нэвтрэх";
  }
});

document.getElementById("forgot-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("lm-email").value.trim();
  const btn   = document.getElementById("forgot-submit");
  forgotMsg.style.display = "none";
  btn.disabled = true; btn.textContent = "Илгээж байна…";
  try {
    const res  = await fetch("/api/auth/forgot-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    forgotMsg.textContent = data.ok ? "Нууц үг шинэчлэх линк илгээгдлээ." : (data.message || "Алдаа гарлаа");
    forgotMsg.style.cssText = `display:block;color:${data.ok ? "var(--emerald-700)" : "var(--rose-600)"};background:${data.ok ? "var(--emerald-50)" : "var(--rose-50)"};padding:8px 12px;border-radius:6px;font-size:13px`;
  } catch {
    forgotMsg.textContent = "Серверийн алдаа.";
    forgotMsg.style.cssText = "display:block;color:var(--rose-600);font-size:13px";
  } finally {
    btn.disabled = false; btn.textContent = "Холбоос илгээх";
  }
});
