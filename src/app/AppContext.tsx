import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { appRepository } from "../services";
import type {
  AppState,
  AssignTicketInput,
  ComplaintInput,
  Department,
  FinishWorkInput,
  TaskInput,
  Team,
  TicketInput,
  User,
  WaterStation,
} from "../types";

interface AppContextValue extends AppState {
  currentUser?: User;
  login: (username: string, password: string) => User | null;
  logout: () => void;
  refreshState: () => void;
  submitComplaint: (input: ComplaintInput) => void;
  createTicket: (input: TicketInput) => void;
  assignTicket: (ticketId: string, assignment: AssignTicketInput) => void;
  createTask: (input: TaskInput) => void;
  startTicket: (ticketId: string, userId: string) => void;
  finishTicket: (ticketId: string, input: FinishWorkInput, userId: string) => void;
  startTask: (taskId: string) => void;
  finishTask: (taskId: string, input: FinishWorkInput) => void;
  upsertDepartment: (department: Department) => void;
  deleteDepartment: (departmentId: string) => void;
  upsertTeam: (team: Team) => void;
  deleteTeam: (teamId: string) => void;
  upsertUser: (user: User) => void;
  deleteUser: (userId: string) => void;
  upsertStation: (station: WaterStation) => void;
  deleteStation: (stationId: string) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider = ({ children }: PropsWithChildren) => {
  const [state, setState] = useState<AppState>(() => appRepository.bootstrap());

  const refreshState = () => {
    setState(appRepository.bootstrap());
  };

  const currentUser = useMemo(
    () => state.users.find((user) => user.id === state.currentUserId),
    [state.currentUserId, state.users],
  );

  const login = (username: string, password: string) => {
    const result = appRepository.login(username, password);
    setState(result.state);
    return result.user;
  };

  const logout = () => {
    setState(appRepository.logout());
  };

  const submitComplaint = (input: ComplaintInput) => {
    setState(appRepository.submitComplaint(input));
  };

  const createTicket = (input: TicketInput) => {
    setState(appRepository.createTicket(input));
  };

  const assignTicket = (ticketId: string, assignment: AssignTicketInput) => {
    setState(appRepository.assignTicket(ticketId, assignment));
  };

  const createTask = (input: TaskInput) => {
    setState(appRepository.createTask(input));
  };

  const startTicket = (ticketId: string, userId: string) => {
    setState(appRepository.startTicket(ticketId, userId));
  };

  const finishTicket = (ticketId: string, input: FinishWorkInput, userId: string) => {
    setState(appRepository.finishTicket(ticketId, input, userId));
  };

  const startTask = (taskId: string) => {
    setState(appRepository.startTask(taskId));
  };

  const finishTask = (taskId: string, input: FinishWorkInput) => {
    setState(appRepository.finishTask(taskId, input));
  };

  const upsertDepartment = (department: Department) => {
    setState(appRepository.upsertDepartment(department));
  };

  const deleteDepartment = (departmentId: string) => {
    setState(appRepository.deleteDepartment(departmentId));
  };

  const upsertTeam = (team: Team) => {
    setState(appRepository.upsertTeam(team));
  };

  const deleteTeam = (teamId: string) => {
    setState(appRepository.deleteTeam(teamId));
  };

  const upsertUser = (user: User) => {
    setState(appRepository.upsertUser(user));
  };

  const deleteUser = (userId: string) => {
    setState(appRepository.deleteUser(userId));
  };

  const upsertStation = (station: WaterStation) => {
    setState(appRepository.upsertStation(station));
  };

  const deleteStation = (stationId: string) => {
    setState(appRepository.deleteStation(stationId));
  };

  const value = {
    ...state,
    currentUser,
    login,
    logout,
    refreshState,
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
  } satisfies AppContextValue;

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }

  return context;
};