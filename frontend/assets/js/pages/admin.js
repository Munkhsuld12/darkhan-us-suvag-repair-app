import * as api from "../api.js";
import { requireAuth } from "../auth.js";
import { roleLabels, roleOptions } from "../seed.js";
import { getDeptName, escapeHtml, el, emptyState } from "../utils.js";

let state = { departments: [], teams: [], users: [], stations: [] };
let activeTab = "departments";

document.addEventListener("DOMContentLoaded", async () => {
  const user = requireAuth();
  if (!user || user.role !== "admin") { window.location.href = "/app.html"; return; }

  await loadMeta();
  setupTabs();
  renderActive();
});

async function loadMeta() {
  const data = await api.getAdminMeta().catch(() => ({ departments: [], teams: [], users: [], stations: [] }));
  state.departments = data.departments ?? [];
  state.teams       = data.teams ?? [];
  state.users       = data.users ?? [];
  state.stations    = data.stations ?? [];
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
  else if (activeTab === "teams") renderTeams();
  else if (activeTab === "users") renderUsers();
  else if (activeTab === "stations") renderStations();
}

// ──────────── DEPARTMENTS ────────────
let editDept = null;
function renderDepartments() {
  const list = el("dept-list");
  const form = el("dept-form");

  list.innerHTML = !state.departments.length ? emptyState() : state.departments.map((d) => `
    <div class="item-card" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
      <div>
        <p style="font-weight:600;font-size:15px">${escapeHtml(d.name)}</p>
        <p style="font-size:12px;color:var(--slate-500)">${escapeHtml(d.id)}</p>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-secondary btn-sm" data-edit-dept="${d.id}">Засах</button>
        <button class="btn btn-danger btn-sm" data-del-dept="${d.id}">Устгах</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll("[data-edit-dept]").forEach((btn) => {
    const d = state.departments.find((x) => x.id === btn.dataset.editDept);
    btn.addEventListener("click", () => {
      editDept = d;
      el("dept-id-input").value   = d.id;
      el("dept-name-input").value = d.name;
      el("dept-form-title").textContent = "Алба засах";
    });
  });

  list.querySelectorAll("[data-del-dept]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Устгах уу?")) return;
      await api.deleteDepartment(btn.dataset.delDept).catch(() => {});
      await loadMeta(); renderActive();
    });
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const id = el("dept-id-input").value.trim();
    const name = el("dept-name-input").value.trim();
    if (!name) return;
    if (editDept) {
      await api.updateDepartment(id, { name }).catch((err) => alert(err.message));
    } else {
      await api.upsertDepartment({ id: id || undefined, name }).catch((err) => alert(err.message));
    }
    editDept = null; form.reset();
    el("dept-form-title").textContent = "Алба нэмэх";
    await loadMeta(); renderActive();
  };

  el("dept-cancel")?.addEventListener("click", () => {
    editDept = null; form.reset();
    el("dept-form-title").textContent = "Алба нэмэх";
  });
}

// ──────────── TEAMS ────────────
let editTeam = null;
function renderTeams() {
  // Populate dept select in team form
  const deptSel = el("team-dept-select");
  deptSel.innerHTML = `<option value="">Алба сонгох</option>` +
    state.departments.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join("");

  const leaderSel = el("team-leader-select");
  leaderSel.innerHTML = `<option value="">Хэрэглэгч сонгох</option>` +
    state.users.map((u) => `<option value="${u.id}">${escapeHtml(u.fullName)}</option>`).join("");

  const list = el("team-list");
  list.innerHTML = !state.teams.length ? emptyState() : state.teams.map((t) => `
    <div class="item-card">
      <div style="display:flex;align-items:start;justify-content:space-between;gap:8px">
        <div>
          <p style="font-weight:600;font-size:15px">${escapeHtml(t.name)}</p>
          <p style="font-size:12px;color:var(--slate-500)">${escapeHtml(getDeptName(t.departmentId, state.departments))}</p>
          <p style="font-size:12px;color:var(--slate-500)">${escapeHtml(state.users.find((u) => u.id === t.leaderUserId)?.fullName ?? "Хуваарилагдаагүй")}</p>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" data-edit-team="${t.id}">Засах</button>
          <button class="btn btn-danger btn-sm" data-del-team="${t.id}">Устгах</button>
        </div>
      </div>
    </div>
  `).join("");

  list.querySelectorAll("[data-edit-team]").forEach((btn) => {
    const t = state.teams.find((x) => x.id === btn.dataset.editTeam);
    btn.addEventListener("click", () => {
      editTeam = t;
      el("team-id-input").value      = t.id;
      el("team-name-input").value    = t.name;
      deptSel.value   = t.departmentId ?? "";
      leaderSel.value = t.leaderUserId ?? "";
      el("team-form-title").textContent = "Засварын бригад засах";
    });
  });

  list.querySelectorAll("[data-del-team]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Устгах уу?")) return;
      await api.deleteTeam(btn.dataset.delTeam).catch(() => {});
      await loadMeta(); renderActive();
    });
  });

  el("team-form").onsubmit = async (e) => {
    e.preventDefault();
    const id = el("team-id-input").value.trim();
    const name = el("team-name-input").value.trim();
    const departmentId = deptSel.value;
    const leaderUserId = leaderSel.value;
    if (!name || !departmentId || !leaderUserId) { alert("Бүх талбарыг бөглөнө үү"); return; }
    if (editTeam) {
      await api.updateTeam(id, { name, departmentId, leaderUserId }).catch((err) => alert(err.message));
    } else {
      await api.upsertTeam({ id: id || undefined, name, departmentId, leaderUserId }).catch((err) => alert(err.message));
    }
    editTeam = null; el("team-form").reset();
    el("team-form-title").textContent = "Засварын бригад нэмэх";
    await loadMeta(); renderActive();
  };

  el("team-cancel")?.addEventListener("click", () => {
    editTeam = null; el("team-form").reset();
    el("team-form-title").textContent = "Засварын бригад нэмэх";
  });
}

// ──────────── USERS ────────────
let editUser = null;
function renderUsers() {
  const deptSel  = el("user-dept-select");
  const teamSel  = el("user-team-select");
  const roleSel  = el("user-role-select");

  roleSel.innerHTML  = roleOptions.map((r) => `<option value="${r}">${escapeHtml(roleLabels[r] ?? r)}</option>`).join("");
  deptSel.innerHTML  = `<option value="">Сонгох</option>` + state.departments.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join("");
  deptSel.onchange = () => {
    const dept = deptSel.value;
    teamSel.innerHTML = `<option value="">Сонгох</option>` +
      state.teams.filter((t) => !dept || t.departmentId === dept).map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
  };
  deptSel.onchange();

  const list = el("user-list");
  list.innerHTML = !state.users.length ? emptyState() : state.users.map((u) => `
    <div class="item-card">
      <div style="display:flex;align-items:start;justify-content:space-between;gap:8px">
        <div>
          <p style="font-weight:600;font-size:15px">${escapeHtml(u.fullName)}</p>
          <p style="font-size:12px;color:var(--slate-500)">${escapeHtml(u.username)} | ${escapeHtml(roleLabels[u.role] ?? u.role)}</p>
          <p style="font-size:12px;color:var(--slate-500)">${escapeHtml(getDeptName(u.departmentId, state.departments))}</p>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" data-edit-user="${u.id}">Засах</button>
          <button class="btn btn-danger btn-sm" data-del-user="${u.id}">Устгах</button>
        </div>
      </div>
    </div>
  `).join("");

  list.querySelectorAll("[data-edit-user]").forEach((btn) => {
    const u = state.users.find((x) => x.id === btn.dataset.editUser);
    btn.addEventListener("click", () => {
      editUser = u;
      el("user-id-input").value       = u.id;
      el("user-fullname-input").value = u.fullName;
      el("user-username-input").value = u.username;
      el("user-password-input").value = "";
      el("user-phone-input").value    = u.phone ?? "";
      roleSel.value  = u.role;
      deptSel.value  = u.departmentId ?? "";
      deptSel.onchange();
      teamSel.value  = u.teamId ?? "";
      el("user-form-title").textContent = "Хэрэглэгч засах";
    });
  });

  list.querySelectorAll("[data-del-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Устгах уу?")) return;
      await api.deleteUser(btn.dataset.delUser).catch(() => {});
      await loadMeta(); renderActive();
    });
  });

  el("user-form").onsubmit = async (e) => {
    e.preventDefault();
    const id = el("user-id-input").value.trim();
    const body = {
      fullName: el("user-fullname-input").value.trim(),
      username: el("user-username-input").value.trim(),
      password: el("user-password-input").value.trim(),
      role: roleSel.value,
      departmentId: deptSel.value || undefined,
      teamId: teamSel.value || undefined,
      phone: el("user-phone-input").value.trim(),
    };
    if (!body.fullName || !body.username) { alert("Нэр болон нэвтрэх нэрийг оруулна уу"); return; }
    if (!editUser && !body.password) { alert("Нууц үгийг оруулна уу"); return; }

    try {
      if (editUser) await api.updateUser(id, body);
      else await api.upsertUser(body);
      editUser = null; el("user-form").reset();
      el("user-form-title").textContent = "Хэрэглэгч нэмэх";
      await loadMeta(); renderActive();
    } catch (err) { alert(err.message); }
  };

  el("user-cancel")?.addEventListener("click", () => {
    editUser = null; el("user-form").reset();
    el("user-form-title").textContent = "Хэрэглэгч нэмэх";
  });
}

// ──────────── STATIONS ────────────
let editStation = null;
let stationSearch = "";

function renderStations() {
  const searchEl = el("station-search-input");
  if (searchEl && !searchEl.dataset.init) {
    searchEl.addEventListener("input", (e) => { stationSearch = e.target.value; renderStations(); });
    searchEl.dataset.init = "1";
  }

  const query = stationSearch.toLowerCase().trim();
  const filtered = state.stations.filter((s) =>
    !query || s.code.toLowerCase().includes(query) ||
    (s.location ?? "").toLowerCase().includes(query) ||
    (s.caretakerName ?? "").toLowerCase().includes(query)
  );

  const list = el("station-list");
  list.innerHTML = !filtered.length ? emptyState("Ус түгээх байр олдсонгүй") : filtered.map((s) => `
    <div class="station-card">
      <div class="code">${escapeHtml(s.code)}</div>
      <p class="location">${escapeHtml(s.location || "Байршил оруулаагүй")}</p>
      <p class="caretaker">${escapeHtml(s.caretakerName || "Хянагч оруулаагүй")}${s.caretakerPhone ? ` | ${escapeHtml(s.caretakerPhone)}` : ""}</p>
      <div class="card-actions">
        <button class="btn btn-secondary btn-sm" data-edit-station="${s.id}">Засах</button>
        <button class="btn btn-danger btn-sm" data-del-station="${s.id}">Устгах</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll("[data-edit-station]").forEach((btn) => {
    const s = state.stations.find((x) => x.id === btn.dataset.editStation);
    btn.addEventListener("click", () => {
      editStation = s;
      el("station-id-input").value        = s.id;
      el("station-code-input").value      = s.code;
      el("station-loc-input").value       = s.location ?? "";
      el("station-care-input").value      = s.caretakerName ?? "";
      el("station-care-ph-input").value   = s.caretakerPhone ?? "";
      el("station-form-title").textContent = "Ус түгээх байр засах";
    });
  });

  list.querySelectorAll("[data-del-station]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Устгах уу?")) return;
      await api.deleteStation(btn.dataset.delStation).catch(() => {});
      await loadMeta(); renderActive();
    });
  });

  el("station-form").onsubmit = async (e) => {
    e.preventDefault();
    const id   = el("station-id-input").value.trim();
    const code = el("station-code-input").value.trim();
    const bagNo = Number(code.split("-")[0]);
    if (!code || !bagNo) { alert("Кодыг зөв оруулна уу (жишээ: 1-5)"); return; }
    const body = {
      code, bagNo,
      name: "",
      location: el("station-loc-input").value.trim(),
      caretakerName: el("station-care-input").value.trim(),
      caretakerPhone: el("station-care-ph-input").value.trim(),
    };
    try {
      if (editStation) await api.updateStation(id, body);
      else await api.upsertStation({ id: id || undefined, ...body });
      editStation = null; el("station-form").reset();
      el("station-form-title").textContent = "Ус түгээх байр нэмэх";
      await loadMeta(); renderActive();
    } catch (err) { alert(err.message); }
  };

  el("station-cancel")?.addEventListener("click", () => {
    editStation = null; el("station-form").reset();
    el("station-form-title").textContent = "Ус түгээх байр нэмэх";
  });
}
