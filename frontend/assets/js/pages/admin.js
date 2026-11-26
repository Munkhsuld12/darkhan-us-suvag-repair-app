import * as api from "../api.js";
import { requireAuth } from "../auth.js";
import { roleLabels, roleOptions } from "../seed.js";
import { getDeptName, escapeHtml, el, emptyState } from "../utils.js";
import { setupSidebar } from "../sidebar.js";

let state = { departments: [], teams: [], users: [], stations: [], workers: [] };
let activeTab = "departments";

function generateTempPassword() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits  = "23456789";
  let pwd = "";
  for (let i = 0; i < 3; i++) pwd += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 4; i++) pwd += digits[Math.floor(Math.random() * digits.length)];
  return pwd;
}

function showTempPasswordModal(username, pwd) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px;text-align:center">
      <div class="modal-header" style="justify-content:center;border-bottom:none;padding-bottom:0">
        <h2>Түр нууц үг</h2>
      </div>
      <div class="modal-body" style="padding-top:12px">
        <p style="font-size:14px;color:var(--slate-600);margin-bottom:20px">
          <strong>${escapeHtml(username)}</strong> хэрэглэгчид дараах түр нууц үгийг утсаар эсвэл биечлэн мэдэгдэнэ үү.
        </p>
        <div style="background:var(--slate-100);border-radius:12px;padding:20px;margin-bottom:12px">
          <span style="font-size:2rem;font-weight:800;letter-spacing:0.15em;color:var(--ink-900);font-family:monospace">${escapeHtml(pwd)}</span>
        </div>
        <p style="font-size:12px;color:var(--slate-400);margin-bottom:20px">Хэрэглэгч нэвтэрсний дараа нууц үгээ заавал өөрчлөх болно.</p>
        <button class="btn btn-primary btn-full" id="tmp-pwd-ok">Ойлголоо</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("#tmp-pwd-ok").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}

document.addEventListener("DOMContentLoaded", async () => {
  setupSidebar();
  const user = requireAuth();
  if (!user || user.role !== "admin") { window.location.href = "/app.html"; return; }

  // Verify token is valid and user still has admin role in DB
  try {
    const me = await api.getMe();
    if (!me?.user || me.user.role !== "admin") {
      alert("Эрх хүрэлцэхгүй байна. Дахин нэвтэрнэ үү.");
      const { logout } = await import("../auth.js");
      logout();
      return;
    }
  } catch {
    const { logout } = await import("../auth.js");
    logout();
    return;
  }

  el("modal-close-btn").addEventListener("click", closeModal);
  let _mouseDownOnOverlay = false;
  el("admin-modal").addEventListener("mousedown", (e) => { _mouseDownOnOverlay = e.target === el("admin-modal"); });
  el("admin-modal").addEventListener("click",     (e) => { if (_mouseDownOnOverlay && e.target === el("admin-modal")) closeModal(); });

  await loadMeta();
  setupTabs();
  renderActive();
});

async function loadMeta() {
  const [data, workerRes] = await Promise.all([
    api.getAdminMeta().catch(() => ({ departments: [], teams: [], users: [], stations: [] })),
    api.getWorkers().catch(() => ({ workers: [] })),
  ]);
  state.departments = data.departments ?? [];
  state.teams       = data.teams ?? [];
  state.users       = data.users ?? [];
  state.stations    = data.stations ?? [];
  state.workers     = workerRes.workers ?? [];
}

function setupTabs() {
  document.querySelectorAll(".tab-btn[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll(".tab-btn[data-tab]").forEach((b) => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== activeTab));
      renderActive();
    });
  });
}

function renderActive() {
  if (activeTab === "departments") renderDepartments();
  else if (activeTab === "teams")   renderTeams();
  else if (activeTab === "users")   renderUsers();
  else if (activeTab === "stations") renderStations();
  else if (activeTab === "archive") renderArchive();
  else if (activeTab === "auditlog") renderAuditLog();
}

// ──────────── MODAL ────────────
function openModal(title, bodyHtml) {
  el("modal-title").textContent = title;
  el("modal-body").innerHTML = bodyHtml;
  el("admin-modal").classList.remove("hidden");
}

function closeModal() {
  el("admin-modal").classList.add("hidden");
  el("modal-body").innerHTML = "";
}


// ──────────── DEPARTMENTS ────────────
function renderDepartments() {
  el("dept-add-btn").onclick = () => openDeptModal(null);

  const list = el("dept-list");
  list.innerHTML = !state.departments.length ? emptyState() : state.departments.map((d) => `
    <div class="item-card" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
      <div>
        <p style="font-weight:600;font-size:15px">${escapeHtml(d.name)}</p>
        <p style="font-size:12px;color:var(--slate-500)">${escapeHtml(d.id)}</p>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-secondary btn-sm" data-edit-dept="${d.id}">Засах</button>
        <button class="btn btn-danger btn-sm" data-del-dept="${d.id}">Архивлах</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll("[data-edit-dept]").forEach((btn) => {
    const d = state.departments.find((x) => x.id === btn.dataset.editDept);
    btn.addEventListener("click", () => openDeptModal(d));
  });

  list.querySelectorAll("[data-del-dept]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Архивлах уу?")) return;
      try {
        await api.deleteDepartment(btn.dataset.delDept);
      } catch (err) { alert(err.message); return; }
      await loadMeta(); renderActive();
    });
  });
}

function openDeptModal(dept) {
  openModal(dept ? "Алба засах" : "Алба нэмэх", `
    <form id="modal-form" class="field-grid">
      <div class="field">
        <label>Нэр</label>
        <input id="m-dept-name" type="text" class="input" placeholder="Албаны нэр" value="${dept ? escapeHtml(dept.name) : ''}" required>
      </div>
      <div style="display:flex;gap:10px;margin-top:4px">
        <button type="submit" class="btn btn-primary" style="flex:1">Хадгалах</button>
        <button type="button" class="btn btn-secondary" id="m-cancel">Цуцлах</button>
      </div>
    </form>
  `);
  el("m-cancel").onclick = closeModal;
  el("modal-form").onsubmit = async (e) => {
    e.preventDefault();
    const name = el("m-dept-name").value.trim();
    if (!name) return;
    try {
      if (dept) await api.updateDepartment(dept.id, { name });
      else await api.upsertDepartment({ name });
      closeModal();
      await loadMeta(); renderActive();
    } catch (err) { alert(err.message); }
  };
}

// ──────────── TEAMS ────────────
function renderTeams() {
  el("team-add-btn").onclick = () => openTeamModal(null);

  const list = el("team-list");
  list.innerHTML = !state.teams.length ? emptyState() : state.teams.map((t) => {
    const members = state.users.filter((u) => u.teamId === t.id);
    const leader  = state.users.find((u) => u.id === t.leaderUserId);
    const teamWorkers = state.workers.filter((w) => w.teamId === t.id);

    const membersHtml = members.length === 0
      ? `<p style="font-size:12px;color:var(--slate-400);margin:0">Гишүүн байхгүй</p>`
      : members.map((u) => `
          <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--slate-100)">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--blue-100);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:var(--blue-700);flex-shrink:0">
              ${escapeHtml(u.fullName.charAt(0))}
            </div>
            <div style="min-width:0;flex:1">
              <p style="margin:0;font-size:13px;font-weight:500;color:var(--ink-900)">${escapeHtml(u.fullName)}${u.id === t.leaderUserId ? ' <span style="font-size:10px;background:var(--blue-100);color:var(--blue-700);padding:1px 5px;border-radius:4px;font-weight:600">Ахлагч</span>' : ''}</p>
              <p style="margin:0;font-size:11px;color:var(--slate-500)">${escapeHtml(u.username)}</p>
            </div>
            <button class="btn btn-secondary btn-sm" style="font-size:11px;padding:2px 8px" data-edit-user="${u.id}">Засах</button>
          </div>`).join("");

    const workersHtml = teamWorkers.length === 0
      ? `<p style="font-size:12px;color:var(--slate-400);margin:0">Ажилтан байхгүй</p>`
      : teamWorkers.map((w) => `
          <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--slate-100)">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--emerald-100,#d1fae5);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#059669;flex-shrink:0">
              ${escapeHtml(w.fullName.charAt(0))}
            </div>
            <div style="min-width:0;flex:1">
              <p style="margin:0;font-size:13px;font-weight:500;color:var(--ink-900)">${escapeHtml(w.fullName)}</p>
              <p style="margin:0;font-size:11px;color:var(--slate-500)">${escapeHtml([w.position, w.phone].filter(Boolean).join(" · ")) || "—"}</p>
            </div>
            <div style="display:flex;gap:4px">
              <button class="btn btn-secondary btn-sm" style="font-size:11px;padding:2px 8px" data-edit-worker="${w.id}">Засах</button>
              <button class="btn btn-danger btn-sm" style="font-size:11px;padding:2px 8px" data-del-worker="${w.id}">Устгах</button>
            </div>
          </div>`).join("");

    return `
    <div class="item-card">
      <div style="display:flex;align-items:start;justify-content:space-between;gap:8px">
        <div>
          <p style="font-weight:600;font-size:15px">${escapeHtml(t.name)}</p>
          <p style="font-size:12px;color:var(--slate-500)">${escapeHtml(getDeptName(t.departmentId, state.departments))}</p>
          <p style="font-size:12px;color:var(--slate-500)">Ахлагч: ${escapeHtml(leader?.fullName ?? "Тогтоогүй")}</p>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" data-edit-team="${t.id}">Засах</button>
          <button class="btn btn-danger btn-sm" data-del-team="${t.id}">Архивлах</button>
        </div>
      </div>
      <div style="margin-top:10px;border-top:1px solid var(--slate-200);padding-top:8px">
        <p style="font-size:11px;font-weight:600;color:var(--slate-400);text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px">Системийн гишүүд (${members.length})</p>
        ${membersHtml}
      </div>
      <div style="margin-top:10px;border-top:1px solid var(--slate-200);padding-top:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <p style="font-size:11px;font-weight:600;color:var(--slate-400);text-transform:uppercase;letter-spacing:.05em;margin:0">Ажилтнууд (${teamWorkers.length})</p>
          <button class="btn btn-primary btn-sm" style="font-size:11px;padding:2px 8px" data-add-worker="${t.id}">+ Нэмэх</button>
        </div>
        ${workersHtml}
      </div>
    </div>`;
  }).join("");

  list.querySelectorAll("[data-edit-team]").forEach((btn) => {
    const t = state.teams.find((x) => x.id === btn.dataset.editTeam);
    btn.addEventListener("click", () => openTeamModal(t));
  });

  list.querySelectorAll("[data-del-team]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Архивлах уу?")) return;
      try {
        await api.deleteTeam(btn.dataset.delTeam);
      } catch (err) { alert(err.message); return; }
      await loadMeta(); renderActive();
    });
  });

  list.querySelectorAll("[data-edit-user]").forEach((btn) => {
    const u = state.users.find((x) => x.id === btn.dataset.editUser);
    btn.addEventListener("click", () => openUserModal(u));
  });

  list.querySelectorAll("[data-add-worker]").forEach((btn) => {
    btn.addEventListener("click", () => openAdminWorkerModal(null, btn.dataset.addWorker));
  });

  list.querySelectorAll("[data-edit-worker]").forEach((btn) => {
    const w = state.workers.find((x) => x.id === btn.dataset.editWorker);
    btn.addEventListener("click", () => openAdminWorkerModal(w, w?.teamId));
  });

  list.querySelectorAll("[data-del-worker]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const w = state.workers.find((x) => x.id === btn.dataset.delWorker);
      if (!confirm(`"${w?.fullName}" ажилтныг устгах уу?`)) return;
      try {
        await api.deleteWorker(btn.dataset.delWorker);
      } catch (err) { alert(err.message); return; }
      await loadMeta(); renderActive();
    });
  });
}

function openAdminWorkerModal(worker, teamId) {
  openModal(worker ? "Ажилтан засах" : "Ажилтан нэмэх", `
    <form id="modal-form" class="field-grid">
      <div class="field">
        <label>Бүтэн нэр</label>
        <input id="m-w-fullname" type="text" class="input" placeholder="Овог, нэр" value="${worker ? escapeHtml(worker.fullName) : ''}" required>
      </div>
      <div class="field-row-2">
        <div class="field">
          <label>Утас</label>
          <input id="m-w-phone" type="tel" class="input" placeholder="XXXX-XXXX" value="${worker ? escapeHtml(worker.phone ?? '') : ''}">
        </div>
        <div class="field">
          <label>Мэргэжил</label>
          <input id="m-w-position" type="text" class="input" placeholder="Тоног төхөөрөмжийн засварчин" value="${worker ? escapeHtml(worker.position ?? '') : ''}">
        </div>
      </div>
      <div class="field">
        <label>Тэмдэглэл</label>
        <textarea id="m-w-notes" class="textarea" rows="2" placeholder="Нэмэлт тэмдэглэл">${worker ? escapeHtml(worker.notes ?? '') : ''}</textarea>
      </div>
      <div style="display:flex;gap:10px;margin-top:4px">
        <button type="submit" class="btn btn-primary" style="flex:1">Хадгалах</button>
        <button type="button" class="btn btn-secondary" id="m-cancel">Цуцлах</button>
      </div>
    </form>
  `);
  el("m-cancel").onclick = closeModal;
  el("modal-form").onsubmit = async (e) => {
    e.preventDefault();
    const body = {
      fullName: el("m-w-fullname").value.trim(),
      phone:    el("m-w-phone").value.trim(),
      position: el("m-w-position").value.trim(),
      notes:    el("m-w-notes").value.trim(),
      teamId:   teamId,
    };
    if (!body.fullName) { alert("Нэрийг оруулна уу"); return; }
    try {
      if (worker) await api.updateWorker(worker.id, body);
      else await api.createWorker(body);
      closeModal();
      await loadMeta(); renderActive();
    } catch (err) { alert(err.message); }
  };
}

function openTeamModal(team) {
  const deptOptions = state.departments.map((d) =>
    `<option value="${d.id}" ${team?.departmentId === d.id ? "selected" : ""}>${escapeHtml(d.name)}</option>`
  ).join("");

  const leaderOptions = state.users.map((u) =>
    `<option value="${u.id}" ${team?.leaderUserId === u.id ? "selected" : ""}>${escapeHtml(u.fullName)}</option>`
  ).join("");

  openModal(team ? "Засварын бригад засах" : "Засварын бригад нэмэх", `
    <form id="modal-form" class="field-grid">
      <div class="field">
        <label>Бригадын нэр</label>
        <input id="m-team-name" type="text" class="input" value="${team ? escapeHtml(team.name) : ''}" required>
      </div>
      <div class="field">
        <label>Алба</label>
        <select id="m-team-dept" class="select" required>
          <option value="">Алба сонгох</option>
          ${deptOptions}
        </select>
      </div>
      <div class="field">
        <label>Ахлагч</label>
        <select id="m-team-leader" class="select" required>
          <option value="">Хэрэглэгч сонгох</option>
          ${leaderOptions}
        </select>
      </div>
      <div style="display:flex;gap:10px;margin-top:4px">
        <button type="submit" class="btn btn-primary" style="flex:1">Хадгалах</button>
        <button type="button" class="btn btn-secondary" id="m-cancel">Цуцлах</button>
      </div>
    </form>
  `);
  el("m-cancel").onclick = closeModal;
  el("modal-form").onsubmit = async (e) => {
    e.preventDefault();
    const name        = el("m-team-name").value.trim();
    const departmentId = el("m-team-dept").value;
    const leaderUserId = el("m-team-leader").value;
    if (!name || !departmentId || !leaderUserId) { alert("Бүх талбарыг бөглөнө үү"); return; }
    try {
      if (team) await api.updateTeam(team.id, { name, departmentId, leaderUserId });
      else await api.upsertTeam({ name, departmentId, leaderUserId });
      closeModal();
      await loadMeta(); renderActive();
    } catch (err) { alert(err.message); }
  };
}

// ──────────── USERS ────────────
const ROLE_ORDER = ["admin", "dispatcher", "general_engineer", "department_engineer", "brigade_leader"];

function renderUsers() {
  el("user-add-btn").onclick = () => openUserModal(null);

  const list = el("user-list");
  if (!state.users.length) { list.innerHTML = emptyState(); return; }

  const userCard = (u) => `
    <div class="item-card" style="margin-bottom:0;border-radius:0;background:#fff">
      <div style="display:flex;align-items:start;justify-content:space-between;gap:8px">
        <div>
          <p style="font-weight:600;font-size:15px">${escapeHtml(u.fullName)}</p>
          <p style="font-size:12px;color:var(--slate-500)">${escapeHtml(u.username)}</p>
          <p style="font-size:12px;color:var(--slate-500)">${escapeHtml(getDeptName(u.departmentId, state.departments))}</p>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn btn-secondary btn-sm" data-edit-user="${u.id}">Засах</button>
          <button class="btn btn-secondary btn-sm" data-reset-user="${u.id}">Нууц үг шинэчлэх</button>
          <button class="btn btn-danger btn-sm" data-del-user="${u.id}">Архивлах</button>
        </div>
      </div>
    </div>`;

  const grouped = ROLE_ORDER.map((role) => ({
    role,
    label: roleLabels[role] ?? role,
    users: state.users.filter((u) => u.role === role),
  })).filter((g) => g.users.length > 0);

  const allGroups = ROLE_ORDER.map((role) => ({
    role,
    label: roleLabels[role] ?? role,
    users: state.users.filter((u) => u.role === role),
  }));

  list.innerHTML = `
    <div class="user-role-grid">
      ${allGroups.map((g) => `
        <div class="card" style="padding:0;overflow:hidden">
          <button type="button" data-toggle-role="${g.role}" style="width:100%;padding:8px 12px;background:var(--slate-50);border:none;border-bottom:1px solid var(--slate-200);cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:6px">
            <div>
              <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--slate-500);margin:0">${escapeHtml(g.label)}</p>
              <p style="font-size:11px;color:var(--slate-400);margin:0">${g.users.length} хэрэглэгч</p>
            </div>
            <span data-arrow="${g.role}" style="font-size:10px;color:var(--slate-400);transition:transform .2s">▼</span>
          </button>
          <div data-role-body="${g.role}" style="display:flex;flex-direction:column">
            ${g.users.length ? g.users.map((u) => `
              <div class="item-card" style="margin-bottom:0;border-radius:0;background:#fff;border-bottom:1px solid var(--slate-100)">
                <p style="font-weight:600;font-size:14px;margin:0 0 2px">${escapeHtml(u.fullName)}</p>
                <p style="font-size:11px;color:var(--slate-500);margin:0 0 6px">${escapeHtml(u.username)}</p>
                <p style="font-size:11px;color:var(--slate-400);margin:0 0 8px">${escapeHtml(getDeptName(u.departmentId, state.departments)) || "—"}</p>
                <div style="display:flex;flex-direction:column;gap:4px">
                  <button class="btn btn-secondary btn-sm" style="width:100%" data-edit-user="${u.id}">Засах</button>
                  <button class="btn btn-secondary btn-sm" style="width:100%" data-reset-user="${u.id}">Нууц үг шинэчлэх</button>
                  <button class="btn btn-danger btn-sm" style="width:100%" data-del-user="${u.id}">Архивлах</button>
                </div>
              </div>`).join("") : `<p style="font-size:12px;color:var(--slate-400);padding:12px;text-align:center;margin:0">Хоосон</p>`}
          </div>
        </div>
      `).join("")}
    </div>
  `;

  list.querySelectorAll("[data-toggle-role]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const role = btn.dataset.toggleRole;
      const body  = list.querySelector(`[data-role-body="${role}"]`);
      const arrow = list.querySelector(`[data-arrow="${role}"]`);
      const isOpen = body.style.display !== "none";
      body.style.display  = isOpen ? "none" : "flex";
      arrow.style.transform = isOpen ? "rotate(-90deg)" : "rotate(0deg)";
    });
  });

  list.querySelectorAll("[data-edit-user]").forEach((btn) => {
    const u = state.users.find((x) => x.id === btn.dataset.editUser);
    btn.addEventListener("click", () => openUserModal(u));
  });

  list.querySelectorAll("[data-reset-user]").forEach((btn) => {
    const u = state.users.find((x) => x.id === btn.dataset.resetUser);
    btn.addEventListener("click", async () => {
      if (!confirm(`"${u?.fullName}" хэрэглэгчийн нууц үгийг шинэчлэх үү?`)) return;
      try {
        const res = await api.resetUserPassword(btn.dataset.resetUser);
        openModal("Түр нууц үг", `
          <div style="text-align:center;padding:8px 0 16px">
            <p style="color:var(--slate-600);margin-bottom:12px">
              <strong>${escapeHtml(u?.fullName ?? "")}</strong> хэрэглэгчид дараах түр нууц үгийг утсаар эсвэл биечлэн мэдэгдэнэ үү.
            </p>
            <div style="font-size:2rem;font-weight:800;letter-spacing:0.15em;color:var(--ink-900);background:var(--slate-100);padding:16px 24px;border-radius:10px;display:inline-block">
              ${escapeHtml(res.tempPassword)}
            </div>
            <p style="font-size:12px;color:var(--slate-400);margin-top:12px">
              Хэрэглэгч нэвтэрсний дараа нууц үгээ заавал өөрчлөх болно.
            </p>
          </div>
          <button class="btn btn-primary btn-full" id="m-cancel">Ойлголоо</button>
        `);
        el("m-cancel").onclick = closeModal;
      } catch (err) { alert(err.message); }
    });
  });

  list.querySelectorAll("[data-del-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Архивлах уу?")) return;
      try {
        await api.deleteUser(btn.dataset.delUser);
      } catch (err) { alert(err.message); return; }
      await loadMeta(); renderActive();
    });
  });
}

function openUserModal(user) {
  const deptOptions = state.departments.map((d) =>
    `<option value="${d.id}" ${user?.departmentId === d.id ? "selected" : ""}>${escapeHtml(d.name)}</option>`
  ).join("");

  const roleOpts = roleOptions.map((r) =>
    `<option value="${r}" ${user?.role === r ? "selected" : ""}>${escapeHtml(roleLabels[r] ?? r)}</option>`
  ).join("");

  openModal(user ? "Хэрэглэгч засах" : "Хэрэглэгч нэмэх", `
    <form id="modal-form" class="field-grid">
      ${user ? `
      <div class="field">
        <label>Бүтэн нэр</label>
        <input id="m-user-fullname" type="text" class="input" placeholder="Овог, нэр" value="${escapeHtml(user.fullName)}" required>
      </div>
      <div class="field-row-2">
        <div class="field">
          <label>Нэвтрэх нэр</label>
          <input id="m-user-username" type="text" class="input" placeholder="username" value="${escapeHtml(user.username)}" required autocomplete="off">
        </div>
        <div class="field">
          <label>Утас</label>
          <input id="m-user-phone" type="tel" class="input" placeholder="XXXX-XXXX" value="${escapeHtml(user.phone ?? '')}" pattern="[0-9\\-]+" inputmode="numeric">
        </div>
      </div>
      <div class="field">
        <label>И-мэйл</label>
        <input id="m-user-email" type="email" class="input" placeholder="name@example.com" value="${escapeHtml(user.email ?? '')}" inputmode="email">
      </div>
      ` : `
      <div class="field">
        <label>Нэвтрэх нэр <span style="color:var(--rose-500)">*</span></label>
        <input id="m-user-username" type="text" class="input" placeholder="username" required autocomplete="off">
      </div>
      <p style="font-size:12px;color:var(--slate-400);margin-top:-4px">Түр нууц үг автоматаар үүсгэгдэнэ. Хэрэглэгч анх нэвтрэхэд өөрчлөх болно.</p>
      `}
      <div class="field">
        <label>Эрх</label>
        <select id="m-user-role" class="select">${roleOpts}</select>
      </div>
      <div class="field" id="m-user-dept-field">
        <label>Алба</label>
        <select id="m-user-dept" class="select">
          <option value="">Сонгох</option>
          ${deptOptions}
        </select>
      </div>
      <div class="field" id="m-user-team-field" style="display:none">
        <label>Засварын бригад</label>
        <select id="m-user-team" class="select">
          <option value="">Сонгох</option>
        </select>
      </div>
      <div style="display:flex;gap:10px;margin-top:4px">
        <button type="submit" class="btn btn-primary" style="flex:1">Хадгалах</button>
        <button type="button" class="btn btn-secondary" id="m-cancel">Цуцлах</button>
      </div>
    </form>
  `);

  el("m-cancel").onclick = closeModal;

  el("m-user-phone")?.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/[^0-9\-]/g, "");
  });

  el("m-toggle-password")?.addEventListener("click", () => {
    const pwd = el("m-user-password");
    const icon = el("m-eye-icon");
    if (!pwd) return;
    if (pwd.type === "password") {
      pwd.type = "text";
      icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`;
    } else {
      pwd.type = "password";
      icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
    }
  });

  const deptSel  = el("m-user-dept");
  const teamSel  = el("m-user-team");
  const teamField = el("m-user-team-field");

  // Roles that need department selection
  const DEPT_ROLES = ["brigade_leader", "worker", "department_engineer"];
  // Roles that also need brigade selection
  const TEAM_ROLES = ["brigade_leader", "worker"];
  const zahirgaa = state.departments.find((d) => d.name === "Захиргаа");
  const deptField = el("m-user-dept-field");

  const refreshTeams = () => {
    const role = el("m-user-role").value;
    if (!TEAM_ROLES.includes(role)) {
      teamField.style.display = "none";
      teamSel.value = "";
      return;
    }
    const filteredTeams = state.teams.filter((t) => !deptSel.value || t.departmentId === deptSel.value);
    if (filteredTeams.length === 0) {
      teamField.style.display = "none";
      teamSel.value = "";
    } else {
      teamField.style.display = "";
      teamSel.innerHTML = `<option value="">Сонгох</option>` +
        filteredTeams.map((t) => `<option value="${t.id}" ${user?.teamId === t.id ? "selected" : ""}>${escapeHtml(t.name)}</option>`).join("");
    }
  };

  const refreshDeptVisibility = () => {
    const role = el("m-user-role").value;
    if (DEPT_ROLES.includes(role)) {
      deptField.style.display = "";
    } else {
      deptField.style.display = "none";
      if (zahirgaa) deptSel.value = zahirgaa.id;
      teamField.style.display = "none";
      teamSel.value = "";
    }
    refreshTeams();
  };

  el("m-user-role").addEventListener("change", refreshDeptVisibility);
  deptSel.addEventListener("change", refreshTeams);
  refreshDeptVisibility();

  el("modal-form").onsubmit = async (e) => {
    e.preventDefault();
    const username = el("m-user-username").value.trim();
    const password = el("m-user-password")?.value.trim() ?? "";
    const body = user ? {
      fullName:     el("m-user-fullname").value.trim(),
      username,
      ...(password ? { password } : {}),
      role:         el("m-user-role").value,
      departmentId: deptSel.value || undefined,
      teamId:       teamField.style.display !== "none" ? teamSel.value || undefined : undefined,
      phone:        el("m-user-phone").value.trim(),
      email:        el("m-user-email").value.trim() || undefined,
    } : {
      fullName:     username,
      username,
      password:     generateTempPassword(),
      role:         el("m-user-role").value,
      departmentId: deptSel.value || undefined,
      teamId:       teamField.style.display !== "none" ? teamSel.value || undefined : undefined,
    };
    if (!username) { alert("Нэвтрэх нэрийг оруулна уу"); return; }
    if (user && !el("m-user-fullname").value.trim()) { alert("Бүтэн нэрийг оруулна уу"); return; }
    try {
      if (user) {
        await api.updateUser(user.id, body);
        closeModal();
        await loadMeta(); renderActive();
      } else {
        const tempPwd = body.password;
        await api.upsertUser(body);
        closeModal();
        await loadMeta(); renderActive();
        showTempPasswordModal(username, tempPwd);
      }
    } catch (err) { alert(err.message); }
  };
}

// ──────────── STATIONS ────────────
let stationSearch = "";

function renderStations() {
  const searchEl = el("station-search-input");
  if (searchEl && !searchEl.dataset.init) {
    searchEl.addEventListener("input", (e) => { stationSearch = e.target.value; renderStations(); });
    searchEl.dataset.init = "1";
  }

  el("station-add-btn").onclick = () => openStationModal(null);

  const q = stationSearch.toLowerCase().trim();
  const filtered = state.stations.filter((s) =>
    !q || s.code.toLowerCase().includes(q) ||
    (s.location ?? "").toLowerCase().includes(q) ||
    (s.caretakerName ?? "").toLowerCase().includes(q)
  );

  const list = el("station-list");
  if (!filtered.length) { list.innerHTML = emptyState("Ус түгээх байр олдсонгүй"); return; }

  const stationCard = (s) => `
    <div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:4px;min-width:0">
      <p style="font-weight:700;font-size:15px;margin:0;color:var(--ink-900)">${escapeHtml(s.code)}</p>
      <p style="font-size:12px;color:var(--slate-500);margin:0">${escapeHtml(s.location || "Байршил тодорхойгүй")}</p>
      <p style="font-size:12px;color:var(--slate-600);margin:0">${escapeHtml(s.caretakerName || "Хянагч оруулаагүй")}${s.caretakerPhone ? ` | ${escapeHtml(s.caretakerPhone)}` : ""}</p>
      <div style="display:flex;gap:6px;margin-top:6px">
        <button class="btn btn-secondary btn-sm" style="flex:1" data-edit-station="${s.id}">Засах</button>
        <button class="btn btn-danger btn-sm" style="flex:1" data-del-station="${s.id}">Архивлах</button>
      </div>
    </div>`;

  const bags = [...new Set(filtered.map((s) => s.bagNo))].sort((a, b) => a - b);

  list.innerHTML = bags.map((bag) => {
    const bagStations = filtered.filter((s) => s.bagNo === bag);
    return `
      <div class="card" style="padding:0;overflow:hidden">
        <button type="button" data-toggle-bag="${bag}" style="width:100%;padding:10px 14px;background:var(--slate-50);border:none;border-bottom:1px solid var(--slate-200);cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:6px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:13px;font-weight:700;color:var(--ink-900)">${bag}-р баг</span>
            <span style="font-size:11px;color:var(--slate-400);background:var(--slate-200);padding:1px 7px;border-radius:10px">${bagStations.length} ус түгээх байр</span>
          </div>
          <span data-bag-arrow="${bag}" style="font-size:10px;color:var(--slate-400);transition:transform .2s">▼</span>
        </button>
        <div data-bag-body="${bag}" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;padding:12px">
          ${bagStations.map((s) => stationCard(s)).join("")}
        </div>
      </div>`;
  }).join("");

  list.querySelectorAll("[data-toggle-bag]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bag   = btn.dataset.toggleBag;
      const body  = list.querySelector(`[data-bag-body="${bag}"]`);
      const arrow = list.querySelector(`[data-bag-arrow="${bag}"]`);
      const isOpen = body.style.display !== "none";
      body.style.display    = isOpen ? "none" : "grid";
      arrow.style.transform = isOpen ? "rotate(-90deg)" : "rotate(0deg)";
    });
  });

  list.querySelectorAll("[data-edit-station]").forEach((btn) => {
    const s = state.stations.find((x) => x.id === btn.dataset.editStation);
    btn.addEventListener("click", () => openStationModal(s));
  });

  list.querySelectorAll("[data-del-station]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Архивлах уу?")) return;
      try {
        await api.deleteStation(btn.dataset.delStation);
      } catch (err) { alert(err.message); return; }
      await loadMeta(); renderActive();
    });
  });
}

function openStationModal(station) {
  openModal(station ? "Ус түгээх байр засах" : "Ус түгээх байр нэмэх", `
    <form id="modal-form" class="field-grid">
      <div class="field">
        <label>Код</label>
        <input id="m-st-code" type="text" class="input" placeholder="Жишээ: 1-5" value="${station ? escapeHtml(station.code) : ''}" required>
        <span class="field-hint">Баг-Дугаар (жишээ: 1-5)</span>
      </div>
      <div class="field">
        <label>Байршил</label>
        <input id="m-st-loc" type="text" class="input" placeholder="Хаяг, байршил" value="${station ? escapeHtml(station.location ?? '') : ''}">
      </div>
      <div class="field">
        <label>Хянагч</label>
        <input id="m-st-care" type="text" class="input" placeholder="Хянагчийн нэр" value="${station ? escapeHtml(station.caretakerName ?? '') : ''}">
      </div>
      <div class="field">
        <label>Хянагчийн утас</label>
        <input id="m-st-care-ph" type="tel" class="input" placeholder="XXXX-XXXX" value="${station ? escapeHtml(station.caretakerPhone ?? '') : ''}">
      </div>
      <div style="display:flex;gap:10px;margin-top:4px">
        <button type="submit" class="btn btn-primary" style="flex:1">Хадгалах</button>
        <button type="button" class="btn btn-secondary" id="m-cancel">Цуцлах</button>
      </div>
    </form>
  `);
  el("m-cancel").onclick = closeModal;
  el("modal-form").onsubmit = async (e) => {
    e.preventDefault();
    const code  = el("m-st-code").value.trim();
    const bagNo = Number(code.split("-")[0]);
    if (!code || !bagNo) { alert("Кодыг зөв оруулна уу (жишээ: 1-5)"); return; }
    const body = {
      code, bagNo, name: "",
      location:      el("m-st-loc").value.trim(),
      caretakerName: el("m-st-care").value.trim(),
      caretakerPhone: el("m-st-care-ph").value.trim(),
    };
    try {
      if (station) await api.updateStation(station.id, body);
      else await api.upsertStation(body);
      closeModal();
      await loadMeta(); renderActive();
    } catch (err) { alert(err.message); }
  };
}

// ──────────── ARCHIVE ────────────
async function renderArchive() {
  const container = el("archive-content");
  container.innerHTML = `<p style="color:var(--slate-500);font-size:14px">Ачааллаж байна…</p>`;

  let data;
  try {
    data = await api.getArchive();
  } catch {
    container.innerHTML = `<p class="empty-state">Архив ачаалахад алдаа гарлаа</p>`;
    return;
  }

  const fmt = (iso) => iso ? new Date(iso).toLocaleString("mn-MN") : "—";
  const section = (title, items, renderItem) => `
    <div class="card section-stack">
      <h2 style="font-size:17px;font-weight:700">${title} <span style="font-weight:400;font-size:13px;color:var(--slate-500)">(${items.length})</span></h2>
      ${items.length ? items.map(renderItem).join("") : `<p class="empty-state">Архивласан бичлэг байхгүй</p>`}
    </div>
  `;

  container.innerHTML = [
    section("Архивласан алба", data.departments, (d) => `
      <div class="item-card" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div>
          <p style="font-weight:600;font-size:14px">${escapeHtml(d.name)}</p>
          <p style="font-size:12px;color:var(--slate-500)">Архивласан: ${fmt(d.deletedAt)}</p>
        </div>
        <button class="btn btn-secondary btn-sm" data-restore-dept="${d.id}">Сэргээх</button>
      </div>
    `),
    section("Архивласан бригад", data.teams, (t) => `
      <div class="item-card" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div>
          <p style="font-weight:600;font-size:14px">${escapeHtml(t.name)}</p>
          <p style="font-size:12px;color:var(--slate-500)">Архивласан: ${fmt(t.deletedAt)}</p>
        </div>
        <button class="btn btn-secondary btn-sm" data-restore-team="${t.id}">Сэргээх</button>
      </div>
    `),
    section("Архивласан хэрэглэгчид", data.users, (u) => `
      <div class="item-card" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div>
          <p style="font-weight:600;font-size:14px">${escapeHtml(u.fullName)}</p>
          <p style="font-size:12px;color:var(--slate-500)">${escapeHtml(u.username)} | Архивласан: ${fmt(u.deletedAt)}</p>
        </div>
        <button class="btn btn-secondary btn-sm" data-restore-user="${u.id}">Сэргээх</button>
      </div>
    `),
    section("Архивласан ус түгээх байрууд", data.stations, (s) => `
      <div class="item-card" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div>
          <p style="font-weight:600;font-size:14px">${escapeHtml(s.code)} — ${s.bagNo}-р баг</p>
          <p style="font-size:12px;color:var(--slate-500)">${escapeHtml(s.location || "Байршилгүй")} | Архивласан: ${fmt(s.deletedAt)}</p>
        </div>
        <button class="btn btn-secondary btn-sm" data-restore-station="${s.id}">Сэргээх</button>
      </div>
    `),
  ].join("");

  container.querySelectorAll("[data-restore-dept]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api.restoreDepartment(btn.dataset.restoreDept).catch((e) => alert(e.message));
      await loadMeta(); renderArchive();
    });
  });
  container.querySelectorAll("[data-restore-team]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api.restoreTeam(btn.dataset.restoreTeam).catch((e) => alert(e.message));
      await loadMeta(); renderArchive();
    });
  });
  container.querySelectorAll("[data-restore-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api.restoreUser(btn.dataset.restoreUser).catch((e) => alert(e.message));
      await loadMeta(); renderArchive();
    });
  });
  container.querySelectorAll("[data-restore-station]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api.restoreStation(btn.dataset.restoreStation).catch((e) => alert(e.message));
      await loadMeta(); renderArchive();
    });
  });
}

// ──────────── AUDIT LOG ────────────
const ACTION_LABELS = { create: "Үүсгэсэн", update: "Засварласан", archive: "Архивласан", restore: "Сэргээсэн", delete: "Устгасан" };
const ENTITY_LABELS = { department: "Алба", team: "Бригад", user: "Хэрэглэгч", station: "Ус түгээх байр", worker: "Ажилтан" };
const ACTION_COLORS = {
  create:  "var(--emerald-600)",
  update:  "var(--brand-600)",
  archive: "var(--rose-600)",
  restore: "var(--amber-700)",
  delete:  "var(--rose-600)",
};

let _auditLogs = [];
let _auditReady = false;

function _renderAuditList() {
  const list    = el("audit-log-list");
  const searchEl  = el("audit-search");
  const actionSel = el("audit-filter-action");
  const entitySel = el("audit-filter-entity");

  const q      = (searchEl?.value ?? "").trim().toLowerCase();
  const action = actionSel?.value ?? "all";
  const entity = entitySel?.value ?? "all";

  const logs = _auditLogs.filter((log) => {
    if (action !== "all" && log.action !== action) return false;
    if (entity !== "all" && log.entityType !== entity) return false;
    if (q) {
      const haystack = [log.entityName, log.entityId, log.userName, log.username].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (!logs.length) {
    list.innerHTML = `<div class="empty-state" style="padding:40px">Үйлдлийн бүртгэл олдсонгүй.</div>`;
    return;
  }

  const fmt = (iso) => iso ? new Date(iso).toLocaleString("mn-MN") : "—";
  list.innerHTML = logs.map((log) => {
    let diffHtml = "";
    if (log.action === "update" && log.details) {
      try {
        const diff = JSON.parse(log.details);
        const entries = Object.entries(diff);
        if (entries.length) {
          diffHtml = `<div style="margin-top:6px;display:flex;flex-direction:column;gap:3px">` +
            entries.map(([field, val]) => {
              const { from, to } = val;
              return `<div style="font-size:12px;color:var(--slate-600)">
                <span style="font-weight:600">${escapeHtml(field)}:</span>
                <span style="color:var(--rose-600);text-decoration:line-through;margin:0 4px">${escapeHtml(String(from || "—"))}</span>
                <span style="color:var(--slate-400);margin-right:4px">→</span>
                <span style="color:var(--emerald-600)">${escapeHtml(String(to || "—"))}</span>
              </div>`;
            }).join("") +
          `</div>`;
        }
      } catch { /* ignore malformed details */ }
    }
    return `
      <div class="item-card" style="display:flex;align-items:start;justify-content:space-between;gap:12px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:12px;font-weight:700;color:${ACTION_COLORS[log.action] ?? "var(--slate-700)"};text-transform:uppercase;letter-spacing:0.05em">${ACTION_LABELS[log.action] ?? log.action}</span>
            <span style="font-size:12px;color:var(--slate-500)">${ENTITY_LABELS[log.entityType] ?? log.entityType}</span>
            <span style="font-size:13px;font-weight:600;color:var(--ink-900)">${escapeHtml(log.entityName || log.entityId || "")}</span>
          </div>
          <p style="font-size:12px;color:var(--slate-500);margin-top:4px">
            ${escapeHtml(log.userName || log.username || "Тодорхойгүй")} · ${fmt(log.createdAt)}
          </p>
          ${diffHtml}
        </div>
      </div>
    `;
  }).join("");
}

async function renderAuditLog() {
  const list = el("audit-log-list");

  if (!_auditReady) {
    list.innerHTML = `<p style="color:var(--slate-500);font-size:14px">Ачааллаж байна…</p>`;
    let data;
    try { data = await api.getAuditLogs(); } catch {
      list.innerHTML = `<p class="empty-state">Үйлдлийн бүртгэл ачаалж чадсангүй.</p>`;
      return;
    }
    _auditLogs = data.logs ?? [];
    _auditReady = true;

    el("audit-search")?.addEventListener("input", _renderAuditList);
    el("audit-filter-action")?.addEventListener("change", _renderAuditList);
    el("audit-filter-entity")?.addEventListener("change", _renderAuditList);
    el("audit-filter-reset")?.addEventListener("click", () => {
      const s = el("audit-search"); if (s) s.value = "";
      const a = el("audit-filter-action"); if (a) a.value = "all";
      const e = el("audit-filter-entity"); if (e) e.value = "all";
      _renderAuditList();
    });
  }

  if (!_auditLogs.length) {
    list.innerHTML = `<div class="empty-state" style="padding:40px">Үйлдлийн бүртгэл алга.</div>`;
    return;
  }

  _renderAuditList();
}
