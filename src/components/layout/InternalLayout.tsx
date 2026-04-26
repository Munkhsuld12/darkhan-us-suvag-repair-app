import { createContext, useEffect, useMemo, useState, type ReactNode, useContext } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { Button } from "../ui/Button";

const linksByRole = {
  admin: [{ label: "Админ", to: "/admin" }],
  dispatcher: [{ label: "Диспетчер", to: "/dispatcher" }],
  general_engineer: [{ label: "Инженер", to: "/engineer" }],
  department_engineer: [{ label: "Инженер", to: "/engineer" }],
  brigade_leader: [{ label: "Бригадын ахлагч", to: "/brigade" }],
} as const;

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition ${
    isActive ? "bg-brand-600 text-white" : "text-white/80 hover:bg-white/10"
  }`;

interface InternalHeaderContextValue {
  mobileHeaderAction?: ReactNode;
}

export const InternalHeaderContext = createContext<InternalHeaderContextValue | undefined>(undefined);

export const useInternalHeader = () => useContext(InternalHeaderContext);

export const InternalLayout = () => {
  const { currentUser, logout } = useApp();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navLinks = currentUser ? linksByRole[currentUser.role] : [];
  const canViewReports = Boolean(currentUser);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const mobileTitle = useMemo(() => navLinks[0]?.label ?? "Дотоод цэс", [navLinks]);

  const mobileMenuButton = (
    <button
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-ink-900 transition hover:bg-white lg:hidden"
      onClick={() => setMobileMenuOpen(true)}
      type="button"
    >
      <span aria-hidden="true" className="flex flex-col gap-1">
        <span className="h-0.5 w-3 rounded-full bg-ink-900" />
        <span className="h-0.5 w-3 rounded-full bg-ink-900" />
        <span className="h-0.5 w-3 rounded-full bg-ink-900" />
      </span>
      <span>Цэс</span>
    </button>
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-ink-900 text-white">
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Хэрэглэгч</p>
          <p className="mt-2 text-base font-semibold text-white">{currentUser?.fullName}</p>
          <p className="text-sm text-white/65">{currentUser?.username}</p>
        </div>

        <nav className="mt-4 flex flex-col gap-1.5 pb-4">
          {navLinks.map((link) => (
            <NavLink key={link.to} className={navItemClass} to={link.to}>
              {link.label}
            </NavLink>
          ))}
          <NavLink className={navItemClass} to="/internal/stations">
            Ус түгээх байрууд
          </NavLink>
          {canViewReports ? (
            <NavLink className={navItemClass} to="/reports">
              Тайлан
            </NavLink>
          ) : null}
        </nav>
      </div>

      <div className="border-t border-white/10 px-3.5 py-3.5">
        <Button
          className="w-full border-white/10 bg-white/10 text-white hover:bg-white/15 hover:text-white focus-visible:ring-white/20"
          onClick={logout}
          type="button"
          variant="ghost"
        >
          Гарах
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <div className={`fixed inset-0 z-40 lg:hidden ${mobileMenuOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
        <button
          aria-label="Цэс хаах"
          className={`absolute inset-0 bg-ink-900/45 transition-opacity ${mobileMenuOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMobileMenuOpen(false)}
          type="button"
        />
        <aside
          className={`absolute inset-y-0 right-0 w-[84vw] max-w-[320px] border-l border-white/10 shadow-2xl transition-transform duration-300 ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between bg-ink-900 px-4 py-4 text-white">
              <p className="text-sm font-semibold">{mobileTitle}</p>
              <Button onClick={() => setMobileMenuOpen(false)} size="sm" type="button" variant="ghost">
                Хаах
              </Button>
            </div>
            {sidebar}
          </div>
        </aside>
      </div>

      <div className="min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200/90 lg:block">
          <div className="sticky top-0 h-screen">{sidebar}</div>
        </aside>
        <main className="px-3 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4 lg:px-6 lg:py-5">
          <InternalHeaderContext.Provider value={{ mobileHeaderAction: mobileMenuButton }}>
            <Outlet />
          </InternalHeaderContext.Provider>
        </main>
      </div>
    </div>
  );
};

