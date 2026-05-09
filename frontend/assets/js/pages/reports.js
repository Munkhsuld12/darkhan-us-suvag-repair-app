import * as api from "../api.js";
import { requireAuth, getUser } from "../auth.js";
import { setupSidebar } from "../sidebar.js";
import { reportTypeLabels, sourceLabels, complaintStatusLabels, priorityLabels, statusLabels } from "../seed.js";
import {
  formatDateTime, formatDate, statusBadge, getStationLabel, getStationOptionLabel,
  getDeptName, getTeamName, isTaskDelayed, avgHours, formatDuration,
  buildCountRows, getMaterialRows, downloadCsv, toExcelText, formatCsvDate,
  escapeHtml, el,
} from "../utils.js";

let state = { tickets: [], tasks: [], complaints: [], maintenanceLogs: [], departments: [], teams: [], users: [], waterStations: [] };
let user = null;

// Filters
let reportType  = "tickets";
let dateFrom    = "";
let dateTo      = "";
let stationFilter    = "all";
let bagFilter        = "all";
let deptFilter       = "all";
let teamFilter       = "all";
let statusFilter     = "all";
let issueTypeFilter  = "all";
let sourceFilter     = "all";
let priorityFilter   = "all";

const today = new Date().toISOString().slice(0, 10);
const defaultFrom = `${today.slice(0, 7)}-01`;

const ROLE_MAP = {
  dispatcher:          "/dispatcher.html",
  general_engineer:    "/engineer.html",
  department_engineer: "/engineer.html",
  brigade_leader:      "/brigade.html",
  admin:               "/admin.html",
};

document.addEventListener("DOMContentLoaded", async () => {
  setupSidebar();
  const u = getUser();
  const link = document.getElementById("dashboard-link");
  if (link && u) link.href = ROLE_MAP[u.role] || "/app.html";

  user = requireAuth();
  if (!user) return;

  dateFrom = defaultFrom;
  dateTo   = today;

  await loadAll();
  setupFilters();
  renderAll();
});

async function loadAll() {
  const params = {};
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo)   params.dateTo   = dateTo;
  if (stationFilter !== "all") params.stationId = stationFilter;
  if (bagFilter !== "all")     params.bagNo      = bagFilter;
  if (deptFilter !== "all")    params.departmentId = deptFilter;
  if (teamFilter !== "all")    params.teamId     = teamFilter;

  const [repRes, metaRes] = await Promise.all([
    api.getReports(params).catch(() => ({ tickets: [], tasks: [], complaints: [], maintenanceLogs: [] })),
    api.getAdminMeta().catch(() => ({ departments: [], teams: [], users: [], stations: [] })),
  ]);

  state.tickets         = repRes.tickets ?? [];
  state.tasks           = repRes.tasks ?? [];
  state.complaints      = repRes.complaints ?? [];
  state.maintenanceLogs = repRes.maintenanceLogs ?? [];
  state.departments     = metaRes.departments ?? [];
  state.teams           = metaRes.teams ?? [];
  state.users           = metaRes.users ?? [];
  state.waterStations   = metaRes.stations ?? [];
}

function setupFilters() {
  // Report type tabs (target the inner tab-list div)
  const tabsEl = el("report-tab-list") || el("report-tabs");
  tabsEl.innerHTML = Object.entries(reportTypeLabels).map(([k, v]) =>
    `<button class="tab-btn${k === reportType ? " active" : ""}" data-type="${k}">${v}</button>`
  ).join("");
  tabsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-type]");
    if (!btn) return;
    reportType = btn.dataset.type;
    tabsEl.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
    renderAll();
  });

  // Date inputs
  el("filter-from").value = dateFrom;
  el("filter-to").value   = dateTo;
  el("filter-from").addEventListener("change", (e) => { dateFrom = e.target.value; applyFilters(); });
  el("filter-to").addEventListener("change",   (e) => { dateTo   = e.target.value; applyFilters(); });

  // Reset btn
  el("filter-reset")?.addEventListener("click", () => {
    dateFrom = defaultFrom; dateTo = today;
    stationFilter = bagFilter = deptFilter = teamFilter =
    statusFilter = issueTypeFilter = sourceFilter = priorityFilter = "all";
    el("filter-from").value = dateFrom; el("filter-to").value = dateTo;
    updateSelectValue("filter-bag", "all");
    updateSelectValue("filter-station", "all");
    updateSelectValue("filter-dept", "all");
    updateSelectValue("filter-team", "all");
    updateSelectValue("filter-status", "all");
    updateSelectValue("filter-issue", "all");
    updateSelectValue("filter-source", "all");
    updateSelectValue("filter-priority", "all");
    applyFilters();
  });

  // Bag / Station / Dept / Team / Status / Issue / Source / Priority
  const bags = [...new Set(state.waterStations.map((s) => s.bagNo))].sort((a,b)=>a-b);
  const bagSel = el("filter-bag");
  bagSel.innerHTML = `<option value="all">Бүх баг</option>` +
    bags.map((b) => `<option value="${b}">${b}-р баг</option>`).join("");
  bagSel.addEventListener("change", (e) => { bagFilter = e.target.value; renderAll(); });

  const statSel = el("filter-station");
  const stationsSorted = [...state.waterStations].sort((a,b) => a.bagNo - b.bagNo || a.code.localeCompare(b.code));
  statSel.innerHTML = `<option value="all">Бүх байр</option>` +
    stationsSorted.map((s) => `<option value="${s.id}">${escapeHtml(getStationOptionLabel(s))}</option>`).join("");
  statSel.addEventListener("change", (e) => { stationFilter = e.target.value; renderAll(); });

  // Role-based dept/team
  const deptSel = el("filter-dept");
  const canChangeDept = !["brigade_leader","department_engineer"].includes(user.role);
  if (canChangeDept) {
    deptSel.innerHTML = `<option value="all">Бүх алба</option>` +
      state.departments.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join("");
    deptSel.addEventListener("change", (e) => {
      deptFilter = e.target.value;
      updateTeamSelect();
      renderAll();
    });
  } else {
    deptSel.disabled = true;
    deptSel.innerHTML = `<option value="${user.departmentId ?? ""}">${escapeHtml(getDeptName(user.departmentId, state.departments))}</option>`;
  }

  updateTeamSelect();
  const canChangeTeam = user.role !== "brigade_leader";
  if (!canChangeTeam) {
    el("filter-team").disabled = true;
    el("filter-team").innerHTML = `<option value="${user.teamId ?? ""}">${escapeHtml(getTeamName(user.teamId, state.teams, state.users))}</option>`;
  }

  // Issue types
  const issues = [...new Set([
    ...state.tickets.map((t) => t.issueType),
    ...state.complaints.map((c) => c.issueType),
  ])].filter(Boolean).sort((a,b) => a.localeCompare(b,"mn"));
  const issueSel = el("filter-issue");
  issueSel.innerHTML = `<option value="all">Бүх төрөл</option>` +
    issues.map((i) => `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`).join("");
  issueSel.addEventListener("change", (e) => { issueTypeFilter = e.target.value; renderAll(); });

  el("filter-source")?.addEventListener("change",   (e) => { sourceFilter   = e.target.value; renderAll(); });
  el("filter-status")?.addEventListener("change",   (e) => { statusFilter   = e.target.value; renderAll(); });
  el("filter-priority")?.addEventListener("change", (e) => { priorityFilter = e.target.value; renderAll(); });

  // CSV / Print
  el("btn-csv")?.addEventListener("click", () => {
    const rows = buildCsvRows();
    downloadCsv(`${reportTypeLabels[reportType]}-${dateFrom}-${dateTo}.csv`, rows);
  });
  el("btn-print")?.addEventListener("click", () => window.print());
}

function updateTeamSelect() {
  const sel = el("filter-team");
  if (!sel || sel.disabled) return;
  const dept = deptFilter !== "all" ? deptFilter : null;
  const filtered = state.teams.filter((t) => !dept || t.departmentId === dept);
  sel.innerHTML = `<option value="all">Бүх бригад</option>` +
    filtered.map((t) => `<option value="${t.id}">${escapeHtml(getTeamName(t.id, state.teams, state.users))}</option>`).join("");
  sel.addEventListener("change", (e) => { teamFilter = e.target.value; renderAll(); });
}

function updateSelectValue(id, val) {
  const s = el(id);
  if (s) s.value = val;
}

async function applyFilters() {
  await loadAll();
  renderAll();
}

// ── Filtered data ──
function getFilteredTickets() {
  return state.tickets.filter((t) => {
    if (stationFilter !== "all" && t.stationId !== stationFilter) return false;
    if (bagFilter !== "all") {
      const s = state.waterStations.find((x) => x.id === t.stationId);
      if (!s || String(s.bagNo) !== bagFilter) return false;
    }
    if (deptFilter !== "all" && t.departmentId !== deptFilter) return false;
    if (teamFilter !== "all" && t.teamId !== teamFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (issueTypeFilter !== "all" && t.issueType !== issueTypeFilter) return false;
    if (sourceFilter !== "all" && t.source !== sourceFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    return true;
  });
}

function getFilteredTasks() {
  return state.tasks.filter((t) => {
    if (stationFilter !== "all" && t.stationId !== stationFilter) return false;
    if (bagFilter !== "all") {
      const s = state.waterStations.find((x) => x.id === t.stationId);
      if (!s || String(s.bagNo) !== bagFilter) return false;
    }
    if (deptFilter !== "all" && t.departmentId !== deptFilter) return false;
    if (teamFilter !== "all" && t.teamId !== teamFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  });
}

function getFilteredComplaints() {
  return state.complaints.filter((c) => {
    if (stationFilter !== "all" && c.stationId !== stationFilter) return false;
    if (bagFilter !== "all") {
      const s = state.waterStations.find((x) => x.id === c.stationId);
      if (!s || String(s.bagNo) !== bagFilter) return false;
    }
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (issueTypeFilter !== "all" && c.issueType !== issueTypeFilter) return false;
    if (sourceFilter !== "all" && c.source !== sourceFilter) return false;
    return true;
  });
}

function getFilteredMaintenance() {
  return state.maintenanceLogs.filter((m) => {
    if (teamFilter !== "all" && m.teamId !== teamFilter) return false;
    if (stationFilter !== "all") {
      const tkt = m.ticketId ? state.tickets.find((t) => t.id === m.ticketId) : null;
      const tsk = m.taskId   ? state.tasks.find((t)   => t.id === m.taskId)   : null;
      const sid = tkt?.stationId ?? tsk?.stationId;
      if (sid !== stationFilter) return false;
    }
    return true;
  });
}

// ── Render ──
function renderAll() {
  const fTickets  = getFilteredTickets();
  const fTasks    = getFilteredTasks();
  const fComps    = getFilteredComplaints();
  const fMlogs    = getFilteredMaintenance();

  renderSummaryCards(fTickets, fTasks, fComps, fMlogs);
  renderBreakdowns(fTickets, fTasks, fComps, fMlogs);
  renderMainTable(fTickets, fTasks, fComps, fMlogs);
  updateFilterVisibility();
}

function renderSummaryCards(fTickets, fTasks, fComps, fMlogs) {
  const completedTickets = fTickets.filter((t) => t.status === "done");
  const openTickets      = fTickets.filter((t) => t.status !== "done");
  const completedTasks   = fTasks.filter((t) => t.status === "done");
  const activeTasks      = fTasks.filter((t) => t.status !== "done");
  const delayedTasks     = fTasks.filter(isTaskDelayed);

  const ticketHours = avgHoursAll(completedTickets.map((t) => avgHours(t.startedAt ?? t.createdAt, t.finishedAt)));
  const taskHours   = avgHoursAll(completedTasks.map((t) => avgHours(t.startedAt ?? t.createdAt, t.finishedAt)));
  const perfAvg     = avgHoursAll([ticketHours, taskHours].filter((x) => x !== null));

  const cards =
    reportType === "complaints" ? [
      { title: "Гомдол", value: fComps.length, note: `${dateFrom} — ${dateTo}`, tone: "brand" },
      { title: "Вэб",    value: fComps.filter((c) => c.source === "web").length,   tone: "blue" },
      { title: "Утас",   value: fComps.filter((c) => c.source === "phone").length, tone: "green" },
      { title: "Хөрвүүлсэн", value: fComps.filter((c) => c.status === "converted").length, tone: "amber" },
    ] : reportType === "tasks" ? [
      { title: "Ажил",    value: fTasks.length,      note: `${dateFrom} — ${dateTo}`, tone: "brand" },
      { title: "Явц",     value: activeTasks.length,   tone: "blue" },
      { title: "Дууссан", value: completedTasks.length, tone: "green" },
      { title: "Хоцорсон",value: delayedTasks.length,  tone: "amber" },
    ] : reportType === "maintenance" ? [
      { title: "Лог",     value: fMlogs.length,    note: `${dateFrom} — ${dateTo}`, tone: "brand" },
      { title: "Байр",    value: new Set(fMlogs.map((m) => { const t = state.tickets.find((x) => x.id === m.ticketId); const k = state.tasks.find((x) => x.id === m.taskId); return t?.stationId ?? k?.stationId; }).filter(Boolean)).size, tone: "blue" },
      { title: "Бригад",  value: new Set(fMlogs.map((m) => m.teamId)).size, tone: "green" },
      { title: "Материал",value: getMaterialRows(fMlogs).reduce((s, r) => s + r.value, 0), tone: "amber" },
    ] : reportType === "performance" ? [
      { title: "Дундаж хугацаа", value: formatDuration(perfAvg), note: "Дууссан ажил", tone: "brand" },
      { title: "Дууссан",   value: completedTickets.length + completedTasks.length, tone: "green" },
      { title: "Идэвхтэй",  value: openTickets.length + activeTasks.length,          tone: "blue" },
      { title: "Хоцорсон",  value: delayedTasks.length,                              tone: "amber" },
    ] : [
      { title: "Хүсэлт",   value: fTickets.length,      note: `${dateFrom} — ${dateTo}`, tone: "brand" },
      { title: "Нээлттэй", value: openTickets.length,     tone: "blue" },
      { title: "Дууссан",  value: completedTickets.length, tone: "green" },
      { title: "Яаралтай", value: fTickets.filter((t) => t.priority === "urgent" || t.status === "urgent").length, tone: "amber" },
    ];

  el("summary-cards").innerHTML = cards.map((c) => `
    <div class="summary-card tone-${c.tone}">
      <p class="label">${escapeHtml(c.title)}</p>
      <p class="value">${escapeHtml(String(c.value))}</p>
      ${c.note ? `<p class="note">${escapeHtml(c.note)}</p>` : ""}
    </div>
  `).join("");
}

function avgHoursAll(vals) {
  const filtered = vals.filter((v) => v !== null && isFinite(v));
  return filtered.length ? filtered.reduce((s, v) => s + v, 0) / filtered.length : null;
}

function stationCode(stationId) {
  return state.waterStations.find((s) => s.id === stationId)?.code ?? "Тодорхойгүй";
}

function renderBreakdowns(fTickets, fTasks, fComps, fMlogs) {
  let cards = [];
  if (reportType === "complaints") {
    cards = [
      { title: "Эх сурвалж", rows: buildCountRows(fComps, (c) => sourceLabels[c.source]) },
      { title: "Төрлөөр",    rows: buildCountRows(fComps, (c) => c.issueType) },
      { title: "Байраар",    rows: buildCountRows(fComps, (c) => stationCode(c.stationId)) },
      { title: "Багаар",     rows: buildCountRows(fComps, (c) => { const s = state.waterStations.find((x) => x.id === c.stationId); return s ? `${s.bagNo}-р баг` : null; }) },
    ];
  } else if (reportType === "tickets") {
    cards = [
      { title: "Төлөвөөр",  rows: buildCountRows(fTickets, (t) => statusLabels[t.status]) },
      { title: "Яаралтаар", rows: buildCountRows(fTickets, (t) => priorityLabels[t.priority]) },
      { title: "Албаар",    rows: buildCountRows(fTickets, (t) => getDeptName(t.departmentId, state.departments)) },
      { title: "Бригадаар", rows: buildCountRows(fTickets, (t) => getTeamName(t.teamId, state.teams, state.users)) },
    ];
  } else if (reportType === "tasks") {
    cards = [
      { title: "Төлөвөөр",  rows: buildCountRows(fTasks, (t) => statusLabels[t.status]) },
      { title: "Албаар",    rows: buildCountRows(fTasks, (t) => getDeptName(t.departmentId, state.departments)) },
      { title: "Бригадаар", rows: buildCountRows(fTasks, (t) => getTeamName(t.teamId, state.teams, state.users)) },
    ];
  } else if (reportType === "maintenance") {
    cards = [
      { title: "Бригадаар", rows: buildCountRows(fMlogs, (m) => getTeamName(m.teamId, state.teams, state.users)) },
      { title: "Байраар",   rows: buildCountRows(fMlogs, (m) => { const t = state.tickets.find((x) => x.id === m.ticketId); const k = state.tasks.find((x) => x.id === m.taskId); return stationCode(t?.stationId ?? k?.stationId); }) },
      { title: "Материал",  rows: getMaterialRows(fMlogs) },
    ];
  } else { // performance
    const allItems = [...fTickets.map((t) => ({ issueType: t.issueType, stationId: t.stationId })), ...fComps.map((c) => ({ issueType: c.issueType, stationId: c.stationId }))];
    cards = [
      { title: "Бригадын ачаалал",   rows: buildCountRows(fTickets, (t) => getTeamName(t.teamId, state.teams, state.users)) },
      { title: "Албаны ачаалал",     rows: buildCountRows(fTickets, (t) => getDeptName(t.departmentId, state.departments)) },
      { title: "Түгээмэл асуудал",   rows: buildCountRows(allItems, (i) => i.issueType) },
      { title: "Их хүсэлттэй байр",  rows: buildCountRows(allItems, (i) => stationCode(i.stationId)) },
    ];
  }

  el("breakdown-cards").innerHTML = cards.map((c) => `
    <div class="breakdown-card">
      <h3>${escapeHtml(c.title)}</h3>
      ${!c.rows.length ? `<div class="empty-state" style="padding:16px 0">Мэдээлэл алга</div>` :
        c.rows.map((r) => `
          <div class="breakdown-row">
            <span>${escapeHtml(r.label)}</span>
            <span class="count">${r.value}</span>
          </div>
        `).join("")}
    </div>
  `).join("");
}

function renderMainTable(fTickets, fTasks, fComps, fMlogs) {
  const wrap = el("main-table-wrap");
  const countEl = el("main-count");
  let html = "";
  let count = 0;

  if (reportType === "performance") {
    const completedTickets = fTickets.filter((t) => t.status === "done");
    const completedTasks   = fTasks.filter((t) => t.status === "done");
    const ticketHours = avgHoursAll(completedTickets.map((t) => avgHours(t.startedAt ?? t.createdAt, t.finishedAt)));
    const taskHours   = avgHoursAll(completedTasks.map((t) => avgHours(t.startedAt ?? t.createdAt, t.finishedAt)));
    const perfAvg     = avgHoursAll([ticketHours, taskHours].filter((x) => x !== null));
    const rows = [
      ["Дундаж засварын хүсэлт", formatDuration(ticketHours)],
      ["Дундаж өдөр тутмын ажил", formatDuration(taskHours)],
      ["Нийт дууссан ажил", String(completedTickets.length + completedTasks.length)],
      ["Идэвхтэй ажил", String(fTickets.filter((t)=>t.status!=="done").length + fTasks.filter((t)=>t.status!=="done").length)],
      ["Хоцорсон ажил", String(fTasks.filter(isTaskDelayed).length)],
      ["Засварын лог", String(fMlogs.length)],
    ];
    count = rows.length;
    html = `<table><thead><tr><th>Үзүүлэлт</th><th>Утга</th></tr></thead><tbody>` +
      rows.map(([l,v]) => `<tr><td style="font-weight:600">${escapeHtml(l)}</td><td>${escapeHtml(v)}</td></tr>`).join("") +
      `</tbody></table>`;
  } else if (reportType === "complaints") {
    count = fComps.length;
    html = `<table><thead><tr><th>Ус түгээх байр</th><th>Төрөл</th><th>Эх сурвалж</th><th>Төлөв</th><th>Огноо</th></tr></thead><tbody>` +
      fComps.map((c) => {
        const s = state.waterStations.find((x) => x.id === c.stationId);
        return `<tr>
          <td><p style="font-weight:600">${escapeHtml(s?.code ?? "Тодорхойгүй")}</p><p style="font-size:12px;color:var(--slate-500)">${escapeHtml(s?.location ?? "-")}</p></td>
          <td><p style="font-weight:600">${escapeHtml(c.issueType)}</p><p style="font-size:12px;color:var(--slate-500)">${escapeHtml(c.description)}</p></td>
          <td>${escapeHtml(sourceLabels[c.source] ?? c.source)}</td>
          <td>${escapeHtml(complaintStatusLabels[c.status] ?? c.status)}</td>
          <td style="color:var(--slate-600)"><p>${escapeHtml(formatDateTime(c.createdAt))}</p><p style="font-size:12px">${escapeHtml(c.citizenName)}</p></td>
        </tr>`;
      }).join("") + `</tbody></table>`;
  } else if (reportType === "tasks") {
    count = fTasks.length;
    html = `<table><thead><tr><th>Ус түгээх байр</th><th>Ажил</th><th>Алба</th><th>Бригад</th><th>Төлөв</th><th>Огноо</th></tr></thead><tbody>` +
      fTasks.map((t) => {
        const s = state.waterStations.find((x) => x.id === t.stationId);
        const delayed = isTaskDelayed(t);
        return `<tr>
          <td><p style="font-weight:600">${escapeHtml(s?.code ?? "Тодорхойгүй")}</p><p style="font-size:12px;color:var(--slate-500)">${escapeHtml(s?.location ?? "-")}</p></td>
          <td><p style="font-weight:600">${escapeHtml(t.description)}</p><p style="font-size:12px;color:var(--slate-500)">${escapeHtml(formatDate(t.taskDate))}</p></td>
          <td>${escapeHtml(getDeptName(t.departmentId, state.departments))}</td>
          <td>${escapeHtml(getTeamName(t.teamId, state.teams, state.users))}</td>
          <td>${statusBadge(t.status)}${delayed ? `<span class="badge badge-assigned" style="margin-left:4px">Хоцорсон</span>` : ""}</td>
          <td style="color:var(--slate-600)">${escapeHtml(formatDate(t.taskDate))}${t.finishedAt ? `<p style="font-size:12px">Дууссан: ${escapeHtml(formatDateTime(t.finishedAt))}</p>` : ""}</td>
        </tr>`;
      }).join("") + `</tbody></table>`;
  } else if (reportType === "maintenance") {
    count = fMlogs.length;
    html = `<table><thead><tr><th>Ус түгээх байр</th><th>Бригад</th><th>Материал</th><th>Тайлбар</th><th>Огноо</th></tr></thead><tbody>` +
      fMlogs.map((m) => {
        const tkt = m.ticketId ? state.tickets.find((t) => t.id === m.ticketId) : null;
        const tsk = m.taskId   ? state.tasks.find((t)   => t.id === m.taskId)   : null;
        const sid = tkt?.stationId ?? tsk?.stationId;
        const s = state.waterStations.find((x) => x.id === sid);
        return `<tr>
          <td><p style="font-weight:600">${escapeHtml(s?.code ?? "Тодорхойгүй")}</p><p style="font-size:12px;color:var(--slate-500)">${escapeHtml(s?.location ?? "-")}</p></td>
          <td>${escapeHtml(getTeamName(m.teamId, state.teams, state.users))}</td>
          <td>${escapeHtml(m.materialsUsed || "-")}</td>
          <td>${escapeHtml(m.description)}</td>
          <td style="color:var(--slate-600)">${escapeHtml(formatDateTime(m.createdAt))}${m.finishedAt ? `<p style="font-size:12px">Дууссан: ${escapeHtml(formatDateTime(m.finishedAt))}</p>` : ""}</td>
        </tr>`;
      }).join("") + `</tbody></table>`;
  } else { // tickets
    count = fTickets.length;
    html = `<table><thead><tr><th>Дугаар</th><th>Ус түгээх байр</th><th>Алба</th><th>Бригад</th><th>Төлөв</th><th>Огноо</th></tr></thead><tbody>` +
      fTickets.map((t) => {
        const s = state.waterStations.find((x) => x.id === t.stationId);
        return `<tr>
          <td><p style="font-weight:600">${escapeHtml(t.ticketNo)}</p><p style="font-size:12px;color:var(--slate-500)">${escapeHtml(t.issueType)}</p></td>
          <td><p style="font-weight:600">${escapeHtml(s?.code ?? "Тодорхойгүй")}</p><p style="font-size:12px;color:var(--slate-500)">${escapeHtml(s ? `${s.bagNo}-р баг` : "-")}</p></td>
          <td>${escapeHtml(getDeptName(t.departmentId, state.departments))}</td>
          <td>${escapeHtml(getTeamName(t.teamId, state.teams, state.users))}</td>
          <td>${statusBadge(t.status)}${t.priority === "urgent" ? `<span class="badge badge-urgent" style="margin-left:4px">Яаралтай</span>` : ""}</td>
          <td style="color:var(--slate-600)">${escapeHtml(formatDateTime(t.createdAt))}${t.finishedAt ? `<p style="font-size:12px">Дууссан: ${escapeHtml(formatDateTime(t.finishedAt))}</p>` : "<p style='font-size:12px'>Нээлттэй</p>"}</td>
        </tr>`;
      }).join("") + `</tbody></table>`;
  }

  if (countEl) countEl.textContent = count;
  const titleEl = el("main-table-title");
  if (titleEl) titleEl.textContent = reportTypeLabels[reportType] ?? "Дэлгэрэнгүй";
  wrap.innerHTML = count === 0 ? `<div class="empty-state" style="padding:40px">Тайлан хоосон</div>` :
    `<div class="table-shell" style="overflow-x:auto">${html}</div>`;
}

function updateFilterVisibility() {
  const show = (id, visible) => {
    const el2 = el(id);
    if (el2) el2.parentElement.style.display = visible ? "" : "none";
  };
  show("filter-status",   ["complaints","tickets","tasks"].includes(reportType));
  show("filter-issue",    ["complaints","tickets"].includes(reportType));
  show("filter-source",   ["complaints","tickets"].includes(reportType));
  show("filter-priority", reportType === "tickets");
}

function buildCsvRows() {
  const fTickets = getFilteredTickets();
  const fTasks   = getFilteredTasks();
  const fComps   = getFilteredComplaints();
  const fMlogs   = getFilteredMaintenance();

  if (reportType === "complaints") {
    return [["Ус түгээх байр","Баг","Төрөл","Эх сурвалж","Төлөв","Огноо","Иргэн","Утас","Тайлбар"],
      ...fComps.map((c) => {
        const s = state.waterStations.find((x) => x.id === c.stationId);
        return [toExcelText(s?.code ?? "Тодорхойгүй"), s ? `${s.bagNo}-р баг` : "-",
          c.issueType, sourceLabels[c.source] ?? c.source, complaintStatusLabels[c.status] ?? c.status,
          toExcelText(formatCsvDate(c.createdAt, true)), c.citizenName, c.phoneNumber, c.description];
      })];
  }
  if (reportType === "tasks") {
    return [["Ус түгээх байр","Баг","Алба","Бригад","Төлөв","Огноо","Дууссан","Тайлбар"],
      ...fTasks.map((t) => {
        const s = state.waterStations.find((x) => x.id === t.stationId);
        return [toExcelText(s?.code ?? "Тодорхойгүй"), s ? `${s.bagNo}-р баг` : "-",
          getDeptName(t.departmentId, state.departments), getTeamName(t.teamId, state.teams, state.users),
          statusLabels[t.status] ?? t.status, toExcelText(formatCsvDate(t.taskDate)),
          t.finishedAt ? toExcelText(formatCsvDate(t.finishedAt, true)) : "-", t.description];
      })];
  }
  if (reportType === "maintenance") {
    return [["Ус түгээх байр","Алба","Бригад","Материал","Огноо","Тайлбар"],
      ...fMlogs.map((m) => {
        const tkt = m.ticketId ? state.tickets.find((t) => t.id === m.ticketId) : null;
        const tsk = m.taskId   ? state.tasks.find((t)   => t.id === m.taskId)   : null;
        const s = state.waterStations.find((x) => x.id === (tkt?.stationId ?? tsk?.stationId));
        const deptId = tkt?.departmentId ?? tsk?.departmentId;
        return [toExcelText(s?.code ?? "Тодорхойгүй"),
          getDeptName(deptId, state.departments), getTeamName(m.teamId, state.teams, state.users),
          m.materialsUsed || "-", toExcelText(formatCsvDate(m.createdAt, true)), m.description];
      })];
  }
  if (reportType === "performance") {
    return [["Үзүүлэлт","Утга"],
      ["Засварын дундаж", formatDuration(avgHoursAll(fTickets.filter((t)=>t.status==="done").map((t)=>avgHours(t.startedAt??t.createdAt,t.finishedAt))))],
      ["Ажлын дундаж", formatDuration(avgHoursAll(fTasks.filter((t)=>t.status==="done").map((t)=>avgHours(t.startedAt??t.createdAt,t.finishedAt))))],
      ["Нийт дууссан", String(fTickets.filter((t)=>t.status==="done").length + fTasks.filter((t)=>t.status==="done").length)],
    ];
  }
  // tickets
  return [["Дугаар","Ус түгээх байр","Баг","Алба","Бригад","Төлөв","Яаралт","Эх сурвалж","Огноо","Дууссан","Тайлбар"],
    ...fTickets.map((t) => {
      const s = state.waterStations.find((x) => x.id === t.stationId);
      return [t.ticketNo, toExcelText(s?.code ?? "Тодорхойгүй"), s ? `${s.bagNo}-р баг` : "-",
        getDeptName(t.departmentId, state.departments), getTeamName(t.teamId, state.teams, state.users),
        statusLabels[t.status] ?? t.status, priorityLabels[t.priority] ?? t.priority,
        sourceLabels[t.source] ?? t.source, toExcelText(formatCsvDate(t.createdAt, true)),
        t.finishedAt ? toExcelText(formatCsvDate(t.finishedAt, true)) : "-",
        `${t.issueType} / ${t.description}`];
    })];
}
