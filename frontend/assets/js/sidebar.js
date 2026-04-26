// Shared sidebar setup — import in each app page
import { requireAuth, logout } from "./auth.js";
import { roleLabels } from "./seed.js";

export function setupSidebar() {
  const user = requireAuth();
  if (!user) return null;

  const nameEl = document.getElementById("sidebar-username");
  const roleEl = document.getElementById("sidebar-role");
  if (nameEl) nameEl.textContent = user.fullName;
  if (roleEl) roleEl.textContent = user.username;

  document.getElementById("logout-btn")?.addEventListener("click", () => logout());

  const toggle  = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");

  toggle?.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("open");
  });
  overlay?.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  });

  return user;
}
