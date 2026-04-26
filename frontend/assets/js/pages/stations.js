import { getStations, getTickets, getTasks, getAdminMeta } from "../api.js";
import {
  matchesStationSearch, getStatusMeta, getDeptName, getTeamName,
  escapeHtml, emptyState, spinner,
} from "../utils.js";

let state = { stations: [], tickets: [], tasks: [], departments: [], teams: [], users: [] };
let selectedBag = null;
let searchQuery = "";
let statusFilter = "all";
let deptFilter = "all";
let viewFilter = "all"; // all | active | free

// Read ?bag=X or ?query=... from URL
const urlParams = new URLSearchParams(window.location.search);
const initBag = urlParams.get("bag");
const initQuery = urlParams.get("query") ?? "";

// Responsive breakpoint
const isDesktop = () => window.innerWidth >= 1280;

document.addEventListener("DOMContentLoaded", async () => {
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
    document.getElementById("station-table-mobile").innerHTML = emptyState("Өгөгдөл ачааллахад алдаа гарлаа");
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
  const title = selectedBag ? `${selectedBag}-р багийн худгууд` : "—";
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
    ? emptyState("Тохирох худаг алга")
    : `<div class="table-shell">${rows.map(({ station, departmentId, teamId, status }) => {
        const meta = getStatusMeta(status);
        return `
          <a href="/station.html?id=${escapeHtml(station.id)}" style="display:flex;flex-direction:column;gap:12px;border-bottom:1px solid var(--slate-200);background:white;padding:16px;text-decoration:none;transition:background 0.12s" onmouseover="this.style.background='var(--slate-50)'" onmouseout="this.style.background='white'">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
              <div>
                <p style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.18em;color:var(--slate-400)">Код</p>
                <p style="font-size:1.25rem;font-weight:800;line-height:1;color:var(--ink-900);margin-top:4px">${escapeHtml(station.code)}</p>
              </div>
              <span class="badge ${meta.badgeClass}">${meta.label}</span>
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
          </a>`;
      }).join("")}</div>`;

  const mobileEl  = document.getElementById("station-table-mobile");
  const desktopEl = document.getElementById("station-table-desktop");
  if (mobileEl)  mobileEl.innerHTML  = tableHtml;
  if (desktopEl) desktopEl.innerHTML = tableHtml;
}
