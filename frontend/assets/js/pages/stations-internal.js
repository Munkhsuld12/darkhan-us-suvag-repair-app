import { requireAuth, getUser } from "../auth.js";
import { getStations, getTickets, getTasks, getAdminMeta, getStationDetail } from "../api.js";
import { setupSidebar } from "../sidebar.js";
import {
  el, emptyState, spinner, escapeHtml, statusBadge, formatDateTime, matchesStationSearch, getStatusMeta, getDeptName, getTeamName
} from "../utils.js";

requireAuth();

let allStations = [];
let allTickets  = [];
let allTasks    = [];
let departments = [];
let teams       = [];
let users       = [];

let selectedBagNo  = null;
let searchQuery    = "";
let statusFilter   = "all";
let deptFilter     = "all";
let viewFilter     = "all"; // all | active | free

// ── helpers ──────────────────────────────────────────────────

const getStationActivity = (stationId) => {
  const latestTicket = allTickets
    .filter(t => t.stationId === stationId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];

  const latestTask = allTasks
    .filter(t => t.stationId === stationId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];

  const useTicket = !latestTask || (latestTicket && +new Date(latestTicket.createdAt) >= +new Date(latestTask.createdAt));
  const source = useTicket ? latestTicket : latestTask;

  const status     = source?.status ?? "new";
  const deptId     = (useTicket ? latestTicket?.departmentId : latestTask?.departmentId) ?? latestTicket?.departmentId ?? latestTask?.departmentId;
  const teamId     = (useTicket ? latestTicket?.teamId : latestTask?.teamId) ?? latestTicket?.teamId ?? latestTask?.teamId;
  const hasActive  = Boolean(
    (latestTicket && latestTicket.status !== "done") ||
    (latestTask   && latestTask.status !== "done")
  );

  return { status, deptId, teamId, hasActive };
};

const bagFolders = () => {
  const nums = [...new Set(allStations.map(s => s.bagNo))].sort((a, b) => a - b);
  return nums.map(bagNo => {
    const stations = allStations.filter(s => s.bagNo === bagNo);
    const activeCount = stations.filter(s => getStationActivity(s.id).hasActive).length;
    return { bagNo, stationCount: stations.length, activeCount };
  });
};

const visibleRows = () => {
  if (!selectedBagNo) return [];
  return allStations
    .filter(s => s.bagNo === selectedBagNo)
    .map(s => ({ station: s, ...getStationActivity(s.id) }))
    .filter(({ station, status, deptId, hasActive }) => {
      if (!matchesStationSearch(station, searchQuery)) return false;
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (deptFilter !== "all" && deptId !== deptFilter) return false;
      if (viewFilter === "active" && !hasActive) return false;
      if (viewFilter === "free"   &&  hasActive) return false;
      return true;
    })
    .sort((a, b) => {
      const parseCode = code => {
        const [bag = "0", num = "0"] = code.split("-");
        return { bag: Number(bag), num: Number(num) };
      };
      const ca = parseCode(a.station.code), cb = parseCode(b.station.code);
      return ca.bag !== cb.bag ? ca.bag - cb.bag : ca.num - cb.num;
    });
};

// ── render ────────────────────────────────────────────────────

function renderBagGrid() {
  const folders = bagFolders();
  const grid = el("bag-grid");
  if (!grid) return;

  grid.innerHTML = folders.map(({ bagNo, stationCount, activeCount }) => {
    const isActive = bagNo === selectedBagNo;
    return `
      <button class="bag-grid-btn${isActive ? " active" : ""}" data-bag="${bagNo}">
        <span class="bag-no">${bagNo}</span>
        <span class="bag-count">${stationCount} байр</span>
        ${activeCount > 0 ? `<span class="bag-active">${activeCount} идэвхтэй</span>` : ""}
      </button>
    `;
  }).join("");

  grid.querySelectorAll(".bag-grid-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedBagNo = Number(btn.dataset.bag);
      renderBagGrid();
      renderStationPanel();
    });
  });
}

function renderViewFilters() {
  const selectedFolder = bagFolders().find(f => f.bagNo === selectedBagNo);
  const total  = selectedFolder?.stationCount ?? 0;
  const active = selectedFolder?.activeCount ?? 0;
  const free   = total - active;

  const items = [
    { key: "all",    label: `Бүгд (${total})`,           cls: "bag-chip" },
    { key: "active", label: `Идэвхтэй (${active})`,      cls: "bag-chip" },
    { key: "free",   label: `Чөлөөтэй (${free})`,        cls: "bag-chip" },
  ];

  const container = el("view-filters");
  if (!container) return;

  container.innerHTML = items.map(({ key, label, cls }) => {
    const activeClass = viewFilter === key ? (
      key === "active" ? "style=\"background:var(--sky-600);color:white\"" :
      key === "free"   ? "style=\"background:var(--emerald-600);color:white\"" :
                         "style=\"background:var(--brand-700);color:white\""
    ) : (
      key === "active" ? "style=\"background:var(--sky-50);color:var(--sky-700)\"" :
      key === "free"   ? "style=\"background:var(--emerald-50);color:var(--emerald-700)\"" :
                         ""
    );
    return `<button class="${cls}" data-view="${key}" ${activeClass}>${escapeHtml(label)}</button>`;
  }).join("");

  container.querySelectorAll(".bag-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      viewFilter = btn.dataset.view;
      renderViewFilters();
      renderStationTable();
    });
  });
}

function renderStationPanel() {
  const title = el("station-panel-title");
  if (title) {
    title.textContent = selectedBagNo ? `${selectedBagNo}-р багийн ус түгээх байрууд` : "Баг сонгоно уу";
  }
  renderViewFilters();
  renderStationTable();
}

function renderStationTable() {
  const wrap = el("station-table-wrap");
  if (!wrap) return;

  const rows = visibleRows();

  if (rows.length === 0) {
    wrap.innerHTML = emptyState("Тохирох ус түгээх байр олдсонгүй.");
    return;
  }

  wrap.innerHTML = `
    <div class="table-shell">
      ${rows.map(({ station, status, deptId, teamId }) => {
        const meta = getStatusMeta(status);
        const deptName = getDeptName(deptId, departments);
        const teamName = getTeamName(teamId, teams, users);
        return `
          <div class="station-row-link" data-station-id="${station.id}" style="display:grid;grid-template-columns:88px minmax(0,1.1fr) 112px 136px 156px;align-items:center;gap:0;border-bottom:1px solid var(--slate-200);background:white;padding:12px 20px;cursor:pointer;transition:background 0.12s">
            <div>
              <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:var(--slate-400)">Код</p>
              <p style="font-size:20px;font-weight:800;line-height:1;color:var(--ink-900);margin-top:4px">${escapeHtml(station.code)}</p>
            </div>
            <div style="min-width:0">
              <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:var(--slate-400)">Байршил</p>
              <p style="font-size:13px;font-weight:600;color:var(--slate-700);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(station.location || "—")}</p>
            </div>
            <div>
              <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:var(--slate-400)">Төлөв</p>
              <span class="badge ${meta.badgeClass}" style="margin-top:4px;display:inline-flex">${meta.label}</span>
            </div>
            <div>
              <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:var(--slate-400)">Алба</p>
              <p style="font-size:13px;font-weight:600;color:var(--slate-700);margin-top:4px">${escapeHtml(deptName)}</p>
            </div>
            <div>
              <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:var(--slate-400)">Засварын бригад</p>
              <p style="font-size:13px;font-weight:600;color:var(--slate-700);margin-top:4px">${escapeHtml(teamName)}</p>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  wrap.querySelectorAll("[data-station-id]").forEach((row) => {
    row.addEventListener("click", () => openStationModal(row.dataset.stationId));
  });
}

function renderDeptFilter() {
  const sel = el("dept-filter");
  if (!sel) return;
  const current = sel.value;
  const existing = sel.querySelectorAll("option:not([value='all'])");
  existing.forEach(o => o.remove());
  departments.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.id; opt.textContent = d.name;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

// ── init ──────────────────────────────────────────────────────

async function init() {
  const [stRes, tRes, taskRes, metaRes] = await Promise.all([
    getStations(),
    getTickets(),
    getTasks(),
    getAdminMeta(),
  ]);

  allStations = stRes.stations ?? [];
  allTickets  = tRes.tickets ?? [];
  allTasks    = taskRes.tasks ?? [];
  departments = metaRes.departments ?? [];
  teams       = metaRes.teams ?? [];
  users       = metaRes.users ?? [];

  // Default to first bag
  const folders = bagFolders();
  if (folders.length > 0) selectedBagNo = folders[0].bagNo;

  renderDeptFilter();
  renderBagGrid();
  renderStationPanel();

  // Filter listeners
  el("search-input")?.addEventListener("input", e => {
    searchQuery = e.target.value;
    renderViewFilters();
    renderStationTable();
  });

  el("status-filter")?.addEventListener("change", e => {
    statusFilter = e.target.value;
    renderViewFilters();
    renderStationTable();
  });

  el("dept-filter")?.addEventListener("change", e => {
    deptFilter = e.target.value;
    renderViewFilters();
    renderStationTable();
  });
}

async function openStationModal(stationId) {
  const modal = el("station-detail-modal");
  el("sdm-code").textContent = "…";
  el("sdm-location").textContent = "";
  el("sdm-info").innerHTML = spinner();
  el("sdm-tickets").innerHTML = "";
  el("sdm-logs").innerHTML = "";
  modal.classList.remove("hidden");

  try {
    const { station, tickets, maintenanceLogs } = await getStationDetail(stationId);

    el("sdm-code").textContent = station.code;
    el("sdm-location").textContent = station.location || "—";
    el("sdm-info").innerHTML = `
      <p><strong>Баг:</strong> ${station.bagNo}-р баг</p>
      <p><strong>Байршил:</strong> ${escapeHtml(station.location || "—")}</p>
      <p><strong>Хянагч:</strong> ${escapeHtml(station.caretakerName || "—")}</p>
      <p><strong>Хянагчийн утас:</strong> ${escapeHtml(station.caretakerPhone || "—")}</p>
    `;

    el("sdm-tickets-title").textContent = `Засварын хүсэлт (${tickets.length})`;
    el("sdm-tickets").innerHTML = tickets.length
      ? tickets.map((t) => `
          <div class="item-card" style="padding:10px 12px">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <strong style="font-size:13px">${escapeHtml(t.ticketNo)}</strong>
              ${statusBadge(t.status)}
            </div>
            <p style="font-size:12px;color:var(--slate-600);margin-top:4px">${escapeHtml(t.issueType)}</p>
            <p style="font-size:11px;color:var(--slate-400);margin-top:2px">${formatDateTime(t.createdAt)}</p>
          </div>`)
        .join("")
      : `<p class="empty-state" style="padding:8px">Хүсэлт байхгүй</p>`;

    el("sdm-logs-title").textContent = `Засварын түүх (${maintenanceLogs.length})`;
    el("sdm-logs").innerHTML = maintenanceLogs.length
      ? maintenanceLogs.map(maintenanceLogHtml).join("")
      : `<p class="empty-state" style="padding:8px">Засварын түүх байхгүй</p>`;

  } catch (err) {
    el("sdm-info").innerHTML = `<p style="color:var(--rose-600)">Алдаа: ${escapeHtml(err.message)}</p>`;
  }
}

const ROLE_MAP = {
  dispatcher:          "/dispatcher.html",
  general_engineer:    "/engineer.html",
  department_engineer: "/engineer.html",
  brigade_leader:      "/brigade.html",
  admin:               "/admin.html",
};

function maintenanceLogHtml(m) {
  const sourceLabel = m.sourceType === "task" ? "Төлөвлөгөөт ажил" : "Иргэний гомдол";
  const originText = m.sourceType === "task"
    ? (m.taskDescription || m.description || "")
    : [m.ticketNo, m.issueType, m.complaintDescription].filter(Boolean).join(" · ");
  const actor = m.completedByName || m.teamLeaderName || m.teamName || "Бригад";
  return `
    <div class="item-card" style="padding:10px 12px">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span class="badge ${m.sourceType === "task" ? "badge-web" : "badge-assigned"}">${sourceLabel}</span>
        <strong style="font-size:13px">${escapeHtml(m.teamName || "Бригад")}</strong>
      </div>
      ${originText ? `<p style="font-size:12px;color:var(--slate-600);margin-top:6px"><strong>Эх сурвалж:</strong> ${escapeHtml(originText)}</p>` : ""}
      <p style="font-size:12px;color:var(--slate-600);margin-top:4px"><strong>Гүйцэтгэл:</strong> ${escapeHtml(m.description)}</p>
      <p style="font-size:11px;color:var(--slate-500);margin-top:4px"><strong>Хэн:</strong> ${escapeHtml(actor)}${m.workerNames ? ` · ${escapeHtml(m.workerNames)}` : ""}</p>
      ${m.materialsUsed ? `<p style="font-size:11px;color:var(--slate-400);margin-top:2px">Материал: ${escapeHtml(m.materialsUsed)}</p>` : ""}
      <p style="font-size:11px;color:var(--slate-400);margin-top:2px">${formatDateTime(m.createdAt)}</p>
    </div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  setupSidebar();
  const u = getUser();
  const link = document.getElementById("dashboard-link");
  if (link && u) link.href = ROLE_MAP[u.role] || "/app.html";

  el("sdm-close")?.addEventListener("click", () => el("station-detail-modal")?.classList.add("hidden"));
  el("station-detail-modal")?.addEventListener("click", (e) => {
    if (e.target === el("station-detail-modal")) el("station-detail-modal").classList.add("hidden");
  });

  init().catch(err => {
    console.error(err);
    const wrap = el("station-table-wrap");
    if (wrap) wrap.innerHTML = `<div class="empty-state" style="color:var(--rose-600)">Мэдээлэл ачаалж чадсангүй.</div>`;
  });
});
