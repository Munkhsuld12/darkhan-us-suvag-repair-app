// Shared utility functions

export const formatDateTime = (value) => {
  if (!value) return "Тодорхойгүй";
  try {
    return new Intl.DateTimeFormat("mn-MN", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(value));
  } catch { return "Тодорхойгүй"; }
};

export const formatDate = (value) => {
  if (!value) return "Тодорхойгүй";
  try {
    return new Intl.DateTimeFormat("mn-MN", {
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(value));
  } catch { return "Тодорхойгүй"; }
};

export const todayStr = () => new Date().toISOString().slice(0, 10);

export const getStatusMeta = (status) => {
  const map = {
    new:         { label: "Шинэ",        badgeClass: "badge-new" },
    assigned:    { label: "Хуваарилсан", badgeClass: "badge-assigned" },
    urgent:      { label: "Яаралтай",    badgeClass: "badge-urgent" },
    in_progress: { label: "Явцдаа",      badgeClass: "badge-in_progress" },
    done:        { label: "Дууссан",      badgeClass: "badge-done" },
    converted:   { label: "Хөрвүүлсэн",  badgeClass: "badge-converted" },
  };
  return map[status] ?? { label: status, badgeClass: "badge-new" };
};

export const statusBadge = (status) => {
  const { label, badgeClass } = getStatusMeta(status);
  return `<span class="badge ${badgeClass}">${label}</span>`;
};

export const sourceBadge = (source) => {
  const label = source === "web" ? "Вэб" : "Утас";
  const cls = source === "web" ? "badge-web" : "badge-phone";
  return `<span class="badge ${cls}">${label}</span>`;
};

export const priorityLabel = (p) => p === "urgent" ? "Яаралтай" : "Энгийн";

export const roleLabel = (role) => {
  const map = {
    admin: "Админ",
    dispatcher: "Диспетчер",
    general_engineer: "Ерөнхий инженер",
    department_engineer: "Хэлтсийн инженер",
    brigade_leader: "Багийн ахлагч",
  };
  return map[role] ?? role;
};

export const getStationLabel = (stationId, stations) => {
  const s = stations.find((x) => x.id === stationId);
  return s ? s.code : "Тодорхойгүй";
};

export const getStationOptionLabel = (station) => {
  const name = station.name?.trim() ?? "";
  if (name) return `${station.code} - ${name}`;
  if (station.location?.trim()) return `${station.code} - ${station.location.trim()}`;
  return station.code;
};

export const matchesStationSearch = (station, query) => {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  const code = station.code.toLowerCase();
  const loc  = (station.location ?? "").toLowerCase();
  const care = (station.caretakerName ?? "").toLowerCase();
  const name = (station.name ?? "").toLowerCase();
  return code.includes(q) || loc.includes(q) || care.includes(q) || name.includes(q);
};

export const getTeamWorkloadCount = (teamId, tickets, tasks) => {
  const t = tickets.filter((x) => x.teamId === teamId && ["assigned","urgent","in_progress"].includes(x.status)).length;
  const k = tasks.filter((x) => x.teamId === teamId && ["assigned","in_progress"].includes(x.status)).length;
  return t + k;
};

export const getTeamName = (teamId, teams, users) => {
  const team = teams.find((t) => t.id === teamId);
  if (!team) return "Хуваарилагдаагүй";
  const leader = users.find((u) => u.id === team.leaderUserId);
  return leader ? `${team.name} — ${leader.fullName}` : team.name;
};

export const getDeptName = (deptId, departments) =>
  departments.find((d) => d.id === deptId)?.name ?? "Хуваарилагдаагүй";

export const isTaskDelayed = (task) => {
  if (task.status === "done") return false;
  const due = new Date(`${task.taskDate}T23:59:59`).getTime();
  return !isNaN(due) && due < Date.now();
};

// Average hours between two ISO strings
export const avgHours = (start, end) => {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff < 0) return null;
  return diff / 3_600_000;
};

export const formatDuration = (hours) => {
  if (hours === null || !isFinite(hours)) return "-";
  const mins = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} цаг`;
  return `${h}ц ${m}м`;
};

export const buildCountRows = (items, getLabel, limit = 6) => {
  const counts = new Map();
  for (const item of items) {
    const label = getLabel(item)?.trim() || "Тодорхойгүй";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "mn"))
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
};

export const tokenizeMaterials = (val) =>
  val.split(/,|\//)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 &&
      !["материал тэмдэглээгүй","материал ашиглаагүй","материалгүй","-"].includes(p.toLowerCase()));

export const getMaterialRows = (logs, limit = 6) => {
  const map = new Map();
  logs.forEach((log) => {
    tokenizeMaterials(log.materialsUsed ?? "").forEach((token) => {
      const key = token.toLowerCase();
      const cur = map.get(key);
      if (cur) cur.value++;
      else map.set(key, { label: token, value: 1 });
    });
  });
  return [...map.values()]
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "mn"))
    .slice(0, limit);
};

// CSV helpers
const padCsv = (n) => String(n).padStart(2, "0");

export const formatCsvDate = (value, includeTime = false) => {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  const base = `${d.getFullYear()}-${padCsv(d.getMonth()+1)}-${padCsv(d.getDate())}`;
  return includeTime ? `${base} ${padCsv(d.getHours())}:${padCsv(d.getMinutes())}` : base;
};

export const toExcelText = (val) => `="${String(val ?? "").replace(/"/g, '""')}"`;

export const downloadCsv = (fileName, rows) => {
  const content = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
};

export const el = (id) => document.getElementById(id);
export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

export const emptyState = (title = "Мэдээлэл алга") =>
  `<div class="empty-state">${title}</div>`;

export const spinner = () =>
  `<div class="loading-state"><div class="spinner"></div><p style="margin-top:12px;font-size:13px">Ачааллаж байна...</p></div>`;

export const escapeHtml = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
