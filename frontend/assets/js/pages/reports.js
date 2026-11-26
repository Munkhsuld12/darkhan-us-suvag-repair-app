import * as api from "../api.js";
import { requireAuth, getUser } from "../auth.js";
import { setupSidebar } from "../sidebar.js";
import { reportTypeLabels, sourceLabels, complaintStatusLabels, priorityLabels, statusLabels, issueTypeOptions } from "../seed.js";
import {
  formatDateTime, formatDate, statusBadge, getStationLabel, getStationOptionLabel,
  getDeptName, getTeamName, isTaskDelayed, avgHours, formatDuration,
  buildCountRows, getMaterialRows, downloadCsv, toExcelText, formatCsvDate,
  escapeHtml, el,
} from "../utils.js";

let state = { tickets: [], tasks: [], complaints: [], maintenanceLogs: [], departments: [], teams: [], users: [], waterStations: [] };
let user = null;

// Role flags (set after auth in setupFilters)
let isBrigadeUser    = false;
let isEngineerUser   = false;
let isDispatcherUser = false;

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
let materialFilter   = "all";
let datePreset       = "month";

const today = new Date().toISOString().slice(0, 10);
const defaultFrom = `${today.slice(0, 7)}-01`;
const allReportTypes = Object.entries(reportTypeLabels).filter(([key]) => key !== "tasks");
// visibleReportTypes is computed after user is known (see setupFilters)
let visibleReportTypes = allReportTypes;

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
  isBrigadeUser    = user?.role === "brigade_leader";
  isDispatcherUser = user?.role === "dispatcher";
  isEngineerUser   = user?.role === "general_engineer" || user?.role === "department_engineer";
  const isBrigade    = isBrigadeUser;
  const isDispatcher = isDispatcherUser;
  const isEngineer   = isEngineerUser;

  visibleReportTypes = allReportTypes.filter(([k]) => {
    if (isBrigade    && (k === "complaints" || k === "tickets"))      return false;
    if (isDispatcher && (k === "maintenance" || k === "performance")) return false;
    if (isEngineer   && k === "complaints")                           return false;
    return true;
  });
  if (isBrigade    && (reportType === "complaints" || reportType === "tickets"))       reportType = "maintenance";
  if (isDispatcher && (reportType === "maintenance" || reportType === "performance"))  reportType = "complaints";
  if (isEngineer   && reportType === "complaints")                                     reportType = "tickets";

  // Brigade label under the filter card header
  if (isBrigade) {
    const hdr = document.querySelector(".section-stack h2");
    const existing = document.getElementById("brigade-label");
    if (hdr && !existing) {
      const badge = document.createElement("span");
      badge.id = "brigade-label";
      badge.style.cssText = "font-size:12px;font-weight:600;color:#0ea5e9;margin-left:10px;vertical-align:middle";
      badge.textContent = "Зөвхөн таны бригадын өгөгдөл";
      hdr.after(badge);
    }
  }

  // Report type tabs (target the inner tab-list div)
  const tabsEl = el("report-tab-list") || el("report-tabs");
  tabsEl.innerHTML = visibleReportTypes.map(([k, v]) =>
    `<button class="tab-btn${k === reportType ? " active" : ""}" data-type="${k}">${v}</button>`
  ).join("");
  tabsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-type]");
    if (!btn) return;
    reportType = btn.dataset.type;
    resetTypeSpecificFilters();
    tabsEl.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
    renderAll();
  });

  // Date inputs
  el("filter-from").value = dateFrom;
  el("filter-to").value   = dateTo;
  el("filter-from").addEventListener("change", (e) => {
    dateFrom = e.target.value;
    datePreset = "custom";
    updateDatePresetButtons();
    applyFilters();
  });
  el("filter-to").addEventListener("change",   (e) => {
    dateTo = e.target.value;
    datePreset = "custom";
    updateDatePresetButtons();
    applyFilters();
  });
  setupDatePresets();

  // Reset btn
  el("filter-reset")?.addEventListener("click", () => {
    dateFrom = defaultFrom; dateTo = today;
    datePreset = "month";
    stationFilter = bagFilter = deptFilter = teamFilter =
    statusFilter = issueTypeFilter = sourceFilter = priorityFilter = materialFilter = "all";
    el("filter-from").value = dateFrom; el("filter-to").value = dateTo;
    updateSelectValue("filter-bag", "all");
    updateSelectValue("filter-station", "all");
    updateSelectValue("filter-status", "all");
    updateSelectValue("filter-issue", "all");
    updateSelectValue("filter-source", "all");
    updateSelectValue("filter-priority", "all");
    updateSelectValue("filter-material", "all");
    populateStationSelect();
    updateDatePresetButtons();
    applyFilters();
  });

  // Bag / Station / Dept / Team / Status / Issue / Source / Priority
  const bags = [...new Set(state.waterStations.map((s) => s.bagNo))].sort((a,b)=>a-b);
  const bagSel = el("filter-bag");
  bagSel.innerHTML = `<option value="all">Бүх баг</option>` +
    bags.map((b) => `<option value="${b}">${b}-р баг</option>`).join("");
  bagSel.addEventListener("change", (e) => {
    bagFilter = e.target.value;
    const selectedStation = state.waterStations.find((s) => s.id === stationFilter);
    if (selectedStation && bagFilter !== "all" && String(selectedStation.bagNo) !== bagFilter) {
      stationFilter = "all";
    }
    populateStationSelect();
    renderAll();
  });

  populateStationSelect();
  el("filter-station").addEventListener("change", (e) => {
    stationFilter = e.target.value;
    const selectedStation = state.waterStations.find((s) => s.id === stationFilter);
    if (selectedStation) {
      bagFilter = String(selectedStation.bagNo);
      updateSelectValue("filter-bag", bagFilter);
      populateStationSelect();
    }
    renderAll();
  });

  if (user.role === "brigade_leader" && user.teamId) {
    teamFilter = user.teamId;
  }
  if (["brigade_leader","department_engineer"].includes(user.role) && user.departmentId) {
    deptFilter = user.departmentId;
  }

  // Issue types
  const issueSel = el("filter-issue");
  issueSel.innerHTML = `<option value="all">Бүх төрөл</option>` +
    issueTypeOptions.map((i) => `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`).join("");
  issueSel.addEventListener("change", (e) => { issueTypeFilter = e.target.value; renderAll(); });

  el("filter-source")?.addEventListener("change",   (e) => { sourceFilter   = e.target.value; renderAll(); });
  el("filter-status")?.addEventListener("change",   (e) => { statusFilter   = e.target.value; renderAll(); });
  el("filter-priority")?.addEventListener("change", (e) => { priorityFilter = e.target.value; renderAll(); });
  populateMaterialSelect();
  el("filter-material")?.addEventListener("change", (e) => { materialFilter = e.target.value; renderAll(); });

  // CSV / Print / Excel / PDF
  el("btn-csv")?.addEventListener("click", () => {
    const rows = buildCsvRows();
    downloadCsv(`${reportTypeLabels[reportType]}-${dateFrom}-${dateTo}.csv`, rows);
  });
  el("btn-print")?.addEventListener("click", () => {
    const typeEl  = el("print-report-type");
    const rangeEl = el("print-date-range");
    const metaEl  = el("print-meta");
    if (typeEl)  typeEl.textContent  = reportTypeLabels[reportType] ?? "Тайлан";
    if (rangeEl) rangeEl.textContent = `Хугацаа: ${dateFrom} — ${dateTo}  ·  Нийт: ${el("main-count")?.textContent ?? ""}`;
    if (metaEl)  metaEl.textContent  = `Хэвлэсэн: ${new Date().toLocaleString("mn-MN")}  ·  ${user?.fullName ?? ""}`;

    // Wait for logo to load before printing
    const logo = document.getElementById("print-logo");
    const doPrint = () => window.print();
    if (!logo || logo.complete || logo.dataset.loaded) {
      doPrint();
    } else {
      logo.addEventListener("load",  doPrint, { once: true });
      logo.addEventListener("error", doPrint, { once: true });
    }
  });
  el("btn-excel")?.addEventListener("click", exportExcel);
  el("btn-pdf")?.addEventListener("click",   exportPDF);
}

function setupDatePresets() {
  el("date-presets")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-range]");
    if (!btn) return;
    setDatePreset(btn.dataset.range);
    applyFilters();
  });
  updateDatePresetButtons();
}

function setDatePreset(range) {
  datePreset = range;
  const to = new Date(today);
  const from = new Date(today);

  if (range === "today") {
    dateFrom = today;
    dateTo = today;
  } else if (range === "7" || range === "30") {
    from.setDate(to.getDate() - (Number(range) - 1));
    dateFrom = toDateInputValue(from);
    dateTo = today;
  } else if (range === "all") {
    dateFrom = "";
    dateTo = "";
  } else {
    datePreset = "month";
    dateFrom = defaultFrom;
    dateTo = today;
  }

  el("filter-from").value = dateFrom;
  el("filter-to").value = dateTo;
  updateDatePresetButtons();
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function updateDatePresetButtons() {
  el("date-presets")?.querySelectorAll("[data-range]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.range === datePreset);
  });
}

function populateStationSelect() {
  const statSel = el("filter-station");
  const stationsSorted = [...state.waterStations]
    .filter((s) => bagFilter === "all" || String(s.bagNo) === bagFilter)
    .sort((a,b) => a.bagNo - b.bagNo || a.code.localeCompare(b.code));
  statSel.innerHTML = `<option value="all">Бүх байр</option>` +
    stationsSorted.map((s) => `<option value="${s.id}">${escapeHtml(getStationOptionLabel(s))}</option>`).join("");
  statSel.value = stationsSorted.some((s) => s.id === stationFilter) ? stationFilter : "all";
}

function resetTypeSpecificFilters() {
  statusFilter = issueTypeFilter = sourceFilter = priorityFilter = materialFilter = "all";
  updateSelectValue("filter-status", "all");
  updateSelectValue("filter-issue", "all");
  updateSelectValue("filter-source", "all");
  updateSelectValue("filter-priority", "all");
  updateSelectValue("filter-material", "all");
}

function updateSelectValue(id, val) {
  const s = el(id);
  if (s) s.value = val;
}

function selectLabel(id) {
  const s = el(id);
  return s?.selectedOptions?.[0]?.textContent?.trim() || "";
}

function materialTokens(text) {
  return String(text || "")
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter((x) => x && x !== "Материал тэмдэглээгүй" && x !== "Материал ашиглагдаагүй");
}

function populateMaterialSelect() {
  const sel = el("filter-material");
  if (!sel) return;
  const materials = [...new Set(state.maintenanceLogs.flatMap((m) => materialTokens(m.materialsUsed)))]
    .sort((a, b) => a.localeCompare(b, "mn"));
  sel.innerHTML = `<option value="all">Бүх материал</option>` +
    materials.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");
  sel.value = materials.includes(materialFilter) ? materialFilter : "all";
}

function normalizeTicketStatus(ticket) {
  return ticket.status === "urgent" ? "assigned" : ticket.status;
}

function isTicketUrgent(ticket) {
  return ticket.priority === "urgent" || ticket.status === "urgent";
}

function ticketStatusCell(ticket) {
  const urgentBadge = isTicketUrgent(ticket)
    ? `<span class="badge badge-urgent" style="margin-left:4px">Яаралтай</span>`
    : "";
  return `${statusBadge(normalizeTicketStatus(ticket))}${urgentBadge}`;
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
    if (statusFilter !== "all" && normalizeTicketStatus(t) !== statusFilter) return false;
    if (issueTypeFilter !== "all" && t.issueType !== issueTypeFilter) return false;
    if (sourceFilter !== "all" && t.source !== sourceFilter) return false;
    if (priorityFilter !== "all") {
      const urgent = isTicketUrgent(t);
      if (priorityFilter === "urgent" && !urgent) return false;
      if (priorityFilter === "normal" && urgent) return false;
    }
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
    const tkt = m.ticketId ? state.tickets.find((t) => t.id === m.ticketId) : null;
    const tsk = m.taskId   ? state.tasks.find((t)   => t.id === m.taskId)   : null;
    const sid = tkt?.stationId ?? tsk?.stationId;
    const station = state.waterStations.find((s) => s.id === sid);
    const deptId = tkt?.departmentId ?? tsk?.departmentId;
    if (stationFilter !== "all" && sid !== stationFilter) return false;
    if (bagFilter !== "all" && (!station || String(station.bagNo) !== bagFilter)) return false;
    if (deptFilter !== "all" && deptId !== deptFilter) return false;
    if (materialFilter !== "all" && !materialTokens(m.materialsUsed).includes(materialFilter)) return false;
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
  renderFilterSummary();
}

function renderSummaryCards(fTickets, fTasks, fComps, fMlogs) {
  const completedTickets = fTickets.filter((t) => t.status === "done");
  const openTickets      = fTickets.filter((t) => t.status !== "done");
  const completedTasks   = fTasks.filter((t) => t.status === "done");
  const activeTasks      = fTasks.filter((t) => t.status !== "done");
  const delayedTasks     = fTasks.filter(isTaskDelayed);
  const issueRows        = buildCountRows([...fComps, ...fTickets], (i) => i.issueType);
  const complaintStations = complaintOrTicketStationRows(fComps, fTickets);
  const topIssue         = topCount(issueRows);
  const topStation       = topCount(complaintStations);

  const ticketHours = avgHoursAll(completedTickets.map((t) => avgHours(t.startedAt ?? t.createdAt, t.finishedAt)));
  const taskHours   = avgHoursAll(completedTasks.map((t) => avgHours(t.startedAt ?? t.createdAt, t.finishedAt)));
  const perfAvg     = avgHoursAll([ticketHours, taskHours].filter((x) => x !== null));

  const cards =
    reportType === "complaints" ? [
      { title: "Гомдол", value: fComps.length, note: `${dateFrom} — ${dateTo}`, tone: "brand" },
      { title: "Вэб",    value: fComps.filter((c) => c.source === "web").length,   tone: "blue" },
      { title: "Утас",   value: fComps.filter((c) => c.source === "phone").length, tone: "green" },
      { title: "Хүсэлт болгосон", value: fComps.filter((c) => c.status === "converted").length, tone: "amber" },
    ] : reportType === "maintenance" ? [
      { title: "Засварын бүртгэл", value: fMlogs.length, note: `${dateFrom} — ${dateTo}`, tone: "brand" },
      { title: "Байр",    value: new Set(fMlogs.map((m) => { const t = state.tickets.find((x) => x.id === m.ticketId); const k = state.tasks.find((x) => x.id === m.taskId); return t?.stationId ?? k?.stationId; }).filter(Boolean)).size, tone: "blue" },
      { title: "Бригад",  value: new Set(fMlogs.map((m) => m.teamId)).size, tone: "green" },
      { title: "Материал",value: getMaterialRows(fMlogs).reduce((s, r) => s + r.value, 0), tone: "amber" },
    ] : reportType === "performance" ? [
      { title: "Нийт гомдол", value: fComps.length, note: `${dateFrom} — ${dateTo}`, tone: "brand" },
      { title: "Их гарсан гэмтэл", value: topIssue?.value ?? 0, note: topIssue?.label ?? "Мэдээлэл алга", tone: "amber" },
      { title: "Гомдол хамгийн ихтэй ус түгээх байр", value: topStation?.value ?? 0, note: topStation?.label ?? "Мэдээлэл алга", tone: "blue" },
      { title: "Яаралтай хүсэлт", value: fTickets.filter(isTicketUrgent).length, tone: "green" },
    ] : [
      { title: "Хүсэлт",   value: fTickets.length,      note: `${dateFrom} — ${dateTo}`, tone: "brand" },
      { title: "Засварын явцад", value: openTickets.length,     tone: "blue" },
      { title: "Дууссан",  value: completedTickets.length, tone: "green" },
      { title: "Яаралтай", value: fTickets.filter(isTicketUrgent).length, tone: "amber" },
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

function topCount(rows) {
  return rows[0] ?? null;
}

function stationCode(stationId) {
  return state.waterStations.find((s) => s.id === stationId)?.code ?? "Тодорхойгүй";
}

function fmtMs(ms) {
  if (!ms || ms <= 0) return "—";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} цаг` : `${h} цаг ${m} мин`;
}

function elapsedStr(startedAt) {
  if (!startedAt) return "";
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 0) return "";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h} цаг ${m} мин`;
  return `${m} мин`;
}

function workerParticipationRows(mlogs) {
  const map = {};
  mlogs.forEach((log) => {
    const line = (log.description || "").split("\n").find((l) => l.startsWith("Оролцсон ажилтнууд:"));
    if (!line) return;
    line.replace("Оролцсон ажилтнууд:", "").split(",")
      .map((n) => n.trim()).filter(Boolean)
      .forEach((name) => { map[name] = (map[name] ?? 0) + 1; });
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
}

function brigadeBreakdowns(fTickets, fTasks, fMlogs) {
  const done = [...fTickets, ...fTasks].filter((t) => t.startedAt && t.finishedAt);
  const durations = done.map((t) => new Date(t.finishedAt) - new Date(t.startedAt)).filter((d) => d > 0);
  const avgMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  const durationRows = done
    .slice(0, 15)
    .map((t) => ({
      label: stationCode(t.stationId),
      value: fmtMs(new Date(t.finishedAt) - new Date(t.startedAt)),
    }));

  return [
    {
      title: `Дундаж хугацаа — ${fmtMs(avgMs)}`,
      rows: durationRows.length ? durationRows : [],
      note: "Дуусгасан ажил тус бүрийн хугацаа",
    },
    {
      title: "Ажилтны оролцоо",
      rows: workerParticipationRows(fMlogs),
      note: "Гүйцэтгэлийн тайланд бичигдсэн",
    },
  ];
}

function complaintOrTicketStationRows(complaints, tickets) {
  const complaintRows = buildCountRows(complaints, (c) => stationCode(c.stationId));
  return complaintRows.length ? complaintRows : buildCountRows(tickets, (t) => stationCode(t.stationId));
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
    if (user?.role === "brigade_leader") {
      cards = [
        { title: "Төлөвөөр",  rows: buildCountRows(fTickets, (t) => statusLabels[normalizeTicketStatus(t)]) },
        { title: "Яаралтаар", rows: buildCountRows(fTickets, (t) => priorityLabels[isTicketUrgent(t) ? "urgent" : "normal"]) },
        ...brigadeBreakdowns(fTickets, fTasks, fMlogs),
      ];
    } else {
      cards = [
        { title: "Төлөвөөр",  rows: buildCountRows(fTickets, (t) => statusLabels[normalizeTicketStatus(t)]) },
        { title: "Яаралтаар", rows: buildCountRows(fTickets, (t) => priorityLabels[isTicketUrgent(t) ? "urgent" : "normal"]) },
        { title: "Албаар",    rows: buildCountRows(fTickets, (t) => getDeptName(t.departmentId, state.departments)) },
        { title: "Бригадаар", rows: buildCountRows(fTickets, (t) => getTeamName(t.teamId, state.teams, state.users)) },
      ];
    }
  } else if (reportType === "maintenance") {
    cards = []; // breakdowns not needed — main table has full detail
  } else { // performance — breakdowns moved into main table
    cards = [];
  }

  el("breakdown-cards").innerHTML = cards.map((c) => `
    <div class="breakdown-card">
      <h3>${escapeHtml(c.title)}</h3>
      ${c.note ? `<p style="font-size:11px;color:var(--slate-400);margin:-4px 0 6px">${escapeHtml(c.note)}</p>` : ""}
      ${!c.rows.length ? `<div class="empty-state" style="padding:16px 0">Мэдээлэл алга</div>` :
        c.rows.map((r) => `
          <div class="breakdown-row">
            <span>${escapeHtml(String(r.label))}</span>
            <span class="count">${escapeHtml(String(r.value))}</span>
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
    const issueRows   = buildCountRows([...fComps, ...fTickets], (i) => i.issueType);
    const stationRows = complaintOrTicketStationRows(fComps, fTickets);
    const bagRows     = buildCountRows([...fComps, ...fTickets], (i) => {
      const s = state.waterStations.find((x) => x.id === i.stationId);
      return s ? `${s.bagNo}-р баг` : null;
    });

    const miniTable = (title, rows) => {
      const body = rows.length
        ? rows.map((r) => `<tr>
            <td style="padding:6px 10px;border-bottom:1px solid var(--slate-100)">${escapeHtml(String(r.label))}</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--slate-100);text-align:right;font-weight:700;color:var(--blue-700)">${r.value}</td>
          </tr>`).join("")
        : `<tr><td colspan="2" style="padding:16px;text-align:center;color:var(--slate-400)">Мэдээлэл алга</td></tr>`;
      return `
        <div style="margin-bottom:20px">
          <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--slate-500);margin:0 0 6px">${escapeHtml(title)}</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr>
              <th style="padding:6px 10px;background:var(--slate-50);text-align:left;font-weight:600;color:var(--slate-600);border-bottom:1px solid var(--slate-200)">Нэр</th>
              <th style="padding:6px 10px;background:var(--slate-50);text-align:right;font-weight:600;color:var(--slate-600);border-bottom:1px solid var(--slate-200)">Тоо</th>
            </tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>`;
    };

    count = issueRows.length + stationRows.length + bagRows.length;
    html = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px">
      ${miniTable("Гэмтлийн төрлөөр", issueRows)}
      ${miniTable("Гомдол, хүсэлт хамгийн ихтэй ус түгээх байр", stationRows)}
      ${miniTable("Багаар", bagRows)}
    </div>`;
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
    html = `<table><thead><tr><th>Дугаар</th><th>Ус түгээх байр</th><th>Төлөв</th><th>Огноо</th></tr></thead><tbody>` +
      fTickets.map((t) => {
        const s = state.waterStations.find((x) => x.id === t.stationId);
        return `<tr>
          <td><p style="font-weight:600">${escapeHtml(t.ticketNo)}</p><p style="font-size:12px;color:var(--slate-500)">${escapeHtml(t.issueType)}</p></td>
          <td><p style="font-weight:600">${escapeHtml(s?.code ?? "Тодорхойгүй")}</p><p style="font-size:12px;color:var(--slate-500)">${escapeHtml(s ? `${s.bagNo}-р баг` : "-")}</p></td>
          <td>${ticketStatusCell(t)}</td>
          <td style="color:var(--slate-600)">${escapeHtml(formatDateTime(t.createdAt))}${t.finishedAt ? `<p style="font-size:12px">Дууссан: ${escapeHtml(formatDateTime(t.finishedAt))}</p>` : "<p style='font-size:12px'>Засварын явцад</p>"}</td>
        </tr>`;
      }).join("") + `</tbody></table>`;
  }

  if (countEl) countEl.textContent = reportType === "performance" ? "" : count;
  const titleEl = el("main-table-title");
  if (titleEl) titleEl.textContent = reportTypeLabels[reportType] ?? "Дэлгэрэнгүй";
  wrap.innerHTML = reportType === "performance"
    ? html
    : count === 0
      ? `<div class="empty-state" style="padding:40px">Тайлан хоосон</div>`
      : `<div class="table-shell" style="overflow-x:auto">${html}</div>`;
}

function renderFilterSummary() {
  const wrap = el("filter-summary");
  if (!wrap) return;

  const chips = [];
  const dateLabel = dateFrom || dateTo
    ? `Огноо: ${dateFrom || "эхлэлгүй"} — ${dateTo || "өнөөдрийг хүртэл"}`
    : "Огноо: бүх хугацаа";
  chips.push(dateLabel);

  if (bagFilter !== "all") chips.push(`Баг: ${selectLabel("filter-bag")}`);
  if (stationFilter !== "all") chips.push(`Байр: ${selectLabel("filter-station")}`);
  if (statusFilter !== "all" && ["complaints", "tickets"].includes(reportType)) chips.push(`Төлөв: ${selectLabel("filter-status")}`);
  if (issueTypeFilter !== "all" && ["complaints", "tickets", "performance"].includes(reportType)) chips.push(`Гэмтэл: ${selectLabel("filter-issue")}`);
  if (sourceFilter !== "all" && ["complaints", "tickets"].includes(reportType)) chips.push(`Суваг: ${selectLabel("filter-source")}`);
  if (priorityFilter !== "all" && reportType === "tickets") chips.push(`Яаралтай: ${selectLabel("filter-priority")}`);
  if (materialFilter !== "all" && reportType === "maintenance") chips.push(`Материал: ${selectLabel("filter-material")}`);

  wrap.innerHTML = chips.map((chip) =>
    `<span class="badge badge-normal">${escapeHtml(chip)}</span>`
  ).join("");
}

function updateFilterVisibility() {
  const show = (id, visible) => {
    const el2 = el(id);
    if (el2) el2.parentElement.style.display = visible ? "" : "none";
  };
  show("filter-bag",      !isBrigadeUser);
  show("filter-status",   ["complaints","tickets"].includes(reportType));
  show("filter-issue",    ["complaints","tickets","performance"].includes(reportType));
  // Ирсэн суваг: dispatcher only
  show("filter-source",   isDispatcherUser && ["complaints","tickets"].includes(reportType));
  show("filter-priority", reportType === "tickets" && !isBrigadeUser);
  show("filter-material", reportType === "maintenance");
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
        return [s?.code ?? "Тодорхойгүй", s ? `${s.bagNo}-р баг` : "-",
          c.issueType, sourceLabels[c.source] ?? c.source, complaintStatusLabels[c.status] ?? c.status,
          formatCsvDate(c.createdAt, true), c.citizenName, c.phoneNumber, c.description];
      })];
  }
  if (reportType === "maintenance") {
    return [["Ус түгээх байр","Алба","Бригад","Материал","Огноо","Тайлбар"],
      ...fMlogs.map((m) => {
        const tkt = m.ticketId ? state.tickets.find((t) => t.id === m.ticketId) : null;
        const tsk = m.taskId   ? state.tasks.find((t)   => t.id === m.taskId)   : null;
        const s = state.waterStations.find((x) => x.id === (tkt?.stationId ?? tsk?.stationId));
        const deptId = tkt?.departmentId ?? tsk?.departmentId;
        return [s?.code ?? "Тодорхойгүй",
          getDeptName(deptId, state.departments), getTeamName(m.teamId, state.teams, state.users),
          m.materialsUsed || "-", formatCsvDate(m.createdAt, true), m.description];
      })];
  }
  if (reportType === "performance") {
    const issueRows = buildCountRows([...fComps, ...fTickets], (i) => i.issueType).slice(0, 10);
    const stationRows = complaintOrTicketStationRows(fComps, fTickets).slice(0, 10);
    const rows = [["Хамгийн их бүртгэгдсэн гэмтэл","Тоо","Гомдол, хүсэлт хамгийн ихтэй ус түгээх байр","Тоо"]];
    Array.from({ length: Math.max(issueRows.length, stationRows.length) }).forEach((_, i) => {
      rows.push([
        issueRows[i]?.label ?? "",
        String(issueRows[i]?.value ?? ""),
        stationRows[i]?.label ?? "",
        String(stationRows[i]?.value ?? ""),
      ]);
    });
    return rows;
  }
  // tickets
  return [["Дугаар","Ус түгээх байр","Баг","Алба","Бригад","Төлөв","Яаралт","Эх сурвалж","Огноо","Дууссан","Тайлбар"],
    ...fTickets.map((t) => {
      const s = state.waterStations.find((x) => x.id === t.stationId);
      return [t.ticketNo, s?.code ?? "Тодорхойгүй", s ? `${s.bagNo}-р баг` : "-",
        getDeptName(t.departmentId, state.departments), getTeamName(t.teamId, state.teams, state.users),
        statusLabels[normalizeTicketStatus(t)] ?? normalizeTicketStatus(t),
        priorityLabels[isTicketUrgent(t) ? "urgent" : "normal"],
        sourceLabels[t.source] ?? t.source, formatCsvDate(t.createdAt, true),
        t.finishedAt ? formatCsvDate(t.finishedAt, true) : "-",
        `${t.issueType} / ${t.description}`];
    })];
}

// Strip ="..." CSV wrapper → plain text for display
function cleanRows(rows) {
  return rows.map((row) => row.map((cell) => {
    const s = String(cell ?? "");
    return s.startsWith('="') && s.endsWith('"') ? s.slice(2, -1) : s;
  }));
}

function exportExcel() {
  const rows = cleanRows(buildCsvRows());
  if (rows.length <= 1) { alert("Тайлан хоосон байна"); return; }

  const [headers, ...body] = rows;
  const typeName = (reportTypeLabels[reportType] ?? "Тайлан").replace(/[<>&"]/g, "");

  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const headerCells = headers.map((h) =>
    `<Cell ss:StyleID="h"><Data ss:Type="String">${esc(h)}</Data></Cell>`
  ).join("");

  const dataRows = body.map((row) =>
    `<Row>${row.map((cell) =>
      `<Cell><Data ss:Type="String">${esc(cell)}</Data></Cell>`
    ).join("")}</Row>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>
    <Style ss:ID="h">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#DBEEFF" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${typeName}">
    <Table>
      <Row>${headerCells}</Row>
${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `тайлан-${reportType}-${today}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF() {
  const rows = cleanRows(buildCsvRows());
  if (rows.length <= 1) { alert("Тайлан хоосон байна"); return; }

  const [headers, ...body] = rows;
  const typeName = reportTypeLabels[reportType] ?? "Тайлан";
  const isWide   = headers.length > 5;

  const thStyle = "background:#dbeeff;padding:6px 8px;border:1px solid #91c6ff;font-size:10px;font-weight:700;text-align:left;white-space:nowrap";
  const tdStyle = (i) => `padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;background:${i%2===1?"#f8fafc":"#fff"};word-break:break-word`;

  const logoUrl   = `${window.location.origin}/DUS-only-logo.png`;
  const printedAt = new Date().toLocaleString("mn-MN");
  const userName  = user?.fullName ?? "";

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      @page { size: A4 ${isWide ? "landscape" : "portrait"}; margin:14mm 12mm; }
      body { font-family:'Segoe UI',Arial,sans-serif; margin:0; color:#0f213d; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      table { width:100%; border-collapse:collapse; }
      .header { display:flex; align-items:center; gap:12px; border-bottom:2px solid #2d83f3; padding-bottom:10px; margin-bottom:14px; }
      .header img { height:44px; width:auto; flex-shrink:0; }
      .header h2 { margin:0 0 3px; font-size:14px; font-weight:800; }
      .header p  { margin:0; font-size:10px; color:#64748b; }
      .footer { margin-top:32px; padding-top:14px; border-top:1px solid #cbd5e1; page-break-inside:avoid; }
      .footer-row { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; }
      .footer-col { flex:1; }
      .footer-col .lbl { font-size:10px; color:#64748b; margin-bottom:22px; }
      .footer-col .line { border-bottom:1px solid #1e293b; margin-bottom:4px; height:24px; }
      .footer-col .name { font-size:10px; color:#64748b; }
      .stamp { width:80px; height:80px; border:1.5px dashed #94a3b8; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:9px; color:#94a3b8; text-align:center; flex-shrink:0; }
    </style>
    </head><body>
    <div class="header">
      <img src="${logoUrl}" alt="лого">
      <div>
        <h2>Дархан-Ус Суваг ХК — ${typeName}</h2>
        <p>Хугацаа: ${dateFrom} — ${dateTo} &nbsp;·&nbsp; Нийт: ${body.length}</p>
        <p>Хэвлэсэн: ${printedAt}${userName ? " · " + userName : ""}</p>
      </div>
    </div>
    <table>
      <thead><tr>${headers.map((h) => `<th style="${thStyle}">${h}</th>`).join("")}</tr></thead>
      <tbody>${body.map((row, i) =>
        `<tr>${row.map((cell) => `<td style="${tdStyle(i)}">${cell}</td>`).join("")}</tr>`
      ).join("")}</tbody>
    </table>
    <div class="footer">
      <div class="footer-row">
        <div class="footer-col"><p class="lbl">Тайлан гаргасан:</p><div class="line"></div><p class="name">Овог нэр / Гарын үсэг</p></div>
        <div class="footer-col"><p class="lbl">Хянасан:</p><div class="line"></div><p class="name">Овог нэр / Гарын үсэг</p></div>
        <div class="footer-col"><p class="lbl">Батлав:</p><div class="line"></div><p class="name">Овог нэр / Гарын үсэг</p></div>
        <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
          <p style="font-size:10px;color:#64748b;margin:0 0 4px;text-align:center">Тамга</p>
          <div class="stamp">Байгууллагын<br>тамга</div>
        </div>
      </div>
    </div>
  </body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:210mm;height:297mm;border:0;visibility:hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 400);
}
