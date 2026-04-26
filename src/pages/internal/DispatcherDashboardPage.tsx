import { useMemo, useState, type FormEvent } from "react";
import { useApp } from "../../app/AppContext";
import { SelectInput, TextInput, TextareaInput } from "../../components/forms/FormField";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { SummaryCard } from "../../components/ui/SummaryCard";
import { issueTypeOptions } from "../../data/seed";
import { formatDateTime, getStationLabel, getStationOptionLabel, getTeamWorkloadCount } from "../../lib/utils";
import type { Complaint, TicketPriority } from "../../types";

const defaultPhoneForm = {
  stationCode: "",
  issueType: issueTypeOptions[0],
  description: "",
  citizenName: "",
  phoneNumber: "",
};

const defaultTicketForm = {
  stationId: "",
  issueType: issueTypeOptions[0],
  description: "",
  source: "phone" as "web" | "phone",
  priority: "normal" as TicketPriority,
  departmentId: "",
  teamId: "",
};

export const DispatcherDashboardPage = () => {
  const {
    complaints,
    tickets,
    departments,
    teams,
    users,
    waterStations,
    currentUser,
    tasks,
    submitComplaint,
    createTicket,
    assignTicket,
  } = useApp();

  const [phoneForm, setPhoneForm] = useState(defaultPhoneForm);
  const [phoneSuccess, setPhoneSuccess] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [assignmentTicketId, setAssignmentTicketId] = useState<string | null>(null);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState(defaultTicketForm);
  const [ticketStationQuery, setTicketStationQuery] = useState("");

  const incomingWeb = complaints.filter((complaint) => complaint.status === "new" && complaint.source === "web");
  const incomingPhone = complaints.filter(
    (complaint) => complaint.status === "new" && complaint.source === "phone",
  );
  const pendingComplaints = useMemo(
    () => [...incomingWeb, ...incomingPhone].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [incomingPhone, incomingWeb],
  );

  const sortedTickets = [...tickets].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const sortedTeams = useMemo(
    () =>
      [...teams].sort((left, right) => {
        const workloadDiff =
          getTeamWorkloadCount(right.id, tickets, tasks) - getTeamWorkloadCount(left.id, tickets, tasks);

        if (workloadDiff !== 0) {
          return workloadDiff;
        }

        return left.name.localeCompare(right.name, "mn-MN");
      }),
    [teams, tickets, tasks],
  );

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

  const getTeamLoadText = (teamId: string) => {
    const team = teams.find((item) => item.id === teamId);
    if (!team) {
      return "";
    }

    const leader = users.find((user) => user.id === team.leaderUserId)?.fullName ?? "Хуваарилагдаагүй";
    const workload = getTeamWorkloadCount(team.id, tickets, tasks);
    if (workload === 0) {
      return `${team.name} — ${leader} (Чөлөөтэй)`;
    }

    return `${team.name} — ${leader} (${workload} ажил)`;
  };

  const handlePhoneSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const station = waterStations.find(
      (item) => item.code.toLowerCase() === phoneForm.stationCode.trim().toLowerCase(),
    );

    if (!station || !currentUser) {
      setPhoneError("Кодыг зөв оруулна уу.");
      return;
    }

    submitComplaint({
      stationId: station.id,
      issueType: phoneForm.issueType,
      description: phoneForm.description.trim(),
      citizenName: phoneForm.citizenName.trim(),
      phoneNumber: phoneForm.phoneNumber.trim(),
      source: "phone",
      createdByLabel: currentUser.fullName,
    });

    setPhoneForm(defaultPhoneForm);
    setPhoneError("");
    setPhoneSuccess("Амжилттай бүртгэлээ.");
  };

  const selectedAssignmentTicket = tickets.find((ticket) => ticket.id === assignmentTicketId);

  const openComplaintModal = (complaint: Complaint) => {
    const station = waterStations.find((item) => item.id === complaint.stationId);
    setTicketForm({
      stationId: complaint.stationId,
      issueType: complaint.issueType,
      description: complaint.description,
      source: complaint.source,
      priority: "normal",
      departmentId: "",
      teamId: "",
    });
    setTicketStationQuery(station ? getStationOptionLabel(station) : "");
    setSelectedComplaint({ ...complaint, stationId: station?.id ?? complaint.stationId });
  };

  const handleCreateTicket = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const resolvedStationId = ticketForm.stationId || resolveStationOption(ticketStationQuery)?.id;

    if (!currentUser || !resolvedStationId) {
      return;
    }

    createTicket({
      complaintId: selectedComplaint?.id,
      stationId: resolvedStationId,
      departmentId: ticketForm.departmentId || undefined,
      teamId: ticketForm.teamId || undefined,
      issueType: ticketForm.issueType,
      description: ticketForm.description,
      priority: ticketForm.priority,
      source: ticketForm.source,
      createdBy: currentUser.id,
    });

    setSelectedComplaint(null);
    setNewTicketOpen(false);
    setTicketForm(defaultTicketForm);
    setTicketStationQuery("");
  };

  const handleAssignTicket = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assignmentTicketId || !currentUser) {
      return;
    }

    assignTicket(assignmentTicketId, {
      departmentId: ticketForm.departmentId,
      teamId: ticketForm.teamId,
      priority: ticketForm.priority,
      assignedBy: currentUser.id,
    });

    setAssignmentTicketId(null);
    setTicketForm(defaultTicketForm);
  };

  return (
    <div className="app-page">
      <PageHeader
        action={
          <Button
            onClick={() => {
              setNewTicketOpen(true);
              setSelectedComplaint(null);
              setTicketForm(defaultTicketForm);
              setTicketStationQuery("");
            }}
            type="button"
          >
            Шинэ хүсэлт
          </Button>
        }
        title="Диспетчер"
      />

      <div className="compact-grid md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Веб" tone="brand" value={incomingWeb.length} />
        <SummaryCard title="Утас" tone="amber" value={incomingPhone.length} />
        <SummaryCard title="Нийт хүсэлт" tone="blue" value={tickets.length} />
        <SummaryCard
          title="Идэвхтэй"
          tone="rose"
          value={tickets.filter((ticket) => ticket.status !== "done").length}
        />
      </div>

      <div className="panel-grid xl:grid-cols-[336px_minmax(0,1fr)]">
        <Card className="section-stack" padding="sm">
          <h2 className="text-xl font-bold text-ink-900">Утсаар бүртгэх</h2>
          <form className="field-grid" onSubmit={handlePhoneSubmit}>
            <TextInput
              label="Худгийн код"
              onChange={(event) => setPhoneForm((prev) => ({ ...prev, stationCode: event.target.value }))}
              required
              value={phoneForm.stationCode}
            />
            <SelectInput
              label="Төрөл"
              onChange={(event) => setPhoneForm((prev) => ({ ...prev, issueType: event.target.value }))}
              required
              value={phoneForm.issueType}
            >
              {issueTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </SelectInput>
            <TextareaInput
              label="Тайлбар"
              onChange={(event) => setPhoneForm((prev) => ({ ...prev, description: event.target.value }))}
              required
              value={phoneForm.description}
            />
            <div className="field-grid sm:grid-cols-2">
              <TextInput
                label="Нэр"
                onChange={(event) => setPhoneForm((prev) => ({ ...prev, citizenName: event.target.value }))}
                required
                value={phoneForm.citizenName}
              />
              <TextInput
                label="Утас"
                onChange={(event) => setPhoneForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                required
                value={phoneForm.phoneNumber}
              />
            </div>
            {phoneError ? <p className="text-sm text-rose-600">{phoneError}</p> : null}
            {phoneSuccess ? (
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{phoneSuccess}</p>
            ) : null}
            <Button type="submit">Бүртгэх</Button>
          </form>
        </Card>

        <Card className="section-stack" padding="sm">
          <h2 className="text-xl font-bold text-ink-900">Бригадын ачаалал</h2>
          <div className="compact-grid sm:grid-cols-2">
            {sortedTeams.map((team) => {
              const workload = getTeamWorkloadCount(team.id, tickets, tasks);
              const busy = workload >= 3;
              const leader = users.find((user) => user.id === team.leaderUserId)?.fullName ?? "Хуваарилагдаагүй";
              return (
                <div
                  key={team.id}
                  className={`rounded-2xl border px-4 py-4 ${busy ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}`}
                >
                  <h3 className="text-base font-semibold text-ink-900">{team.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{leader}</p>
                  <p className={`mt-3 text-sm font-semibold ${busy ? "text-rose-700" : "text-emerald-700"}`}>
                    {workload >= 1 ? `${workload} ажил` : "Чөлөөтэй"}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="panel-grid xl:grid-cols-2">
        <Card className="flex min-h-[360px] flex-col" padding="sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <h2 className="text-xl font-bold text-ink-900">Ирсэн хүсэлт</h2>
            {pendingComplaints.length ? (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                {pendingComplaints.length}
              </span>
            ) : null}
          </div>

          <div className="mt-3.5 space-y-3 scroll-pane">
            {pendingComplaints.length === 0 ? (
              <EmptyState title="Шинэ хүсэлт алга" />
            ) : (
              pendingComplaints.map((complaint) => (
                <div key={complaint.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {complaint.source === "web" ? "Веб" : "Утас"} · {formatDateTime(complaint.createdAt)}
                      </p>
                      <h3 className="mt-1.5 text-base font-semibold text-ink-900">
                        {getStationLabel(complaint.stationId, waterStations)} · {complaint.issueType}
                      </h3>
                    </div>
                    <Button onClick={() => openComplaintModal(complaint)} size="sm" type="button" variant="secondary">
                      Бүртгэх
                    </Button>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{complaint.description}</p>
                  <p className="mt-3 text-sm text-slate-500">
                    {complaint.citizenName} · {complaint.phoneNumber}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="flex min-h-[360px] flex-col" padding="sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <h2 className="text-xl font-bold text-ink-900">Засварын хүсэлт</h2>
            {sortedTickets.length ? (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                {sortedTickets.length}
              </span>
            ) : null}
          </div>

          <div className="mt-3.5 space-y-3 scroll-pane">
            {sortedTickets.length === 0 ? (
              <EmptyState title="Засварын хүсэлт алга" />
            ) : (
              sortedTickets.map((ticket) => (
                <div key={ticket.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-ink-900">{ticket.ticketNo}</h3>
                        <StatusBadge status={ticket.status} />
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {getStationLabel(ticket.stationId, waterStations)} · {ticket.issueType}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        const station = waterStations.find((item) => item.id === ticket.stationId);
                        setAssignmentTicketId(ticket.id);
                        setTicketForm({
                          stationId: ticket.stationId,
                          issueType: ticket.issueType,
                          description: ticket.description,
                          source: ticket.source,
                          priority: ticket.priority,
                          departmentId: ticket.departmentId ?? "",
                          teamId: ticket.teamId ?? "",
                        });
                        setTicketStationQuery(station ? getStationOptionLabel(station) : "");
                      }}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Хуваарилах
                    </Button>
                  </div>

                  <div className="mt-3 space-y-1.5 text-sm text-slate-500">
                    <p>{ticket.description}</p>
                    <p>{ticket.source === "web" ? "Веб" : "Утас"}</p>
                    <p>{departments.find((department) => department.id === ticket.departmentId)?.name ?? "Хуваарилагдаагүй"}</p>
                    <p>{ticket.teamId ? getTeamLoadText(ticket.teamId).split(" (")[0] : "Хуваарилагдаагүй"}</p>
                    <p>{formatDateTime(ticket.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Modal
        onClose={() => {
          setSelectedComplaint(null);
          setNewTicketOpen(false);
          setTicketForm(defaultTicketForm);
          setTicketStationQuery("");
        }}
        open={Boolean(selectedComplaint || newTicketOpen)}
        title={selectedComplaint ? "Хүсэлтээс үүсгэх" : "Шинэ хүсэлт"}
      >
        <form className="field-grid" onSubmit={handleCreateTicket}>
          <TextInput
            label="Ус түгээх байр"
            list="dispatcher-station-options"
            onChange={(event) => {
              const nextQuery = event.target.value;
              const matchedStation = resolveStationOption(nextQuery);
              setTicketStationQuery(nextQuery);
              setTicketForm((prev) => ({ ...prev, stationId: matchedStation?.id ?? "" }));
            }}
            placeholder="Код, нэр, байршил, хянагчаар хайх"
            required
            value={ticketStationQuery}
          />
          <datalist id="dispatcher-station-options">
            {stationOptions.map((station) => (
              <option key={station.id} value={station.label} />
            ))}
          </datalist>
          <SelectInput
            label="Төрөл"
            onChange={(event) => setTicketForm((prev) => ({ ...prev, issueType: event.target.value }))}
            required
            value={ticketForm.issueType}
          >
            {issueTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </SelectInput>
          <TextareaInput
            label="Тайлбар"
            onChange={(event) => setTicketForm((prev) => ({ ...prev, description: event.target.value }))}
            required
            value={ticketForm.description}
          />
          <div className="field-grid sm:grid-cols-3">
            <SelectInput
              label="Эх сурвалж"
              onChange={(event) =>
                setTicketForm((prev) => ({ ...prev, source: event.target.value as "web" | "phone" }))
              }
              value={ticketForm.source}
            >
              <option value="phone">Утас</option>
              <option value="web">Веб</option>
            </SelectInput>
            <SelectInput
              label="Алба"
              onChange={(event) =>
                setTicketForm((prev) => ({ ...prev, departmentId: event.target.value, teamId: "" }))
              }
              required
              value={ticketForm.departmentId}
            >
              <option value="">Алба сонгох</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </SelectInput>
            <SelectInput
              label="Яаралт"
              onChange={(event) =>
                setTicketForm((prev) => ({ ...prev, priority: event.target.value as TicketPriority }))
              }
              value={ticketForm.priority}
            >
              <option value="normal">Энгийн</option>
              <option value="urgent">Яаралтай</option>
            </SelectInput>
          </div>
          <SelectInput
            label="Засварын бригад"
            onChange={(event) => setTicketForm((prev) => ({ ...prev, teamId: event.target.value }))}
            required
            value={ticketForm.teamId}
          >
            <option value="">Засварын бригад сонгох</option>
            {sortedTeams
              .filter((team) => !ticketForm.departmentId || team.departmentId === ticketForm.departmentId)
              .map((team) => (
                <option key={team.id} value={team.id}>
                  {getTeamLoadText(team.id)}
                </option>
              ))}
          </SelectInput>
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => {
                setSelectedComplaint(null);
                setNewTicketOpen(false);
                setTicketStationQuery("");
              }}
              type="button"
              variant="ghost"
            >
              Болих
            </Button>
            <Button type="submit">Хадгалах</Button>
          </div>
        </form>
      </Modal>

      <Modal
        onClose={() => {
          setAssignmentTicketId(null);
          setTicketForm(defaultTicketForm);
        }}
        open={Boolean(selectedAssignmentTicket)}
        title="Хуваарилах"
      >
        <form className="field-grid" onSubmit={handleAssignTicket}>
          <Card className="border border-slate-100 bg-slate-50 shadow-none" padding="sm">
            <p className="text-sm font-semibold text-ink-900">{selectedAssignmentTicket?.ticketNo}</p>
            <p className="mt-2 text-sm text-slate-500">{selectedAssignmentTicket?.description}</p>
          </Card>
          <SelectInput
            label="Алба"
            onChange={(event) =>
              setTicketForm((prev) => ({ ...prev, departmentId: event.target.value, teamId: "" }))
            }
            required
            value={ticketForm.departmentId}
          >
            <option value="">Алба сонгох</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </SelectInput>
          <SelectInput
            label="Засварын бригад"
            onChange={(event) => setTicketForm((prev) => ({ ...prev, teamId: event.target.value }))}
            required
            value={ticketForm.teamId}
          >
            <option value="">Засварын бригад сонгох</option>
            {sortedTeams
              .filter((team) => !ticketForm.departmentId || team.departmentId === ticketForm.departmentId)
              .map((team) => (
                <option key={team.id} value={team.id}>
                  {getTeamLoadText(team.id)}
                </option>
              ))}
          </SelectInput>
          <SelectInput
            label="Яаралт"
            onChange={(event) =>
              setTicketForm((prev) => ({ ...prev, priority: event.target.value as TicketPriority }))
            }
            value={ticketForm.priority}
          >
            <option value="normal">Энгийн</option>
            <option value="urgent">Яаралтай</option>
          </SelectInput>
          <div className="flex justify-end gap-3">
            <Button onClick={() => setAssignmentTicketId(null)} type="button" variant="ghost">
              Болих
            </Button>
            <Button type="submit">Хуваарилах</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

