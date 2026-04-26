import { useNavigate } from "react-router-dom";
import { LoginPanel } from "../components/auth/LoginPanel";

export const LoginPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-3 py-5 sm:px-4 sm:py-8">
      <LoginPanel onClose={() => navigate("/", { replace: true })} />
    </div>
  );
};
