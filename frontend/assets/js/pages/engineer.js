import * as api from "../api.js";
import { requireAuth } from "../auth.js";
import { setupSidebar } from "../sidebar.js";
import {
  formatDateTime, formatDate, statusBadge, getStationLabel, getStationOptionLabel,
  getDeptName, getTeamName, isTaskDelayed, todayStr, emptyState, escapeHtml, el,
} from "../utils.js";

let state = { tasks: [], teams: [], departments: [], users: [], waterStations: [] };
let user = null;
let deptFilter = "all";
let taskStationId = "";

document.addEventListener("DOMContentLoaded", async () => {
  setupSidebar();
  user = requireAuth();
  if (!user) return;

  await loadAll();
  setupForm();
  render();
});

async function loadAll() {
  const [taskRes, metaRes] = await Promise.all([
    api.getTasks().catch(() => ({ tasks: [] })),
    api.getAdminMeta().catch(() => ({ departments: [], teams: [], users: [], stations: [] })),
  ]);
  state.tasks         = taskRes.tasks ?? [];
  state.departments   = metaRes.departments ?? [];
  state.teams         = metaRes.teams ?? [];
  state.users         = metaRes.users ?? [];
  state.waterStations = metaRes.stations ?? [];
}

function getAccessibleDepts() {
  if (user.role === "general_engineer") return state.departments.map((d) => d.id);
  return user.departmentId ? [user.departmentId] : [];
}

function getVisibleTasks() {
  const accessDepts = getAccessibleDepts();
  return state.tasks
    .filter((t) => accessDepts.includes(t.departmentId))
    .filter((t) => deptFilter === "all" || t.departmentId === deptFilter)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

function render() {
  const tasks = getVisibleTasks();
  const today = todayStr();
  const done  = tasks.filter((t) => t.status === "done").length;
  const prog  = tasks.filter((t) => t.status === "in_progress").length;
  const delay = tasks.filter((t) => isTaskDelayed(t)).length;

  if (el("eng-total"))   el("eng-total").textContent   = tasks.length;
  if (el("eng-progress")) el("eng-progress").textContent = prog;
  if (el("eng-done"))    el("eng-done").textContent    = done;
  if (el("eng-delayed")) el("eng-delayed").textContent = delay;
  const progressLabel = el("tasks-progress-label");
  if (progressLabel) progressLabel.textContent = `${done}/${tasks.length} дууссан`;

  // Dept filter for general_engineer
  const filterEl = el("dept-filter-wrap");
  if (filterEl) {
    if (user.role === "general_engineer") {
      filterEl.style.display = "";
      const sel = el("dept-filter");
      if (sel && !sel.dataset.init) {
        sel.innerHTML = `<option value="all">Бүх алба</option>` +
          state.departments.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join("");
        sel.value = deptFilter;
        sel.addEventListener("change", (e) => { deptFilter = e.target.value; render(); });
        sel.dataset.init = "1";
      }
    } else {
      filterEl.style.display = "none";
    }
  }

  const tasksEl = el("tasks-list");
  if (!tasks.length) { tasksEl.innerHTML = emptyState("Ажил байхгүй"); return; }

  tasksEl.innerHTML = tasks.map((task) => {
    const station = state.waterStations.find((s) => s.id === task.stationId);
    const delayed = isTaskDelayed(task);
    return `
      <div class="item-card">
        <div style="display:flex;flex-wrap:wrap;align-items:start;justify-content:space-between;gap:8px">
          <div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <strong>${escapeHtml(station?.code ?? "Тодорхойгүй")}</strong>
              ${statusBadge(task.status)}
              ${delayed ? `<span class="badge badge-assigned">Хоцорсон</span>` : ""}
            </div>
            <p style="font-size:13px;color:var(--slate-500);margin-top:4px">
              ${escapeHtml(getDeptName(task.departmentId, state.departments))} · ${escapeHtml(getTeamName(task.teamId, state.teams, state.users))}
            </p>
          </div>
          <div style="font-size:12px;color:var(--slate-500);text-align:right">
            <p>${escapeHtml(formatDate(task.taskDate))}</p>
            <p>${escapeHtml(formatDateTime(task.createdAt))}</p>
          </div>
        </div>
        <p style="font-size:13px;color:var(--slate-600);margin-top:8px">${escapeHtml(task.description)}</p>
        ${task.workReport ? `<div style="margin-top:8px;background:white;border-radius:10px;padding:10px 12px;font-size:13px;color:var(--slate-600)">${escapeHtml(task.workReport)}</div>` : ""}
      </div>`;
  }).join("");
}

function setupForm() {
  // Populate station datalist
  const dl = el("engineer-station-datalist");
  if (dl) {
    state.waterStations.forEach((s) => {
      const o = document.createElement("option");
      o.value = getStationOptionLabel(s);
      dl.appendChild(o);
    });
  }

  // Dept select
  const deptSel = el("form-dept");
  if (deptSel) {
    if (user.role === "general_engineer") {
      deptSel.innerHTML = `<option value="">Алба сонгох</option>` +
        state.departments.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join("");
      deptSel.disabled = false;
    } else {
      deptSel.innerHTML = `<option value="${user.departmentId ?? ""}">${escapeHtml(getDeptName(user.departmentId, state.departments))}</option>`;
      deptSel.disabled = true;
    }
    deptSel.addEventListener("change", () => refreshTeamSelect());
    refreshTeamSelect();
  }

  // Station input
  el("form-station")?.addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    const s = state.waterStations.find((x) =>
      x.code.toLowerCase() === q || getStationOptionLabel(x).toLowerCase() === q
    );
    taskStationId = s?.id ?? "";
  });

  // Form submit
  el("task-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!taskStationId) { alert("Ус түгээх байрыг сонгоно уу"); return; }
    const teamId = el("form-team").value;
    const deptId = deptSel.value || user.departmentId;
    if (!teamId || !deptId) { alert("Алба болон бригад сонгоно уу"); return; }

    try {
      await api.createTask({
        stationId: taskStationId,
        teamId,
        departmentId: deptId,
        createdBy: user.id,
        description: el("form-desc").value.trim(),
        taskDate: el("form-date").value,
      });
      e.target.reset();
      taskStationId = "";
      await loadAll(); render();
    } catch (err) { alert(err.message); }
  });
}

function refreshTeamSelect() {
  const sel  = el("form-team");
  const dept = el("form-dept")?.value || user.departmentId;
  const filtered = state.teams.filter((t) => !dept || t.departmentId === dept);
  sel.innerHTML = `<option value="">Засварын бригад сонгох</option>` +
    filtered.map((t) => `<option value="${t.id}">${escapeHtml(getTeamName(t.id, state.teams, state.users))}</option>`).join("");
}
