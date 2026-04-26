import type { Complaint, Department, MaintenanceLog, Task, Team, Ticket, User } from "../types";
import { getDepartmentName, getTeamName } from "./utils";

export type ReportType = "complaints" | "tickets" | "tasks" | "maintenance" | "performance";

export interface CountRow {
  label: string;
  value: number;
}

export interface ReportScope {
  fullAccess: boolean;
  departmentIds: Set<string>;
  teamIds: Set<string>;
  complaintIds: Set<string>;
}

const broadRoles = new Set<string>(["admin", "dispatcher", "general_engineer"]);

const normalizeLabel = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : "Тодорхойгүй";
};

export const reportTypeLabels: Record<ReportType, string> = {
  complaints: "Гомдол",
  tickets: "Засварын хүсэлт",
  tasks: "Өдөр тутмын ажил",
  maintenance: "Засварын түүх",
  performance: "Гүйцэтгэлийн тойм",
};

export const sourceLabels: Record<Complaint["source"], string> = {
  web: "Вэб",
  phone: "Утас",
};

export const complaintStatusLabels: Record<Complaint["status"], string> = {
  new: "Шинэ",
  converted: "Хөрвүүлсэн",
};

export const priorityLabels: Record<Ticket["priority"], string> = {
  normal: "Энгийн",
  urgent: "Яаралтай",
};

export const isDateInRange = (value: string | undefined, dateFrom: string, dateTo: string) => {
  if (!value) {
    return false;
  }

  const normalized = value.slice(0, 10);
  return normalized >= dateFrom && normalized <= dateTo;
};

export const buildCountRows = <T>(
  items: T[],
  getLabel: (item: T) => string | undefined | null,
  limit = 6,
): CountRow[] => {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const label = normalizeLabel(getLabel(item));
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0], "mn");
    })
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
};

export const averageHoursBetween = (start?: string, end?: string) => {
  if (!start || !end) {
    return null;
  }

  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) {
    return null;
  }

  return (endTime - startTime) / 3_600_000;
};

export const formatDuration = (hours: number | null) => {
  if (hours === null || !Number.isFinite(hours)) {
    return "-";
  }

  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (wholeHours === 0) {
    return `${minutes} мин`;
  }

  if (minutes === 0) {
    return `${wholeHours} цаг`;
  }

  return `${wholeHours}ц ${minutes}м`;
};

export const isTaskDelayed = (task: Task, now = new Date()) => {
  if (task.status === "done") {
    return false;
  }

  const dueAt = new Date(`${task.taskDate}T23:59:59`).getTime();
  return !Number.isNaN(dueAt) && dueAt < now.getTime();
};

export const tokenizeMaterials = (value: string) =>
  value
    .split(/,|\//)
    .map((part) => part.trim())
    .filter(
      (part) =>
        part.length > 0 &&
        !["материал тэмдэглээгүй", "материал ашиглаагүй", "материалгүй", "-"]
          .includes(part.toLowerCase()),
    );

export const getTeamWorkloadRows = ({
  teams,
  tickets,
  tasks,
  users,
  limit = 6,
}: {
  teams: Team[];
  tickets: Ticket[];
  tasks: Task[];
  users: User[];
  limit?: number;
}) =>
  teams
    .map((team) => ({
      label: getTeamName(team.id, teams, users),
      value:
        tickets.filter((ticket) => ticket.teamId === team.id && ticket.status !== "done").length +
        tasks.filter((task) => task.teamId === team.id && task.status !== "done").length,
    }))
    .sort((left, right) => {
      if (right.value !== left.value) {
        return right.value - left.value;
      }

      return left.label.localeCompare(right.label, "mn");
    })
    .slice(0, limit);

export const getDepartmentWorkloadRows = ({
  departments,
  tickets,
  tasks,
}: {
  departments: Department[];
  tickets: Ticket[];
  tasks: Task[];
}) =>
  departments
    .map((department) => ({
      label: department.name,
      value:
        tickets.filter(
          (ticket) => ticket.departmentId === department.id && ticket.status !== "done",
        ).length +
        tasks.filter((task) => task.departmentId === department.id && task.status !== "done").length,
    }))
    .sort((left, right) => {
      if (right.value !== left.value) {
        return right.value - left.value;
      }

      return left.label.localeCompare(right.label, "mn");
    });

export const getReportScope = ({
  currentUser,
  departments,
  teams,
  tickets,
}: {
  currentUser?: User;
  departments: Department[];
  teams: Team[];
  tickets: Ticket[];
}): ReportScope => {
  if (!currentUser) {
    return {
      fullAccess: false,
      departmentIds: new Set<string>(),
      teamIds: new Set<string>(),
      complaintIds: new Set<string>(),
    };
  }

  if (broadRoles.has(currentUser.role)) {
    return {
      fullAccess: true,
      departmentIds: new Set(departments.map((department) => department.id)),
      teamIds: new Set(teams.map((team) => team.id)),
      complaintIds: new Set(
        tickets.map((ticket) => ticket.complaintId).filter((complaintId): complaintId is string => Boolean(complaintId)),
      ),
    };
  }

  if (currentUser.role === "department_engineer") {
    const departmentId = currentUser.departmentId ?? "";
    const departmentIds = new Set<string>(departmentId ? [departmentId] : []);
    const teamIds = new Set(
      teams.filter((team) => team.departmentId === departmentId).map((team) => team.id),
    );
    const complaintIds = new Set(
      tickets
        .filter((ticket) => {
          const resolvedDepartmentId =
            ticket.departmentId ?? (ticket.teamId ? teams.find((team) => team.id === ticket.teamId)?.departmentId : undefined);
          return resolvedDepartmentId === departmentId;
        })
        .map((ticket) => ticket.complaintId)
        .filter((complaintId): complaintId is string => Boolean(complaintId)),
    );

    return {
      fullAccess: false,
      departmentIds,
      teamIds,
      complaintIds,
    };
  }

  const teamId = currentUser.teamId ?? "";
  const team = teams.find((item) => item.id === teamId);
  const departmentId = team?.departmentId ?? currentUser.departmentId ?? "";

  return {
    fullAccess: false,
    departmentIds: new Set<string>(departmentId ? [departmentId] : []),
    teamIds: new Set<string>(teamId ? [teamId] : []),
    complaintIds: new Set(
      tickets
        .filter((ticket) => ticket.teamId === teamId)
        .map((ticket) => ticket.complaintId)
        .filter((complaintId): complaintId is string => Boolean(complaintId)),
    ),
  };
};

export const getPerformanceIssueRows = ({
  tickets,
  complaints,
}: {
  tickets: Ticket[];
  complaints: Complaint[];
}) =>
  buildCountRows(
    [...tickets.map((ticket) => ({ issueType: ticket.issueType })), ...complaints.map((complaint) => ({ issueType: complaint.issueType }))],
    (item) => item.issueType,
  );

export const getPerformanceStationRows = ({
  tickets,
  complaints,
  stationLabel,
}: {
  tickets: Ticket[];
  complaints: Complaint[];
  stationLabel: (stationId: string) => string;
}) =>
  buildCountRows(
    [
      ...tickets.map((ticket) => ({ stationId: ticket.stationId })),
      ...complaints.map((complaint) => ({ stationId: complaint.stationId })),
    ],
    (item) => stationLabel(item.stationId),
  );

export const getMaterialsSummaryRows = (logs: MaintenanceLog[], limit = 6) => {
  const materialMap = new Map<string, { label: string; value: number }>();

  logs.forEach((log) => {
    tokenizeMaterials(log.materialsUsed).forEach((token) => {
      const key = token.toLowerCase();
      const current = materialMap.get(key);
      if (current) {
        current.value += 1;
        return;
      }

      materialMap.set(key, { label: token, value: 1 });
    });
  });

  return [...materialMap.values()]
    .sort((left, right) => {
      if (right.value !== left.value) {
        return right.value - left.value;
      }

      return left.label.localeCompare(right.label, "mn");
    })
    .slice(0, limit);
};

export const getMaintenanceDepartmentName = ({
  departmentId,
  teamId,
  departments,
  teams,
}: {
  departmentId?: string;
  teamId?: string;
  departments: Department[];
  teams: Team[];
}) => {
  const resolvedDepartmentId = departmentId ?? (teamId ? teams.find((team) => team.id === teamId)?.departmentId : undefined);
  return getDepartmentName(resolvedDepartmentId, departments);
};
