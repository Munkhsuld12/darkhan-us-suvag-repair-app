import { getStations, getTickets, getTasks, getAdminMeta, submitComplaint, login as apiLogin } from "../api.js";
import {
  matchesStationSearch, getStatusMeta, getDeptName, getTeamName,
  getStationOptionLabel, escapeHtml, emptyState, formatDate,
} from "../utils.js";
import { issueTypeOptions } from "../seed.js";
import { setSession, getRoleRedirect } from "../auth.js";

let state = { stations: [], tickets: [], tasks: [], departments: [], teams: [], users: [] };
let selectedBag = null;
let searchQuery = "";

const statusBarClass = {
  new: "bar-new", assigned: "bar-assigned", urgent: "bar-urgent",
  in_progress: "bar-in_progress", done: "bar-done",
};

document.addEventListener("DOMContentLoaded", async () => {
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
    document.getElementById("station-preview-grid").innerHTML = emptyState("Өгөгдөл ачааллахад алдаа гарлаа");
    return;
  }

  const bags = [...new Set(state.stations.map((s) => s.bagNo))].sort((a, b) => a - b);
  selectedBag = bags[0] ?? null;

  renderBagChips(bags);
  document.getElementById("station-search").addEventListener("input", (e) => {
    searchQuery = e.target.value;
    render();
  });
  render();
  setupComplaintModal();
  setupLoginModal();
});

function renderBagChips(bags) {
  const container = document.getElementById("bag-chips");
  container.innerHTML = bags.map((b) => `
    <button class="bag-chip${b === selectedBag ? " active" : ""}" data-bag="${b}">${b}-р баг</button>
  `).join("");
  container.querySelectorAll(".bag-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedBag = Number(btn.dataset.bag);
      container.querySelectorAll(".bag-chip").forEach((b) =>
        b.classList.toggle("active", Number(b.dataset.bag) === selectedBag)
      );
      searchQuery = "";
      document.getElementById("station-search").value = "";
      render();
    });
  });

  // Convert vertical mouse wheel to horizontal scroll
  container.addEventListener("wheel", (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}

function getOpenTicket(stationId) {
  return state.tickets
    .filter((t) => t.stationId === stationId && t.status !== "done")
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
}

function render() {
  renderStationGrid();
  renderPlannedTasks();
}

function renderStationGrid() {
  const q       = searchQuery.trim();
  const titleEl = document.getElementById("station-grid-title");
  const linkEl  = document.getElementById("all-stations-link");
  const gridEl  = document.getElementById("station-preview-grid");

  let result;
  if (q) {
    result = state.stations
      .filter((s) => matchesStationSearch(s, q))
      .sort((a, b) => {
        const ql = q.toLowerCase();
        const sa = a.code.toLowerCase().startsWith(ql) ? 0 : 1;
        const sb = b.code.toLowerCase().startsWith(ql) ? 0 : 1;
        return sa - sb || a.code.localeCompare(b.code);
      });
    titleEl.textContent = "Хайлтын үр дүн";
    linkEl.href = `/stations.html?query=${encodeURIComponent(q)}`;
  } else {
    result = state.stations
      .filter((s) => s.bagNo === selectedBag)
      .sort((a, b) => {
        const [ab = "0", an = "0"] = a.code.split("-");
        const [bb = "0", bn = "0"] = b.code.split("-");
        return Number(ab) - Number(bb) || Number(an) - Number(bn);
      });
    titleEl.textContent = selectedBag ? `${selectedBag}-р баг` : "—";
    linkEl.href = `/stations.html${selectedBag ? `?bag=${selectedBag}` : ""}`;
  }

  const preview = result.slice(0, 6);
  if (!preview.length) { gridEl.innerHTML = emptyState("Тохирох ус түгээх байр алга"); return; }
  gridEl.innerHTML = preview.map((s) => stationCardHtml(s)).join("");
}

function stationCardHtml(station) {
  const ticket   = getOpenTicket(station.id);
  const status   = ticket?.status ?? "new";
  const meta     = getStatusMeta(status);
  const barCls   = statusBarClass[status] ?? "bar-new";
  const deptName = getDeptName(ticket?.departmentId, state.departments);
  const teamName = getTeamName(ticket?.teamId, state.teams, state.users);

  return `
    <a href="/station.html?id=${escapeHtml(station.id)}" class="station-card">
      <div class="station-card-body">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div>
            <p class="bag-label">${escapeHtml(String(station.bagNo))}-р баг</p>
            <h3 class="code">${escapeHtml(station.code)}</h3>
          </div>
          <span class="badge ${meta.badgeClass}">${meta.label}</span>
        </div>
        <p class="location">${escapeHtml(station.location || "Байршил оруулаагүй")}</p>
        ${ticket?.description ? `<p class="ticket-desc">${escapeHtml(ticket.description)}</p>` : ""}
        <div style="display:grid;gap:8px">
          <div class="info-block">
            <p class="info-label">Алба</p>
            <p class="info-value">${escapeHtml(deptName)}</p>
          </div>
          <div class="info-block">
            <p class="info-label">Засварын бригад</p>
            <p class="info-value">${escapeHtml(teamName)}</p>
          </div>
        </div>
      </div>
      <div class="station-card-bar ${barCls}"></div>
    </a>`;
}

function renderPlannedTasks() {
  const listEl  = document.getElementById("planned-tasks-list");
  const badgeEl = document.getElementById("planned-tasks-badge");
  const today   = new Date().toISOString().slice(0, 10);

  const notDone   = state.tasks.filter((t) => t.status !== "done");
  const upcoming  = notDone.filter((t) => t.taskDate >= today);
  const source    = upcoming.length > 0 ? upcoming : notDone;

  const planned = source
    .sort((a, b) => a.taskDate === b.taskDate
      ? +new Date(a.createdAt) - +new Date(b.createdAt)
      : a.taskDate.localeCompare(b.taskDate)
    )
    .slice(0, 4)
    .map((t) => {
      const station = state.stations.find((s) => s.id === t.stationId);
      return {
        ...t,
        stationCode:     station?.code ?? "Тодорхойгүй",
        stationLocation: station?.location ?? "Байршил оруулаагүй",
        teamName:        getTeamName(t.teamId, state.teams, state.users),
        meta:            getStatusMeta(t.status),
      };
    });

  if (badgeEl) { badgeEl.textContent = planned.length; badgeEl.classList.toggle("hidden", !planned.length); }
  if (!planned.length) { listEl.innerHTML = emptyState("Ажил алга"); return; }

  listEl.innerHTML = planned.map((t) => `
    <div style="border-radius:var(--radius);border:1px solid var(--slate-200);background:var(--slate-50);padding:14px 16px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div>
          <p style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.16em;color:var(--slate-400)">${escapeHtml(formatDate(t.taskDate))}</p>
          <h3 style="font-size:1rem;font-weight:700;color:var(--ink-900);margin-top:4px">${escapeHtml(t.stationCode)}</h3>
        </div>
        <span class="badge ${t.meta.badgeClass}">${t.meta.label}</span>
      </div>
      <p style="font-size:14px;color:var(--slate-600);margin-top:10px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${escapeHtml(t.description || "")}</p>
      <p style="font-size:14px;color:var(--slate-500);margin-top:10px">${escapeHtml(t.teamName)}</p>
      <p style="font-size:14px;color:var(--slate-500);margin-top:4px">${escapeHtml(t.stationLocation)}</p>
    </div>
  `).join("");
}

// ── Login modal ──────────────────────────────────────────────
function setupLoginModal() {
  const modal    = document.getElementById("login-modal");
  const openBtn  = document.getElementById("open-login-btn");
  const closeBtn = document.getElementById("close-login-btn");
  const form     = document.getElementById("login-modal-form");
  const errEl    = document.getElementById("lm-error");
  const submitBtn = document.getElementById("lm-submit");

  const openModal = () => {
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    form.reset();
    errEl.style.display = "none";
  };

  const closeModal = () => {
    modal.style.display = "none";
    document.body.style.overflow = "";
  };

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  if (new URLSearchParams(window.location.search).get("login") === "1") openModal();

  document.getElementById("lm-toggle-password")?.addEventListener("click", () => {
    const pwd = document.getElementById("lm-password");
    const icon = document.getElementById("lm-eye-icon");
    if (pwd.type === "password") {
      pwd.type = "text";
      icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`;
    } else {
      pwd.type = "password";
      icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.style.display = "none";
    submitBtn.disabled = true;
    submitBtn.textContent = "Нэвтэрч байна...";

    try {
      const data = await apiLogin(
        document.getElementById("lm-username").value.trim(),
        document.getElementById("lm-password").value,
      );
      setSession(data.token, data.user);
      window.location.href = data.user.profileComplete === false
        ? "/profile-setup.html"
        : getRoleRedirect(data.user.role);
    } catch (err) {
      errEl.textContent = err.message || "Нэвтрэх нэр эсвэл нууц үг буруу";
      errEl.style.display = "";
      submitBtn.disabled = false;
      submitBtn.textContent = "Нэвтрэх";
    }
  });
}

// ── Complaint modal ──────────────────────────────────────────
function setupComplaintModal() {
  const modal    = document.getElementById("complaint-modal");
  const openBtn  = document.getElementById("open-complaint-btn");
  const closeBtn = document.getElementById("close-complaint-btn");
  const form     = document.getElementById("complaint-form");
  const errEl    = document.getElementById("c-error");
  const succEl   = document.getElementById("c-success");

  // Populate issue type select
  const issueSel = document.getElementById("c-issue");
  issueTypeOptions.forEach((opt) => {
    const o = document.createElement("option");
    o.value = o.textContent = opt;
    issueSel.appendChild(o);
  });

  // Station combobox
  let selectedStation = null;
  const stationInput = document.getElementById("c-station");
  const stationDrop  = document.getElementById("c-station-dropdown");

  const attachDropdownHandlers = () => {
    stationDrop.querySelectorAll(".station-dropdown-item").forEach((item) => {
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectedStation = state.stations.find((x) => x.id === item.dataset.id);
        stationInput.value = selectedStation.code;
        stationDrop.classList.add("hidden");
      });
    });
  };

  const showGrouped = () => {
    const bags = [...new Set(state.stations.map((s) => s.bagNo))].sort((a, b) => a - b);
    stationDrop.innerHTML = bags.map((bag) => {
      const list = state.stations
        .filter((s) => s.bagNo === bag)
        .sort((a, b) => Number(a.code.split("-")[1]) - Number(b.code.split("-")[1]));
      return `<div class="station-dropdown-group">${bag}-р баг</div>` +
        list.map((s) => `
          <div class="station-dropdown-item" data-id="${escapeHtml(s.id)}">
            <span class="station-dropdown-code">${escapeHtml(s.code)}</span>
            <span class="station-dropdown-loc">${escapeHtml(s.location || "Байршил оруулаагүй")}</span>
          </div>`).join("");
    }).join("");
    attachDropdownHandlers();
    stationDrop.classList.remove("hidden");
  };

  stationInput.addEventListener("input", () => {
    selectedStation = null;
    const q = stationInput.value.trim().toLowerCase();
    if (!q) { showGrouped(); return; }
    const matches = state.stations
      .filter((s) => s.code.toLowerCase().includes(q) || (s.location ?? "").toLowerCase().includes(q))
      .sort((a, b) => {
        const ac = a.code.toLowerCase(), bc = b.code.toLowerCase();
        const ap = ac.startsWith(q + "-") ? 0 : 1;
        const bp = bc.startsWith(q + "-") ? 0 : 1;
        return ap - bp || ac.localeCompare(bc);
      })
      .slice(0, 15);
    stationDrop.innerHTML = matches.length
      ? matches.map((s) => `
          <div class="station-dropdown-item" data-id="${escapeHtml(s.id)}">
            <span class="station-dropdown-code">${escapeHtml(s.code)}</span>
            <span class="station-dropdown-loc">${escapeHtml(s.location || "Байршил оруулаагүй")}</span>
          </div>`).join("")
      : `<div class="station-dropdown-empty">Тохирох байр олдсонгүй</div>`;
    attachDropdownHandlers();
    stationDrop.classList.remove("hidden");
  });
  stationInput.addEventListener("blur",  () => setTimeout(() => stationDrop.classList.add("hidden"), 150));
  stationInput.addEventListener("focus", () => {
    if (stationInput.value.trim()) stationInput.dispatchEvent(new Event("input"));
    else showGrouped();
  });

  const openModal = () => {
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    form.reset();
    selectedStation = null;
    stationDrop.classList.add("hidden");
    errEl.style.display = "none";
    succEl.classList.add("hidden");
  };

  const closeModal = () => {
    modal.style.display = "none";
    document.body.style.overflow = "";
  };

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.style.display = "none";
    succEl.classList.add("hidden");

    const station = selectedStation ||
      state.stations.find((s) => s.code.toLowerCase() === stationInput.value.trim().toLowerCase());
    if (!station) {
      errEl.textContent = "Жагсаалтаас ус түгээх байр сонгоно уу";
      errEl.style.display = "";
      stationInput.focus();
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    try {
      await submitComplaint({
        stationId:      station.id,
        issueType:      document.getElementById("c-issue").value,
        description:    document.getElementById("c-desc").value.trim(),
        citizenName:    document.getElementById("c-name").value.trim(),
        phoneNumber:    document.getElementById("c-phone").value.trim(),
        source:         "web",
        createdByLabel: "Иргэн",
      });
      form.reset();
      succEl.classList.remove("hidden");
    } catch (err) {
      errEl.textContent = err.message || "Алдаа гарлаа";
      errEl.style.display = "";
    } finally {
      submitBtn.disabled = false;
    }
  });
}
