import * as api from "../api.js";
import { requireAuth } from "../auth.js";
import { setupSidebar } from "../sidebar.js";
import { materialOptions } from "../seed.js";
import {
  formatDateTime, statusBadge, getStationLabel, todayStr,
  emptyState, escapeHtml, el,
} from "../utils.js";

let state = { tickets: [], tasks: [], users: [], waterStations: [], workers: [] };
let user = null;
let selectedItem = null;
let editingWorker = null;
let timerInterval = null;
const sessionStart = {}; // id → Date.now() when Эхлэх was pressed this session

document.addEventListener("DOMContentLoaded", async () => {
  setupSidebar();
  user = requireAuth();
  if (!user) return;

  await loadAll();
  render();
  renderDone();
  renderWorkers();
  setupFinishModal();
  setupWorkerModal();
  setupStats();
});

async function loadAll() {
  const [tickRes, taskRes, metaRes, workerRes] = await Promise.all([
    api.getTickets().catch(() => ({ tickets: [] })),
    api.getTasks().catch(() => ({ tasks: [] })),
    api.getAdminMeta().catch(() => ({ users: [], stations: [] })),
    api.getWorkers().catch(() => ({ workers: [] })),
  ]);
  state.tickets       = tickRes.tickets ?? [];
  state.tasks         = taskRes.tasks ?? [];
  state.users         = metaRes.users ?? [];
  state.waterStations = metaRes.stations ?? [];
  state.workers       = workerRes.workers ?? [];
}

function getItems() {
  const today  = todayStr();
  const teamId = user.teamId ?? "";

  const ticketItems = state.tickets
    .filter((t) => t.teamId === teamId && (
      t.status !== "done" ||
      t.createdAt?.slice(0,10) === today ||
      t.assignedAt?.slice(0,10) === today
    ))
    .map((t) => ({
      id: t.id, type: "ticket",
      stationId: t.stationId, issue: t.issueType,
      assignedAt: t.assignedAt ?? t.createdAt,
      startedAt: t.startedAt ?? null,
      status: (t.status === "new" || t.status === "urgent") ? "assigned" : t.status,
      urgent: t.priority === "urgent" || t.status === "urgent",
    }));

  const taskItems = state.tasks
    .filter((t) => t.teamId === teamId && (t.taskDate === today || t.status !== "done"))
    .map((t) => ({
      id: t.id, type: "task",
      stationId: t.stationId, issue: t.description,
      assignedAt: t.createdAt,
      startedAt: t.startedAt ?? null,
      status: t.status,
    }));

  return [...ticketItems, ...taskItems].sort((a, b) => {
    if (b.urgent !== a.urgent) return b.urgent ? 1 : -1;
    return +new Date(b.assignedAt) - +new Date(a.assignedAt);
  });
}

function elapsedStr(startedAt) {
  if (!startedAt) return "";
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 0) return "";
  const totalMins = Math.floor(ms / 60000);
  const days = Math.floor(totalMins / 1440);
  const h    = Math.floor((totalMins % 1440) / 60);
  const m    = totalMins % 60;
  const s    = Math.floor((ms % 60000) / 1000);
  if (days > 0) return `${days} өдөр ${h} цаг`;
  if (h > 0)    return `${h} цаг ${m} мин`;
  if (m > 0)    return `${m} мин ${s} сек`;
  return `${s} сек`;
}

function elapsedFromMs(ms) {
  if (ms < 0) return "";
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h} цаг ${m} мин`;
  if (m > 0) return `${m} мин ${s} сек`;
  return `${s} сек`;
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    document.querySelectorAll("[data-timer-id]").forEach((el2) => {
      const ms = Date.now() - Number(el2.dataset.timerStart);
      el2.textContent = elapsedFromMs(ms);
    });
  }, 1000);
}

function renderCard(item) {
  const sessionT = item.status === "in_progress" ? sessionStart[item.id] : null;
  const timerHtml = sessionT
    ? `<p style="font-size:12px;font-weight:600;color:#f97316;margin-top:6px">
         ⏱ <span data-timer-id="${escapeHtml(item.id)}" data-timer-start="${sessionT}">${elapsedFromMs(Date.now() - sessionT)}</span>
       </p>`
    : "";

  return `
    <div class="card card-sm" style="border-left:3px solid ${item.type === "ticket" ? "#f97316" : "#0ea5e9"}">
      <div style="display:flex;align-items:start;justify-content:space-between;gap:8px">
        <h2 style="font-size:1.5rem;font-weight:800;margin:0">
          ${escapeHtml(getStationLabel(item.stationId, state.waterStations))}
        </h2>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
          ${item.status !== "assigned" ? statusBadge(item.status) : ""}
          ${item.urgent ? `<span class="badge badge-urgent">Яаралтай</span>` : ""}
        </div>
      </div>
      <p style="font-size:13px;color:var(--slate-600);margin-top:8px">${escapeHtml(item.issue)}</p>
      <p style="font-size:12px;color:var(--slate-500);margin-top:4px">${escapeHtml(formatDateTime(item.assignedAt))}</p>
      ${timerHtml}
      <div style="display:flex;gap:8px;margin-top:12px">
        ${item.status !== "in_progress" && item.status !== "done"
          ? `<button class="btn btn-primary btn-sm" style="flex:1" data-action="start" data-id="${item.id}" data-type="${item.type}">Эхлэх</button>`
          : ""}
        ${item.status === "in_progress"
          ? `<button class="btn btn-secondary btn-sm" style="flex:1" data-action="finish" data-id="${item.id}" data-type="${item.type}">Дуусгах</button>`
          : ""}
      </div>
    </div>`;
}

function render() {
  const items   = getItems();
  const tickets = items.filter((i) => i.type === "ticket");
  const tasks   = items.filter((i) => i.type === "task");

  const ticketEl = el("brigade-tickets");
  const taskEl   = el("brigade-tasks");
  const countEl  = (id, n) => { const e = el(id); if (e) e.textContent = n ? `(${n})` : ""; };

  countEl("brigade-ticket-count", tickets.length);
  countEl("brigade-task-count",   tasks.length);

  // Start live timer only for items started in this session
  if (items.some((i) => i.status === "in_progress" && sessionStart[i.id])) startTimer();
  else if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

  ticketEl.innerHTML = tickets.length
    ? tickets.map(renderCard).join("")
    : `<p style="font-size:13px;color:var(--slate-400);padding:12px 4px">Засварын хүсэлт байхгүй</p>`;

  taskEl.innerHTML = tasks.length
    ? tasks.map(renderCard).join("")
    : `<p style="font-size:13px;color:var(--slate-400);padding:12px 4px">Өдөр тутмын ажил байхгүй</p>`;

  [ticketEl, taskEl].forEach((container) => {
    container.querySelectorAll("[data-action=start]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const itemId = btn.dataset.id;
          if (btn.dataset.type === "ticket") await api.startTicket(itemId);
          else await api.startTask(itemId);
          sessionStart[itemId] = Date.now();
          await loadAll(); render(); renderDone();
        } catch (err) { alert(err.message); }
      });
    });

    container.querySelectorAll("[data-action=finish]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const allItems = getItems();
        selectedItem = allItems.find((i) => i.id === btn.dataset.id && i.type === btn.dataset.type) ?? null;
        openFinishModal();
      });
    });
  });
}

// ── Completed work section ──
function durationLabel(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return null;
  const ms = new Date(finishedAt) - new Date(startedAt);
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h} цаг ${m} мин` : `${m} мин`;
}

function openDoneDetail(raw) {
  const s = state.waterStations.find((x) => x.id === raw.stationId);
  const dur = durationLabel(raw.startedAt, raw.finishedAt);
  const color = raw.type === "ticket" ? "#f97316" : "#0ea5e9";
  const typeLabel = raw.type === "ticket" ? "Засварын хүсэлт" : "Өдөр тутмын ажил";

  const row = (label, value) => value
    ? `<div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid var(--slate-100)">
         <span style="font-size:12px;color:var(--slate-500);width:120px;flex-shrink:0">${label}</span>
         <span style="font-size:13px;color:var(--ink-900);font-weight:500">${value}</span>
       </div>` : "";

  el("done-modal-title").textContent = getStationLabel(raw.stationId, state.waterStations);
  el("done-modal-body").innerHTML = `
    <div style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;color:white;background:${color};margin-bottom:12px">${typeLabel}</div>
    ${row("Ус түгээх байр", s ? `${s.code} — ${s.location || ""}` : raw.stationId)}
    ${row("Гэмтлийн төрөл", raw.issueType)}
    ${row("Тайлбар", raw.description)}
    ${raw.ticketNo ? row("Тасалбарын №", raw.ticketNo) : ""}
    ${row("Эхэлсэн", raw.startedAt ? formatDateTime(raw.startedAt) : null)}
    ${row("Дууссан", raw.finishedAt ? formatDateTime(raw.finishedAt) : null)}
    ${raw.workReport ? row("Ажлын тайлан", raw.workReport) : ""}
  `;
  el("done-modal").classList.remove("hidden");
}

function renderDone() {
  const teamId = user.teamId ?? "";
  const doneTickets = state.tickets.filter((t) => t.teamId === teamId && t.status === "done");
  const doneTasks   = state.tasks.filter((t)   => t.teamId === teamId && t.status === "done");

  const all = [
    ...doneTickets.map((t) => ({
      type: "ticket", id: t.id, stationId: t.stationId,
      issueType: t.issueType, description: t.description,
      ticketNo: t.ticketNo, workReport: null,
      startedAt: t.startedAt, finishedAt: t.finishedAt ?? t.createdAt,
    })),
    ...doneTasks.map((t) => ({
      type: "task", id: t.id, stationId: t.stationId,
      issueType: null, description: t.description,
      ticketNo: null, workReport: t.workReport,
      startedAt: t.startedAt, finishedAt: t.finishedAt ?? t.taskDate,
    })),
  ].sort((a, b) => +new Date(b.finishedAt) - +new Date(a.finishedAt));

  const listEl  = el("done-list");
  const countEl = el("done-count");
  if (!listEl) return;
  if (countEl) countEl.textContent = all.length;

  if (!all.length) {
    listEl.innerHTML = `<p style="font-size:13px;color:var(--slate-400);text-align:center;padding:20px 0">Дууссан ажил байхгүй</p>`;
    return;
  }

  listEl.innerHTML = all.map((item) => {
    const color = item.type === "ticket" ? "#f97316" : "#0ea5e9";
    return `
    <div data-done-id="${escapeHtml(item.id)}" data-done-type="${item.type}"
         style="display:flex;align-items:center;gap:12px;padding:10px 8px;border-bottom:1px solid var(--slate-100);cursor:pointer;border-radius:6px;transition:background 0.15s"
         onmouseenter="this.style.background='var(--slate-50)'" onmouseleave="this.style.background=''">
      <span style="width:4px;min-height:36px;border-radius:2px;background:${color};flex-shrink:0;align-self:stretch"></span>
      <div style="flex:1;min-width:0">
        <p style="font-weight:700;font-size:13px;color:var(--ink-900);margin:0">
          ${escapeHtml(getStationLabel(item.stationId, state.waterStations))}
        </p>
        <p style="font-size:12px;color:var(--slate-600);margin:2px 0 0">${escapeHtml(item.issueType || item.description)}</p>
        <p style="font-size:11px;color:var(--slate-400);margin:3px 0 0">${escapeHtml(formatDateTime(item.finishedAt))}</p>
      </div>
      <svg style="color:var(--slate-300);flex-shrink:0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
  }).join("");

  // Click to open detail
  listEl.querySelectorAll("[data-done-id]").forEach((row2) => {
    row2.addEventListener("click", () => {
      const raw = all.find((x) => x.id === row2.dataset.doneId && x.type === row2.dataset.doneType);
      if (raw) openDoneDetail(raw);
    });
  });

  // Close done modal
  el("done-modal-close")?.addEventListener("click", () => el("done-modal").classList.add("hidden"));
  el("done-modal")?.addEventListener("click", (e) => {
    if (e.target === el("done-modal")) el("done-modal").classList.add("hidden");
  });
}

// ── Stats / report section ──
function fmtDuration(ms) {
  if (!ms || ms <= 0) return "—";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} цаг` : `${h} цаг ${m} мин`;
}

function parseWorkerNames(description) {
  const line = (description || "").split("\n").find((l) => l.startsWith("Оролцсон ажилтнууд:"));
  if (!line) return [];
  return line.replace("Оролцсон ажилтнууд:", "").split(",").map((n) => n.trim()).filter(Boolean);
}

async function loadStats() {
  const from      = el("stat-from")?.value || "";
  const to        = el("stat-to")?.value   || "";
  const summaryEl = el("stat-summary");
  const workerEl  = el("stat-workers");
  if (!summaryEl || !workerEl) return;

  summaryEl.innerHTML = `<p style="font-size:13px;color:var(--slate-400)">Уншиж байна…</p>`;
  workerEl.innerHTML  = "";

  try {
    const data = await api.getReports({ dateFrom: from, dateTo: to });
    const logs = data.maintenanceLogs ?? [];

    // Average duration from maintenance logs (most accurate)
    const durations = logs
      .filter((m) => m.startedAt && m.finishedAt)
      .map((m) => new Date(m.finishedAt) - new Date(m.startedAt))
      .filter((d) => d > 0);
    const avgMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    // Worker participation from log descriptions
    const workerMap = {};
    logs.forEach((log) => {
      parseWorkerNames(log.description).forEach((name) => {
        workerMap[name] = (workerMap[name] ?? 0) + 1;
      });
    });

    // Summary cards
    summaryEl.innerHTML = [
      { label: "Дууссан ажил",    value: logs.length,        note: `${from} — ${to}` },
      { label: "Дундаж хугацаа", value: fmtDuration(avgMs), note: "нэг ажлын дундаж" },
    ].map(({ label, value, note }) => `
      <div class="summary-card">
        <p class="label">${label}</p>
        <p class="value">${value}</p>
        <p class="note">${note}</p>
      </div>`).join("");

    // Worker participation table
    const sorted = Object.entries(workerMap).sort((a, b) => b[1] - a[1]);
    workerEl.innerHTML = sorted.length ? `
      <p style="font-size:13px;font-weight:700;color:var(--slate-700);margin:12px 0 8px">Ажилтны оролцоо</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr>
            <th style="text-align:left;padding:7px 10px;background:var(--slate-50);color:var(--slate-500);font-weight:600;border-bottom:1px solid var(--slate-200)">Нэр</th>
            <th style="text-align:right;padding:7px 10px;background:var(--slate-50);color:var(--slate-500);font-weight:600;border-bottom:1px solid var(--slate-200)">Оролцсон ажил</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map(([name, count]) => `
            <tr>
              <td style="padding:7px 10px;border-bottom:1px solid var(--slate-100);color:var(--ink-900)">${escapeHtml(name)}</td>
              <td style="padding:7px 10px;border-bottom:1px solid var(--slate-100);text-align:right;font-weight:700;color:var(--blue-700)">${count}</td>
            </tr>`).join("")}
        </tbody>
      </table>` :
      `<p style="font-size:13px;color:var(--slate-400);text-align:center;padding:16px 0">Тайлант хугацаанд дууссан ажил байхгүй</p>`;

  } catch (err) {
    summaryEl.innerHTML = `<p style="font-size:13px;color:var(--red-600)">Алдаа: ${escapeHtml(err.message)}</p>`;
    workerEl.innerHTML  = "";
  }
}

function setupStats() {
  const today = new Date().toISOString().slice(0, 10);
  const fromEl = el("stat-from");
  const toEl   = el("stat-to");
  if (fromEl) fromEl.value = `${today.slice(0, 7)}-01`;
  if (toEl)   toEl.value   = today;
  el("stat-from")?.addEventListener("change", () => loadStats());
  el("stat-to")?.addEventListener("change",   () => loadStats());
  loadStats();
}

// ── Workers section ──
function renderWorkers() {
  const section = el("workers-section");
  if (!section) return;

  if (!state.workers.length) {
    section.innerHTML = `<p style="font-size:13px;color:var(--slate-500);text-align:center;padding:12px 0">Ажилтан бүртгэлгүй байна</p>`;
    return;
  }

  section.innerHTML = state.workers.map((w) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--slate-100)">
      <div style="width:32px;height:32px;border-radius:50%;background:var(--blue-100);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--blue-700);flex-shrink:0">
        ${escapeHtml(w.fullName.charAt(0))}
      </div>
      <div style="min-width:0;flex:1">
        <p style="margin:0;font-size:13px;font-weight:600;color:var(--ink-900)">${escapeHtml(w.fullName)}</p>
        <p style="margin:0;font-size:12px;color:var(--slate-500)">${escapeHtml([w.position, w.phone].filter(Boolean).join(" · "))}</p>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-secondary btn-sm" data-edit-worker="${escapeHtml(w.id)}">Засах</button>
        <button class="btn btn-danger btn-sm" data-del-worker="${escapeHtml(w.id)}">Устгах</button>
      </div>
    </div>
  `).join("");

  section.querySelectorAll("[data-edit-worker]").forEach((btn) => {
    const w = state.workers.find((x) => x.id === btn.dataset.editWorker);
    btn.addEventListener("click", () => openWorkerModal(w));
  });

  section.querySelectorAll("[data-del-worker]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const w = state.workers.find((x) => x.id === btn.dataset.delWorker);
      if (!confirm(`"${w?.fullName}" ажилтныг устгах уу?`)) return;
      try {
        await api.deleteWorker(btn.dataset.delWorker);
        await loadAll(); render(); renderWorkers();
      } catch (err) { alert(err.message); }
    });
  });
}

function openWorkerModal(worker) {
  editingWorker = worker ?? null;
  el("worker-modal-title").textContent = worker ? "Ажилтан засах" : "Ажилтан нэмэх";
  el("w-fullname").value  = worker?.fullName ?? "";
  el("w-phone").value     = worker?.phone ?? "";
  el("w-position").value  = worker?.position ?? "";
  el("w-notes").value     = worker?.notes ?? "";
  el("worker-modal").classList.remove("hidden");
  el("w-fullname").focus();
}

function closeWorkerModal() {
  el("worker-modal").classList.add("hidden");
  editingWorker = null;
}

function setupWorkerModal() {
  el("add-worker-btn")?.addEventListener("click", () => openWorkerModal(null));
  el("worker-modal-close")?.addEventListener("click", closeWorkerModal);
  el("worker-modal-cancel")?.addEventListener("click", closeWorkerModal);
  el("worker-modal")?.addEventListener("click", (e) => {
    if (e.target === el("worker-modal")) closeWorkerModal();
  });

  el("worker-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      fullName: el("w-fullname").value.trim(),
      phone:    el("w-phone").value.trim(),
      position: el("w-position").value.trim(),
      notes:    el("w-notes").value.trim(),
      teamId:   user.teamId,
    };
    if (!body.fullName) { alert("Нэрийг оруулна уу"); return; }
    try {
      if (editingWorker) await api.updateWorker(editingWorker.id, body);
      else await api.createWorker(body);
      closeWorkerModal();
      await loadAll(); render(); renderWorkers();
    } catch (err) { alert(err.message); }
  });
}

// ── Finish modal ──
function setupFinishModal() {
  el("finish-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    const report = el("finish-report").value.trim();
    const selectedMaterials = [...document.querySelectorAll(".material-cb:checked")]
      .map((cb) => cb.value)
      .filter((v) => v !== "Бусад");
    const otherMaterial = el("finish-materials-other").value.trim();
    if (otherMaterial) selectedMaterials.push(otherMaterial);
    const materials = selectedMaterials.join(", ");
    if (!report) { alert("Тайлбарыг бичнэ үү"); return; }

    // Append selected worker names to the report text
    const selectedWorkers = [...document.querySelectorAll(".worker-cb:checked")]
      .map((cb) => state.workers.find((w) => w.id === cb.value)?.fullName)
      .filter(Boolean);
    const fullReport = selectedWorkers.length
      ? `${report}\nОролцсон ажилтнууд: ${selectedWorkers.join(", ")}`
      : report;

    try {
      if (selectedItem.type === "ticket") {
        await api.finishTicket(selectedItem.id, { reportDescription: fullReport, materialsUsed: materials, workerIds: [] });
      } else {
        await api.finishTask(selectedItem.id, { reportDescription: fullReport, materialsUsed: materials });
      }
      closeFinishModal();
      await loadAll(); render(); renderDone();
    } catch (err) { alert(err.message); }
  });

  document.querySelectorAll("[data-close-modal]").forEach((btn) =>
    btn.addEventListener("click", closeFinishModal)
  );
}

function openFinishModal() {
  el("finish-report").value = "";

  // Render material checkboxes
  const cbWrap = el("material-checkboxes");
  cbWrap.innerHTML = [...materialOptions, "Бусад"].map((m) => `
    <label class="checkbox-label">
      <input type="checkbox" class="material-cb" value="${escapeHtml(m)}">
      <span>${escapeHtml(m)}</span>
    </label>
  `).join("");
  el("material-other-wrap").style.display = "none";
  el("finish-materials-other").value = "";
  cbWrap.querySelector(".material-cb[value='Бусад']")?.addEventListener("change", (e) => {
    el("material-other-wrap").style.display = e.target.checked ? "" : "none";
    if (!e.target.checked) el("finish-materials-other").value = "";
  });

  el("workers-list").innerHTML = state.workers.map((w) => `
    <label class="checkbox-label">
      <input type="checkbox" class="worker-cb" value="${escapeHtml(w.id)}">
      <span>${escapeHtml(w.fullName)}${w.position ? ` <span style="color:var(--slate-400);font-size:11px">(${escapeHtml(w.position)})</span>` : ""}</span>
    </label>
  `).join("") || "<p style='font-size:13px;color:var(--slate-500)'>Ажилтан байхгүй</p>";

  el("finish-modal").classList.remove("hidden");
}

function closeFinishModal() {
  el("finish-modal").classList.add("hidden");
  selectedItem = null;
}
