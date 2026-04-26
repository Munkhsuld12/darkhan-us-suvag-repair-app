export type Role =
  | "admin"
  | "dispatcher"
  | "general_engineer"
  | "department_engineer"
  | "brigade_leader";

export type TicketStatus = "new" | "assigned" | "urgent" | "in_progress" | "done";
export type TicketPriority = "normal" | "urgent";
export type ComplaintSource = "web" | "phone";

export interface Department {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  departmentId: string;
  leaderUserId: string;
}

export interface User {
  id: string;
  fullName: string;
  username: string;
  password: string;
  role: Role;
  departmentId?: string;
  teamId?: string;
  phone: string;
}

export interface WaterStation {
  id: string;
  code: string;
  name: string;
  bagNo: number;
  location: string;
  caretakerName: string;
  caretakerPhone: string;
}

export interface Complaint {
  id: string;
  stationId: string;
  issueType: string;
  description: string;
  citizenName: string;
  phoneNumber: string;
  source: ComplaintSource;
  photoName?: string;
  status: "new" | "converted";
  createdAt: string;
  createdByLabel: string;
}

export interface Ticket {
  id: string;
  complaintId?: string;
  ticketNo: string;
  stationId: string;
  departmentId?: string;
  teamId?: string;
  issueType: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  source: ComplaintSource;
  createdBy: string;
  assignedBy?: string;
  assignedAt?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface TicketLog {
  id: string;
  ticketId: string;
  userId: string;
  action: string;
  note: string;
  loggedAt: string;
}

export interface TicketWorker {
  id: string;
  ticketId: string;
  userId: string;
}

export interface Task {
  id: string;
  stationId: string;
  teamId: string;
  departmentId: string;
  createdBy: string;
  description: string;
  status: Exclude<TicketStatus, "new" | "urgent"> | "assigned";
  taskDate: string;
  startedAt?: string;
  finishedAt?: string;
  workReport?: string;
  createdAt: string;
}

export interface MaintenanceLog {
  id: string;
  ticketId?: string;
  taskId?: string;
  teamId: string;
  description: string;
  materialsUsed: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

export interface AppState {
  departments: Department[];
  teams: Team[];
  users: User[];
  waterStations: WaterStation[];
  complaints: Complaint[];
  tickets: Ticket[];
  ticketLogs: TicketLog[];
  ticketWorkers: TicketWorker[];
  tasks: Task[];
  maintenanceLogs: MaintenanceLog[];
  currentUserId?: string;
}

export interface ComplaintInput {
  stationId: string;
  issueType: string;
  description: string;
  citizenName: string;
  phoneNumber: string;
  source: ComplaintSource;
  photoName?: string;
  createdByLabel: string;
}

export interface TicketInput {
  complaintId?: string;
  stationId: string;
  departmentId?: string;
  teamId?: string;
  issueType: string;
  description: string;
  priority: TicketPriority;
  source: ComplaintSource;
  createdBy: string;
}

export interface AssignTicketInput {
  departmentId: string;
  teamId: string;
  priority: TicketPriority;
  assignedBy: string;
}

export interface TaskInput {
  stationId: string;
  teamId: string;
  departmentId: string;
  createdBy: string;
  description: string;
  taskDate: string;
}

export interface FinishWorkInput {
  reportDescription: string;
  materialsUsed: string;
  workerIds?: string[];
}

export interface LoginResult {
  state: AppState;
  user: User | null;
}