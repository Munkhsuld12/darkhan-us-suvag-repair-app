import { Link } from "react-router-dom";
import { getDepartmentName, getStatusMeta, getTeamName } from "../../lib/utils";
import type { Department, Team, Ticket, User, WaterStation } from "../../types";

interface StationCardProps {
  station: WaterStation;
  ticket?: Ticket;
  departments: Department[];
  teams: Team[];
  users: User[];
  basePath?: string;
}

export const StationCard = ({
  station,
  ticket,
  departments,
  teams,
  users,
  basePath = "/stations",
}: StationCardProps) => {
  const statusMeta = getStatusMeta(ticket?.status ?? "new");

  return (
    <Link
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-soft sm:rounded-[28px]"
      to={`${basePath}/${station.id}`}
    >
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              {station.bagNo}-р баг
            </p>
            <h3 className="mt-1 text-[1.9rem] font-extrabold leading-none text-ink-900">{station.code}</h3>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusMeta.badgeClass}`}>
            {statusMeta.label}
          </span>
        </div>

        <p className="line-clamp-2 text-sm leading-6 text-slate-500">{station.location}</p>
        {ticket?.description ? (
          <p className="line-clamp-2 text-sm leading-6 text-slate-700">{ticket.description}</p>
        ) : null}

        <div className="grid gap-2 text-sm text-slate-500">
          <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Алба</p>
            <p className="mt-1 line-clamp-1 font-semibold text-slate-700">
              {getDepartmentName(ticket?.departmentId, departments)}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Засварын бригад</p>
            <p className="mt-1 line-clamp-1 font-semibold text-slate-700">
              {getTeamName(ticket?.teamId, teams, users)}
            </p>
          </div>
        </div>
      </div>

      <div className={`mt-auto h-1.5 w-full ${statusMeta.barClass}`} />
    </Link>
  );
};
