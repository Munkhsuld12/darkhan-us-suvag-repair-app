import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { getRoleRedirectPath } from "../../lib/utils";
import { BrandLogo } from "../branding/BrandLogo";
import { TextInput } from "../forms/FormField";
import { Button } from "../ui/Button";

const demoAccounts = [
  { label: "Админ", username: "admin", password: "admin123" },
  { label: "Диспетчер", username: "dispatcher", password: "dispatch123" },
  { label: "Ерөнхий инженер", username: "chief", password: "chief123" },
  { label: "Хэлтсийн инженер", username: "eng1", password: "eng123" },
  { label: "Бригадын ахлагч", username: "bat", password: "bat123" },
];

export const LoginPanel = ({
  onClose,
  compact = false,
}: {
  onClose?: () => void;
  compact?: boolean;
}) => {
  const { login } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const fillDemoAccount = (nextUsername: string, nextPassword: string) => {
    setUsername(nextUsername);
    setPassword(nextPassword);
    setError("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const user = login(username, password);

    if (!user) {
      setError("Нэвтрэх нэр эсвэл нууц үг буруу байна.");
      return;
    }

    const state = location.state as { from?: string } | undefined;
    navigate(state?.from || getRoleRedirectPath(user.role), { replace: true });
  };

  return (
    <div
      className={`w-full rounded-[28px] border border-slate-200/80 bg-white/98 shadow-card ${
        compact ? "max-w-lg p-4 sm:p-5" : "max-w-xl p-4 sm:p-5"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2.5">
          <BrandLogo className="max-w-[220px] sm:max-w-[260px]" imageClassName="h-11 sm:h-12" />
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-brand-700">Нэвтрэх</p>
            <h2
              className={`font-extrabold text-ink-900 ${
                compact ? "mt-1 text-[1.7rem] sm:text-[1.9rem]" : "mt-1.5 text-[1.85rem]"
              }`}
            >
              Дотоод хэрэглэгч
            </h2>
          </div>
        </div>
        {onClose ? (
          <button
            className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
            onClick={onClose}
            type="button"
          >
            Хаах
          </button>
        ) : null}
      </div>

      <div className="mt-4.5">
        <p className="text-sm font-semibold text-slate-600">Туршилтын хэрэглэгч</p>
        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          {demoAccounts.map((account) => (
            <button
              key={account.username}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50"
              onClick={() => fillDemoAccount(account.username, account.password)}
              type="button"
            >
              <span className="block text-sm font-semibold text-ink-900">{account.label}</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {account.username} / {account.password}
              </span>
            </button>
          ))}
        </div>
      </div>

      <form className={`grid gap-3 ${compact ? "mt-4.5" : "mt-5"}`} onSubmit={handleSubmit}>
        <TextInput
          autoComplete="username"
          label="Нэвтрэх нэр"
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Жишээ: admin"
          required
          value={username}
        />
        <TextInput
          autoComplete="current-password"
          label="Нууц үг"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Нууц үгээ оруулна"
          required
          type="password"
          value={password}
        />
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <Button className="w-full" size="lg" type="submit">
          Нэвтрэх
        </Button>
      </form>
    </div>
  );
};
