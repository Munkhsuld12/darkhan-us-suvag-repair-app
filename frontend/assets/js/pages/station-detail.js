import { getStationDetail } from "../api.js";
import { formatDateTime, statusBadge, escapeHtml, el, spinner } from "../utils.js";

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (!id) { window.location.href = "/stations.html"; return; }

  const mainEl = el("station-main");
  mainEl.innerHTML = spinner();

  try {
    const data = await getStationDetail(id);
    const { station, tickets, maintenanceLogs } = data;

    document.title = `Ус түгээх байр ${station.code} — Дархан-Ус Суваг`;

    mainEl.innerHTML = `
      <div class="card" style="margin-bottom:20px">
        <div class="page-header">
          <h1 style="font-size:2.5rem;font-weight:800">${escapeHtml(station.code)}</h1>
          <a href="/stations.html" class="btn btn-secondary btn-sm">← Жагсаалт</a>
        </div>
        <div style="margin-top:16px;display:grid;gap:8px;font-size:14px">
          <p><strong>Баг:</strong> ${station.bagNo}-р баг</p>
          <p><strong>Байршил:</strong> ${escapeHtml(station.location || "—")}</p>
          <p><strong>Хянагч:</strong> ${escapeHtml(station.caretakerName || "—")}</p>
          <p><strong>Хянагчийн утас:</strong> ${escapeHtml(station.caretakerPhone || "—")}</p>
        </div>
      </div>

      <div class="panel-grid panel-grid-2">
        <div class="card section-stack">
          <h2 style="font-size:17px;font-weight:700">Засварын хүсэлт (${tickets.length})</h2>
          <div style="display:flex;flex-direction:column;gap:10px;max-height:400px;overflow-y:auto">
            ${tickets.length ? tickets.map((t) => `
              <div class="item-card">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                  <strong style="font-size:14px">${escapeHtml(t.ticketNo)}</strong>
                  ${statusBadge(t.status)}
                </div>
                <p style="font-size:13px;color:var(--slate-600);margin-top:6px">${escapeHtml(t.issueType)}</p>
                <p style="font-size:12px;color:var(--slate-500);margin-top:4px">${formatDateTime(t.createdAt)}</p>
              </div>
            `).join("") : '<p class="empty-state">Хүсэлт байхгүй</p>'}
          </div>
        </div>

        <div class="card section-stack">
          <h2 style="font-size:17px;font-weight:700">Засварын түүх (${maintenanceLogs.length})</h2>
          <div style="display:flex;flex-direction:column;gap:10px;max-height:400px;overflow-y:auto">
            ${maintenanceLogs.length ? maintenanceLogs.map((m) => `
              <div class="item-card">
                <p style="font-size:13px;font-weight:600">${escapeHtml(m.teamName || "Бригад")}</p>
                <p style="font-size:13px;color:var(--slate-600);margin-top:4px">${escapeHtml(m.description)}</p>
                ${m.materialsUsed ? `<p style="font-size:12px;color:var(--slate-500);margin-top:4px">Материал: ${escapeHtml(m.materialsUsed)}</p>` : ""}
                <p style="font-size:12px;color:var(--slate-500);margin-top:4px">${formatDateTime(m.createdAt)}</p>
              </div>
            `).join("") : '<p class="empty-state">Засварын түүх байхгүй</p>'}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    mainEl.innerHTML = `<p class="empty-state">Алдаа: ${err.message}</p>`;
  }
});
