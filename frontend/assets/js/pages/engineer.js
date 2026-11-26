import * as api from "../api.js";
import { requireAuth } from "../auth.js";
import { setupSidebar } from "../sidebar.js";
import {
  formatDateTime, statusBadge, getStationLabel, getStationOptionLabel,
  getTeamWorkloadCount, getDeptName, getTeamName,
  emptyState, escapeHtml, el, todayStr,
} from "../utils.js";

let state = { tasks: [], tickets: [], teams: [], departments: [], users: [], waterStations: [] };
let currentUser = null;

const isDepartmentEngineer = () => currentUser?.role === "department_engineer";

const getScopedDepartmentId = () => {
  if (!isDepartmentEngineer()) return null;
  return currentUser?.departmentId ?? "";
};

const getVisibleDepartments = () => {
  const departmentId = getScopedDepartmentId();
  if (departmentId === null) return state.departments;
  return state.departments.filter((dept) => dept.id === departmentId);
};

const getVisibleTeams = () => {
  const departmentId = getScopedDepartmentId();
  if (departmentId === null) return state.teams;
  const visibleTeamIds = new Set([
    ...getVisibleTickets().map((ticket) => ticket.teamId).filter(Boolean),
    ...getVisibleTasks().map((task) => task.teamId).filter(Boolean),
  ]);
  return state.teams.filter((team) =>
    team.departmentId === departmentId || visibleTeamIds.has(team.id)
  );
};

const getVisibleTickets = () => {
  const departmentId = getScopedDepartmentId();
  if (departmentId === null) return state.tickets;
  return state.tickets.filter((ticket) => ticket.departmentId === departmentId);
};

const getVisibleTasks = () => {
  const departmentId = getScopedDepartmentId();
  if (departmentId === null) return state.tasks;
  return state.tasks.filter((task) => task.departmentId === departmentId);
};

document.addEventListener("DOMContentLoaded", async () => {
  setupSidebar();
  currentUser = requireAuth();
  if (!currentUser) return;

  await loadAll();
  render();
  setupModal();
});

async function loadAll() {
  const [taskRes, tickRes, metaRes] = await Promise.all([
    api.getTasks().catch(() => ({ tasks: [] })),
    api.getTickets().catch(() => ({ tickets: [] })),
    api.getAdminMeta().catch(() => ({ departments: [], teams: [], users: [], stations: [] })),
  ]);
  state.tasks         = taskRes.tasks ?? [];
  state.tickets       = tickRes.tickets ?? [];
  state.departments   = metaRes.departments ?? [];
  state.teams         = metaRes.teams ?? [];
  state.users         = metaRes.users ?? [];
  state.waterStations = metaRes.stations ?? [];
}

function render() {
  renderWorkload();
  renderTasks();
}

function renderWorkload() {
  const today = new Date().toISOString().slice(0, 10);
  const visibleTeams = getVisibleTeams();
  const visibleTickets = getVisibleTickets();
  const visibleTasks = getVisibleTasks();
  const sorted = [...visibleTeams].sort((a, b) => {
    const diff = getTeamWorkloadCount(b.id, visibleTickets, visibleTasks) -
                 getTeamWorkloadCount(a.id, visibleTickets, visibleTasks);
    return diff !== 0 ? diff : a.name.localeCompare(b.name, "mn-MN");
  });

  if (!sorted.length) {
    el("workload-grid").innerHTML = emptyState("Бригадын мэдээлэл алга.");
    return;
  }

  el("workload-grid").innerHTML = sorted.map((team) => {
    const count  = getTeamWorkloadCount(team.id, visibleTickets, visibleTasks);
    const leader = state.users.find((u) => u.id === team.leaderUserId)?.fullName ?? "Хуваарилагдаагүй";
    const busy   = count >= 3;

    const todayTasks   = visibleTasks.filter((t) => t.teamId === team.id && t.taskDate === today);
    const todayTickets = visibleTickets.filter((t) => t.teamId === team.id && t.assignedAt && t.assignedAt.slice(0, 10) === today);
    const total = todayTasks.length + todayTickets.length;
    const done  = todayTasks.filter((t) => t.status === "done").length
                + todayTickets.filter((t) => t.status === "done").length;
    const pct   = total > 0 ? Math.round(done / total * 100) : 0;
    const barColor   = pct === 100 ? "var(--emerald-500)" : pct >= 50 ? "var(--brand-500)" : "var(--amber-500)";
    const stripeClass = (total > 0 && pct < 100) ? "progress-bar-stripe" : "progress-bar-done";
    const progressHtml = `
      <div style="margin-top:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
          <span style="font-size:11px;font-weight:700;color:var(--slate-500)">Өнөөдрийн явц</span>
          <span style="font-size:13px;font-weight:800;color:${total===0?"var(--slate-400)":barColor}">${total===0?"—":`${done}/${total} · ${pct}%`}</span>
        </div>
        <div style="position:relative;height:28px;background:var(--slate-200);border-radius:8px;overflow:hidden">
          ${total > 0 ? `<div class="${stripeClass}" style="position:absolute;left:0;top:0;height:100%;width:${pct}%;background:${barColor};border-radius:8px;transition:width 0.6s ease"></div>` : ""}
        </div>
      </div>`;

    return `
      <div class="workload-card ${busy ? "busy" : "free"}" data-team-id="${escapeHtml(team.id)}" style="cursor:pointer">
        <p class="workload-name">${escapeHtml(team.name)}</p>
        <p class="workload-leader">${escapeHtml(leader)}</p>
        <p class="workload-count">${count >= 1 ? `${count} ажил` : "Чөлөөтэй"}</p>
        ${progressHtml}
      </div>`;
  }).join("");

  el("workload-grid").querySelectorAll("[data-team-id]").forEach((card) => {
    card.addEventListener("click", () => openTeamModal(card.dataset.teamId));
  });
}

function renderTasks() {
  const sorted = [...getVisibleTasks()].sort((a, b) => {
    const order = { in_progress: 0, assigned: 1, done: 2 };
    return (order[a.status] ?? 1) - (order[b.status] ?? 1) ||
           new Date(b.createdAt) - new Date(a.createdAt);
  });

  const countEl = el("tasks-count");
  const active  = sorted.filter((t) => t.status !== "done").length;
  if (countEl) { countEl.textContent = active; countEl.style.display = active ? "" : "none"; }

  const listEl = el("tasks-list");
  if (!sorted.length) { listEl.innerHTML = emptyState("Төлөвлөгөөт ажил алга."); return; }

  listEl.innerHTML = `<div class="compact-grid">${sorted.map((t) => `
    <div class="card card-sm">
      <div style="display:flex;align-items:start;justify-content:space-between;gap:8px">
        <div>
          <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--slate-400);margin:0">
            ${escapeHtml(getTeamName(t.teamId, state.teams, state.users))}
          </p>
          <h3 style="font-size:15px;font-weight:700;margin:4px 0 0;color:var(--ink-900)">
            ${escapeHtml(getStationLabel(t.stationId, state.waterStations))}
          </h3>
        </div>
        ${statusBadge(t.status)}
      </div>
      <p style="font-size:13px;color:var(--slate-600);margin-top:8px">${escapeHtml(t.description)}</p>
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--slate-500)">${escapeHtml(t.taskDate)}</span>
        <span style="font-size:12px;color:var(--slate-400)">·</span>
        <span style="font-size:12px;color:var(--slate-500)">${escapeHtml(getDeptName(t.departmentId, state.departments))}</span>
      </div>
    </div>
  `).join("")}</div>`;
}

// ── Team detail modal ──
function openTeamModal(teamId) {
  const team   = getVisibleTeams().find((t) => t.id === teamId);
  if (!team) return;
  const leader = state.users.find((u) => u.id === team?.leaderUserId)?.fullName ?? "—";
  const fmt    = (iso) => iso ? new Date(iso).toLocaleString("mn-MN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

  const tickets = getVisibleTickets().filter((t) => t.teamId === teamId && t.status !== "done");
  const tasks   = getVisibleTasks().filter((t) => t.teamId === teamId && t.status !== "done");

  el("tdm-title").textContent  = team?.name ?? "";
  el("tdm-leader").textContent = `Ахлагч: ${leader}`;

  const ticketHtml = tickets.length ? tickets.map((t) => `
    <div class="item-card" style="padding:10px 12px;border-left:3px solid #f97316">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:11px;font-weight:700;color:#f97316;text-transform:uppercase">Засварын хүсэлт</span>
        ${statusBadge(t.status === "urgent" ? "assigned" : t.status)}
        ${(t.priority === "urgent" || t.status === "urgent") ? `<span class="badge badge-urgent">Яаралтай</span>` : ""}
      </div>
      <p style="font-weight:600;font-size:14px;margin-top:4px">${escapeHtml(getStationLabel(t.stationId, state.waterStations))} · ${escapeHtml(t.issueType)}</p>
      <p style="font-size:12px;color:var(--slate-500);margin-top:2px">${escapeHtml(t.ticketNo)} · ${fmt(t.assignedAt ?? t.createdAt)}</p>
    </div>`).join("") : `<p style="font-size:13px;color:var(--slate-400);padding:8px 4px">Засварын хүсэлт байхгүй</p>`;

  const taskHtml = tasks.length ? tasks.map((t) => `
    <div class="item-card" style="padding:10px 12px;border-left:3px solid #0ea5e9">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:11px;font-weight:700;color:#0ea5e9;text-transform:uppercase">Ажлын даалгавар</span>
        ${statusBadge(t.status)}
      </div>
      <p style="font-weight:600;font-size:14px;margin-top:4px">${escapeHtml(getStationLabel(t.stationId, state.waterStations))} · ${escapeHtml(t.description)}</p>
      <p style="font-size:12px;color:var(--slate-500);margin-top:2px">Огноо: ${escapeHtml(t.taskDate)}</p>
    </div>`).join("") : `<p style="font-size:13px;color:var(--slate-400);padding:8px 4px">Ажлын даалгавар алга.</p>`;

  el("tdm-body").innerHTML = `
    <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--slate-400)">Засварын хүсэлт (${tickets.length})</p>
    ${ticketHtml}
    <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--slate-400);margin-top:4px">Ажлын даалгавар (${tasks.length})</p>
    ${taskHtml}`;

  el("tdm-overlay").classList.remove("hidden");
}

// ── Task create modal ──
function setupModal() {
  el("tdm-close")?.addEventListener("click", () => el("tdm-overlay").classList.add("hidden"));
  el("tdm-overlay")?.addEventListener("click", (e) => {
    if (e.target === el("tdm-overlay")) el("tdm-overlay").classList.add("hidden");
  });
  el("btn-new-task").addEventListener("click", openModal);

  document.querySelectorAll("[data-close-modal]").forEach((btn) =>
    btn.addEventListener("click", closeModal)
  );
  el("task-modal").addEventListener("click", (e) => {
    if (e.target === el("task-modal")) closeModal();
  });

  el("task-dept").addEventListener("change", refreshTeams);

  const resolveStation = (val) => {
    const q = val.trim().toLowerCase();
    const s = state.waterStations.find((x) =>
      x.code.toLowerCase() === q || getStationOptionLabel(x).toLowerCase() === q
    );
    el("task-station-id").value = s?.id ?? "";
  };
  el("task-station").addEventListener("input",  (e) => resolveStation(e.target.value));
  el("task-station").addEventListener("change", (e) => resolveStation(e.target.value));

  el("task-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    resolveStation(el("task-station").value);
    const stationId = el("task-station-id").value;
    const teamId    = el("task-team").value;
    const deptId    = el("task-dept").value;
    const date      = el("task-date").value;
    const desc      = el("task-desc").value.trim();

    if (!stationId) { alert("Ус түгээх байрыг сонгоно уу (жагсаалтаас сонгоно уу)"); return; }
    if (!teamId)    { alert("Бригадыг сонгоно уу"); return; }
    if (!deptId)    { alert("Албыг сонгоно уу"); return; }
    if (!desc)      { alert("Ажлын тайлбар оруулна уу"); return; }

    const scopedDepartmentId = getScopedDepartmentId();
    if (scopedDepartmentId !== null && deptId !== scopedDepartmentId) {
      alert("Та зөвхөн өөрийн албаны бригад руу ажил хуваарилна");
      return;
    }

    const selectedTeam = getVisibleTeams().find((team) => team.id === teamId);
    if (!selectedTeam) {
      alert("Сонгосон бригад олдсонгүй");
      return;
    }
    if (selectedTeam.departmentId !== deptId) {
      alert("Сонгосон бригад энэ албанд харьяалагдахгүй байна");
      return;
    }

    try {
      await api.createTask({
        stationId,
        teamId,
        departmentId: deptId,
        createdBy: currentUser.id,
        description: desc,
        taskDate: date,
      });
      closeModal();
      await loadAll();
      render();
    } catch (err) { alert(err.message); }
  });
}

function openModal() {
  if (isDepartmentEngineer() && !currentUser?.departmentId) {
    alert("Танд алба оноогоогүй байна");
    return;
  }

  const dl = el("task-station-list");
  dl.innerHTML = state.waterStations.map((s) =>
    `<option value="${escapeHtml(getStationOptionLabel(s))}"></option>`
  ).join("");

  const taskDept = el("task-dept");
  const scopedDepartmentId = getScopedDepartmentId();
  taskDept.innerHTML = `<option value="">Алба сонгох</option>` +
    getVisibleDepartments().map((d) =>
      `<option value="${d.id}">${escapeHtml(d.name)}</option>`
    ).join("");
  taskDept.disabled = scopedDepartmentId !== null;
  if (scopedDepartmentId) taskDept.value = scopedDepartmentId;

  refreshTeams();

  el("task-date").value       = todayStr();
  el("task-station").value    = "";
  el("task-station-id").value = "";
  el("task-desc").value       = "";

  el("task-modal").classList.remove("hidden");
  el("task-station").focus();
}

function refreshTeams() {
  const deptId   = el("task-dept").value || getScopedDepartmentId() || "";
  const filtered = getVisibleTeams().filter((t) => !deptId || t.departmentId === deptId);
  el("task-team").innerHTML = `<option value="">Бригад сонгох</option>` +
    filtered.map((t) => {
      const w      = getTeamWorkloadCount(t.id, getVisibleTickets(), getVisibleTasks());
      const leader = state.users.find((u) => u.id === t.leaderUserId)?.fullName ?? "—";
      const load   = w > 0 ? `${w} ажил` : "Чөлөөтэй";
      return `<option value="${t.id}">${escapeHtml(t.name)} — ${escapeHtml(leader)} (${load})</option>`;
    }).join("");
}

function closeModal() {
  el("task-modal").classList.add("hidden");
}
