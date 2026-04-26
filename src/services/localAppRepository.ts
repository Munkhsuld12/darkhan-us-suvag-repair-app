import { createSeedState, storageKey } from "../data/seed";
import {
  createId,
  generateTicketNo,
  normalizeLeaderDisplayName,
  sanitizeStationName,
} from "../lib/utils";
import type {
  AppState,
  AssignTicketInput,
  Complaint,
  ComplaintInput,
  Department,
  FinishWorkInput,
  LoginResult,
  MaintenanceLog,
  Task,
  TaskInput,
  Team,
  Ticket,
  TicketInput,
  TicketLog,
  TicketPriority,
  TicketStatus,
  TicketWorker,
  User,
  WaterStation,
} from "../types";
import type { AppRepository } from "./appRepository";

const normalizeLegacyLabel = (value: string) =>
  value.replace(/тасалбар/g, "засварын хүсэлт").replace(/Тасалбар/g, "Засварын хүсэлт");

const normalizeState = (savedState: unknown): AppState => {
  const seed = createSeedState();

  if (!savedState || typeof savedState !== "object") {
    return seed;
  }

  const draft = savedState as Partial<AppState>;

  return {
    departments: Array.isArray(draft.departments) ? draft.departments : seed.departments,
    teams: Array.isArray(draft.teams) ? draft.teams : seed.teams,
    users: Array.isArray(draft.users)
      ? draft.users.map((user) => ({
          ...user,
          fullName:
            user.role === "brigade_leader"
              ? normalizeLeaderDisplayName(user.fullName)
              : user.fullName,
        }))
      : seed.users,
    waterStations: Array.isArray(draft.waterStations)
      ? draft.waterStations.map((station) => ({
          ...station,
          name: sanitizeStationName(station.name),
        }))
      : seed.waterStations,
    complaints: Array.isArray(draft.complaints) ? draft.complaints : seed.complaints,
    tickets: Array.isArray(draft.tickets) ? draft.tickets : seed.tickets,
    ticketLogs: Array.isArray(draft.ticketLogs)
      ? draft.ticketLogs.map((log) => ({
          ...log,
          action: normalizeLegacyLabel(log.action),
          note: normalizeLegacyLabel(log.note),
        }))
      : seed.ticketLogs,
    ticketWorkers: Array.isArray(draft.ticketWorkers) ? draft.ticketWorkers : seed.ticketWorkers,
    tasks: Array.isArray(draft.tasks) ? draft.tasks : seed.tasks,
    maintenanceLogs: Array.isArray(draft.maintenanceLogs)
      ? draft.maintenanceLogs
      : seed.maintenanceLogs,
    currentUserId:
      typeof draft.currentUserId === "string" || draft.currentUserId === undefined
        ? draft.currentUserId
        : undefined,
  };
};

const loadStoredState = (): AppState => {
  const saved = localStorage.getItem(storageKey);
  if (!saved) {
    return createSeedState();
  }

  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    return createSeedState();
  }
};

const saveState = (state: AppState) => {
  localStorage.setItem(storageKey, JSON.stringify(state));
  return state;
};

const withTicketLogs = (
  logs: TicketLog[],
  ticketId: string,
  userId: string,
  action: string,
  note: string,
): TicketLog[] => [
  {
    id: createId("ticket-log"),
    ticketId,
    userId,
    action,
    note,
    loggedAt: new Date().toISOString(),
  },
  ...logs,
];

const buildTicketStatus = (priority: TicketPriority, hasTeam: boolean): TicketStatus => {
  if (priority === "urgent") {
    return "urgent";
  }

  return hasTeam ? "assigned" : "new";
};

const upsertById = <T extends { id: string }>(
  items: T[],
  nextItem: T,
  fallbackPrefix: string,
): T[] => {
  const item = { ...nextItem, id: nextItem.id || createId(fallbackPrefix) } as T;

  if (items.some((entry) => entry.id === item.id)) {
    return items.map((entry) => (entry.id === item.id ? item : entry));
  }

  return [item, ...items];
};

export const createLocalAppRepository = (): AppRepository => {
  const bootstrap = () => loadStoredState();

  const login = (username: string, password: string): LoginResult => {
    const state = loadStoredState();
    const user = state.users.find(
      (item) => item.username === username.trim() && item.password === password,
    );

    if (!user) {
      return { state, user: null };
    }

    const nextState = saveState({ ...state, currentUserId: user.id });
    return { state: nextState, user };
  };

  const logout = () => {
    const state = loadStoredState();
    return saveState({ ...state, currentUserId: undefined });
  };

  const submitComplaint = (input: ComplaintInput) => {
    const state = loadStoredState();

    const complaint: Complaint = {
      id: createId("complaint"),
      stationId: input.stationId,
      issueType: input.issueType,
      description: input.description,
      citizenName: input.citizenName,
      phoneNumber: input.phoneNumber,
      source: input.source,
      photoName: input.photoName,
      status: "new",
      createdAt: new Date().toISOString(),
      createdByLabel: input.createdByLabel,
    };

    return saveState({ ...state, complaints: [complaint, ...state.complaints] });
  };

  const createTicket = (input: TicketInput) => {
    const state = loadStoredState();
    const status = buildTicketStatus(input.priority, Boolean(input.teamId));
    const now = new Date().toISOString();

    const ticket: Ticket = {
      id: createId("ticket"),
      complaintId: input.complaintId,
      ticketNo: generateTicketNo(state.tickets, new Date()),
      stationId: input.stationId,
      departmentId: input.departmentId,
      teamId: input.teamId,
      issueType: input.issueType,
      description: input.description,
      priority: input.priority,
      status,
      source: input.source,
      createdBy: input.createdBy,
      assignedBy: input.teamId ? input.createdBy : undefined,
      assignedAt: input.teamId ? now : undefined,
      createdAt: now,
    };

    let ticketLogs = withTicketLogs(
      state.ticketLogs,
      ticket.id,
      input.createdBy,
      "Засварын хүсэлт үүсгэсэн",
      `${ticket.ticketNo} дугаартай засварын хүсэлт бүртгэлээ.`,
    );

    if (input.teamId && input.departmentId) {
      ticketLogs = withTicketLogs(
        ticketLogs,
        ticket.id,
        input.createdBy,
        "Багт хуваарилсан",
        "Шинэ засварын хүсэлтийг бригад руу хуваарилсан.",
      );
    }

    return saveState({
      ...state,
      complaints: input.complaintId
        ? state.complaints.map((complaint) =>
            complaint.id === input.complaintId ? { ...complaint, status: "converted" } : complaint,
          )
        : state.complaints,
      tickets: [ticket, ...state.tickets],
      ticketLogs,
    });
  };

  const assignTicket = (ticketId: string, assignment: AssignTicketInput) => {
    const state = loadStoredState();
    const now = new Date().toISOString();

    const nextTickets = state.tickets.map((ticket) =>
      ticket.id === ticketId
        ? {
            ...ticket,
            departmentId: assignment.departmentId,
            teamId: assignment.teamId,
            priority: assignment.priority,
            status: buildTicketStatus(assignment.priority, true),
            assignedBy: assignment.assignedBy,
            assignedAt: now,
          }
        : ticket,
    );

    let ticketLogs = withTicketLogs(
      state.ticketLogs,
      ticketId,
      assignment.assignedBy,
      "Хуваарилалт шинэчилсэн",
      "Засварын хүсэлтийн хуваарилалт шинэчлэгдлээ.",
    );

    if (assignment.priority === "urgent") {
      ticketLogs = withTicketLogs(
        ticketLogs,
        ticketId,
        assignment.assignedBy,
        "Яаралтай болгосон",
        "Засварын хүсэлтийг яаралтай ангилалд орууллаа.",
      );
    }

    return saveState({
      ...state,
      tickets: nextTickets,
      ticketLogs,
    });
  };

  const createTask = (input: TaskInput) => {
    const state = loadStoredState();

    const task: Task = {
      id: createId("task"),
      stationId: input.stationId,
      teamId: input.teamId,
      departmentId: input.departmentId,
      createdBy: input.createdBy,
      description: input.description,
      status: "assigned",
      taskDate: input.taskDate,
      createdAt: new Date().toISOString(),
    };

    return saveState({
      ...state,
      tasks: [task, ...state.tasks],
    });
  };

  const startTicket = (ticketId: string, userId: string) => {
    const state = loadStoredState();

    return saveState({
      ...state,
      tickets: state.tickets.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              status: "in_progress",
              startedAt: ticket.startedAt ?? new Date().toISOString(),
            }
          : ticket,
      ),
      ticketLogs: withTicketLogs(
        state.ticketLogs,
        ticketId,
        userId,
        "Ажил эхэлсэн",
        "Ажил эхлүүлэв.",
      ),
    });
  };

  const finishTicket = (ticketId: string, input: FinishWorkInput, userId: string) => {
    const state = loadStoredState();
    const ticket = state.tickets.find((item) => item.id === ticketId);

    if (!ticket || !ticket.teamId) {
      return state;
    }

    const finishedAt = new Date().toISOString();
    const maintenanceLog: MaintenanceLog = {
      id: createId("maintenance"),
      ticketId,
      teamId: ticket.teamId,
      description: input.reportDescription,
      materialsUsed: input.materialsUsed || "Материал тэмдэглээгүй",
      startedAt: ticket.startedAt,
      finishedAt,
      createdAt: finishedAt,
    };

    const ticketWorkers: TicketWorker[] = (input.workerIds ?? []).map((workerId) => ({
      id: createId("ticket-worker"),
      ticketId,
      userId: workerId,
    }));

    return saveState({
      ...state,
      tickets: state.tickets.map((item) =>
        item.id === ticketId
          ? {
              ...item,
              status: "done",
              startedAt: item.startedAt ?? finishedAt,
              finishedAt,
            }
          : item,
      ),
      ticketLogs: withTicketLogs(
        state.ticketLogs,
        ticketId,
        userId,
        "Ажил дууссан",
        input.reportDescription,
      ),
      ticketWorkers: [
        ...state.ticketWorkers.filter((worker) => worker.ticketId !== ticketId),
        ...ticketWorkers,
      ],
      maintenanceLogs: [maintenanceLog, ...state.maintenanceLogs],
    });
  };

  const startTask = (taskId: string) => {
    const state = loadStoredState();

    return saveState({
      ...state,
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: "in_progress",
              startedAt: task.startedAt ?? new Date().toISOString(),
            }
          : task,
      ),
    });
  };

  const finishTask = (taskId: string, input: FinishWorkInput) => {
    const state = loadStoredState();
    const task = state.tasks.find((item) => item.id === taskId);

    if (!task) {
      return state;
    }

    const finishedAt = new Date().toISOString();
    const maintenanceLog: MaintenanceLog = {
      id: createId("maintenance"),
      taskId,
      teamId: task.teamId,
      description: input.reportDescription,
      materialsUsed: input.materialsUsed || "Материал тэмдэглээгүй",
      startedAt: task.startedAt,
      finishedAt,
      createdAt: finishedAt,
    };

    return saveState({
      ...state,
      tasks: state.tasks.map((item) =>
        item.id === taskId
          ? {
              ...item,
              status: "done",
              finishedAt,
              startedAt: item.startedAt ?? finishedAt,
              workReport: input.reportDescription,
            }
          : item,
      ),
      maintenanceLogs: [maintenanceLog, ...state.maintenanceLogs],
    });
  };

  const upsertDepartment = (department: Department) => {
    const state = loadStoredState();
    return saveState({
      ...state,
      departments: upsertById(state.departments, department, "department"),
    });
  };

  const deleteDepartment = (departmentId: string) => {
    const state = loadStoredState();
    return saveState({
      ...state,
      departments: state.departments.filter((department) => department.id !== departmentId),
    });
  };

  const upsertTeam = (team: Team) => {
    const state = loadStoredState();
    return saveState({
      ...state,
      teams: upsertById(state.teams, team, "team"),
    });
  };

  const deleteTeam = (teamId: string) => {
    const state = loadStoredState();
    return saveState({
      ...state,
      teams: state.teams.filter((team) => team.id !== teamId),
    });
  };

  const upsertUser = (user: User) => {
    const state = loadStoredState();
    const normalizedUser: User = {
      ...user,
      fullName:
        user.role === "brigade_leader"
          ? normalizeLeaderDisplayName(user.fullName)
          : user.fullName,
    };

    return saveState({
      ...state,
      users: upsertById(state.users, normalizedUser, "user"),
    });
  };

  const deleteUser = (userId: string) => {
    const state = loadStoredState();
    return saveState({
      ...state,
      users: state.users.filter((user) => user.id !== userId),
      currentUserId: state.currentUserId === userId ? undefined : state.currentUserId,
    });
  };

  const upsertStation = (station: WaterStation) => {
    const state = loadStoredState();
    const normalizedStation: WaterStation = {
      ...station,
      name: sanitizeStationName(station.name),
    };

    return saveState({
      ...state,
      waterStations: upsertById(state.waterStations, normalizedStation, "station"),
    });
  };

  const deleteStation = (stationId: string) => {
    const state = loadStoredState();
    return saveState({
      ...state,
      waterStations: state.waterStations.filter((station) => station.id !== stationId),
    });
  };

  return {
    bootstrap,
    login,
    logout,
    submitComplaint,
    createTicket,
    assignTicket,
    createTask,
    startTicket,
    finishTicket,
    startTask,
    finishTask,
    upsertDepartment,
    deleteDepartment,
    upsertTeam,
    deleteTeam,
    upsertUser,
    deleteUser,
    upsertStation,
    deleteStation,
  };
};