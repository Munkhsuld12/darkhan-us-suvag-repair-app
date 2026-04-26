// API client — all fetch calls to the backend

import { getToken, clearSession } from "./auth.js";

const BASE = "";   // same-origin; backend serves frontend at /

const headers = (extra = {}) => {
  const h = { "Content-Type": "application/json", ...extra };
  const token = getToken();
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
};

const PUBLIC_PAGES = ["/", "/index.html", "/stations.html", "/station.html", "/complaint.html"];
const isPublicPage = () => PUBLIC_PAGES.some((p) => window.location.pathname === p || window.location.pathname === "");

const handle = async (res) => {
  if (res.status === 401) {
    clearSession();
    if (!isPublicPage()) window.location.href = "/login.html";
    throw new Error("Нэвтрэх шаардлагатай");
  }
  const data = await res.json();
  if (!data.ok && !res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  return data;
};

const get  = (url)       => fetch(BASE + url, { headers: headers() }).then(handle);
const post = (url, body) => fetch(BASE + url, { method: "POST",  headers: headers(), body: JSON.stringify(body) }).then(handle);
const put  = (url, body) => fetch(BASE + url, { method: "PUT",   headers: headers(), body: JSON.stringify(body) }).then(handle);
const patch = (url, body) => fetch(BASE + url, { method: "PATCH", headers: headers(), body: JSON.stringify(body) }).then(handle);
const del  = (url)       => fetch(BASE + url, { method: "DELETE", headers: headers() }).then(handle);

// ── Auth ──
export const login = (username, password) => post("/api/auth/login", { username, password });
export const getMe = () => get("/api/auth/me");

// ── Complaints ──
export const getComplaints = () => get("/api/complaints");
export const submitComplaint = (body) => post("/api/complaints", body);

// ── Tickets ──
export const getTickets = () => get("/api/tickets");
export const createTicket = (body) => post("/api/tickets", body);
export const assignTicket = (id, body) => patch(`/api/tickets/${id}/assign`, body);
export const startTicket  = (id) => patch(`/api/tickets/${id}/start`, {});
export const finishTicket = (id, body) => patch(`/api/tickets/${id}/finish`, body);

// ── Tasks ──
export const getTasks = () => get("/api/tasks");
export const createTask = (body) => post("/api/tasks", body);
export const startTask  = (id) => patch(`/api/tasks/${id}/start`, {});
export const finishTask = (id, body) => patch(`/api/tasks/${id}/finish`, body);

// ── Reports ──
export const getReports = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return get(`/api/reports${q ? "?" + q : ""}`);
};
export const getOverview = () => get("/api/reports/overview");

// ── Meta (all authenticated internal users) ──
export const getAdminMeta = () => get("/api/meta");

// ── Admin only ──
export const upsertDepartment = (body) => post("/api/admin/departments", body);
export const updateDepartment = (id, body) => put(`/api/admin/departments/${id}`, body);
export const deleteDepartment = (id) => del(`/api/admin/departments/${id}`);
export const upsertTeam = (body) => post("/api/admin/teams", body);
export const updateTeam = (id, body) => put(`/api/admin/teams/${id}`, body);
export const deleteTeam = (id) => del(`/api/admin/teams/${id}`);
export const upsertUser = (body) => post("/api/admin/users", body);
export const updateUser = (id, body) => put(`/api/admin/users/${id}`, body);
export const deleteUser = (id) => del(`/api/admin/users/${id}`);
export const upsertStation = (body) => post("/api/admin/stations", body);
export const updateStation = (id, body) => put(`/api/admin/stations/${id}`, body);
export const deleteStation = (id) => del(`/api/admin/stations/${id}`);

// ── Public Stations ──
export const getStations = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return get(`/api/stations${q ? "?" + q : ""}`);
};
export const getStationDetail = (id) => get(`/api/stations/${id}`);
