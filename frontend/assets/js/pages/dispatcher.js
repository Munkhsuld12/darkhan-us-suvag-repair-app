import * as api from "../api.js";
import { requireAuth } from "../auth.js";
import { setupSidebar } from "../sidebar.js";
import { issueTypeOptions } from "../seed.js";
import {
  formatDateTime, statusBadge, sourceBadge, getStationLabel,
  getStationOptionLabel, getTeamWorkloadCount, getDeptName, getTeamName,
  emptyState, escapeHtml, el,
} from "../utils.js";

let state = { complaints: [], tickets: [], teams: [], departments: [], users: [], waterStations: [], tasks: [] };

document.addEventListener("DOMContentLoaded", async () => {
  setupSidebar();
  const user = requireAuth();
  if (!user) return;

  await loadAll();
  renderAll();
  setupPhoneForm();
  setupNewTicketBtn();
});

async function loadAll() {
  const [compRes, tickRes, taskRes, metaRes] = await Promise.all([
    api.getComplaints().catch(() => ({ complaints: [] })),
    api.getTickets().catch(() => ({ tickets: [] })),
    api.getTasks().catch(() => ({ tasks: [] })),
    api.getAdminMeta().catch(() => ({ departments: [], teams: [], users: [], stations: [] })),
  ]);
  state.complaints    = compRes.complaints ?? [];
  state.tickets       = tickRes.tickets ?? [];
  state.tasks         = taskRes.tasks ?? [];
  state.departments   = metaRes.departments ?? [];
  state.teams         = metaRes.teams ?? [];
  state.users         = metaRes.users ?? [];
  state.waterStations = metaRes.stations ?? [];
}

function renderAll() {
  renderSummary();
  renderWorkload();
  renderComplaints();
  renderTickets();
}

function renderSummary() {
  const inWeb   = state.complaints.filter((c) => c.status === "new" && c.source === "web").length;
  const inPhone = state.complaints.filter((c) => c.status === "new" && c.source === "phone").length;
  const total   = state.tickets.length;
  const active  = state.tickets.filter((t) => t.status !== "done").length;

  el("sum-web").textContent   = inWeb;
  el("sum-phone").textContent = inPhone;
  el("sum-total").textContent = total;
  el("sum-active").textContent = active;
}

function renderWorkload() {
  const sorted = [...state.teams].sort((a, b) => {
    const diff = getTeamWorkloadCount(b.id, state.tickets, state.tasks) - getTeamWorkloadCount(a.id, state.tickets, state.tasks);
    return diff !== 0 ? diff : a.name.localeCompare(b.name, "mn-MN");
  });

  el("workload-grid").innerHTML = sorted.map((team) => {
    const count  = getTeamWorkloadCount(team.id, state.tickets, state.tasks);
    const leader = state.users.find((u) => u.id === team.leaderUserId)?.fullName ?? "Хуваарилагдаагүй";
    const busy   = count >= 3;
    return `
      <div class="workload-card ${busy ? "busy" : "free"}" style="cursor:pointer" data-team-id="${team.id}">
        <p class="workload-name">${escapeHtml(team.name)}</p>
        <p class="workload-leader">${escapeHtml(leader)}</p>
        <p class="workload-count">${count >= 1 ? `${count} ажил` : "Чөлөөтэй"}</p>
      </div>`;
  }).join("");

  el("workload-grid").querySelectorAll("[data-team-id]").forEach((card) => {
    card.addEventListener("click", () => openTeamDetailModal(card.dataset.teamId));
  });
}

function renderComplaints() {
  const pending = [...state.complaints]
    .filter((c) => c.status === "new")
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const countEl = el("complaints-count");
  if (countEl) { countEl.textContent = pending.length; countEl.style.display = pending.length ? "" : "none"; }
  const listEl = el("complaints-list");
  if (!pending.length) { listEl.innerHTML = emptyState("Шинэ хүсэлт алга"); return; }

  listEl.innerHTML = pending.map((c) => `
    <div class="item-card">
      <div style="display:flex;flex-wrap:wrap;align-items:start;justify-content:space-between;gap:8px">
        <div>
          <p class="item-meta">${sourceBadge(c.source)} · ${escapeHtml(formatDateTime(c.createdAt))}</p>
          <h3 class="item-title">${escapeHtml(getStationLabel(c.stationId, state.waterStations))} · ${escapeHtml(c.issueType)}</h3>
        </div>
        <button class="btn btn-secondary btn-sm" data-action="register-complaint" data-id="${c.id}">Бүртгэх</button>
      </div>
      <p style="font-size:13px;color:var(--slate-600);margin-top:8px">${escapeHtml(c.description)}</p>
      <p style="font-size:12px;color:var(--slate-500);margin-top:6px">${escapeHtml(c.citizenName)} · ${escapeHtml(c.phoneNumber)}</p>
    </div>
  `).join("");

  listEl.querySelectorAll("[data-action=register-complaint]").forEach((btn) => {
    btn.addEventListener("click", () => openTicketModalFromComplaint(btn.dataset.id));
  });
}

function renderTickets() {
  const sorted = [...state.tickets].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const tickCountEl = el("tickets-count");
  if (tickCountEl) { tickCountEl.textContent = sorted.length; tickCountEl.style.display = sorted.length ? "" : "none"; }
  const listEl = el("tickets-list");
  if (!sorted.length) { listEl.innerHTML = emptyState("Засварын хүсэлт алга"); return; }

  listEl.innerHTML = sorted.map((t) => `
    <div class="item-card">
      <div style="display:flex;flex-wrap:wrap;align-items:start;justify-content:space-between;gap:8px">
        <div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <strong style="font-size:14px">${escapeHtml(t.ticketNo)}</strong>
            ${statusBadge(t.status)}
          </div>
          <p style="font-size:13px;color:var(--slate-600);margin-top:4px">${escapeHtml(getStationLabel(t.stationId, state.waterStations))} · ${escapeHtml(t.issueType)}</p>
        </div>
        <button class="btn btn-secondary btn-sm" data-action="assign-ticket" data-id="${t.id}">Хуваарилах</button>
      </div>
      <div style="font-size:12px;color:var(--slate-500);margin-top:8px;display:flex;flex-direction:column;gap:2px">
        <p>${escapeHtml(t.description)}</p>
        <p>${sourceBadge(t.source)} ${escapeHtml(getDeptName(t.departmentId, state.departments))}</p>
        <p>${escapeHtml(formatDateTime(t.createdAt))}</p>
      </div>
    </div>
  `).join("");

  listEl.querySelectorAll("[data-action=assign-ticket]").forEach((btn) => {
    btn.addEventListener("click", () => openAssignModal(btn.dataset.id));
  });
}

// ── Phone form ──
function setupPhoneForm() {
  const form   = el("phone-form");
  const errEl  = el("phone-error");
  const succEl = el("phone-success");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = ""; errEl.style.display = "none";
    succEl.style.display = "none";

    const code = el("phone-station-code").value.trim().toLowerCase();
    const station = state.waterStations.find((s) => s.code.toLowerCase() === code);
    if (!station) { errEl.textContent = "Кодыг зөв оруулна уу."; errEl.style.display = ""; return; }

    const user = JSON.parse(localStorage.getItem("dhs_user") || "{}");
    try {
      await api.submitComplaint({
        stationId: station.id,
        issueType: el("phone-issue").value,
        description: el("phone-desc").value.trim(),
        citizenName: el("phone-name").value.trim(),
        phoneNumber: el("phone-number").value.trim(),
        source: "phone",
        createdByLabel: user.fullName || "Диспетчер",
      });
      form.reset();
      succEl.style.display = "";
      await loadAll(); renderAll();
    } catch (err) {
      errEl.textContent = err.message;
    }
  });

  // Populate issue type options
  const sel = el("phone-issue");
  issueTypeOptions.forEach((opt) => {
    const o = document.createElement("option");
    o.value = o.textContent = opt;
    sel.appendChild(o);
  });
}

// ── New Ticket button ──
function setupNewTicketBtn() {
  el("btn-new-ticket")?.addEventListener("click", () => openTicketModal(null));
}

// ── Ticket modal ──
let currentComplaint = null;
let modalMode = "create"; // "create" | "assign"

function openTicketModalFromComplaint(complaintId) {
  currentComplaint = state.complaints.find((c) => c.id === complaintId) || null;
  modalMode = "create";
  openTicketModal(currentComplaint);
}

function openTicketModal(complaint) {
  modalMode = "create";
  currentComplaint = complaint;

  const modal = el("ticket-modal");
  el("ticket-modal-title").textContent = complaint ? "Хүсэлтээс үүсгэх" : "Шинэ хүсэлт";

  // Pre-fill from complaint
  const stationInput = el("tm-station");
  if (complaint) {
    const s = state.waterStations.find((x) => x.id === complaint.stationId);
    stationInput.value = s ? getStationOptionLabel(s) : "";
    el("tm-issue").value = complaint.issueType;
    el("tm-desc").value  = complaint.description;
    el("tm-source").value = complaint.source;
    el("tm-station-id").value = complaint.stationId;
  } else {
    stationInput.value = "";
    el("tm-station-id").value = "";
    el("tm-issue").value = issueTypeOptions[0];
    el("tm-desc").value  = "";
    el("tm-source").value = "phone";
  }
  el("tm-priority").value = "normal";
  el("tm-dept").value = "";
  updateTeamOptions("tm-team", "tm-dept");

  populateStationDatalist();
  populateDeptSelect("tm-dept");
  populateIssueSelect("tm-issue");

  modal.classList.remove("hidden");
}

function openAssignModal(ticketId) {
  modalMode = "assign";
  const ticket = state.tickets.find((t) => t.id === ticketId);
  if (!ticket) return;

  el("assign-ticket-info").innerHTML = `
    <div class="item-card" style="background:var(--slate-50)">
      <p style="font-weight:600">${escapeHtml(ticket.ticketNo)}</p>
      <p style="font-size:13px;color:var(--slate-500);margin-top:4px">${escapeHtml(ticket.description)}</p>
    </div>`;

  el("am-dept").value = ticket.departmentId || "";
  el("am-priority").value = ticket.priority || "normal";
  updateTeamOptions("am-team", "am-dept");
  el("am-team").value = ticket.teamId || "";

  populateDeptSelect("am-dept");
  el("am-dept").value = ticket.departmentId || "";
  updateTeamOptions("am-team", "am-dept");
  el("am-team").value = ticket.teamId || "";

  el("assign-modal").dataset.ticketId = ticketId;
  el("assign-modal").classList.remove("hidden");
}

function populateStationDatalist() {
  const dl = el("station-datalist");
  dl.innerHTML = state.waterStations.map((s) =>
    `<option value="${escapeHtml(getStationOptionLabel(s))}"></option>`
  ).join("");
}

function populateDeptSelect(deptElId) {
  const sel = el(deptElId);
  const current = sel.value;
  sel.innerHTML = `<option value="">Алба сонгох</option>` +
    state.departments.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join("");
  if (current) sel.value = current;
}

function populateIssueSelect(elId) {
  const sel = el(elId);
  const cur = sel.value;
  sel.innerHTML = issueTypeOptions.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
  if (cur) sel.value = cur; else if (issueTypeOptions.length) sel.value = issueTypeOptions[0];
}

function updateTeamOptions(teamElId, deptElId) {
  const deptId = el(deptElId)?.value ?? "";
  const teamSel = el(teamElId);
  const currentTeam = teamSel.value;

  const filtered = state.teams.filter((t) => !deptId || t.departmentId === deptId);
  const sorted = [...filtered].sort((a, b) => {
    const wa = getTeamWorkloadCount(a.id, state.tickets, state.tasks);
    const wb = getTeamWorkloadCount(b.id, state.tickets, state.tasks);
    return wb - wa || a.name.localeCompare(b.name, "mn-MN");
  });

  teamSel.innerHTML = `<option value="">Засварын бригад сонгох</option>` + sorted.map((t) => {
    const w = getTeamWorkloadCount(t.id, state.tickets, state.tasks);
    const leader = state.users.find((u) => u.id === t.leaderUserId)?.fullName ?? "—";
    const load = w > 0 ? `${w} ажил` : "Чөлөөтэй";
    return `<option value="${t.id}">${escapeHtml(t.name)} — ${escapeHtml(leader)} (${load})</option>`;
  }).join("");
  if (currentTeam) teamSel.value = currentTeam;
}

// Wire up modal interactions
document.addEventListener("DOMContentLoaded", () => {
  // Station input → resolve id
  el("tm-station")?.addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    const s = state.waterStations.find((x) =>
      x.code.toLowerCase() === q || getStationOptionLabel(x).toLowerCase() === q
    );
    el("tm-station-id").value = s?.id ?? "";
  });

  // Dept change → refresh team options
  el("tm-dept")?.addEventListener("change", () => updateTeamOptions("tm-team", "tm-dept"));
  el("am-dept")?.addEventListener("change", () => updateTeamOptions("am-team", "am-dept"));

  // Create ticket form submit
  el("ticket-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const stationId = el("tm-station-id").value;
    if (!stationId) { alert("Ус түгээх байрыг сонгоно уу"); return; }
    const user = JSON.parse(localStorage.getItem("dhs_user") || "{}");
    try {
      await api.createTicket({
        complaintId: currentComplaint?.id,
        stationId,
        departmentId: el("tm-dept").value || undefined,
        teamId: el("tm-team").value || undefined,
        issueType: el("tm-issue").value,
        description: el("tm-desc").value.trim(),
        priority: el("tm-priority").value,
        source: el("tm-source").value,
        createdBy: user.id,
      });
      closeModals();
      await loadAll(); renderAll();
    } catch (err) { alert(err.message); }
  });

  // Assign ticket form submit
  el("assign-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ticketId = el("assign-modal").dataset.ticketId;
    const user = JSON.parse(localStorage.getItem("dhs_user") || "{}");
    try {
      await api.assignTicket(ticketId, {
        departmentId: el("am-dept").value,
        teamId: el("am-team").value,
        priority: el("am-priority").value,
        assignedBy: user.id,
      });
      closeModals();
      await loadAll(); renderAll();
    } catch (err) { alert(err.message); }
  });

  // Close buttons
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", closeModals);
  });
});

function closeModals() {
  el("ticket-modal")?.classList.add("hidden");
  el("assign-modal")?.classList.add("hidden");
  el("team-detail-modal")?.classList.add("hidden");
  currentComplaint = null;
}

function openTeamDetailModal(teamId) {
  const team   = state.teams.find((t) => t.id === teamId);
  if (!team) return;
  const leader = state.users.find((u) => u.id === team.leaderUserId)?.fullName ?? "Ахлагч тогтоогүй";

  const tickets = state.tickets.filter((t) => t.teamId === teamId && t.status !== "done");
  const tasks   = state.tasks.filter((t) => t.teamId === teamId && t.status !== "done");

  el("tdm-title").textContent  = team.name;
  el("tdm-leader").textContent = leader;

  const fmt = (iso) => iso ? new Date(iso).toLocaleString("mn-MN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

  const ticketHtml = tickets.length
    ? tickets.map((t) => `
      <div class="item-card" style="padding:10px 12px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:12px;font-weight:600;color:var(--slate-500)">Засварын хүсэлт</span>
          ${statusBadge(t.status)}
          ${t.priority === "urgent" ? `<span class="badge badge-urgent">Яаралтай</span>` : ""}
        </div>
        <p style="font-weight:600;font-size:14px;margin-top:4px">${escapeHtml(getStationLabel(t.stationId, state.waterStations))} · ${escapeHtml(t.issueType)}</p>
        <p style="font-size:12px;color:var(--slate-500);margin-top:2px">${escapeHtml(t.ticketNo)} · ${fmt(t.assignedAt ?? t.createdAt)}</p>
      </div>`).join("")
    : `<p class="empty-state" style="padding:12px">Засварын хүсэлт байхгүй</p>`;

  const taskHtml = tasks.length
    ? tasks.map((t) => `
      <div class="item-card" style="padding:10px 12px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:12px;font-weight:600;color:var(--slate-500)">Ажлын даалгавар</span>
          ${statusBadge(t.status)}
        </div>
        <p style="font-weight:600;font-size:14px;margin-top:4px">${escapeHtml(getStationLabel(t.stationId, state.waterStations))} · ${escapeHtml(t.description)}</p>
        <p style="font-size:12px;color:var(--slate-500);margin-top:2px">Огноо: ${escapeHtml(t.taskDate)}</p>
      </div>`).join("")
    : `<p class="empty-state" style="padding:12px">Ажлын даалгавар байхгүй</p>`;

  el("tdm-body").innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px">
      <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--slate-400)">Засварын хүсэлт (${tickets.length})</p>
      ${ticketHtml}
      <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--slate-400);margin-top:8px">Ажлын даалгавар (${tasks.length})</p>
      ${taskHtml}
    </div>`;

  el("team-detail-modal").classList.remove("hidden");
}
