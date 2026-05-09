import * as api from "../api.js";
import { requireAuth } from "../auth.js";
import { setupSidebar } from "../sidebar.js";
import {
  formatDateTime, statusBadge, getStationLabel, todayStr,
  emptyState, escapeHtml, el,
} from "../utils.js";

let state = { tickets: [], tasks: [], users: [], waterStations: [] };
let user = null;
let selectedItem = null;

document.addEventListener("DOMContentLoaded", async () => {
  setupSidebar();
  user = requireAuth();
  if (!user) return;

  await loadAll();
  render();
  setupFinishModal();
});

async function loadAll() {
  const [tickRes, taskRes, metaRes] = await Promise.all([
    api.getTickets().catch(() => ({ tickets: [] })),
    api.getTasks().catch(() => ({ tasks: [] })),
    api.getAdminMeta().catch(() => ({ users: [], stations: [] })),
  ]);
  state.tickets       = tickRes.tickets ?? [];
  state.tasks         = taskRes.tasks ?? [];
  state.users         = metaRes.users ?? [];
  state.waterStations = metaRes.stations ?? [];
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
      status: t.status === "new" ? "assigned" : t.status === "urgent" ? "urgent" : t.status,
    }));

  const taskItems = state.tasks
    .filter((t) => t.teamId === teamId && (t.taskDate === today || t.status !== "done"))
    .map((t) => ({
      id: t.id, type: "task",
      stationId: t.stationId, issue: t.description,
      assignedAt: t.createdAt,
      status: t.status,
    }));

  return [...ticketItems, ...taskItems].sort((a, b) => +new Date(b.assignedAt) - +new Date(a.assignedAt));
}

function render() {
  const items = getItems();
  const inProg  = items.filter((i) => i.status === "in_progress").length;
  const pending = items.filter((i) => i.status !== "done").length;

  el("brig-total").textContent    = items.length;
  el("brig-progress").textContent = inProg;
  el("brig-pending").textContent  = pending;

  const listEl = el("brigade-list");
  if (!items.length) { listEl.innerHTML = emptyState("Өнөөдрийн ажил алга"); return; }

  listEl.innerHTML = items.map((item) => `
    <div class="card card-sm">
      <div style="display:flex;align-items:start;justify-content:space-between;gap:8px">
        <div>
          <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.16em;color:var(--slate-400)">
            ${item.type === "ticket" ? "Засварын хүсэлт" : "Өдөр тутмын ажил"}
          </p>
          <h2 style="font-size:1.75rem;font-weight:800;margin-top:4px">
            ${escapeHtml(getStationLabel(item.stationId, state.waterStations))}
          </h2>
        </div>
        ${statusBadge(item.status)}
      </div>
      <p style="font-size:13px;color:var(--slate-600);margin-top:10px">${escapeHtml(item.issue)}</p>
      <p style="font-size:12px;color:var(--slate-500);margin-top:6px">${escapeHtml(formatDateTime(item.assignedAt))}</p>
      <div style="display:flex;gap:8px;margin-top:12px">
        ${item.status !== "in_progress" && item.status !== "done"
          ? `<button class="btn btn-primary btn-sm" style="flex:1" data-action="start" data-id="${item.id}" data-type="${item.type}">Эхлэх</button>`
          : ""}
        ${item.status === "in_progress"
          ? `<button class="btn btn-secondary btn-sm" style="flex:1" data-action="finish" data-id="${item.id}" data-type="${item.type}">Дуусгах</button>`
          : ""}
      </div>
    </div>
  `).join("");

  listEl.querySelectorAll("[data-action=start]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        if (btn.dataset.type === "ticket") await api.startTicket(btn.dataset.id);
        else await api.startTask(btn.dataset.id);
        await loadAll(); render();
      } catch (err) { alert(err.message); }
    });
  });

  listEl.querySelectorAll("[data-action=finish]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const items2 = getItems();
      selectedItem = items2.find((i) => i.id === btn.dataset.id && i.type === btn.dataset.type) ?? null;
      openFinishModal();
    });
  });
}

function setupFinishModal() {
  // Populate worker checkboxes
  el("finish-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    const report    = el("finish-report").value.trim();
    const materials = el("finish-materials").value.trim();
    if (!report) { alert("Тайлбарыг бичнэ үү"); return; }

    const workerIds = [...document.querySelectorAll(".worker-cb:checked")].map((cb) => cb.value);

    try {
      if (selectedItem.type === "ticket") {
        await api.finishTicket(selectedItem.id, { reportDescription: report, materialsUsed: materials, workerIds });
      } else {
        await api.finishTask(selectedItem.id, { reportDescription: report, materialsUsed: materials });
      }
      closeFinishModal();
      await loadAll(); render();
    } catch (err) { alert(err.message); }
  });

  document.querySelectorAll("[data-close-modal]").forEach((btn) =>
    btn.addEventListener("click", closeFinishModal)
  );
}

function openFinishModal() {
  // Reset form
  el("finish-report").value    = "";
  el("finish-materials").value = "";

  // Worker checkboxes
  const workers = state.users.filter((u) => u.teamId === user.teamId);
  el("workers-list").innerHTML = workers.map((w) => `
    <label class="checkbox-label">
      <input type="checkbox" class="worker-cb" value="${w.id}">
      <span>${escapeHtml(w.fullName)}</span>
    </label>
  `).join("") || "<p style='font-size:13px;color:var(--slate-500)'>Ажилтан байхгүй</p>";

  el("finish-modal").classList.remove("hidden");
}

function closeFinishModal() {
  el("finish-modal").classList.add("hidden");
  selectedItem = null;
}
