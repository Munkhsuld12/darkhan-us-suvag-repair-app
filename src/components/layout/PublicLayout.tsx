import { useEffect, useRef, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { BrandLogo } from "../branding/BrandLogo";
import { Button } from "../ui/Button";

export const PublicLayout = () => {
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= 20) {
        setHeaderVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }

      if (currentScrollY > lastScrollY.current + 10) {
        setHeaderVisible(false);
      } else if (currentScrollY < lastScrollY.current - 8) {
        setHeaderVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-hero">
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-transform duration-300 ${
          headerVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto max-w-7xl px-3 pt-2 sm:px-5 sm:pt-2.5 lg:px-6">
          <div className="flex h-14 items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-3.5 shadow-card backdrop-blur-sm sm:h-[3.75rem] sm:px-4">
            <Link className="min-w-0 max-w-[min(74vw,360px)] shrink overflow-hidden" to="/">
              <BrandLogo className="max-w-full" imageClassName="h-10 sm:h-11" />
            </Link>

            <Link className="shrink-0" to="/login">
              <Button size="sm" variant="secondary">
                Нэвтрэх
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 pb-5 pt-[4.55rem] sm:px-5 sm:pb-6 sm:pt-[5.1rem] lg:px-6 lg:pb-7 lg:pt-[5.3rem]">
        <Outlet />
      </main>
    </div>
  );
};
