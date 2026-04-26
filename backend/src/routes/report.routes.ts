import { Router } from "express";
import { query } from "../db";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// GET /api/reports/overview
router.get("/overview", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    let ticketFilter = "";
    let taskFilter = "";
    const params: unknown[] = [];

    if (user.role === "brigade_leader" && user.teamId) {
      ticketFilter = " WHERE team_id = $1";
      taskFilter = " WHERE team_id = $1";
      params.push(user.teamId);
    } else if (user.role === "department_engineer" && user.departmentId) {
      ticketFilter = " WHERE department_id = $1";
      taskFilter = " WHERE department_id = $1";
      params.push(user.departmentId);
    }

    const [ticketsRes, tasksRes, complaintsRes, maintenanceRes] = await Promise.all([
      query(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS done FROM tickets${ticketFilter}`, params),
      query(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS done FROM tasks${taskFilter}`, params),
      query("SELECT COUNT(*) AS total FROM complaints", []),
      query("SELECT COUNT(*) AS total FROM maintenance_logs", []),
    ]);

    res.json({
      ok: true,
      overview: {
        totalTickets: Number(ticketsRes.rows[0]?.total ?? 0),
        doneTickets: Number(ticketsRes.rows[0]?.done ?? 0),
        totalTasks: Number(tasksRes.rows[0]?.total ?? 0),
        doneTasks: Number(tasksRes.rows[0]?.done ?? 0),
        totalComplaints: Number(complaintsRes.rows[0]?.total ?? 0),
        totalMaintenanceLogs: Number(maintenanceRes.rows[0]?.total ?? 0),
      },
    });
  } catch (err) {
    console.error("Overview error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

// GET /api/reports — full data for reporting UI
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const { dateFrom, dateTo, stationId, bagNo, departmentId, teamId } = req.query as Record<string, string>;

    // Build role-based filters
    const isBrigade = user.role === "brigade_leader";
    const isDeptEngineer = user.role === "department_engineer";

    // Tickets
    let ticketSql = "SELECT t.*, u.full_name AS created_by_name FROM tickets t LEFT JOIN users u ON u.id = t.created_by WHERE 1=1";
    const ticketParams: unknown[] = [];
    let pi = 1;

    if (isBrigade && user.teamId) {
      ticketSql += ` AND t.team_id = $${pi++}`;
      ticketParams.push(user.teamId);
    } else if (isDeptEngineer && user.departmentId) {
      ticketSql += ` AND t.department_id = $${pi++}`;
      ticketParams.push(user.departmentId);
    }
    if (dateFrom) { ticketSql += ` AND t.created_at >= $${pi++}`; ticketParams.push(dateFrom); }
    if (dateTo)   { ticketSql += ` AND t.created_at <= $${pi++}::date + interval '1 day'`; ticketParams.push(dateTo); }
    if (stationId && stationId !== "all") { ticketSql += ` AND t.station_id = $${pi++}`; ticketParams.push(stationId); }
    if (bagNo && bagNo !== "all") {
      ticketSql += ` AND EXISTS (SELECT 1 FROM water_stations ws WHERE ws.id = t.station_id AND ws.bag_no = $${pi++})`;
      ticketParams.push(Number(bagNo));
    }
    if (departmentId && departmentId !== "all") { ticketSql += ` AND t.department_id = $${pi++}`; ticketParams.push(departmentId); }
    if (teamId && teamId !== "all") { ticketSql += ` AND t.team_id = $${pi++}`; ticketParams.push(teamId); }
    ticketSql += " ORDER BY t.created_at DESC";

    // Tasks
    let taskSql = "SELECT * FROM tasks WHERE 1=1";
    const taskParams: unknown[] = [];
    pi = 1;

    if (isBrigade && user.teamId) {
      taskSql += ` AND team_id = $${pi++}`;
      taskParams.push(user.teamId);
    } else if (isDeptEngineer && user.departmentId) {
      taskSql += ` AND department_id = $${pi++}`;
      taskParams.push(user.departmentId);
    }
    if (dateFrom) { taskSql += ` AND task_date >= $${pi++}`; taskParams.push(dateFrom); }
    if (dateTo)   { taskSql += ` AND task_date <= $${pi++}`; taskParams.push(dateTo); }
    if (stationId && stationId !== "all") { taskSql += ` AND station_id = $${pi++}`; taskParams.push(stationId); }
    if (bagNo && bagNo !== "all") {
      taskSql += ` AND EXISTS (SELECT 1 FROM water_stations ws WHERE ws.id = station_id AND ws.bag_no = $${pi++})`;
      taskParams.push(Number(bagNo));
    }
    if (departmentId && departmentId !== "all") { taskSql += ` AND department_id = $${pi++}`; taskParams.push(departmentId); }
    if (teamId && teamId !== "all") { taskSql += ` AND team_id = $${pi++}`; taskParams.push(teamId); }
    taskSql += " ORDER BY created_at DESC";

    // Complaints (full access only)
    let complaintSql = "SELECT * FROM complaints WHERE 1=1";
    const complaintParams: unknown[] = [];
    pi = 1;
    const hasFullAccess = ["admin", "dispatcher", "general_engineer"].includes(user.role);
    if (!hasFullAccess) {
      complaintSql += " AND 1=0"; // no access
    } else {
      if (dateFrom) { complaintSql += ` AND created_at >= $${pi++}`; complaintParams.push(dateFrom); }
      if (dateTo)   { complaintSql += ` AND created_at <= $${pi++}::date + interval '1 day'`; complaintParams.push(dateTo); }
      if (stationId && stationId !== "all") { complaintSql += ` AND station_id = $${pi++}`; complaintParams.push(stationId); }
      if (bagNo && bagNo !== "all") {
        complaintSql += ` AND EXISTS (SELECT 1 FROM water_stations ws WHERE ws.id = station_id AND ws.bag_no = $${pi++})`;
        complaintParams.push(Number(bagNo));
      }
    }
    complaintSql += " ORDER BY created_at DESC";

    // Maintenance logs
    let mlSql = "SELECT * FROM maintenance_logs WHERE 1=1";
    const mlParams: unknown[] = [];
    pi = 1;

    if (isBrigade && user.teamId) {
      mlSql += ` AND team_id = $${pi++}`;
      mlParams.push(user.teamId);
    } else if (isDeptEngineer && user.departmentId) {
      mlSql += ` AND (EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.department_id = $${pi}) OR EXISTS (SELECT 1 FROM tasks tk WHERE tk.id = task_id AND tk.department_id = $${pi}))`;
      mlParams.push(user.departmentId);
      pi++;
    }
    if (dateFrom) { mlSql += ` AND created_at >= $${pi++}`; mlParams.push(dateFrom); }
    if (dateTo)   { mlSql += ` AND created_at <= $${pi++}::date + interval '1 day'`; mlParams.push(dateTo); }
    if (teamId && teamId !== "all") { mlSql += ` AND team_id = $${pi++}`; mlParams.push(teamId); }
    mlSql += " ORDER BY created_at DESC";

    const [ticketsRes, tasksRes, complaintsRes, mlRes] = await Promise.all([
      query<Record<string, unknown>>(ticketSql, ticketParams),
      query<Record<string, unknown>>(taskSql, taskParams),
      query<Record<string, unknown>>(complaintSql, complaintParams),
      query<Record<string, unknown>>(mlSql, mlParams),
    ]);

    const toTicket = (row: Record<string, unknown>) => ({
      id: row.id, complaintId: row.complaint_id, ticketNo: row.ticket_no,
      stationId: row.station_id, departmentId: row.department_id, teamId: row.team_id,
      issueType: row.issue_type, description: row.description, priority: row.priority,
      status: row.status, source: row.source, createdBy: row.created_by,
      assignedBy: row.assigned_by, assignedAt: row.assigned_at,
      createdAt: row.created_at, startedAt: row.started_at, finishedAt: row.finished_at,
    });

    const toTask = (row: Record<string, unknown>) => ({
      id: row.id, stationId: row.station_id, teamId: row.team_id, departmentId: row.department_id,
      createdBy: row.created_by, description: row.description, status: row.status,
      taskDate: typeof row.task_date === "object" && row.task_date !== null
        ? (row.task_date as Date).toISOString().slice(0, 10) : String(row.task_date).slice(0, 10),
      startedAt: row.started_at, finishedAt: row.finished_at, workReport: row.work_report, createdAt: row.created_at,
    });

    const toComplaint = (row: Record<string, unknown>) => ({
      id: row.id, stationId: row.station_id, issueType: row.issue_type, description: row.description,
      citizenName: row.citizen_name, phoneNumber: row.phone_number, source: row.source,
      status: row.status, createdAt: row.created_at, createdByLabel: row.created_by_label,
    });

    const toMLog = (row: Record<string, unknown>) => ({
      id: row.id, ticketId: row.ticket_id, taskId: row.task_id, teamId: row.team_id,
      description: row.description, materialsUsed: row.materials_used,
      startedAt: row.started_at, finishedAt: row.finished_at, createdAt: row.created_at,
    });

    res.json({
      ok: true,
      tickets: ticketsRes.rows.map(toTicket),
      tasks: tasksRes.rows.map(toTask),
      complaints: complaintsRes.rows.map(toComplaint),
      maintenanceLogs: mlRes.rows.map(toMLog),
    });
  } catch (err) {
    console.error("Reports error:", err);
    res.status(500).json({ ok: false, message: "Серверийн алдаа" });
  }
});

export default router;
