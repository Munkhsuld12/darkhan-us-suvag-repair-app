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
  renderSummary();
  renderWorkload();
  renderTasks();
}

function renderSummary() {
  const total  = state.tasks.length;
  const active = state.tasks.filter((t) => t.status === "in_progress").length;
  const done   = state.tasks.filter((t) => t.status === "done").length;
  el("eng-total").textContent  = total;
  el("eng-active").textContent = active;
  el("eng-done").textContent   = done;
}

function renderWorkload() {
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...state.teams].sort((a, b) => {
    const diff = getTeamWorkloadCount(b.id, state.tickets, state.tasks) -
                 getTeamWorkloadCount(a.id, state.tickets, state.tasks);
    return diff !== 0 ? diff : a.name.localeCompare(b.name, "mn-MN");
  });

  el("workload-grid").innerHTML = sorted.map((team) => {
    const count  = getTeamWorkloadCount(team.id, state.tickets, state.tasks);
    const leader = state.users.find((u) => u.id === team.leaderUserId)?.fullName ?? "Хуваарилагдаагүй";
    const busy   = count >= 3;

    const todayTasks   = state.tasks.filter((t) => t.teamId === team.id && t.taskDate === today);
    const todayTickets = state.tickets.filter((t) => t.teamId === team.id && t.assignedAt && t.assignedAt.slice(0, 10) === today);
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
      <div class="workload-card ${busy ? "busy" : "free"}">
        <p class="workload-name">${escapeHtml(team.name)}</p>
        <p class="workload-leader">${escapeHtml(leader)}</p>
        <p class="workload-count">${count >= 1 ? `${count} ажил` : "Чөлөөтэй"}</p>
        ${progressHtml}
      </div>`;
  }).join("");
}

function renderTasks() {
  const sorted = [...state.tasks].sort((a, b) => {
    const order = { in_progress: 0, assigned: 1, done: 2 };
    return (order[a.status] ?? 1) - (order[b.status] ?? 1) ||
           new Date(b.createdAt) - new Date(a.createdAt);
  });

  const countEl = el("tasks-count");
  const active  = sorted.filter((t) => t.status !== "done").length;
  if (countEl) { countEl.textContent = active; countEl.style.display = active ? "" : "none"; }

  const listEl = el("tasks-list");
  if (!sorted.length) { listEl.innerHTML = emptyState("Төлөвлөгөөт ажил байхгүй байна"); return; }

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

// ── Modal ──
function setupModal() {
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
  const dl = el("task-station-list");
  dl.innerHTML = state.waterStations.map((s) =>
    `<option value="${escapeHtml(getStationOptionLabel(s))}"></option>`
  ).join("");

  el("task-dept").innerHTML = `<option value="">Алба сонгох</option>` +
    state.departments.map((d) =>
      `<option value="${d.id}">${escapeHtml(d.name)}</option>`
    ).join("");

  refreshTeams();

  el("task-date").value       = todayStr();
  el("task-station").value    = "";
  el("task-station-id").value = "";
  el("task-desc").value       = "";

  el("task-modal").classList.remove("hidden");
  el("task-station").focus();
}

function refreshTeams() {
  const deptId   = el("task-dept").value;
  const filtered = state.teams.filter((t) => !deptId || t.departmentId === deptId);
  el("task-team").innerHTML = `<option value="">Бригад сонгох</option>` +
    filtered.map((t) => {
      const w      = getTeamWorkloadCount(t.id, state.tickets, state.tasks);
      const leader = state.users.find((u) => u.id === t.leaderUserId)?.fullName ?? "—";
      const load   = w > 0 ? `${w} ажил` : "Чөлөөтэй";
      return `<option value="${t.id}">${escapeHtml(t.name)} — ${escapeHtml(leader)} (${load})</option>`;
    }).join("");
}

function closeModal() {
  el("task-modal").classList.add("hidden");
}
