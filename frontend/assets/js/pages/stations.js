import { getStations, getTickets, getTasks, getAdminMeta, getStationDetail } from "../api.js";
import {
  matchesStationSearch, getStatusMeta, getDeptName, getTeamName,
  escapeHtml, emptyState, spinner, statusBadge, formatDateTime,
} from "../utils.js";

let state = { stations: [], tickets: [], tasks: [], departments: [], teams: [], users: [] };
let selectedBag = null;
let searchQuery = "";
let statusFilter = "all";
let deptFilter = "all";
let viewFilter = "all"; // all | active | free

const el = (id) => document.getElementById(id);

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

async function openStationModal(stationId) {
  const modal = el("station-detail-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  el("sdm-code").textContent = "…";
  el("sdm-location").textContent = "";
  el("sdm-info").innerHTML = spinner();
  el("sdm-tickets").innerHTML = "";
  el("sdm-logs").innerHTML = "";

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
          </div>`).join("")
      : `<p class="empty-state" style="padding:8px">Хүсэлт байхгүй</p>`;

    el("sdm-logs-title").textContent = `Засварын түүх (${maintenanceLogs.length})`;
    el("sdm-logs").innerHTML = maintenanceLogs.length
      ? maintenanceLogs.map(maintenanceLogHtml).join("")
      : `<p class="empty-state" style="padding:8px">Засварын түүх байхгүй</p>`;
  } catch (err) {
    el("sdm-info").innerHTML = `<p style="color:var(--rose-600)">Алдаа: ${escapeHtml(err.message)}</p>`;
  }
}
// Read ?bag=X or ?query=... from URL
const urlParams = new URLSearchParams(window.location.search);
const initBag = urlParams.get("bag");
const initQuery = urlParams.get("query") ?? "";

// Responsive breakpoint
const isDesktop = () => window.innerWidth >= 1280;

// Document-level delegation for station row clicks (set up at module load, before DOMContentLoaded)
document.addEventListener("click", (e) => {
  const row = e.target.closest("[data-station-id]");
  if (row) openStationModal(row.dataset.stationId);
});

document.addEventListener("DOMContentLoaded", async () => {
  // Close handlers
  el("sdm-close")?.addEventListener("click", () => el("station-detail-modal")?.classList.add("hidden"));
  el("station-detail-modal")?.addEventListener("click", (e) => {
    if (e.target === el("station-detail-modal")) el("station-detail-modal").classList.add("hidden");
  });

  showSpinners();

  // Header scroll-to-hide
  const header = document.getElementById("pub-header");
  let lastY = 0;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    if (y <= 20) header.classList.remove("scrolled-down");
    else if (y > lastY + 10) header.classList.add("scrolled-down");
    else if (y < lastY - 8) header.classList.remove("scrolled-down");
    lastY = y;
  }, { passive: true });

  try {
    const [stRes, tickRes, taskRes, metaRes] = await Promise.all([
      getStations(),
      getTickets().catch(() => ({ tickets: [] })),
      getTasks().catch(() => ({ tasks: [] })),
      getAdminMeta().catch(() => ({ departments: [], teams: [], users: [], stations: [] })),
    ]);
    state.stations    = stRes.stations ?? [];
    state.tickets     = tickRes.tickets ?? [];
    state.tasks       = taskRes.tasks ?? [];
    state.departments = metaRes.departments ?? [];
    state.teams       = metaRes.teams ?? [];
    state.users       = metaRes.users ?? [];
  } catch {
    document.getElementById("station-table-mobile").innerHTML = emptyState("Мэдээлэл ачаалж чадсангүй.");
    return;
  }

  if (initQuery) searchQuery = initQuery;

  const bags = [...new Set(state.stations.map((s) => s.bagNo))].sort((a, b) => a - b);
  if (initBag && bags.includes(Number(initBag))) selectedBag = Number(initBag);
  else selectedBag = bags[0] ?? null;

  populateDeptFilters();
  setupLayout(bags);
  render();

  window.addEventListener("resize", () => {
    setupLayout(bags);
    render();
  });
});

function showSpinners() {
  document.getElementById("station-table-mobile").innerHTML = spinner();
  document.getElementById("station-table-desktop").innerHTML = spinner();
}

function populateDeptFilters() {
  const opts = `<option value="all">Бүх алба</option>` +
    state.departments.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join("");
  document.getElementById("dept-filter").innerHTML = opts;
  document.getElementById("dept-filter-desktop").innerHTML = opts;
}

function setupLayout(bags) {
  const desktop = isDesktop();
  document.getElementById("mobile-view").style.display = desktop ? "none" : "";
  document.getElementById("desktop-view").style.display = desktop ? "" : "none";

  // Wire up mobile controls
  const bagSelectMobile = document.getElementById("bag-select-mobile");
  if (bagSelectMobile && !bagSelectMobile.dataset.init) {
    bagSelectMobile.innerHTML = bags.map((b) => {
      const activeCount = stationEntries().filter((e) => e.station.bagNo === b && e.hasActive).length;
      const suffix = activeCount > 0 ? ` • ${activeCount} идэвхтэй` : "";
      return `<option value="${b}">${b}-р баг${suffix}</option>`;
    }).join("");
    if (selectedBag) bagSelectMobile.value = String(selectedBag);
    bagSelectMobile.addEventListener("change", (e) => { selectedBag = Number(e.target.value); render(); });
    bagSelectMobile.dataset.init = "1";
  }

  const searchEl = document.getElementById("station-search");
  if (searchEl && !searchEl.dataset.init) {
    searchEl.value = searchQuery;
    searchEl.addEventListener("input", (e) => { searchQuery = e.target.value; render(); });
    searchEl.dataset.init = "1";
  }
  const statusEl = document.getElementById("status-filter");
  if (statusEl && !statusEl.dataset.init) {
    statusEl.value = statusFilter;
    statusEl.addEventListener("change", (e) => { statusFilter = e.target.value; render(); });
    statusEl.dataset.init = "1";
  }
  const deptEl = document.getElementById("dept-filter");
  if (deptEl && !deptEl.dataset.init) {
    deptEl.value = deptFilter;
    deptEl.addEventListener("change", (e) => { deptFilter = e.target.value; render(); });
    deptEl.dataset.init = "1";
  }

  // Desktop controls
  const searchDesktop = document.getElementById("station-search-desktop");
  if (searchDesktop && !searchDesktop.dataset.init) {
    searchDesktop.value = searchQuery;
    searchDesktop.addEventListener("input", (e) => { searchQuery = e.target.value; render(); });
    searchDesktop.dataset.init = "1";
  }
  const statusDesktop = document.getElementById("status-filter-desktop");
  if (statusDesktop && !statusDesktop.dataset.init) {
    statusDesktop.value = statusFilter;
    statusDesktop.addEventListener("change", (e) => { statusFilter = e.target.value; render(); });
    statusDesktop.dataset.init = "1";
  }
  const deptDesktop = document.getElementById("dept-filter-desktop");
  if (deptDesktop && !deptDesktop.dataset.init) {
    deptDesktop.value = deptFilter;
    deptDesktop.addEventListener("change", (e) => { deptFilter = e.target.value; render(); });
    deptDesktop.dataset.init = "1";
  }
}

function stationEntries() {
  return state.stations.map((station) => {
    const latestTicket = state.tickets
      .filter((t) => t.stationId === station.id)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
    const latestTask = state.tasks
      .filter((t) => t.stationId === station.id)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];

    const useTicket = !latestTask || (latestTicket &&
      +new Date(latestTicket.createdAt) >= +new Date(latestTask.createdAt));

    const departmentId = useTicket
      ? (latestTicket?.departmentId ?? latestTask?.departmentId)
      : (latestTask?.departmentId ?? latestTicket?.departmentId);
    const teamId = useTicket
      ? (latestTicket?.teamId ?? latestTask?.teamId)
      : (latestTask?.teamId ?? latestTicket?.teamId);
    const status = useTicket
      ? (latestTicket?.status ?? latestTask?.status ?? "new")
      : (latestTask?.status ?? latestTicket?.status ?? "new");
    const hasActive = Boolean(
      (latestTicket && latestTicket.status !== "done") ||
      (latestTask   && latestTask.status !== "done")
    );

    return { station, departmentId, teamId, status, hasActive };
  });
}

function visibleRows() {
  const q = searchQuery.trim().toLowerCase();
  const allEntries = stationEntries();
  const folderEntries = allEntries.filter((e) => e.station.bagNo === selectedBag);

  return folderEntries
    .filter(({ station, status, departmentId, hasActive }) => {
      if (q && !matchesStationSearch(station, q)) return false;
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (deptFilter !== "all" && departmentId !== deptFilter) return false;
      if (viewFilter === "active" && !hasActive) return false;
      if (viewFilter === "free"   &&  hasActive) return false;
      return true;
    })
    .sort((a, b) => {
      const [ab = "0", an = "0"] = a.station.code.split("-");
      const [bb = "0", bn = "0"] = b.station.code.split("-");
      return Number(ab) - Number(bb) || Number(an) - Number(bn);
    });
}

function render() {
  const allEntries = stationEntries();
  const bags = [...new Set(state.stations.map((s) => s.bagNo))].sort((a, b) => a - b);

  renderBagFolderGrid(bags, allEntries);
  renderViewFilterChips(allEntries);
  renderStationTable();
}

function renderBagFolderGrid(bags, allEntries) {
  const gridEl = document.getElementById("bag-folder-grid");
  if (!gridEl) return;
  gridEl.innerHTML = bags.map((bagNo) => {
    const rows = allEntries.filter((e) => e.station.bagNo === bagNo);
    const activeCount = rows.filter((e) => e.hasActive).length;
    const isSelected  = selectedBag === bagNo;
    return `
      <button data-bag="${bagNo}" class="bag-folder-btn" style="
        border-radius:var(--radius);border:1px solid ${isSelected ? "var(--brand-300)" : "var(--slate-200)"};
        background:${isSelected ? "var(--brand-50)" : "white"};
        box-shadow:${isSelected ? "var(--shadow-card)" : "none"};
        padding:12px;text-align:left;cursor:pointer;transition:border-color 0.15s,background 0.15s">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <h2 style="font-size:1.25rem;font-weight:800;line-height:1;color:var(--ink-900)">${bagNo}</h2>
          ${activeCount > 0 ? `<span style="border-radius:999px;background:var(--sky-100);padding:2px 8px;font-size:10px;font-weight:600;color:var(--sky-700)">${activeCount}</span>` : ""}
        </div>
        <p style="margin-top:8px;font-size:12px;color:var(--slate-500)">${rows.length} байр</p>
      </button>`;
  }).join("");

  gridEl.querySelectorAll(".bag-folder-btn").forEach((btn) => {
    btn.addEventListener("click", () => { selectedBag = Number(btn.dataset.bag); render(); });
  });

  // Update folder titles
  const title = selectedBag ? `${selectedBag}-р багийн ус түгээх байрууд` : "—";
  const titleMobile  = document.getElementById("folder-title-mobile");
  const titleDesktop = document.getElementById("folder-title-desktop");
  if (titleMobile)  titleMobile.textContent = title;
  if (titleDesktop) titleDesktop.textContent = title;
}

function renderViewFilterChips(allEntries) {
  const folderEntries = allEntries.filter((e) => e.station.bagNo === selectedBag);
  const total  = folderEntries.length;
  const active = folderEntries.filter((e) => e.hasActive).length;
  const free   = total - active;

  const chips = [
    { key: "all",    label: `Бүгд (${total})`,         bg: "var(--brand-700)" },
    { key: "active", label: `Идэвхтэй (${active})`,    bg: "var(--sky-600)",     inactiveStyle: "background:var(--sky-50);color:var(--sky-700)" },
    { key: "free",   label: `Чөлөөтэй (${free})`,      bg: "var(--emerald-600)", inactiveStyle: "background:var(--emerald-50);color:var(--emerald-700)" },
  ];

  ["view-filter-chips", "view-filter-chips-desktop"].forEach((containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = chips.map(({ key, label, bg, inactiveStyle }) => {
      const isActive = viewFilter === key;
      const style = isActive
        ? `background:${bg};color:white`
        : (inactiveStyle ?? "background:var(--slate-100);color:var(--slate-600)");
      return `<button data-view="${key}" style="border-radius:999px;padding:6px 12px;font-size:14px;font-weight:600;cursor:pointer;border:none;transition:background 0.15s,color 0.15s;${style}">${escapeHtml(label)}</button>`;
    }).join("");
    container.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => { viewFilter = btn.dataset.view; render(); });
    });
  });
}

function renderStationTable() {
  const rows = visibleRows();
  const tableHtml = rows.length === 0
    ? emptyState("Тохирох ус түгээх байр олдсонгүй.")
    : `<div class="table-shell">${rows.map(({ station, departmentId, teamId, status }) => {
        const meta = getStatusMeta(status);
        return `
          <div data-station-id="${station.id}" class="station-row-clickable" style="display:flex;flex-direction:column;gap:12px;border-bottom:1px solid var(--slate-200);background:white;padding:16px;cursor:pointer;transition:background 0.12s">
            <div>
              <p style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.18em;color:var(--slate-400)">Код</p>
              <p style="font-size:1.25rem;font-weight:800;line-height:1;color:var(--ink-900);margin-top:4px">${escapeHtml(station.code)}</p>
            </div>
            <div style="display:grid;gap:12px;grid-template-columns:1fr 1fr 1fr">
              <div style="grid-column:span 3">
                <p style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.18em;color:var(--slate-400)">Байршил</p>
                <p style="font-size:13px;font-weight:600;color:var(--slate-700);margin-top:4px">${escapeHtml(station.location || "—")}</p>
              </div>
              <div>
                <p style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.18em;color:var(--slate-400)">Алба</p>
                <p style="font-size:13px;font-weight:600;color:var(--slate-700);margin-top:4px">${escapeHtml(getDeptName(departmentId, state.departments))}</p>
              </div>
              <div style="grid-column:span 2">
                <p style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.18em;color:var(--slate-400)">Засварын бригад</p>
                <p style="font-size:13px;font-weight:600;color:var(--slate-700);margin-top:4px">${escapeHtml(getTeamName(teamId, state.teams, state.users))}</p>
              </div>
            </div>
          </div>`;
      }).join("")}</div>`;

  const mobileEl  = document.getElementById("station-table-mobile");
  const desktopEl = document.getElementById("station-table-desktop");
  if (mobileEl)  mobileEl.innerHTML  = tableHtml;
  if (desktopEl) desktopEl.innerHTML = tableHtml;
}
