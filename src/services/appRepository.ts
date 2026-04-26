import type {
  AppState,
  AssignTicketInput,
  ComplaintInput,
  Department,
  FinishWorkInput,
  LoginResult,
  TaskInput,
  Team,
  TicketInput,
  User,
  WaterStation,
} from "../types";

export interface AppRepository {
  bootstrap(): AppState;
  login(username: string, password: string): LoginResult;
  logout(): AppState;
  submitComplaint(input: ComplaintInput): AppState;
  createTicket(input: TicketInput): AppState;
  assignTicket(ticketId: string, assignment: AssignTicketInput): AppState;
  createTask(input: TaskInput): AppState;
  startTicket(ticketId: string, userId: string): AppState;
  finishTicket(ticketId: string, input: FinishWorkInput, userId: string): AppState;
  startTask(taskId: string): AppState;
  finishTask(taskId: string, input: FinishWorkInput): AppState;
  upsertDepartment(department: Department): AppState;
  deleteDepartment(departmentId: string): AppState;
  upsertTeam(team: Team): AppState;
  deleteTeam(teamId: string): AppState;
  upsertUser(user: User): AppState;
  deleteUser(userId: string): AppState;
  upsertStation(station: WaterStation): AppState;
  deleteStation(stationId: string): AppState;
}