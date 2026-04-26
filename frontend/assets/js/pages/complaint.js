import { getStations, submitComplaint } from "../api.js";
import { issueTypeOptions } from "../seed.js";
import { getStationOptionLabel, el } from "../utils.js";

document.addEventListener("DOMContentLoaded", async () => {
  let stations = [];

  // Populate issue types
  const issueSelect = el("issueType");
  issueTypeOptions.forEach((opt) => {
    const o = document.createElement("option");
    o.value = o.textContent = opt;
    issueSelect.appendChild(o);
  });

  // Load stations for datalist
  try {
    const data = await getStations();
    stations = data.stations;
    const dl = el("station-datalist");
    stations.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = getStationOptionLabel(s);
      dl.appendChild(opt);
    });
  } catch { /* ignore */ }

  const form      = el("complaint-form");
  const errEl     = el("complaint-error");
  const successEl = el("complaint-success");
  const stationInput = el("stationQuery");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    successEl.classList.add("hidden");

    const query = stationInput.value.trim().toLowerCase();
    const station = stations.find(
      (s) => s.code.toLowerCase() === query ||
             getStationOptionLabel(s).toLowerCase() === query
    );

    if (!station) {
      errEl.textContent = "Ус түгээх байрыг кодоор оруулна уу (жишээ: 1-5)";
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
