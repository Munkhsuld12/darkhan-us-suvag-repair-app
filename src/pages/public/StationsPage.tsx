import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { SelectInput, TextInput } from "../../components/forms/FormField";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  compareStationCode,
  getDepartmentName,
  getStationLatestActivity,
  getStationSearchScore,
  getStatusMeta,
  getTeamName,
  matchesStationSearch,
} from "../../lib/utils";

export const StationsPage = ({ mode = "public" }: { mode?: "public" | "internal" }) => {
  const { waterStations, tickets, tasks, departments, teams, users } = useApp();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("query") ?? "");
  const initialBagFilter = searchParams.get("bag") ?? "all";
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [selectedBag, setSelectedBag] = useState<number | null>(null);
  const [stationViewFilter, setStationViewFilter] = useState<"all" | "active" | "free">("all");
  const stationBasePath = mode === "internal" ? "/internal/stations" : "/stations";
  const normalizedSearch = searchQuery.trim();

  const bagOptions = useMemo(
    () => [...new Set(waterStations.map((station) => station.bagNo))].sort((a, b) => a - b),
    [waterStations],
  );

  const stationEntries = useMemo(() => {
    return waterStations.map((station) => {
      const latestTicket = getStationLatestActivity(station.id, tickets);
      const latestTask = tasks
        .filter((task) => task.stationId === station.id)
        .sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt))[0];

      const latestSource = (() => {
        if (!latestTicket && !latestTask) {
          return "none" as const;
        }

        if (!latestTask) {
          return "ticket" as const;
        }

        if (!latestTicket) {
          return "task" as const;
        }

        return +new Date(latestTicket.createdAt) >= +new Date(latestTask.createdAt)
          ? ("ticket" as const)
          : ("task" as const);
      })();

      const departmentId =
        latestSource === "task"
          ? latestTask?.departmentId ?? latestTicket?.departmentId
          : latestTicket?.departmentId ?? latestTask?.departmentId;

      const teamId =
        latestSource === "task"
          ? latestTask?.teamId ?? latestTicket?.teamId
          : latestTicket?.teamId ?? latestTask?.teamId;

      const status =
        latestSource === "task"
          ? latestTask?.status ?? latestTicket?.status ?? "new"
          : latestTicket?.status ?? latestTask?.status ?? "new";

      const hasActiveWork = Boolean(
        (latestTicket && latestTicket.status !== "done") || (latestTask && latestTask.status !== "done"),
      );

      return {
        station,
        departmentId,
        teamId,
        status,
        hasActiveWork,
      };
    });
  }, [tasks, tickets, waterStations]);

  const bagFolders = useMemo(
    () =>
      bagOptions.map((bagNo) => ({
        bagNo,
        rows: stationEntries.filter(({ station }) => station.bagNo === bagNo),
      })),
    [bagOptions, stationEntries],
  );

  useEffect(() => {
    if (bagFolders.length === 0) {
      setSelectedBag(null);
      return;
    }

    if (initialBagFilter !== "all") {
      setSelectedBag(Number(initialBagFilter));
      return;
    }

    setSelectedBag((current) => {
      if (current && bagFolders.some((folder) => folder.bagNo === current)) {
        return current;
      }

      return bagFolders[0]?.bagNo ?? null;
    });
  }, [bagFolders, initialBagFilter]);

  const selectedFolder = useMemo(
    () => bagFolders.find((folder) => folder.bagNo === selectedBag) ?? bagFolders[0] ?? null,
    [bagFolders, selectedBag],
  );

  const visibleSelectedRows = useMemo(() => {
    if (!selectedFolder) {
      return [];
    }

    return selectedFolder.rows
      .filter((entry) => {
        const matchesSearch = matchesStationSearch(entry.station, normalizedSearch);
        const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
        const matchesDepartment = departmentFilter === "all" || entry.departmentId === departmentFilter;

        if (stationViewFilter === "active") {
          return matchesSearch && matchesStatus && matchesDepartment && entry.hasActiveWork;
        }

        if (stationViewFilter === "free") {
          return matchesSearch && matchesStatus && matchesDepartment && !entry.hasActiveWork;
        }

        return matchesSearch && matchesStatus && matchesDepartment;
      })
      .sort((left, right) => {
        if (normalizedSearch) {
          const scoreDiff =
            getStationSearchScore(left.station, normalizedSearch) -
            getStationSearchScore(right.station, normalizedSearch);

          if (scoreDiff !== 0) {
            return scoreDiff;
          }
        }

        return compareStationCode(left.station, right.station);
      });
  }, [departmentFilter, normalizedSearch, selectedFolder, stationViewFilter, statusFilter]);

  const selectedActiveCount = useMemo(
    () => selectedFolder?.rows.filter((entry) => entry.hasActiveWork).length ?? 0,
    [selectedFolder],
  );

  const selectedFreeCount = useMemo(
    () => selectedFolder?.rows.filter((entry) => !entry.hasActiveWork).length ?? 0,
    [selectedFolder],
  );

  const renderStationViewFilters = () => (
    <div className="flex flex-wrap gap-2">
      <button
        className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
          stationViewFilter === "all"
            ? "bg-brand-700 text-white"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
        onClick={() => setStationViewFilter("all")}
        type="button"
      >
        Бүгд ({selectedFolder?.rows.length ?? 0})
      </button>
      <button
        className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
          stationViewFilter === "active"
            ? "bg-sky-600 text-white"
            : "bg-sky-50 text-sky-700 hover:bg-sky-100"
        }`}
        onClick={() => setStationViewFilter("active")}
        type="button"
      >
        Идэвхтэй ({selectedActiveCount})
      </button>
      <button
        className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
          stationViewFilter === "free"
            ? "bg-emerald-600 text-white"
            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
        }`}
        onClick={() => setStationViewFilter("free")}
        type="button"
      >
        Чөлөөтэй ({selectedFreeCount})
      </button>
    </div>
  );

  if (bagFolders.length === 0) {
    return <EmptyState title="Ус түгээх байр олдсонгүй" />;
  }

  return (
    <div className="app-page">
      <div className="space-y-4 xl:hidden">
        <Card className="space-y-3.5" padding="sm">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Ус түгээх байр
            </p>
            <h1 className="text-2xl font-bold leading-tight text-ink-900">Ус түгээх байрууд</h1>
          </div>

          <SelectInput
            label="Баг"
            onChange={(event) => setSelectedBag(Number(event.target.value))}
            value={selectedFolder ? String(selectedFolder.bagNo) : ""}
          >
            {bagFolders.map(({ bagNo, rows }) => {
              const folderActiveCount = rows.filter((entry) => entry.hasActiveWork).length;
              const suffix = folderActiveCount > 0 ? ` • ${folderActiveCount} идэвхтэй` : "";

              return (
                <option key={bagNo} value={bagNo}>
                  {bagNo}-р баг{suffix}
                </option>
              );
            })}
          </SelectInput>

          <TextInput
            label="Хайлт"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Код, нэр, байршил, хянагчаар хайх"
            value={searchQuery}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectInput
              label="Төлөв"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="all">Бүх төлөв</option>
              <option value="new">Шинэ</option>
              <option value="assigned">Хуваарилсан</option>
              <option value="urgent">Яаралтай</option>
              <option value="in_progress">Явцдаа</option>
              <option value="done">Дууссан</option>
            </SelectInput>
            <SelectInput
              label="Алба"
              onChange={(event) => setDepartmentFilter(event.target.value)}
              value={departmentFilter}
            >
              <option value="all">Бүх алба</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </SelectInput>
          </div>

          {renderStationViewFilters()}
        </Card>

        {selectedFolder ? (
          <Card className="flex flex-col gap-3" padding="sm">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-xl font-bold text-ink-900">{selectedFolder.bagNo}-р багийн худгууд</h2>
            </div>

            {visibleSelectedRows.length === 0 ? (
              <EmptyState title="Тохирох худаг алга" />
            ) : (
              <div className="table-shell">
                {visibleSelectedRows.map(({ station, departmentId, teamId, status }) => {
                  const statusMeta = getStatusMeta(status);

                  return (
                    <Link
                      className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 transition last:border-b-0 hover:bg-slate-50"
                      key={station.id}
                      to={`${stationBasePath}/${station.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Код</p>
                          <p className="mt-1 text-xl font-extrabold leading-none text-ink-900">{station.code}</p>
                        </div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusMeta.badgeClass}`}>
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="min-w-0 sm:col-span-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Байршил</p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">{station.location}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Алба</p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">
                            {getDepartmentName(departmentId, departments)}
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Засварын бригад</p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">
                            {getTeamName(teamId, teams, users)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        ) : null}
      </div>

      <div className="hidden xl:grid xl:grid-cols-[304px_minmax(0,1fr)] xl:gap-6">
        <Card className="section-stack xl:sticky xl:top-24 xl:max-h-[calc(100vh-7.5rem)] xl:overflow-y-auto" padding="sm">
          <h1 className="text-lg font-bold text-ink-900 sm:text-xl">Багууд</h1>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-3">
            {bagFolders.map(({ bagNo, rows }) => {
              const isSelected = selectedFolder?.bagNo === bagNo;
              const folderActiveCount = rows.filter((entry) => entry.hasActiveWork).length;

              return (
                <button
                  key={bagNo}
                  className={`rounded-2xl border px-3 py-3 text-left transition ${
                    isSelected
                      ? "border-brand-300 bg-brand-50 shadow-card"
                      : "border-slate-200 bg-white hover:border-brand-200 hover:bg-slate-50"
                  }`}
                  onClick={() => setSelectedBag(bagNo)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-xl font-extrabold leading-none text-ink-900">{bagNo}</h2>
                    {folderActiveCount > 0 ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                        {folderActiveCount}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{rows.length} байр</p>
                </button>
              );
            })}
          </div>
        </Card>

        {selectedFolder ? (
          <Card className="flex max-h-[calc(100vh-7.5rem)] flex-col gap-3 overflow-hidden" padding="sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-3">
              <h2 className="text-xl font-bold text-ink-900 sm:text-[1.65rem]">{selectedFolder.bagNo}-р багийн худгууд</h2>

              <div className="grid gap-3 lg:grid-cols-3">
                <TextInput
                  label="Ус түгээх байр хайх"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Код, нэр, байршил, хянагчаар хайх"
                  value={searchQuery}
                />
                <SelectInput
                  label="Төлөв"
                  onChange={(event) => setStatusFilter(event.target.value)}
                  value={statusFilter}
                >
                  <option value="all">Бүх төлөв</option>
                  <option value="new">Шинэ</option>
                  <option value="assigned">Хуваарилсан</option>
                  <option value="urgent">Яаралтай</option>
                  <option value="in_progress">Явцдаа</option>
                  <option value="done">Дууссан</option>
                </SelectInput>
                <SelectInput
                  label="Алба"
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                  value={departmentFilter}
                >
                  <option value="all">Бүх алба</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </SelectInput>
              </div>

              {renderStationViewFilters()}
            </div>

            {visibleSelectedRows.length === 0 ? (
              <EmptyState title="Тохирох худаг алга" />
            ) : (
              <div className="table-shell scroll-pane xl:overscroll-contain">
                {visibleSelectedRows.map(({ station, departmentId, teamId, status }) => {
                  const statusMeta = getStatusMeta(status);

                  return (
                    <Link
                      className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 transition last:border-b-0 hover:bg-slate-50 sm:px-5 lg:grid lg:grid-cols-[88px_minmax(0,1.1fr)_112px_136px_156px] lg:items-center"
                      key={station.id}
                      to={`${stationBasePath}/${station.id}`}
                    >
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Код</p>
                        <p className="mt-1 text-xl font-extrabold leading-none text-ink-900">{station.code}</p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Байршил</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">{station.location}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Төлөв</p>
                        <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusMeta.badgeClass}`}>
                          {statusMeta.label}
                        </span>
                      </div>

                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Алба</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {getDepartmentName(departmentId, departments)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Засварын бригад</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">{getTeamName(teamId, teams, users)}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        ) : null}
      </div>
    </div>
  );
};
