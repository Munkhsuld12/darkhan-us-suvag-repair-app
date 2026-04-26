import { useMemo, useState } from "react";
import { useApp } from "../../app/AppContext";
import { SelectInput, TextInput } from "../../components/forms/FormField";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { SummaryCard } from "../../components/ui/SummaryCard";
import {
  averageHoursBetween,
  buildCountRows,
  complaintStatusLabels,
  formatDuration,
  getDepartmentWorkloadRows,
  getMaterialsSummaryRows,
  getPerformanceIssueRows,
  getPerformanceStationRows,
  getReportScope,
  getTeamWorkloadRows,
  isDateInRange,
  isTaskDelayed,
  priorityLabels,
  reportTypeLabels,
  sourceLabels,
  type CountRow,
  type ReportType,
} from "../../lib/reporting";
import {
  compareStationCode,
  formatDate,
  formatDateTime,
  getDepartmentName,
  getStationOptionLabel,
  getStatusMeta,
  getTeamName,
} from "../../lib/utils";

const toDateInputValue = (value = new Date()) => value.toISOString().slice(0, 10);
const reportTypeOptions: ReportType[] = ["complaints", "tickets", "tasks", "maintenance", "performance"];

const toneClasses = {
  slate: "bg-slate-100 text-slate-700",
  blue: "bg-sky-100 text-sky-700",
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  brand: "bg-brand-100 text-brand-700",
} as const;

const InlineBadge = ({ label, tone = "slate" }: { label: string; tone?: keyof typeof toneClasses }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClasses[tone]}`}>
    {label}
  </span>
);

const BreakdownCard = ({
  title,
  rows,
  emptyTitle = "Мэдээлэл алга",
}: {
  title: string;
  rows: CountRow[];
  emptyTitle?: string;
}) => (
  <Card className="flex min-h-[160px] flex-col" padding="sm">
    <div className="border-b border-slate-200 pb-3">
      <h2 className="text-lg font-bold text-ink-900">{title}</h2>
    </div>
    {rows.length === 0 ? (
      <div className="mt-4">
        <EmptyState title={emptyTitle} />
      </div>
    ) : (
      <div className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <div
            key={`${title}-${row.label}`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3"
          >
            <p className="text-sm font-medium text-slate-600">{row.label}</p>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink-900">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    )}
  </Card>
);

const padCsvPart = (value: number) => String(value).padStart(2, "0");

const formatCsvDateValue = (value?: string, includeTime = false) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const datePart = `${date.getFullYear()}-${padCsvPart(date.getMonth() + 1)}-${padCsvPart(date.getDate())}`;
  return includeTime ? `${datePart} ${padCsvPart(date.getHours())}:${padCsvPart(date.getMinutes())}` : datePart;
};

const toExcelText = (value: string) => `="${String(value).replace(/"/g, '""')}"`;

const downloadCsv = (fileName: string, rows: string[][]) => {
  const csvContent = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const ReportsPage = () => {
  const { currentUser, complaints, departments, maintenanceLogs, tasks, teams, tickets, users, waterStations } = useApp();

  const today = toDateInputValue();
  const defaultFrom = `${today.slice(0, 7)}-01`;

  const [reportType, setReportType] = useState<ReportType>("tickets");
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(today);
  const [stationFilter, setStationFilter] = useState("all");
  const [bagFilter, setBagFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [issueTypeFilter, setIssueTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const stationMap = useMemo(() => new Map(waterStations.map((station) => [station.id, station])), [waterStations]);
  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const ticketMap = useMemo(() => new Map(tickets.map((ticket) => [ticket.id, ticket])), [tickets]);
  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  const scope = useMemo(
    () => getReportScope({ currentUser, departments, teams, tickets }),
    [currentUser, departments, teams, tickets],
  );

  const accessibleStations = useMemo(() => {
    if (scope.fullAccess) {
      return [...waterStations].sort(compareStationCode);
    }

    const stationIds = new Set<string>();

    complaints.forEach((complaint) => {
      if (scope.complaintIds.has(complaint.id)) {
        stationIds.add(complaint.stationId);
      }
    });

    tickets.forEach((ticket) => {
      const resolvedDepartmentId = ticket.departmentId ?? (ticket.teamId ? teamMap.get(ticket.teamId)?.departmentId : undefined);
      const withinScope = currentUser?.role === "brigade_leader"
        ? Boolean(ticket.teamId && scope.teamIds.has(ticket.teamId))
        : Boolean(resolvedDepartmentId && scope.departmentIds.has(resolvedDepartmentId));

      if (withinScope) {
        stationIds.add(ticket.stationId);
      }
    });

    tasks.forEach((task) => {
      const withinScope = currentUser?.role === "brigade_leader"
        ? scope.teamIds.has(task.teamId)
        : scope.departmentIds.has(task.departmentId);
      if (withinScope) {
        stationIds.add(task.stationId);
      }
    });

    maintenanceLogs.forEach((log) => {
      const ticket = log.ticketId ? ticketMap.get(log.ticketId) : undefined;
      const task = log.taskId ? taskMap.get(log.taskId) : undefined;
      const stationId = ticket?.stationId ?? task?.stationId;
      const resolvedDepartmentId = ticket?.departmentId ?? task?.departmentId ?? teamMap.get(log.teamId)?.departmentId;
      const withinScope = currentUser?.role === "brigade_leader"
        ? scope.teamIds.has(log.teamId)
        : Boolean(resolvedDepartmentId && scope.departmentIds.has(resolvedDepartmentId));

      if (stationId && withinScope) {
        stationIds.add(stationId);
      }
    });

    return waterStations.filter((station) => stationIds.has(station.id)).sort(compareStationCode);
  }, [complaints, currentUser?.role, maintenanceLogs, scope, taskMap, tasks, teamMap, ticketMap, tickets, waterStations]);

  const bagOptions = useMemo(
    () => [...new Set(accessibleStations.map((station) => station.bagNo))].sort((left, right) => left - right),
    [accessibleStations],
  );

  const departmentOptions = useMemo(
    () =>
      departments
        .filter((department) => scope.departmentIds.has(department.id))
        .sort((left, right) => left.name.localeCompare(right.name, "mn")),
    [departments, scope.departmentIds],
  );

  const selectableTeams = useMemo(
    () =>
      teams
        .filter((team) => scope.teamIds.has(team.id) && (departmentFilter === "all" || team.departmentId === departmentFilter))
        .sort((left, right) => left.name.localeCompare(right.name, "mn")),
    [departmentFilter, scope.teamIds, teams],
  );

  const issueTypeOptions = useMemo(
    () =>
      [...new Set([...complaints.map((complaint) => complaint.issueType), ...tickets.map((ticket) => ticket.issueType)])]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "mn")),
    [complaints, tickets],
  );

  const matchesStation = (stationId?: string) => {
    if (!stationId) {
      return false;
    }

    const station = stationMap.get(stationId);
    if (!station) {
      return false;
    }

    if (stationFilter !== "all" && stationId !== stationFilter) {
      return false;
    }

    if (bagFilter !== "all" && String(station.bagNo) !== bagFilter) {
      return false;
    }

    return true;
  };

  const matchesDepartmentAndTeam = (departmentId?: string, teamId?: string) => {
    const resolvedDepartmentId = departmentId ?? (teamId ? teamMap.get(teamId)?.departmentId : undefined);

    if (departmentFilter !== "all" && resolvedDepartmentId !== departmentFilter) {
      return false;
    }

    if (teamFilter !== "all" && teamId !== teamFilter) {
      return false;
    }

    return true;
  };

  const scopedComplaints = useMemo(
    () => complaints.filter((complaint) => scope.fullAccess || scope.complaintIds.has(complaint.id)),
    [complaints, scope.complaintIds, scope.fullAccess],
  );

  const scopedTickets = useMemo(
    () =>
      tickets.filter((ticket) => {
        if (scope.fullAccess) {
          return true;
        }

        const resolvedDepartmentId = ticket.departmentId ?? (ticket.teamId ? teamMap.get(ticket.teamId)?.departmentId : undefined);
        if (currentUser?.role === "brigade_leader") {
          return Boolean(ticket.teamId && scope.teamIds.has(ticket.teamId));
        }

        return Boolean(resolvedDepartmentId && scope.departmentIds.has(resolvedDepartmentId));
      }),
    [currentUser?.role, scope.departmentIds, scope.fullAccess, scope.teamIds, teamMap, tickets],
  );

  const scopedTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (scope.fullAccess) {
          return true;
        }

        if (currentUser?.role === "brigade_leader") {
          return scope.teamIds.has(task.teamId);
        }

        return scope.departmentIds.has(task.departmentId);
      }),
    [currentUser?.role, scope.departmentIds, scope.fullAccess, scope.teamIds, tasks],
  );

  const scopedMaintenanceLogs = useMemo(
    () =>
      maintenanceLogs.filter((log) => {
        if (scope.fullAccess) {
          return true;
        }

        if (currentUser?.role === "brigade_leader") {
          return scope.teamIds.has(log.teamId);
        }

        const ticket = log.ticketId ? ticketMap.get(log.ticketId) : undefined;
        const task = log.taskId ? taskMap.get(log.taskId) : undefined;
        const resolvedDepartmentId = ticket?.departmentId ?? task?.departmentId ?? teamMap.get(log.teamId)?.departmentId;
        return Boolean(resolvedDepartmentId && scope.departmentIds.has(resolvedDepartmentId));
      }),
    [currentUser?.role, maintenanceLogs, scope.departmentIds, scope.fullAccess, scope.teamIds, taskMap, teamMap, ticketMap],
  );

  const filteredComplaints = useMemo(
    () =>
      scopedComplaints.filter(
        (complaint) =>
          isDateInRange(complaint.createdAt, dateFrom, dateTo) &&
          matchesStation(complaint.stationId) &&
          (statusFilter === "all" || complaint.status === statusFilter) &&
          (issueTypeFilter === "all" || complaint.issueType === issueTypeFilter) &&
          (sourceFilter === "all" || complaint.source === sourceFilter),
      ),
    [dateFrom, dateTo, issueTypeFilter, scopedComplaints, sourceFilter, statusFilter, stationFilter, bagFilter],
  );

  const filteredTickets = useMemo(
    () =>
      scopedTickets.filter(
        (ticket) =>
          isDateInRange(ticket.createdAt, dateFrom, dateTo) &&
          matchesStation(ticket.stationId) &&
          matchesDepartmentAndTeam(ticket.departmentId, ticket.teamId) &&
          (statusFilter === "all" || ticket.status === statusFilter) &&
          (issueTypeFilter === "all" || ticket.issueType === issueTypeFilter) &&
          (sourceFilter === "all" || ticket.source === sourceFilter) &&
          (priorityFilter === "all" || ticket.priority === priorityFilter),
      ),
    [dateFrom, dateTo, departmentFilter, issueTypeFilter, priorityFilter, scopedTickets, sourceFilter, statusFilter, stationFilter, bagFilter, teamFilter],
  );

  const filteredTasks = useMemo(
    () =>
      scopedTasks.filter(
        (task) =>
          isDateInRange(task.taskDate, dateFrom, dateTo) &&
          matchesStation(task.stationId) &&
          matchesDepartmentAndTeam(task.departmentId, task.teamId) &&
          (statusFilter === "all" || task.status === statusFilter),
      ),
    [dateFrom, dateTo, departmentFilter, scopedTasks, statusFilter, stationFilter, bagFilter, teamFilter],
  );

  const filteredMaintenanceLogs = useMemo(
    () =>
      scopedMaintenanceLogs.filter((log) => {
        if (!isDateInRange(log.createdAt, dateFrom, dateTo)) {
          return false;
        }

        const ticket = log.ticketId ? ticketMap.get(log.ticketId) : undefined;
        const task = log.taskId ? taskMap.get(log.taskId) : undefined;
        const stationId = ticket?.stationId ?? task?.stationId;
        const departmentId = ticket?.departmentId ?? task?.departmentId ?? teamMap.get(log.teamId)?.departmentId;

        return matchesStation(stationId) && matchesDepartmentAndTeam(departmentId, log.teamId);
      }),
    [dateFrom, dateTo, departmentFilter, scopedMaintenanceLogs, stationFilter, bagFilter, teamFilter, taskMap, teamMap, ticketMap],
  );

  const openTickets = filteredTickets.filter((ticket) => ticket.status !== "done");
  const completedTickets = filteredTickets.filter((ticket) => ticket.status === "done");
  const activeTasks = filteredTasks.filter((task) => task.status !== "done");
  const completedTasks = filteredTasks.filter((task) => task.status === "done");
  const delayedTasks = filteredTasks.filter((task) => isTaskDelayed(task));

  const ticketAverageHours = useMemo(() => {
    const values = completedTickets
      .map((ticket) => averageHoursBetween(ticket.startedAt ?? ticket.createdAt, ticket.finishedAt))
      .filter((value): value is number => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }, [completedTickets]);

  const taskAverageHours = useMemo(() => {
    const values = completedTasks
      .map((task) => averageHoursBetween(task.startedAt ?? task.createdAt, task.finishedAt))
      .filter((value): value is number => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }, [completedTasks]);

  const performanceAverageHours = useMemo(() => {
    const values = [ticketAverageHours, taskAverageHours].filter((value): value is number => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }, [taskAverageHours, ticketAverageHours]);

  const complaintSourceRows = buildCountRows(filteredComplaints, (complaint) => sourceLabels[complaint.source], 4);
  const complaintIssueRows = buildCountRows(filteredComplaints, (complaint) => complaint.issueType, 6);
  const complaintStationRows = buildCountRows(filteredComplaints, (complaint) => stationMap.get(complaint.stationId)?.code, 6);
  const complaintBagRows = buildCountRows(filteredComplaints, (complaint) => {
    const station = stationMap.get(complaint.stationId);
    return station ? `${station.bagNo}-р баг` : "Тодорхойгүй";
  }, 6);

  const ticketStatusRows = buildCountRows(filteredTickets, (ticket) => getStatusMeta(ticket.status).label, 6);
  const ticketPriorityRows = buildCountRows(filteredTickets, (ticket) => priorityLabels[ticket.priority], 4);
  const ticketDepartmentRows = buildCountRows(
    filteredTickets,
    (ticket) => getDepartmentName(ticket.departmentId ?? (ticket.teamId ? teamMap.get(ticket.teamId)?.departmentId : undefined), departments),
    6,
  );
  const ticketTeamRows = buildCountRows(filteredTickets, (ticket) => getTeamName(ticket.teamId, teams, users), 6);

  const taskStatusRows = buildCountRows(filteredTasks, (task) => getStatusMeta(task.status).label, 6);
  const taskDepartmentRows = buildCountRows(filteredTasks, (task) => getDepartmentName(task.departmentId, departments), 6);
  const taskTeamRows = buildCountRows(filteredTasks, (task) => getTeamName(task.teamId, teams, users), 6);

  const maintenanceTeamRows = buildCountRows(filteredMaintenanceLogs, (log) => getTeamName(log.teamId, teams, users), 6);
  const maintenanceStationRows = buildCountRows(filteredMaintenanceLogs, (log) => {
    const ticket = log.ticketId ? ticketMap.get(log.ticketId) : undefined;
    const task = log.taskId ? taskMap.get(log.taskId) : undefined;
    return stationMap.get(ticket?.stationId ?? task?.stationId ?? "")?.code;
  }, 6);
  const materialRows = getMaterialsSummaryRows(filteredMaintenanceLogs, 6);

  const performanceTeamRows = getTeamWorkloadRows({
    teams: teams.filter((team) => scope.teamIds.has(team.id)),
    tickets: filteredTickets,
    tasks: filteredTasks,
    users,
  }).filter((row) => row.value > 0);
  const performanceDepartmentRows = getDepartmentWorkloadRows({
    departments: departmentOptions,
    tickets: filteredTickets,
    tasks: filteredTasks,
  }).filter((row) => row.value > 0);
  const performanceIssueRows = getPerformanceIssueRows({ tickets: filteredTickets, complaints: filteredComplaints });
  const performanceStationRows = getPerformanceStationRows({
    tickets: filteredTickets,
    complaints: filteredComplaints,
    stationLabel: (stationId) => stationMap.get(stationId)?.code ?? "Тодорхойгүй",
  });

  const summaryCards =
    reportType === "complaints"
      ? [
          { title: "Гомдол", value: filteredComplaints.length, note: `${dateFrom} — ${dateTo}`, tone: "brand" as const },
          { title: "Вэб", value: filteredComplaints.filter((complaint) => complaint.source === "web").length, tone: "blue" as const },
          { title: "Утас", value: filteredComplaints.filter((complaint) => complaint.source === "phone").length, tone: "green" as const },
          { title: "Хөрвүүлсэн", value: filteredComplaints.filter((complaint) => complaint.status === "converted").length, note: `${filteredComplaints.filter((complaint) => complaint.status === "new").length} шинэ`, tone: "amber" as const },
        ]
      : reportType === "tasks"
        ? [
            { title: "Ажил", value: filteredTasks.length, note: `${dateFrom} — ${dateTo}`, tone: "brand" as const },
            { title: "Явц", value: activeTasks.length, tone: "blue" as const },
            { title: "Дууссан", value: completedTasks.length, tone: "green" as const },
            { title: "Хоцорсон", value: delayedTasks.length, tone: "amber" as const },
          ]
        : reportType === "maintenance"
          ? [
              { title: "Лог", value: filteredMaintenanceLogs.length, note: `${dateFrom} — ${dateTo}`, tone: "brand" as const },
              { title: "Байр", value: new Set(maintenanceStationRows.map((row) => row.label)).size, tone: "blue" as const },
              { title: "Бригад", value: new Set(filteredMaintenanceLogs.map((log) => log.teamId)).size, tone: "green" as const },
              { title: "Материал", value: materialRows.reduce((sum, row) => sum + row.value, 0), tone: "amber" as const },
            ]
          : reportType === "performance"
            ? [
                { title: "Дундаж хугацаа", value: formatDuration(performanceAverageHours), note: "Дууссан ажил", tone: "brand" as const },
                { title: "Дууссан", value: completedTickets.length + completedTasks.length, tone: "green" as const },
                { title: "Идэвхтэй", value: openTickets.length + activeTasks.length, tone: "blue" as const },
                { title: "Хоцорсон", value: delayedTasks.length, tone: "amber" as const },
              ]
            : [
                { title: "Хүсэлт", value: filteredTickets.length, note: `${dateFrom} — ${dateTo}`, tone: "brand" as const },
                { title: "Нээлттэй", value: openTickets.length, tone: "blue" as const },
                { title: "Дууссан", value: completedTickets.length, tone: "green" as const },
                { title: "Яаралтай", value: filteredTickets.filter((ticket) => ticket.priority === "urgent" || ticket.status === "urgent").length, tone: "amber" as const },
              ];

  const mainCount =
    reportType === "complaints"
      ? filteredComplaints.length
      : reportType === "tickets"
        ? filteredTickets.length
        : reportType === "tasks"
          ? filteredTasks.length
          : reportType === "maintenance"
            ? filteredMaintenanceLogs.length
            : completedTickets.length + completedTasks.length;

  const breakdownCards =
    reportType === "complaints"
      ? [
          <BreakdownCard key="complaint-source" rows={complaintSourceRows} title="Эх сурвалж" />,
          <BreakdownCard key="complaint-issue" rows={complaintIssueRows} title="Төрлөөр" />,
          <BreakdownCard key="complaint-station" rows={complaintStationRows} title="Байраар" />,
          <BreakdownCard key="complaint-bag" rows={complaintBagRows} title="Багаар" />,
        ]
      : reportType === "tickets"
        ? [
            <BreakdownCard key="ticket-status" rows={ticketStatusRows} title="Төлөвөөр" />,
            <BreakdownCard key="ticket-priority" rows={ticketPriorityRows} title="Яаралтаар" />,
            <BreakdownCard key="ticket-department" rows={ticketDepartmentRows} title="Албаар" />,
            <BreakdownCard key="ticket-team" rows={ticketTeamRows} title="Бригадаар" />,
          ]
        : reportType === "tasks"
          ? [
              <BreakdownCard key="task-status" rows={taskStatusRows} title="Төлөвөөр" />,
              <BreakdownCard key="task-department" rows={taskDepartmentRows} title="Албаар" />,
              <BreakdownCard key="task-team" rows={taskTeamRows} title="Бригадаар" />,
              <BreakdownCard key="task-delay" rows={delayedTasks.length ? [{ label: "Хоцорсон ажил", value: delayedTasks.length }] : []} title="Хоцролт" emptyTitle="Хоцролтгүй" />,
            ]
          : reportType === "maintenance"
            ? [
                <BreakdownCard key="maintenance-team" rows={maintenanceTeamRows} title="Бригадаар" />,
                <BreakdownCard key="maintenance-station" rows={maintenanceStationRows} title="Байраар" />,
                <BreakdownCard key="maintenance-material" rows={materialRows} title="Материал" />,
              ]
            : [
                <BreakdownCard key="performance-team" rows={performanceTeamRows} title="Бригадын ачаалал" />,
                <BreakdownCard key="performance-department" rows={performanceDepartmentRows} title="Албаны ачаалал" />,
                <BreakdownCard key="performance-issue" rows={performanceIssueRows} title="Түгээмэл асуудал" />,
                <BreakdownCard key="performance-station" rows={performanceStationRows} title="Их хүсэлттэй байр" />,
              ];

  const renderMainContent = () => {
    if (reportType === "performance") {
      return (
        <div className="table-shell mt-3 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead>
              <tr className="text-slate-500">
                <th className="px-3 py-3 font-semibold">Үзүүлэлт</th>
                <th className="px-3 py-3 font-semibold">Утга</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { label: "Дундаж засварын хүсэлт", value: formatDuration(ticketAverageHours) },
                { label: "Дундаж өдөр тутмын ажил", value: formatDuration(taskAverageHours) },
                { label: "Нийт дууссан ажил", value: String(completedTickets.length + completedTasks.length) },
                { label: "Идэвхтэй ажил", value: String(openTickets.length + activeTasks.length) },
                { label: "Хоцорсон ажил", value: String(delayedTasks.length) },
                { label: "Засварын лог", value: String(filteredMaintenanceLogs.length) },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="px-3 py-4 font-medium text-ink-900">{row.label}</td>
                  <td className="px-3 py-4 text-slate-600">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (reportType === "complaints") {
      return (
        <div className="table-shell mt-3 scroll-pane xl:overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead><tr className="text-slate-500"><th className="px-3 py-3 font-semibold">Ус түгээх байр</th><th className="px-3 py-3 font-semibold">Төрөл</th><th className="px-3 py-3 font-semibold">Эх сурвалж</th><th className="px-3 py-3 font-semibold">Төлөв</th><th className="px-3 py-3 font-semibold">Огноо</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredComplaints.map((complaint) => {
                const station = stationMap.get(complaint.stationId);
                return (
                  <tr key={complaint.id} className="align-top">
                    <td className="px-3 py-4"><p className="font-semibold text-ink-900">{station?.code ?? "Тодорхойгүй"}</p><p className="mt-1 text-xs text-slate-500">{station?.location ?? "-"}</p></td>
                    <td className="px-3 py-4"><p className="font-semibold text-ink-900">{complaint.issueType}</p><p className="mt-1 text-xs text-slate-500">{complaint.description}</p></td>
                    <td className="px-3 py-4"><InlineBadge label={sourceLabels[complaint.source]} tone={complaint.source === "web" ? "brand" : "blue"} /></td>
                    <td className="px-3 py-4"><InlineBadge label={complaintStatusLabels[complaint.status]} tone={complaint.status === "converted" ? "green" : "slate"} /></td>
                    <td className="px-3 py-4 text-slate-600"><p>{formatDateTime(complaint.createdAt)}</p><p className="mt-1 text-xs text-slate-500">{complaint.citizenName}</p></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    if (reportType === "tasks") {
      return (
        <div className="table-shell mt-3 scroll-pane xl:overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead><tr className="text-slate-500"><th className="px-3 py-3 font-semibold">Ус түгээх байр</th><th className="px-3 py-3 font-semibold">Ажил</th><th className="px-3 py-3 font-semibold">Алба</th><th className="px-3 py-3 font-semibold">Бригад</th><th className="px-3 py-3 font-semibold">Төлөв</th><th className="px-3 py-3 font-semibold">Огноо</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.map((task) => {
                const station = stationMap.get(task.stationId);
                const delayed = isTaskDelayed(task);
                return (
                  <tr key={task.id} className="align-top">
                    <td className="px-3 py-4"><p className="font-semibold text-ink-900">{station?.code ?? "Тодорхойгүй"}</p><p className="mt-1 text-xs text-slate-500">{station?.location ?? "-"}</p></td>
                    <td className="px-3 py-4"><p className="font-semibold text-ink-900">{task.description}</p><p className="mt-1 text-xs text-slate-500">{formatDate(task.taskDate)}</p></td>
                    <td className="px-3 py-4 text-slate-600">{getDepartmentName(task.departmentId, departments)}</td>
                    <td className="px-3 py-4 text-slate-600">{getTeamName(task.teamId, teams, users)}</td>
                    <td className="px-3 py-4"><div className="flex flex-wrap gap-2"><StatusBadge status={task.status} />{delayed ? <InlineBadge label="Хоцорсон" tone="amber" /> : null}</div></td>
                    <td className="px-3 py-4 text-slate-600"><p>{formatDate(task.taskDate)}</p><p className="mt-1 text-xs text-slate-500">{task.finishedAt ? `Дууссан: ${formatDateTime(task.finishedAt)}` : "Дуусаагүй"}</p></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    if (reportType === "maintenance") {
      return (
        <div className="table-shell mt-3 scroll-pane xl:overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead><tr className="text-slate-500"><th className="px-3 py-3 font-semibold">Ус түгээх байр</th><th className="px-3 py-3 font-semibold">Бригад</th><th className="px-3 py-3 font-semibold">Материал</th><th className="px-3 py-3 font-semibold">Тайлбар</th><th className="px-3 py-3 font-semibold">Огноо</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMaintenanceLogs.map((log) => {
                const ticket = log.ticketId ? ticketMap.get(log.ticketId) : undefined;
                const task = log.taskId ? taskMap.get(log.taskId) : undefined;
                const station = stationMap.get(ticket?.stationId ?? task?.stationId ?? "");
                return (
                  <tr key={log.id} className="align-top">
                    <td className="px-3 py-4"><p className="font-semibold text-ink-900">{station?.code ?? "Тодорхойгүй"}</p><p className="mt-1 text-xs text-slate-500">{station?.location ?? "-"}</p></td>
                    <td className="px-3 py-4 text-slate-600">{getTeamName(log.teamId, teams, users)}</td>
                    <td className="px-3 py-4 text-slate-600">{log.materialsUsed || "-"}</td>
                    <td className="px-3 py-4 text-slate-600">{log.description}</td>
                    <td className="px-3 py-4 text-slate-600"><p>{formatDateTime(log.createdAt)}</p><p className="mt-1 text-xs text-slate-500">{log.finishedAt ? `Дууссан: ${formatDateTime(log.finishedAt)}` : "-"}</p></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="table-shell mt-3 scroll-pane xl:overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead><tr className="text-slate-500"><th className="px-3 py-3 font-semibold">Дугаар</th><th className="px-3 py-3 font-semibold">Ус түгээх байр</th><th className="px-3 py-3 font-semibold">Алба</th><th className="px-3 py-3 font-semibold">Бригад</th><th className="px-3 py-3 font-semibold">Төлөв</th><th className="px-3 py-3 font-semibold">Огноо</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTickets.map((ticket) => {
              const station = stationMap.get(ticket.stationId);
              return (
                <tr key={ticket.id} className="align-top">
                  <td className="px-3 py-4"><p className="font-semibold text-ink-900">{ticket.ticketNo}</p><p className="mt-1 text-xs text-slate-500">{ticket.issueType}</p></td>
                  <td className="px-3 py-4"><p className="font-semibold text-ink-900">{station?.code ?? "Тодорхойгүй"}</p><p className="mt-1 text-xs text-slate-500">{station?.bagNo}-р баг</p></td>
                  <td className="px-3 py-4 text-slate-600">{getDepartmentName(ticket.departmentId ?? (ticket.teamId ? teamMap.get(ticket.teamId)?.departmentId : undefined), departments)}</td>
                  <td className="px-3 py-4 text-slate-600">{getTeamName(ticket.teamId, teams, users)}</td>
                  <td className="px-3 py-4"><div className="flex flex-wrap gap-2"><StatusBadge status={ticket.status} />{ticket.priority === "urgent" ? <InlineBadge label="Яаралтай" tone="amber" /> : null}</div></td>
                  <td className="px-3 py-4 text-slate-600"><p>{formatDateTime(ticket.createdAt)}</p><p className="mt-1 text-xs text-slate-500">{ticket.finishedAt ? `Дууссан: ${formatDateTime(ticket.finishedAt)}` : "Нээлттэй"}</p></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const buildCsvRows = () => {
    if (reportType === "complaints") {
      return [["Ус түгээх байр", "Баг", "Төрөл", "Эх сурвалж", "Төлөв", "Огноо", "Иргэн", "Утас", "Тайлбар"], ...filteredComplaints.map((complaint) => {
        const station = stationMap.get(complaint.stationId);
        return [toExcelText(station?.code ?? "Тодорхойгүй"), station ? `${station.bagNo}-р баг` : "-", complaint.issueType, sourceLabels[complaint.source], complaintStatusLabels[complaint.status], toExcelText(formatCsvDateValue(complaint.createdAt, true)), complaint.citizenName, complaint.phoneNumber, complaint.description];
      })];
    }

    if (reportType === "tasks") {
      return [["Ус түгээх байр", "Баг", "Алба", "Бригад", "Төлөв", "Огноо", "Дууссан", "Тайлбар"], ...filteredTasks.map((task) => {
        const station = stationMap.get(task.stationId);
        return [toExcelText(station?.code ?? "Тодорхойгүй"), station ? `${station.bagNo}-р баг` : "-", getDepartmentName(task.departmentId, departments), getTeamName(task.teamId, teams, users), getStatusMeta(task.status).label, toExcelText(formatCsvDateValue(task.taskDate)), task.finishedAt ? toExcelText(formatCsvDateValue(task.finishedAt, true)) : "-", task.description];
      })];
    }

    if (reportType === "maintenance") {
      return [["Ус түгээх байр", "Алба", "Бригад", "Материал", "Огноо", "Тайлбар"], ...filteredMaintenanceLogs.map((log) => {
        const ticket = log.ticketId ? ticketMap.get(log.ticketId) : undefined;
        const task = log.taskId ? taskMap.get(log.taskId) : undefined;
        const station = stationMap.get(ticket?.stationId ?? task?.stationId ?? "");
        const departmentId = ticket?.departmentId ?? task?.departmentId ?? teamMap.get(log.teamId)?.departmentId;
        return [toExcelText(station?.code ?? "Тодорхойгүй"), getDepartmentName(departmentId, departments), getTeamName(log.teamId, teams, users), log.materialsUsed || "-", toExcelText(formatCsvDateValue(log.createdAt, true)), log.description];
      })];
    }

    if (reportType === "performance") {
      return [["Үзүүлэлт", "Утга"], ["Дундаж засварын хүсэлт", formatDuration(ticketAverageHours)], ["Дундаж өдөр тутмын ажил", formatDuration(taskAverageHours)], ["Нийт дууссан ажил", String(completedTickets.length + completedTasks.length)], ["Идэвхтэй ажил", String(openTickets.length + activeTasks.length)], ["Хоцорсон ажил", String(delayedTasks.length)], ["Засварын лог", String(filteredMaintenanceLogs.length)]];
    }

    return [["Дугаар", "Ус түгээх байр", "Баг", "Алба", "Бригад", "Төлөв", "Яаралт", "Эх сурвалж", "Огноо", "Дууссан", "Тайлбар"], ...filteredTickets.map((ticket) => {
      const station = stationMap.get(ticket.stationId);
      return [ticket.ticketNo, toExcelText(station?.code ?? "Тодорхойгүй"), station ? `${station.bagNo}-р баг` : "-", getDepartmentName(ticket.departmentId ?? (ticket.teamId ? teamMap.get(ticket.teamId)?.departmentId : undefined), departments), getTeamName(ticket.teamId, teams, users), getStatusMeta(ticket.status).label, priorityLabels[ticket.priority], sourceLabels[ticket.source], toExcelText(formatCsvDateValue(ticket.createdAt, true)), ticket.finishedAt ? toExcelText(formatCsvDateValue(ticket.finishedAt, true)) : "-", `${ticket.issueType} / ${ticket.description}`];
    })];
  };

  const handleReset = () => {
    setDateFrom(defaultFrom); setDateTo(today); setStationFilter("all"); setBagFilter("all"); setDepartmentFilter("all"); setTeamFilter("all"); setStatusFilter("all"); setIssueTypeFilter("all"); setSourceFilter("all"); setPriorityFilter("all");
  };

  const showDepartmentFilter = !["brigade_leader", "department_engineer"].includes(currentUser?.role ?? "");
  const showTeamFilter = currentUser?.role !== "brigade_leader";
  const showStatusFilter = reportType === "complaints" || reportType === "tickets" || reportType === "tasks";
  const showIssueTypeFilter = reportType === "complaints" || reportType === "tickets";
  const showSourceFilter = reportType === "complaints" || reportType === "tickets";
  const showPriorityFilter = reportType === "tickets";

  return (
    <div className="app-page">
      <PageHeader action={<div className="flex flex-wrap gap-2"><Button onClick={() => downloadCsv(`${reportTypeLabels[reportType]}-${dateFrom}-${dateTo}.csv`, buildCsvRows())} size="sm" type="button" variant="secondary">CSV татах</Button><Button onClick={() => window.print()} size="sm" type="button">Хэвлэх</Button></div>} title="Тайлан" />
      <Card padding="sm"><div className="flex flex-wrap gap-2">{reportTypeOptions.map((type) => <Button key={type} onClick={() => setReportType(type)} size="sm" type="button" variant={reportType === type ? "primary" : "secondary"}>{reportTypeLabels[type]}</Button>)}</div></Card>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{summaryCards.map((card) => <SummaryCard key={card.title} note={card.note} title={card.title} tone={card.tone} value={card.value} />)}</div>
      <Card className="section-stack" padding="sm"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl font-bold text-ink-900">Шүүлтүүр</h2><Button onClick={handleReset} size="sm" type="button" variant="ghost">Цэвэрлэх</Button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><TextInput label="Эхлэх огноо" onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} /><TextInput label="Дуусах огноо" onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} /><SelectInput label="Баг" onChange={(event) => setBagFilter(event.target.value)} value={bagFilter}><option value="all">Бүх баг</option>{bagOptions.map((bagNo) => <option key={bagNo} value={bagNo}>{bagNo}-р баг</option>)}</SelectInput><SelectInput label="Ус түгээх байр" onChange={(event) => setStationFilter(event.target.value)} value={stationFilter}><option value="all">Бүх байр</option>{accessibleStations.map((station) => <option key={station.id} value={station.id}>{getStationOptionLabel(station)}</option>)}</SelectInput>{showDepartmentFilter ? <SelectInput label="Алба" onChange={(event) => { setDepartmentFilter(event.target.value); setTeamFilter("all"); }} value={departmentFilter}><option value="all">Бүх алба</option>{departmentOptions.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</SelectInput> : <TextInput disabled label="Алба" value={getDepartmentName(scope.departmentIds.values().next().value, departments)} />}{showTeamFilter ? <SelectInput label="Бригад" onChange={(event) => setTeamFilter(event.target.value)} value={teamFilter}><option value="all">Бүх бригад</option>{selectableTeams.map((team) => <option key={team.id} value={team.id}>{getTeamName(team.id, teams, users)}</option>)}</SelectInput> : <TextInput disabled label="Бригад" value={getTeamName(currentUser?.teamId, teams, users)} />}{showStatusFilter ? <SelectInput label="Төлөв" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option value="all">Бүх төлөв</option>{reportType === "complaints" ? <><option value="new">Шинэ</option><option value="converted">Хөрвүүлсэн</option></> : reportType === "tasks" ? <><option value="assigned">Хуваарилсан</option><option value="in_progress">Явцдаа</option><option value="done">Дууссан</option></> : <><option value="new">Шинэ</option><option value="assigned">Хуваарилсан</option><option value="urgent">Яаралтай</option><option value="in_progress">Явцдаа</option><option value="done">Дууссан</option></>}</SelectInput> : null}{showIssueTypeFilter ? <SelectInput label="Төрөл" onChange={(event) => setIssueTypeFilter(event.target.value)} value={issueTypeFilter}><option value="all">Бүх төрөл</option>{issueTypeOptions.map((issueType) => <option key={issueType} value={issueType}>{issueType}</option>)}</SelectInput> : null}{showSourceFilter ? <SelectInput label="Эх сурвалж" onChange={(event) => setSourceFilter(event.target.value)} value={sourceFilter}><option value="all">Бүгд</option><option value="web">Вэб</option><option value="phone">Утас</option></SelectInput> : null}{showPriorityFilter ? <SelectInput label="Яаралт" onChange={(event) => setPriorityFilter(event.target.value)} value={priorityFilter}><option value="all">Бүгд</option><option value="normal">Энгийн</option><option value="urgent">Яаралтай</option></SelectInput> : null}</div></Card>
      <div className="panel-grid xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"><Card className="flex min-h-[360px] flex-col" padding="sm"><div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3"><h2 className="text-xl font-bold text-ink-900">{reportTypeLabels[reportType]}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{mainCount}</span></div>{mainCount === 0 ? <div className="mt-4"><EmptyState title="Тайлан хоосон" /></div> : renderMainContent()}</Card><div className="section-stack">{breakdownCards}</div></div>
    </div>
  );
};
