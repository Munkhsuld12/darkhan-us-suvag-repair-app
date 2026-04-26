import { Route, Routes, useLocation } from "react-router-dom";
import { InternalLayout } from "./components/layout/InternalLayout";
import { PublicLayout } from "./components/layout/PublicLayout";
import { AdminPage } from "./pages/internal/AdminPage";
import { BrigadeLeaderPage } from "./pages/internal/BrigadeLeaderPage";
import { DispatcherDashboardPage } from "./pages/internal/DispatcherDashboardPage";
import { EngineerDashboardPage } from "./pages/internal/EngineerDashboardPage";
import { ReportsPage } from "./pages/internal/ReportsPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ComplaintFormPage } from "./pages/public/ComplaintFormPage";
import { HomePage } from "./pages/public/HomePage";
import { StationDetailsPage } from "./pages/public/StationDetailsPage";
import { StationsPage } from "./pages/public/StationsPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";

const internalRoles = [
  "admin",
  "dispatcher",
  "general_engineer",
  "department_engineer",
  "brigade_leader",
] as const;

const reportRoles = internalRoles;

export default function App() {
  const location = useLocation();
  const state = location.state as { backgroundLocation?: typeof location } | undefined;
  const backgroundLocation = state?.backgroundLocation;

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route element={<PublicLayout />}>
          <Route element={<HomePage />} path="/" />
          <Route element={<ComplaintFormPage />} path="/complaint" />
          <Route element={<StationsPage />} path="/stations" />
          <Route element={<StationDetailsPage />} path="/stations/:stationId" />
          <Route element={<NotFoundPage />} path="*" />
        </Route>

        <Route element={<LoginPage />} path="/login" />

        <Route element={<ProtectedRoute allowedRoles={[...internalRoles]} />}>
          <Route element={<InternalLayout />}>
            <Route element={<StationsPage mode="internal" />} path="/internal/stations" />
            <Route
              element={<StationDetailsPage mode="internal" />}
              path="/internal/stations/:stationId"
            />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[...reportRoles]} />}>
          <Route element={<InternalLayout />}>
            <Route element={<ReportsPage />} path="/reports" />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["dispatcher"]} />}>
          <Route element={<InternalLayout />}>
            <Route element={<DispatcherDashboardPage />} path="/dispatcher" />
          </Route>
        </Route>

        <Route
          element={<ProtectedRoute allowedRoles={["general_engineer", "department_engineer"]} />}
        >
          <Route element={<InternalLayout />}>
            <Route element={<EngineerDashboardPage />} path="/engineer" />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["brigade_leader"]} />}>
          <Route element={<InternalLayout />}>
            <Route element={<BrigadeLeaderPage />} path="/brigade" />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
          <Route element={<InternalLayout />}>
            <Route element={<AdminPage />} path="/admin" />
          </Route>
        </Route>
      </Routes>

      {backgroundLocation ? (
        <Routes>
          <Route element={<ComplaintFormPage modal />} path="/complaint" />
        </Routes>
      ) : null}
    </>
  );
}
