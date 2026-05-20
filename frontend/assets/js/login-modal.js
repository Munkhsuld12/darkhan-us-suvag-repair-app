import { login as apiLogin } from "./api.js";
import { setSession, getRoleRedirect } from "./auth.js";

// Inject modal HTML once
const html = `
<div id="login-modal" style="display:none;position:fixed;inset:0;z-index:60;overflow-y:auto;background:rgba(15,33,61,0.45);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);padding:12px;align-items:center;justify-content:center">
  <div style="width:100%;max-width:420px;margin:auto">
    <div class="card" style="padding:28px 28px 24px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px">
        <div>
          <p style="font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--slate-500);margin-bottom:4px">Нэвтрэх</p>
          <h2 style="font-size:1.25rem;font-weight:800;color:var(--ink-900);letter-spacing:-0.02em">Дотоод хэрэглэгч</h2>
        </div>
        <button id="close-login-btn" style="border-radius:999px;background:var(--slate-100);border:none;padding:8px 12px;font-size:13px;font-weight:600;color:var(--slate-600);cursor:pointer;flex-shrink:0">Хаах</button>
      </div>
      <form id="login-modal-form" class="field-grid">
        <div class="field">
          <label for="lm-username">Нэвтрэх нэр</label>
          <input id="lm-username" type="text" class="input" placeholder="Нэвтрэх нэр" required autocomplete="username">
        </div>
        <div class="field">
          <label for="lm-password">Нууц үг</label>
          <div style="position:relative">
            <input id="lm-password" type="password" class="input" placeholder="Нууц үгээ оруулна" required autocomplete="current-password" style="padding-right:40px">
            <button type="button" id="lm-toggle-password" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--slate-400);padding:0">
              <svg id="lm-eye-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
        </div>
        <p id="lm-error" class="error-msg" style="display:none"></p>
        <button id="lm-submit" type="submit" class="btn btn-primary btn-full btn-lg">Нэвтрэх</button>
        <p style="text-align:center;margin:4px 0 0">
          <a href="#" id="lm-forgot-link" style="font-size:13px;color:var(--blue-600);text-decoration:none">Нууц үг мартсан уу?</a>
        </p>
      </form>
      <form id="forgot-form" class="field-grid" style="display:none">
        <p style="font-size:13px;color:var(--slate-600);margin:0 0 4px">И-мэйл хаягаа оруулна уу.</p>
        <div class="field">
          <label for="lm-email">И-мэйл хаяг</label>
          <input id="lm-email" type="email" class="input" placeholder="name@example.com" required autocomplete="email">
        </div>
        <p id="forgot-msg" style="display:none;font-size:13px;padding:8px 12px;border-radius:6px"></p>
        <button id="forgot-submit" type="submit" class="btn btn-primary btn-full">Холбоос илгээх</button>
        <p style="text-align:center;margin:4px 0 0">
          <a href="#" id="lm-back-link" style="font-size:13px;color:var(--blue-600);text-decoration:none">Буцах</a>
        </p>
      </form>
    </div>
  </div>
</div>`;

document.body.insertAdjacentHTML("beforeend", html);

const modal      = document.getElementById("login-modal");
const form       = document.getElementById("login-modal-form");
const errEl      = document.getElementById("lm-error");
const submitBtn  = document.getElementById("lm-submit");
const forgotForm = document.getElementById("forgot-form");
const forgotMsg  = document.getElementById("forgot-msg");

const showLogin  = () => { form.style.display = ""; forgotForm.style.display = "none"; };
const showForgot = () => { form.style.display = "none"; forgotForm.style.display = ""; forgotMsg.style.display = "none"; };

export const openLoginModal = () => {
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
  form.reset(); errEl.style.display = "none"; showLogin();
};
const closeModal = () => { modal.style.display = "none"; document.body.style.overflow = ""; };

// Wire open button if present on the page
document.getElementById("open-login-btn")?.addEventListener("click", openLoginModal);
document.getElementById("close-login-btn").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
if (new URLSearchParams(location.search).get("login") === "1") openLoginModal();

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
