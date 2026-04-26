import { login as apiLogin } from "../api.js";
import { isAuthenticated, setSession, getRoleRedirect } from "../auth.js";
import { el } from "../utils.js";

document.addEventListener("DOMContentLoaded", () => {
  if (isAuthenticated()) {
    const user = JSON.parse(localStorage.getItem("dhs_user") || "null");
    if (user) { window.location.href = getRoleRedirect(user.role); return; }
  }

  const form   = el("login-form");
  const errEl  = el("login-error");
  const btnEl  = el("login-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    btnEl.disabled = true;
    btnEl.textContent = "Нэвтэрч байна...";

    try {
      const data = await apiLogin(el("username").value.trim(), el("password").value);
      setSession(data.token, data.user);
      window.location.href = "/app.html";
    } catch (err) {
      errEl.textContent = err.message || "Нэвтрэх нэр эсвэл нууц үг буруу";
      btnEl.disabled = false;
      btnEl.textContent = "Нэвтрэх";
    }
  });
});
