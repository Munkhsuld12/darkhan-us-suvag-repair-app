import { Link, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import { useApp } from "../../app/AppContext";
import { TextInput } from "../../components/forms/FormField";
import { StationCard } from "../../components/stations/StationCard";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  compareStationCode,
  filterStationsByBag,
  formatDate,
  getStationOpenTicket,
  getStationSearchScore,
  getStatusMeta,
  getTeamName,
  matchesStationSearch,
  sortStationsByCode,
} from "../../lib/utils";

export const HomePage = () => {
  const { waterStations, tickets, departments, teams, users, tasks } = useApp();
  const location = useLocation();
  const bagNumbers = useMemo(
    () => [...new Set(waterStations.map((station) => station.bagNo))].sort((a, b) => a - b),
    [waterStations],
  );
  const [selectedBag, setSelectedBag] = useState<number>(bagNumbers[0] ?? 1);
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedSearch = searchQuery.trim();

  const visibleStations = useMemo(
    () => sortStationsByCode(filterStationsByBag(waterStations, selectedBag)),
    [selectedBag, waterStations],
  );

  const matchingStations = useMemo(
    () =>
      waterStations
        .filter((station) => matchesStationSearch(station, normalizedSearch))
        .sort((left, right) => {
          const scoreDiff =
            getStationSearchScore(left, normalizedSearch) -
            getStationSearchScore(right, normalizedSearch);

          if (scoreDiff !== 0) {
            return scoreDiff;
          }

          return compareStationCode(left, right);
        }),
    [normalizedSearch, waterStations],
  );

  const resultStations = normalizedSearch ? matchingStations : visibleStations;
  const previewStations = resultStations.slice(0, 6);

  const stationListLink = useMemo(() => {
    const params = new URLSearchParams();
    if (normalizedSearch) {
      params.set("query", normalizedSearch);
    } else {
      params.set("bag", String(selectedBag));
    }

    return `/stations?${params.toString()}`;
  }, [normalizedSearch, selectedBag]);

  const plannedTasks = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const upcomingTasks = tasks.filter((task) => task.status !== "done" && task.taskDate >= today);
    const source = upcomingTasks.length > 0 ? upcomingTasks : tasks.filter((task) => task.status !== "done");

    return source
      .sort((a, b) => {
        if (a.taskDate === b.taskDate) {
          return +new Date(a.createdAt) - +new Date(b.createdAt);
        }

        return a.taskDate.localeCompare(b.taskDate);
      })
      .slice(0, 4)
      .map((task) => {
        const station = waterStations.find((item) => item.id === task.stationId);
        return {
          ...task,
          stationCode: station?.code ?? "Тодорхойгүй",
          stationLocation: station?.location ?? "Байршил оруулаагүй",
          teamName: getTeamName(task.teamId, teams, users),
          statusMeta: getStatusMeta(task.status),
        };
      });
  }, [tasks, teams, users, waterStations]);

  return (
    <div className="app-page">
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" padding="sm">
        <h2 className="text-base font-semibold text-ink-900">Гомдол, хүсэлт</h2>
        <Link className="shrink-0" state={{ backgroundLocation: location }} to="/complaint">
          <Button size="sm" type="button">Хүсэлт илгээх</Button>
        </Link>
      </Card>

      <Card className="section-stack" padding="sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <h1 className="text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">Ус түгээх байрууд</h1>
          <div className="chip-scroll lg:flex lg:flex-wrap lg:justify-end lg:overflow-visible lg:pb-0">
            {bagNumbers.map((bagNo) => (
              <button
                key={bagNo}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  selectedBag === bagNo
                    ? "bg-brand-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                onClick={() => setSelectedBag(bagNo)}
                type="button"
              >
                {bagNo}-р баг
              </button>
            ))}
          </div>
        </div>

        <TextInput
          label="Хайлт"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Код, нэр, байршил, хянагчаар хайх"
          value={searchQuery}
        />
      </Card>

      <div className="panel-grid xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="section-stack flex max-h-[720px] min-h-[360px] flex-col" padding="sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-ink-900 sm:text-xl">
              {normalizedSearch ? "Хайлтын үр дүн" : `${selectedBag}-р баг`}
            </h2>
            <Link className="text-sm font-semibold text-brand-700" to={stationListLink}>
              Бүгдийг харах
            </Link>
          </div>

          {previewStations.length === 0 ? (
            <EmptyState title="Тохирох ус түгээх байр алга" />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="compact-grid sm:grid-cols-2 2xl:grid-cols-3">
                {previewStations.map((station) => (
                  <StationCard
                    key={station.id}
                    departments={departments}
                    station={station}
                    teams={teams}
                    ticket={getStationOpenTicket(station.id, tickets)}
                    users={users}
                  />
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="section-stack" padding="sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-ink-900 sm:text-xl">Төлөвлөгдсөн ажил</h2>
            {plannedTasks.length ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {plannedTasks.length}
              </span>
            ) : null}
          </div>

          {plannedTasks.length === 0 ? (
            <EmptyState title="Ажил алга" />
          ) : (
            <div className="space-y-2.5">
              {plannedTasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {formatDate(task.taskDate)}
                      </p>
                      <h3 className="mt-1 text-base font-bold text-ink-900">{task.stationCode}</h3>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${task.statusMeta.badgeClass}`}>
                      {task.statusMeta.label}
                    </span>
                  </div>
                  <p className="mt-2.5 line-clamp-2 text-sm text-slate-600">{task.description}</p>
                  <p className="mt-2.5 text-sm text-slate-500">{task.teamName}</p>
                  <p className="mt-1 text-sm text-slate-500">{task.stationLocation}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
