import { useMemo, useState, type FormEvent } from "react";
import { useApp } from "../../app/AppContext";
import { TextInput, TextareaInput } from "../../components/forms/FormField";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { InternalMobileMenuAction } from "../../components/ui/PageHeader";
import { Modal } from "../../components/ui/Modal";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDateTime, getStationLabel } from "../../lib/utils";

type MobileItem =
  | {
      id: string;
      type: "ticket";
      stationId: string;
      issue: string;
      assignedAt: string;
      status: "assigned" | "urgent" | "in_progress" | "done";
    }
  | {
      id: string;
      type: "task";
      stationId: string;
      issue: string;
      assignedAt: string;
      status: "assigned" | "in_progress" | "done";
    };

export const BrigadeLeaderPage = () => {
  const { currentUser, tickets, tasks, waterStations, users, startTicket, finishTicket, startTask, finishTask } =
    useApp();

  const [selectedItem, setSelectedItem] = useState<MobileItem | null>(null);
  const [reportDescription, setReportDescription] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);

  const today = new Date().toISOString().slice(0, 10);
  const teamId = currentUser?.teamId ?? "";

  const workerOptions = users.filter((user) => user.teamId === teamId);

  const items = useMemo(() => {
    const ticketItems: MobileItem[] = tickets
      .filter(
        (ticket) =>
          ticket.teamId === teamId &&
          (ticket.status !== "done" ||
            ticket.createdAt.slice(0, 10) === today ||
            ticket.assignedAt?.slice(0, 10) === today),
      )
      .map((ticket) => ({
        id: ticket.id,
        type: "ticket",
        stationId: ticket.stationId,
        issue: ticket.issueType,
        assignedAt: ticket.assignedAt ?? ticket.createdAt,
        status:
          ticket.status === "new"
            ? "assigned"
            : ticket.status === "urgent"
              ? "urgent"
              : ticket.status,
      }));

    const taskItems: MobileItem[] = tasks
      .filter((task) => task.teamId === teamId && (task.taskDate === today || task.status !== "done"))
      .map((task) => ({
        id: task.id,
        type: "task",
        stationId: task.stationId,
        issue: task.description,
        assignedAt: task.createdAt,
        status: task.status,
      }));

    return [...ticketItems, ...taskItems].sort((a, b) => +new Date(b.assignedAt) - +new Date(a.assignedAt));
  }, [tasks, teamId, tickets, today]);

  const inProgressCount = items.filter((item) => item.status === "in_progress").length;
  const pendingCount = items.filter((item) => item.status !== "done").length;

  const resetFinishForm = () => {
    setSelectedItem(null);
    setReportDescription("");
    setMaterialsUsed("");
    setSelectedWorkers([]);
  };

  const handleFinish = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedItem || !reportDescription.trim() || !currentUser) {
      return;
    }

    if (selectedItem.type === "ticket") {
      finishTicket(
        selectedItem.id,
        { reportDescription: reportDescription.trim(), materialsUsed: materialsUsed.trim(), workerIds: selectedWorkers },
        currentUser.id,
      );
    } else {
      finishTask(selectedItem.id, {
        reportDescription: reportDescription.trim(),
        materialsUsed: materialsUsed.trim(),
        workerIds: selectedWorkers,
      });
    }

    resetFinishForm();
  };

  return (
    <div className="app-page">
      <div className="flex justify-end lg:hidden">
        <InternalMobileMenuAction />
      </div>

      <Card padding="sm">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Нийт</p>
            <p className="mt-1 text-[1.75rem] font-extrabold text-ink-900">{items.length}</p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">Явц</p>
            <p className="mt-1 text-[1.75rem] font-extrabold text-sky-700">{inProgressCount}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">Үлдсэн</p>
            <p className="mt-1 text-[1.75rem] font-extrabold text-amber-700">{pendingCount}</p>
          </div>
        </div>
      </Card>

      {items.length === 0 ? (
        <EmptyState title="Өнөөдрийн ажил алга" />
      ) : (
        <div className="compact-grid">
          {items.map((item) => (
            <Card key={`${item.type}-${item.id}`} padding="sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {item.type === "ticket" ? "Засварын хүсэлт" : "Өдөр тутмын ажил"}
                  </p>
                  <h2 className="mt-1.5 text-[1.75rem] font-extrabold text-ink-900">
                    {getStationLabel(item.stationId, waterStations)}
                  </h2>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.issue}</p>
              <p className="mt-3 text-sm text-slate-500">{formatDateTime(item.assignedAt)}</p>

              <div className="mt-3.5 flex gap-2">
                {item.status !== "in_progress" && item.status !== "done" ? (
                  <Button
                    className="flex-1"
                    onClick={() => {
                      if (item.type === "ticket" && currentUser) {
                        startTicket(item.id, currentUser.id);
                      }
                      if (item.type === "task") {
                        startTask(item.id);
                      }
                    }}
                    size="sm"
                    type="button"
                  >
                    Эхлэх
                  </Button>
                ) : null}
                {item.status === "in_progress" ? (
                  <Button className="flex-1" onClick={() => setSelectedItem(item)} size="sm" type="button" variant="secondary">
                    Дуусгах
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal onClose={resetFinishForm} open={Boolean(selectedItem)} title="Гүйцэтгэл">
        <form className="field-grid" onSubmit={handleFinish}>
          <TextareaInput
            label="Тайлан"
            onChange={(event) => setReportDescription(event.target.value)}
            required
            value={reportDescription}
          />
          <TextInput
            label="Ашигласан материал"
            onChange={(event) => setMaterialsUsed(event.target.value)}
            value={materialsUsed}
          />
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Оролцсон ажилтнууд</p>
            <div className="compact-grid sm:grid-cols-2">
              {workerOptions.map((worker) => (
                <label key={worker.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <input
                    checked={selectedWorkers.includes(worker.id)}
                    onChange={(event) => {
                      setSelectedWorkers((prev) =>
                        event.target.checked ? [...prev, worker.id] : prev.filter((item) => item !== worker.id),
                      );
                    }}
                    type="checkbox"
                  />
                  <span className="text-sm text-slate-700">{worker.fullName}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button onClick={resetFinishForm} type="button" variant="ghost">
              Болих
            </Button>
            <Button type="submit">Хадгалах</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

