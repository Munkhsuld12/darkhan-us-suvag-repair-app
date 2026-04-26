import { Link, useLocation, useParams } from "react-router-dom";
import { useMemo } from "react";
import { useApp } from "../../app/AppContext";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import {
  formatDateTime,
  getDepartmentName,
  getStationOpenTicket,
  getTeamName,
} from "../../lib/utils";

export const StationDetailsPage = ({ mode = "public" }: { mode?: "public" | "internal" }) => {
  const { stationId } = useParams();
  const location = useLocation();
  const {
    waterStations,
    tickets,
    ticketLogs,
    maintenanceLogs,
    users,
    teams,
    departments,
    tasks,
  } = useApp();

  const station = waterStations.find((item) => item.id === stationId);

  const openTicket = station ? getStationOpenTicket(station.id, tickets) : undefined;

  const timeline = useMemo(() => {
    if (!station) {
      return [];
    }

    const stationTickets = tickets.filter((ticket) => ticket.stationId === station.id);
    const stationTasks = tasks.filter((task) => task.stationId === station.id);

    const ticketEvents = ticketLogs
      .filter((log) => stationTickets.some((ticket) => ticket.id === log.ticketId))
      .map((log) => ({
        id: log.id,
        date: log.loggedAt,
        action: log.action,
        note: log.note,
        actor: users.find((user) => user.id === log.userId)?.fullName ?? "Систем",
      }));

    const maintenanceEvents = maintenanceLogs
      .filter(
        (log) =>
          stationTickets.some((ticket) => ticket.id === log.ticketId) ||
          stationTasks.some((task) => task.id === log.taskId),
      )
      .map((log) => ({
        id: log.id,
        date: log.createdAt,
        action: "Засварын тайлан",
        note: `${log.description}${log.materialsUsed ? ` Материал: ${log.materialsUsed}.` : ""}`,
        actor: getTeamName(log.teamId, teams, users),
      }));

    return [...ticketEvents, ...maintenanceEvents].sort(
      (a, b) => +new Date(b.date) - +new Date(a.date),
    );
  }, [maintenanceLogs, station, tasks, teams, ticketLogs, tickets, users]);

  if (!station) {
    return <EmptyState title="Мэдээлэл олдсонгүй" />;
  }

  const action =
    mode === "internal" ? (
      <Link to="/internal/stations">
        <Button size="sm" variant="secondary">Жагсаалт руу</Button>
      </Link>
    ) : (
      <Link state={{ backgroundLocation: location }} to={`/complaint?stationId=${station.id}`}>
        <Button size="sm">Хүсэлт илгээх</Button>
      </Link>
    );

  const openWorkCount = [
    ...tickets.filter((ticket) => ticket.stationId === station.id && ticket.status !== "done"),
    ...tasks.filter((task) => task.stationId === station.id && task.status !== "done"),
  ].length;

  return (
    <div className="app-page">
      <PageHeader action={action} title={station.code} />

      <div className="panel-grid xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="section-stack" padding="sm">
          <div className="rounded-2xl bg-slate-50 px-3.5 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Хянагч</p>
            <p className="mt-1.5 text-lg font-bold text-ink-900">{station.caretakerName || "Оруулаагүй"}</p>
            {station.caretakerPhone ? <p className="mt-1 text-sm text-slate-500">{station.caretakerPhone}</p> : null}
          </div>

          {openTicket ? (
            <div className="rounded-2xl border border-brand-200 bg-brand-50 px-3.5 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-700">
                    Нээлттэй засварын хүсэлт
                  </p>
                  <h2 className="mt-1.5 text-lg font-bold text-ink-900">{openTicket.ticketNo}</h2>
                </div>
                <StatusBadge status={openTicket.status} />
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>
                  <span className="font-semibold text-slate-800">Төрөл:</span> {openTicket.issueType}
                </p>
                <p>
                  <span className="font-semibold text-slate-800">Алба:</span>{" "}
                  {getDepartmentName(openTicket.departmentId, departments)}
                </p>
                <p>
                  <span className="font-semibold text-slate-800">Засварын бригад:</span>{" "}
                  {getTeamName(openTicket.teamId, teams, users)}
                </p>
                <p className="rounded-2xl bg-white/90 px-3 py-2.5 text-sm text-slate-700">{openTicket.description}</p>
              </div>
            </div>
          ) : (
            <EmptyState title="Засварын хүсэлт байхгүй" />
          )}

          <div className="rounded-2xl bg-slate-50 px-3.5 py-3.5">
            <div className="space-y-2 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-800">Код:</span> {station.code}
              </p>
              <p>
                <span className="font-semibold text-slate-800">Баг:</span> {station.bagNo}-р баг
              </p>
              <p>
                <span className="font-semibold text-slate-800">Байршил:</span> {station.location}
              </p>
              <p>
                <span className="font-semibold text-slate-800">Нээлттэй ажил:</span> {openWorkCount}
              </p>
            </div>
          </div>
        </Card>

        <Card className="flex min-h-[360px] flex-col" padding="sm">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-lg font-bold text-ink-900 sm:text-xl">Түүх</h2>
          </div>

          <div className="mt-3.5 space-y-3 scroll-pane">
            {timeline.length === 0 ? (
              <EmptyState title="Түүх алга" />
            ) : (
              timeline.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {formatDateTime(item.date)}
                      </p>
                      <h3 className="mt-1 text-sm font-semibold text-ink-900 sm:text-base">{item.action}</h3>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-brand-700 sm:text-xs">
                      {item.actor}
                    </span>
                  </div>
                  <p className="mt-2.5 text-sm leading-6 text-slate-600">{item.note}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
