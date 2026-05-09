import { getStations, submitComplaint } from "../api.js";
import { issueTypeOptions } from "../seed.js";
import { escapeHtml, el } from "../utils.js";

document.addEventListener("DOMContentLoaded", async () => {
  let stations = [];
  let selectedStation = null;

  // Populate issue types
  const issueSelect = el("issueType");
  issueTypeOptions.forEach((opt) => {
    const o = document.createElement("option");
    o.value = o.textContent = opt;
    issueSelect.appendChild(o);
  });

  // Load stations
  try {
    const data = await getStations();
    stations = data.stations;
  } catch { /* ignore */ }

  const form         = el("complaint-form");
  const errEl        = el("complaint-error");
  const successEl    = el("complaint-success");
  const stationInput = el("stationQuery");
  const stationDrop  = el("station-dropdown");

  const attachHandlers = () => {
    stationDrop.querySelectorAll(".station-dropdown-item").forEach((item) => {
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectedStation = stations.find((x) => x.id === item.dataset.id);
        stationInput.value = selectedStation.code;
        stationDrop.classList.add("hidden");
      });
    });
  };

  const showGrouped = () => {
    const bags = [...new Set(stations.map((s) => s.bagNo))].sort((a, b) => a - b);
    stationDrop.innerHTML = bags.map((bag) => {
      const list = stations
        .filter((s) => s.bagNo === bag)
        .sort((a, b) => Number(a.code.split("-")[1]) - Number(b.code.split("-")[1]));
      return `<div class="station-dropdown-group">${bag}-р баг</div>` +
        list.map((s) => `
          <div class="station-dropdown-item" data-id="${escapeHtml(s.id)}">
            <span class="station-dropdown-code">${escapeHtml(s.code)}</span>
            <span class="station-dropdown-loc">${escapeHtml(s.location || "Байршил оруулаагүй")}</span>
          </div>`).join("");
    }).join("");
    attachHandlers();
    stationDrop.classList.remove("hidden");
  };

  stationInput.addEventListener("input", () => {
    selectedStation = null;
    const q = stationInput.value.trim().toLowerCase();
    if (!q) { showGrouped(); return; }
    const matches = stations
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
    attachHandlers();
    stationDrop.classList.remove("hidden");
  });
  stationInput.addEventListener("blur",  () => setTimeout(() => stationDrop.classList.add("hidden"), 150));
  stationInput.addEventListener("focus", () => {
    if (stationInput.value.trim()) stationInput.dispatchEvent(new Event("input"));
    else showGrouped();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    successEl.classList.add("hidden");

    const station = selectedStation ||
      stations.find((s) => s.code.toLowerCase() === stationInput.value.trim().toLowerCase());

    if (!station) {
      errEl.textContent = "Жагсаалтаас ус түгээх байр сонгоно уу";
      stationInput.focus();
      return;
    }

    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;

    try {
      await submitComplaint({
        stationId: station.id,
        issueType: el("issueType").value,
        description: el("description").value.trim(),
        citizenName: el("citizenName").value.trim(),
        phoneNumber: el("phoneNumber").value.trim(),
        source: "web",
        createdByLabel: "Иргэн",
      });

      form.reset();
      stationInput.value = "";
      successEl.classList.remove("hidden");
    } catch (err) {
      errEl.textContent = err.message || "Алдаа гарлаа. Дахин оролдоно уу.";
    } finally {
      btn.disabled = false;
    }
  });
});
