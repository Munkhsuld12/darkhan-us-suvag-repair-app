import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useApp } from "../app/AppContext";
import type { Role } from "../types";

export const ProtectedRoute = ({ allowedRoles }: { allowedRoles: Role[] }) => {
  const { currentUser } = useApp();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return <Navigate replace to="/" />;
  }

  return <Outlet />;
};
