import { useMemo, useState, type FormEvent } from "react";
import { useApp } from "../../app/AppContext";
import { SelectInput, TextInput, TextareaInput } from "../../components/forms/FormField";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { InternalMobileMenuAction } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDate, formatDateTime, getStationLabel, getStationOptionLabel, getTeamName } from "../../lib/utils";

export const EngineerDashboardPage = () => {
  const { currentUser, tasks, teams, departments, waterStations, users, createTask } = useApp();

  const accessibleDepartmentIds =
    currentUser?.role === "general_engineer"
      ? departments.map((department) => department.id)
      : currentUser?.departmentId
        ? [currentUser.departmentId]
        : [];

  const [departmentFilter, setDepartmentFilter] = useState(
    currentUser?.role === "general_engineer" ? "all" : currentUser?.departmentId ?? "",
  );
  const [taskDepartmentId, setTaskDepartmentId] = useState(
    currentUser?.role === "general_engineer" ? accessibleDepartmentIds[0] ?? "" : currentUser?.departmentId ?? "",
  );
  const [taskTeamId, setTaskTeamId] = useState("");
  const [taskStationId, setTaskStationId] = useState("");
  const [taskStationQuery, setTaskStationQuery] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDate, setTaskDate] = useState(new Date().toISOString().slice(0, 10));

  const stationOptions = useMemo(
    () =>
      waterStations.map((station) => ({
        id: station.id,
        code: station.code,
        label: getStationOptionLabel(station),
      })),
    [waterStations],
  );

  const resolveStationOption = (query: string) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }

    return stationOptions.find(
      (station) => station.code.toLowerCase() === normalized || station.label.toLowerCase() === normalized,
    );
  };

  const visibleTasks = useMemo(() => {
    return tasks
      .filter((task) => accessibleDepartmentIds.includes(task.departmentId))
      .filter((task) => departmentFilter === "all" || task.departmentId === departmentFilter)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [accessibleDepartmentIds, departmentFilter, tasks]);

  const today = new Date().toISOString().slice(0, 10);
  const doneCount = visibleTasks.filter((task) => task.status === "done").length;
  const inProgressCount = visibleTasks.filter((task) => task.status === "in_progress").length;
  const delayedCount = visibleTasks.filter((task) => task.taskDate < today && task.status !== "done").length;

  const handleCreateTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const resolvedStationId = taskStationId || resolveStationOption(taskStationQuery)?.id;

    if (!currentUser || !taskDepartmentId || !taskTeamId || !resolvedStationId || !taskDescription.trim()) {
      return;
    }

    createTask({
      stationId: resolvedStationId,
      teamId: taskTeamId,
      departmentId: taskDepartmentId,
      createdBy: currentUser.id,
      description: taskDescription.trim(),
      taskDate,
    });

    setTaskDescription("");
    setTaskStationId("");
    setTaskStationQuery("");
  };

  const teamOptions = teams.filter((team) => !taskDepartmentId || team.departmentId === taskDepartmentId);

  return (
    <div className="app-page">
      <div className="flex justify-end lg:hidden">
        <InternalMobileMenuAction />
      </div>

      <Card className="overflow-hidden" padding="none">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 bg-white lg:grid-cols-4 lg:divide-y-0">
          <div className="px-4 py-3 sm:px-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-700">Нийт</p>
            <p className="mt-1 text-[1.75rem] font-extrabold text-ink-900">{visibleTasks.length}</p>
          </div>
          <div className="px-4 py-3 sm:px-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">Явц</p>
            <p className="mt-1 text-[1.75rem] font-extrabold text-sky-700">{inProgressCount}</p>
          </div>
          <div className="px-4 py-3 sm:px-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Дууссан</p>
            <p className="mt-1 text-[1.75rem] font-extrabold text-emerald-700">{doneCount}</p>
          </div>
          <div className="px-4 py-3 sm:px-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">Хоцролт</p>
            <p className="mt-1 text-[1.75rem] font-extrabold text-amber-700">{delayedCount}</p>
          </div>
        </div>
      </Card>

      <div className="panel-grid xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="section-stack" padding="sm">
          <h2 className="text-xl font-bold text-ink-900">Шинэ ажил</h2>
          <form className="field-grid" onSubmit={handleCreateTask}>
            <div className="field-grid sm:grid-cols-2">
              {currentUser?.role === "general_engineer" ? (
                <SelectInput
                  label="Алба"
                  onChange={(event) => {
                    setTaskDepartmentId(event.target.value);
                    setTaskTeamId("");
                  }}
                  required
                  value={taskDepartmentId}
                >
                  <option value="">Алба сонгох</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </SelectInput>
              ) : (
                <TextInput
                  disabled
                  label="Алба"
                  value={departments.find((department) => department.id === taskDepartmentId)?.name ?? ""}
                />
              )}

              <SelectInput
                label="Засварын бригад"
                onChange={(event) => setTaskTeamId(event.target.value)}
                required
                value={taskTeamId}
              >
                <option value="">Засварын бригад сонгох</option>
                {teamOptions.map((team) => (
                  <option key={team.id} value={team.id}>
                    {getTeamName(team.id, teams, users)}
                  </option>
                ))}
              </SelectInput>
            </div>

            <TextInput
              label="Ус түгээх байр"
              list="engineer-station-options"
              onChange={(event) => {
                const nextQuery = event.target.value;
                const matchedStation = resolveStationOption(nextQuery);
                setTaskStationQuery(nextQuery);
                setTaskStationId(matchedStation?.id ?? "");
              }}
              placeholder="Код, нэр, байршил, хянагчаар хайх"
              required
              value={taskStationQuery}
            />
            <datalist id="engineer-station-options">
              {stationOptions.map((station) => (
                <option key={station.id} value={station.label} />
              ))}
            </datalist>

            <TextInput label="Огноо" onChange={(event) => setTaskDate(event.target.value)} type="date" value={taskDate} />
            <TextareaInput
              label="Тайлбар"
              onChange={(event) => setTaskDescription(event.target.value)}
              required
              value={taskDescription}
            />
            <Button type="submit">Ажил үүсгэх</Button>
          </form>
        </Card>

        <Card className="flex min-h-[360px] flex-col" padding="sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-ink-900">Өдөр тутмын ажил</h2>
              <p className="mt-1 text-sm text-slate-500">{doneCount}/{visibleTasks.length} дууссан</p>
            </div>
            {currentUser?.role === "general_engineer" ? (
              <div className="w-full sm:w-[240px]">
                <SelectInput
                  label="Алба"
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                  value={departmentFilter}
                >
                  <option value="all">Бүх алба</option>
                  {departments
                    .filter((department) => accessibleDepartmentIds.includes(department.id))
                    .map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                </SelectInput>
              </div>
            ) : null}
          </div>

          <div className="mt-3.5 space-y-3 scroll-pane">
            {visibleTasks.length === 0 ? (
              <EmptyState title="Ажил алга" />
            ) : (
              visibleTasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-ink-900">
                          {getStationLabel(task.stationId, waterStations)}
                        </h3>
                        <StatusBadge status={task.status} />
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {departments.find((department) => department.id === task.departmentId)?.name} · {getTeamName(task.teamId, teams, users)}
                      </p>
                    </div>
                    <div className="text-sm text-slate-500 sm:text-right">
                      <p>{formatDate(task.taskDate)}</p>
                      <p>{formatDateTime(task.createdAt)}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-600">{task.description}</p>
                  {task.workReport ? (
                    <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm text-slate-600">
                      {task.workReport}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

