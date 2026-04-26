import type { PropsWithChildren } from "react";
import { Button } from "./Button";
import { Card } from "./Card";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
}

export const Modal = ({ open, title, onClose, children }: PropsWithChildren<ModalProps>) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-2.5 backdrop-blur-sm sm:p-4">
      <div className="flex min-h-full items-end justify-center sm:items-center">
        <Card className="w-full max-w-xl" padding="md">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
            <h3 className="text-base font-bold text-ink-900 sm:text-lg">{title}</h3>
            <Button onClick={onClose} size="sm" type="button" variant="ghost">
              Хаах
            </Button>
          </div>
          <div className="mt-3.5 max-h-[min(72vh,720px)] overflow-y-auto pr-1 sm:mt-4">{children}</div>
        </Card>
      </div>
    </div>
  );
};
