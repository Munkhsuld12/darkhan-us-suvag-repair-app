import { login as apiLogin } from "../api.js";
import { isAuthenticated, setSession, getRoleRedirect, getUser } from "../auth.js";
import { el } from "../utils.js";

document.addEventListener("DOMContentLoaded", () => {
  if (isAuthenticated()) {
    const user = getUser();
    if (user) {
      window.location.href = user.profileComplete === false
        ? "/profile-setup.html"
        : getRoleRedirect(user.role);
      return;
    }
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
      window.location.href = data.user.profileComplete === false
        ? "/profile-setup.html"
        : "/app.html";
    } catch (err) {
      errEl.textContent = err.message || "Нэвтрэх нэр эсвэл нууц үг буруу";
      btnEl.disabled = false;
      btnEl.textContent = "Нэвтрэх";
    }
  });
});
