import { getStatusMeta } from "../../lib/utils";
import type { TicketStatus } from "../../types";

export const StatusBadge = ({ status }: { status: TicketStatus }) => {
  const meta = getStatusMeta(status);

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold sm:px-3 sm:text-xs ${meta.badgeClass}`}>
      {meta.label}
    </span>
  );
};
