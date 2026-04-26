import type {
  Department,
  Role,
  Task,
  Team,
  Ticket,
  TicketStatus,
  User,
  WaterStation,
} from "../types";

const normalizeSearchValue = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

const normalizeStationCodeQuery = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\d]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const normalizeDigitsOnly = (value: string) => value.replace(/\D+/g, "");

const parseStationCode = (code: string) => {
  const [bag = "0", number = "0"] = code.split("-");
  return {
    bagNo: Number(bag) || 0,
    stationNo: Number(number) || 0,
  };
};

export const formatDateTime = (value?: string) => {
  if (!value) {
    return "Тодорхойгүй";
  }

  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export const formatDate = (value?: string) => {
  if (!value) {
    return "Тодорхойгүй";
  }

  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
};

export const filterStationsByBag = (stations: WaterStation[], bagNo?: number) => {
  if (!bagNo) {
    return stations;
  }

  return stations.filter((station) => station.bagNo === bagNo);
};

export const compareStationCode = (left: WaterStation, right: WaterStation) => {
  const leftCode = parseStationCode(left.code);
  const rightCode = parseStationCode(right.code);

  if (leftCode.bagNo !== rightCode.bagNo) {
    return leftCode.bagNo - rightCode.bagNo;
  }

  if (leftCode.stationNo !== rightCode.stationNo) {
    return leftCode.stationNo - rightCode.stationNo;
  }

  return left.code.localeCompare(right.code);
};

export const sortStationsByCode = <T extends WaterStation>(stations: T[]) =>
  [...stations].sort(compareStationCode);

const generatedStationNamePattern = /^\d+-р багийн ус түгээх байр \d+$/u;
const brigadeLeaderSuffixPattern = /\s+ахлагч$/u;

export const sanitizeStationName = (name: string) => {
  const normalized = name.trim();
  return generatedStationNamePattern.test(normalized) ? "" : normalized;
};

export const normalizeLeaderDisplayName = (name: string) =>
  name.trim().replace(brigadeLeaderSuffixPattern, "");

export const getStationOptionLabel = (station: WaterStation) => {
  const name = sanitizeStationName(station.name);

  if (name) {
    return `${station.code} - ${name}`;
  }

  if (station.location.trim()) {
    return `${station.code} - ${station.location.trim()}`;
  }

  return station.code;
};

export const matchesStationSearch = (station: WaterStation, query: string) => {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) {
    return true;
  }

  const normalizedCodeQuery = normalizeStationCodeQuery(query);
  const digitQuery = normalizeDigitsOnly(query);
  const code = station.code.toLowerCase();
  const compactCode = normalizeDigitsOnly(station.code);
  const name = normalizeSearchValue(sanitizeStationName(station.name));
  const location = normalizeSearchValue(station.location);
  const caretakerName = normalizeSearchValue(station.caretakerName);

  if (
    (normalizedCodeQuery &&
      (code === normalizedCodeQuery ||
        code.startsWith(normalizedCodeQuery) ||
        code.includes(normalizedCodeQuery))) ||
    (digitQuery && (compactCode.startsWith(digitQuery) || compactCode.includes(digitQuery)))
  ) {
    return true;
  }

  return (
    name.includes(normalizedQuery) ||
    location.includes(normalizedQuery) ||
    caretakerName.includes(normalizedQuery)
  );
};

export const getStationSearchScore = (station: WaterStation, query: string) => {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) {
    return 0;
  }

  const normalizedCodeQuery = normalizeStationCodeQuery(query);
  const digitQuery = normalizeDigitsOnly(query);
  const code = station.code.toLowerCase();
  const compactCode = normalizeDigitsOnly(station.code);
  const name = normalizeSearchValue(sanitizeStationName(station.name));
  const location = normalizeSearchValue(station.location);
  const caretakerName = normalizeSearchValue(station.caretakerName);
  const bagValue = String(station.bagNo);

  if (normalizedCodeQuery && code === normalizedCodeQuery) {
    return 0;
  }

  if (digitQuery && bagValue === digitQuery) {
    return 1;
  }

  if (normalizedCodeQuery && code.startsWith(normalizedCodeQuery)) {
    return 2;
  }

  if (digitQuery && compactCode.startsWith(digitQuery)) {
    return 3;
  }

  if (
    (normalizedCodeQuery && code.includes(normalizedCodeQuery)) ||
    (digitQuery && compactCode.includes(digitQuery))
  ) {
    return 4;
  }

  if (name.includes(normalizedQuery)) {
    return 5;
  }

  if (location.includes(normalizedQuery)) {
    return 6;
  }

  if (caretakerName.includes(normalizedQuery)) {
    return 7;
  }

  return 99;
};

export const getRoleRedirectPath = (role: Role) => {
  switch (role) {
    case "dispatcher":
      return "/dispatcher";
    case "general_engineer":
    case "department_engineer":
      return "/engineer";
    case "brigade_leader":
      return "/brigade";
    case "admin":
      return "/admin";
    default:
      return "/";
  }
};

export const getStatusMeta = (status: TicketStatus) => {
  const statusMap = {
    new: {
      label: "Шинэ",
      badgeClass: "bg-slate-100 text-slate-700",
      barClass: "bg-slate-400",
    },
    assigned: {
      label: "Хуваарилсан",
      badgeClass: "bg-amber-100 text-amber-700",
      barClass: "bg-amber-500",
    },
    urgent: {
      label: "Яаралтай",
      badgeClass: "bg-rose-100 text-rose-700",
      barClass: "bg-rose-500",
    },
    in_progress: {
      label: "Явцдаа",
      badgeClass: "bg-sky-100 text-sky-700",
      barClass: "bg-sky-500",
    },
    done: {
      label: "Дууссан",
      badgeClass: "bg-emerald-100 text-emerald-700",
      barClass: "bg-emerald-500",
    },
  } as const;

  return statusMap[status];
};

export const getTeamWorkloadCount = (teamId: string, tickets: Ticket[], tasks: Task[]) => {
  const activeTicketCount = tickets.filter(
    (ticket) =>
      ticket.teamId === teamId &&
      ["assigned", "urgent", "in_progress"].includes(ticket.status),
  ).length;

  const activeTaskCount = tasks.filter(
    (task) => task.teamId === teamId && ["assigned", "in_progress"].includes(task.status),
  ).length;

  return activeTicketCount + activeTaskCount;
};

export const generateTicketNo = (tickets: Ticket[], now = new Date()) => {
  const datePart = [
    now.getFullYear(),
    `${now.getMonth() + 1}`.padStart(2, "0"),
    `${now.getDate()}`.padStart(2, "0"),
  ].join("");

  const todayCount = tickets.filter((ticket) => ticket.ticketNo.includes(datePart)).length + 1;
  return `TKT-${datePart}-${String(todayCount).padStart(3, "0")}`;
};

export const createId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export const getStationOpenTicket = (stationId: string, tickets: Ticket[]) =>
  tickets
    .filter((ticket) => ticket.stationId === stationId && ticket.status !== "done")
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];

export const getStationLatestActivity = (stationId: string, tickets: Ticket[]) =>
  tickets
    .filter((ticket) => ticket.stationId === stationId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];

export const getDepartmentName = (departmentId: string | undefined, departments: Department[]) =>
  departments.find((department) => department.id === departmentId)?.name ?? "Хуваарилагдаагүй";

export const getTeamName = (teamId: string | undefined, teams: Team[], users: User[]) => {
  if (!teamId) {
    return "Хуваарилагдаагүй";
  }

  const team = teams.find((item) => item.id === teamId);
  if (!team) {
    return "Хуваарилагдаагүй";
  }

  const leader = users.find((user) => user.id === team.leaderUserId);
  return leader ? `${team.name} — ${normalizeLeaderDisplayName(leader.fullName)}` : team.name;
};

export const getStationLabel = (stationId: string, stations: WaterStation[]) =>
  stations.find((station) => station.id === stationId)?.code ?? "Тодорхойгүй";

export const isInternalRole = (role?: Role) =>
  Boolean(
    role &&
      ["admin", "dispatcher", "general_engineer", "department_engineer", "brigade_leader"].includes(
        role,
      ),
  );





