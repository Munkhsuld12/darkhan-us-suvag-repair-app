import {
  getStations, getTickets, getTasks, getAdminMeta, submitComplaint,
  getEditableComplaint, updateComplaint, login as apiLogin, getStationDetail,
} from "../api.js";
import {
  matchesStationSearch, getStatusMeta, getDeptName, getTeamName,
  getStationOptionLabel, escapeHtml, emptyState, formatDate,
  statusBadge, formatDateTime, spinner,
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
    document.getElementById("station-preview-grid").innerHTML = emptyState("Мэдээлэл ачаалж чадсангүй.");
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

  document.getElementById("sdm-close")?.addEventListener("click", () =>
    document.getElementById("station-detail-modal")?.classList.add("hidden"));
  document.getElementById("station-detail-modal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("station-detail-modal"))
      document.getElementById("station-detail-modal").classList.add("hidden");
  });
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
  if (!preview.length) { gridEl.innerHTML = emptyState("Тохирох ус түгээх байр олдсонгүй."); return; }
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
    <div data-station-id="${station.id}" class="station-card" style="cursor:pointer">
      <div class="station-card-body">
        <div>
          <p class="bag-label">${escapeHtml(String(station.bagNo))}-р баг</p>
          <h3 class="code">${escapeHtml(station.code)}</h3>
        </div>
        <p class="location">${escapeHtml(station.location || "Байршил тодорхойгүй")}</p>
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
    </div>`;
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
        stationLocation: station?.location ?? "Байршил тодорхойгүй",
        teamName:        getTeamName(t.teamId, state.teams, state.users),
        meta:            getStatusMeta(t.status),
      };
    });

  if (badgeEl) { badgeEl.textContent = planned.length; badgeEl.classList.toggle("hidden", !planned.length); }
  if (!planned.length) { listEl.innerHTML = emptyState("Төлөвлөсөн ажил олдсонгүй."); return; }

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
      <p style="font-size:11px;color:var(--slate-500);margin-top:4px"><strong>Гүйцэтгэсэн:</strong> ${escapeHtml(actor)}${m.workerNames ? ` · ${escapeHtml(m.workerNames)}` : ""}</p>
      ${m.materialsUsed ? `<p style="font-size:11px;color:var(--slate-400);margin-top:2px">Материал: ${escapeHtml(m.materialsUsed)}</p>` : ""}
      <p style="font-size:11px;color:var(--slate-400);margin-top:2px">${formatDateTime(m.createdAt)}</p>
    </div>`;
}

// ── Station detail popup ─────────────────────────────────────
async function openStationModal(stationId) {
  const modal = document.getElementById("station-detail-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  document.getElementById("sdm-code").textContent = "…";
  document.getElementById("sdm-location").textContent = "";
  document.getElementById("sdm-info").innerHTML = spinner();
  document.getElementById("sdm-tickets").innerHTML = "";
  document.getElementById("sdm-logs").innerHTML = "";

  try {
    const { station, tickets, maintenanceLogs } = await getStationDetail(stationId);
    document.getElementById("sdm-code").textContent = station.code;
    document.getElementById("sdm-location").textContent = station.location || "—";
    document.getElementById("sdm-info").innerHTML = `
      <p><strong>Баг:</strong> ${station.bagNo}-р баг</p>
      <p><strong>Байршил:</strong> ${escapeHtml(station.location || "—")}</p>
      <p><strong>Хянагч:</strong> ${escapeHtml(station.caretakerName || "—")}</p>
      <p><strong>Хянагчийн утас:</strong> ${escapeHtml(station.caretakerPhone || "—")}</p>
    `;
    document.getElementById("sdm-tickets-title").textContent = `Засварын хүсэлт (${tickets.length})`;
    document.getElementById("sdm-tickets").innerHTML = tickets.length
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
    document.getElementById("sdm-logs-title").textContent = `Засварын түүх (${maintenanceLogs.length})`;
    document.getElementById("sdm-logs").innerHTML = maintenanceLogs.length
      ? maintenanceLogs.map(maintenanceLogHtml).join("")
      : `<p class="empty-state" style="padding:8px">Засварын түүх байхгүй</p>`;
  } catch (err) {
    document.getElementById("sdm-info").innerHTML = `<p style="color:var(--rose-600)">Алдаа: ${escapeHtml(err.message)}</p>`;
  }
}
// Delegation for station card clicks (CSP blocks inline onclick, so use addEventListener)
document.addEventListener("click", (e) => {
  const card = e.target.closest("[data-station-id]");
  if (card) openStationModal(card.dataset.stationId);
});

// ── Login modal ──────────────────────────────────────────────
function setupLoginModal() {
  const modal      = document.getElementById("login-modal");
  const openBtn    = document.getElementById("open-login-btn");
  const closeBtn   = document.getElementById("close-login-btn");
  const form       = document.getElementById("login-modal-form");
  const errEl      = document.getElementById("lm-error");
  const submitBtn  = document.getElementById("lm-submit");
  const forgotForm = document.getElementById("forgot-form");
  const forgotMsg  = document.getElementById("forgot-msg");

  const showLogin  = () => { form.style.display = ""; forgotForm.style.display = "none"; };
  const showForgot = () => { form.style.display = "none"; forgotForm.style.display = ""; forgotMsg.style.display = "none"; };

  const openModal = () => {
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    form.reset();
    errEl.style.display = "none";
    showLogin();
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

  document.getElementById("lm-forgot-link").addEventListener("click", (e) => { e.preventDefault(); showForgot(); });
  document.getElementById("lm-back-link").addEventListener("click",   (e) => { e.preventDefault(); showLogin(); });

  document.getElementById("forgot-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email     = document.getElementById("lm-email").value.trim();
    const btn       = document.getElementById("forgot-submit");
    forgotMsg.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Илгээж байна…";
    try {
      const res  = await fetch("/api/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      forgotMsg.textContent = data.ok
        ? "Нууц үг шинэчлэх холбоос илгээгдлээ."
        : (data.message || "Алдаа гарлаа.");
      forgotMsg.style.cssText = `display:block;color:${data.ok ? "var(--emerald-700)" : "var(--rose-600)"};background:${data.ok ? "var(--emerald-50)" : "var(--rose-50)"};padding:8px 12px;border-radius:6px;font-size:13px`;
    } catch {
      forgotMsg.textContent = "Серверийн алдаа. Дахин оролдоно уу.";
      forgotMsg.style.cssText = "display:block;color:var(--rose-600);font-size:13px";
    } finally {
      btn.disabled = false;
      btn.textContent = "Холбоос илгээх";
    }
  });

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
  const titleEl  = document.querySelector("#complaint-modal h2");
  const lastEditBtn = document.getElementById("last-complaint-edit-btn");
  let editState  = null;

  try {
    const last = JSON.parse(localStorage.getItem("dhs_last_complaint_edit") || "null");
    if (last?.editUrl && lastEditBtn) {
      const editUrl = last.editUrl.replace(`${location.origin}/?editComplaint=`, `${location.origin}/index.html?editComplaint=`);
      lastEditBtn.href = editUrl;
      lastEditBtn.classList.remove("hidden");
    }
  } catch { /* ignore */ }

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
            <span class="station-dropdown-loc">${escapeHtml(s.location || "Байршил тодорхойгүй")}</span>
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
            <span class="station-dropdown-loc">${escapeHtml(s.location || "Байршил тодорхойгүй")}</span>
          </div>`).join("")
      : `<div class="station-dropdown-empty">Тохирох ус түгээх байр олдсонгүй.</div>`;
    attachDropdownHandlers();
    stationDrop.classList.remove("hidden");
  });
  stationInput.addEventListener("blur",  () => setTimeout(() => stationDrop.classList.add("hidden"), 150));
  stationInput.addEventListener("focus", () => {
    if (stationInput.value.trim()) stationInput.dispatchEvent(new Event("input"));
    else showGrouped();
  });

  const openModal = (mode = "create") => {
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    form.reset();
    selectedStation = null;
    editState = mode === "create" ? null : editState;
    titleEl.textContent = mode === "edit" ? "Гомдол, хүсэлт засах" : "Гомдол, хүсэлт илгээх";
    form.querySelector("button[type=submit]").textContent = mode === "edit" ? "Өөрчлөлт хадгалах" : "Илгээх";
    stationDrop.classList.add("hidden");
    errEl.style.display = "none";
    succEl.classList.add("hidden");
    succEl.innerHTML = "Амжилттай илгээгдлээ.";
  };

  const closeModal = () => {
    modal.style.display = "none";
    document.body.style.overflow = "";
  };

  openBtn.addEventListener("click", () => openModal());
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
      const photoFile = document.getElementById("c-photo")?.files?.[0] ?? null;
      const payload = {
        stationId:      station.id,
        issueType:      document.getElementById("c-issue").value,
        description:    document.getElementById("c-desc").value.trim(),
        citizenName:    document.getElementById("c-name").value.trim(),
        phoneNumber:    document.getElementById("c-phone").value.trim(),
        source:         "web",
        createdByLabel: "Иргэн",
      };
      if (editState) {
        await updateComplaint(editState.id, { ...payload, token: editState.token }, photoFile);
        succEl.textContent = "Өөрчлөлт хадгалагдлаа.";
        setTimeout(() => closeModal(), 1200);
      } else {
        const data = await submitComplaint(payload, photoFile);
        const editUrl = `${location.origin}/index.html?editComplaint=${encodeURIComponent(data.id)}&editToken=${encodeURIComponent(data.editToken)}`;
        localStorage.setItem("dhs_last_complaint_edit", JSON.stringify({ id: data.id, token: data.editToken, editUrl }));
        if (lastEditBtn) {
          lastEditBtn.href = editUrl;
          lastEditBtn.classList.remove("hidden");
        }
        succEl.innerHTML = `
          <div>Амжилттай илгээгдлээ.</div>
          <a href="${escapeHtml(editUrl)}" class="btn btn-secondary btn-sm" style="margin-top:8px;display:inline-flex">Хүсэлтээ засах</a>
        `;
        form.reset();
        selectedStation = null;
        stationDrop.classList.add("hidden");
      }
      succEl.classList.remove("hidden");
    } catch (err) {
      errEl.textContent = err.message || "Алдаа гарлаа";
      errEl.style.display = "";
    } finally {
      submitBtn.disabled = false;
    }
  });

  const params = new URLSearchParams(window.location.search);
  const editId = params.get("editComplaint");
  const editToken = params.get("editToken");
  if (editId && editToken) {
    getEditableComplaint(editId, editToken).then(({ complaint }) => {
      editState = { id: editId, token: editToken };
      openModal("edit");
      const station = state.stations.find((s) => s.id === complaint.stationId);
      selectedStation = station ?? null;
      stationInput.value = station?.code ?? complaint.stationCode ?? "";
      document.getElementById("c-issue").value = complaint.issueType ?? "";
      document.getElementById("c-desc").value = complaint.description ?? "";
      document.getElementById("c-name").value = complaint.citizenName ?? "";
      document.getElementById("c-phone").value = complaint.phoneNumber ?? "";
    }).catch((err) => {
      openModal("edit");
      errEl.textContent = err.message || "Засах хүсэлт олдсонгүй";
      errEl.style.display = "";
    });
  } else if (params.get("complaint") === "1") {
    openModal();
  }
}
