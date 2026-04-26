import { useMemo, useState } from "react";
import { useApp } from "../../app/AppContext";
import { SelectInput, TextInput } from "../../components/forms/FormField";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { compareStationCode, getStationSearchScore, matchesStationSearch } from "../../lib/utils";
import type { Role } from "../../types";

type AdminTab = "departments" | "teams" | "users" | "stations";

const tabs: { id: AdminTab; label: string }[] = [
  { id: "departments", label: "Алба" },
  { id: "teams", label: "Засварын бригад" },
  { id: "users", label: "Хэрэглэгч" },
  { id: "stations", label: "Ус түгээх байр" },
];

const roleOptions: Role[] = [
  "admin",
  "dispatcher",
  "general_engineer",
  "department_engineer",
  "brigade_leader",
];

const scrollCardClass = "section-stack xl:flex xl:max-h-[calc(100vh-9rem)] xl:flex-col xl:overflow-hidden";
const scrollBodyClass = "compact-grid scroll-pane";

export const AdminPage = () => {
  const {
    departments,
    teams,
    users,
    waterStations,
    upsertDepartment,
    deleteDepartment,
    upsertTeam,
    deleteTeam,
    upsertUser,
    deleteUser,
    upsertStation,
    deleteStation,
  } = useApp();

  const [activeTab, setActiveTab] = useState<AdminTab>("departments");

  const [departmentId, setDepartmentId] = useState("");
  const [departmentName, setDepartmentName] = useState("");

  const [teamId, setTeamId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamDepartmentId, setTeamDepartmentId] = useState("");
  const [teamLeaderUserId, setTeamLeaderUserId] = useState("");

  const [userId, setUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("dispatcher");
  const [userDepartmentId, setUserDepartmentId] = useState("");
  const [userTeamId, setUserTeamId] = useState("");
  const [phone, setPhone] = useState("");

  const [stationId, setStationId] = useState("");
  const [stationCode, setStationCode] = useState("");
  const [location, setLocation] = useState("");
  const [caretakerName, setCaretakerName] = useState("");
  const [caretakerPhone, setCaretakerPhone] = useState("");
  const [stationSearch, setStationSearch] = useState("");

  const filteredStations = useMemo(() => {
    const query = stationSearch.trim();

    return [...waterStations]
      .filter((station) => matchesStationSearch(station, query))
      .sort((left, right) => {
        if (query) {
          const scoreDiff = getStationSearchScore(left, query) - getStationSearchScore(right, query);

          if (scoreDiff !== 0) {
            return scoreDiff;
          }
        }

        return compareStationCode(left, right);
      });
  }, [stationSearch, waterStations]);

  const resetDepartmentForm = () => {
    setDepartmentId("");
    setDepartmentName("");
  };

  const resetTeamForm = () => {
    setTeamId("");
    setTeamName("");
    setTeamDepartmentId("");
    setTeamLeaderUserId("");
  };

  const resetUserForm = () => {
    setUserId("");
    setFullName("");
    setUsername("");
    setPassword("");
    setRole("dispatcher");
    setUserDepartmentId("");
    setUserTeamId("");
    setPhone("");
  };

  const resetStationForm = () => {
    setStationId("");
    setStationCode("");
    setLocation("");
    setCaretakerName("");
    setCaretakerPhone("");
  };

  return (
    <div className="app-page">
      <PageHeader title="Админ" />

      <div className="flex flex-wrap gap-2.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`rounded-full border border-slate-200 px-3.5 py-2 text-sm font-semibold transition ${
              activeTab === tab.id ? "border-brand-700 bg-brand-700 text-white" : "bg-white text-slate-600 shadow-card"
            }`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "departments" ? (
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <Card className="space-y-4">
            <h2 className="text-xl font-bold text-ink-900">
              {departmentId ? "Алба засах" : "Алба нэмэх"}
            </h2>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!departmentName.trim()) return;
                upsertDepartment({ id: departmentId, name: departmentName.trim() });
                resetDepartmentForm();
              }}
            >
              <TextInput
                label="Албаны нэр"
                onChange={(event) => setDepartmentName(event.target.value)}
                required
                value={departmentName}
              />
              <div className="flex gap-3">
                <Button type="submit">{departmentId ? "Шинэчлэх" : "Нэмэх"}</Button>
                {departmentId ? (
                  <Button onClick={resetDepartmentForm} type="button" variant="ghost">
                    Болих
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>

          <Card className={scrollCardClass}>
            <div className={scrollBodyClass}>
              {departments.map((department) => (
                <div key={department.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div>
                    <p className="text-lg font-semibold text-ink-900">{department.name}</p>
                    <p className="text-sm text-slate-500">{department.id}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setDepartmentId(department.id);
                        setDepartmentName(department.name);
                      }}
                      type="button"
                      variant="secondary"
                    >
                      Засах
                    </Button>
                    <Button onClick={() => deleteDepartment(department.id)} type="button" variant="danger">
                      Устгах
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "teams" ? (
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <Card className="space-y-4">
            <h2 className="text-xl font-bold text-ink-900">
              {teamId ? "Засварын бригад засах" : "Засварын бригад нэмэх"}
            </h2>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!teamName.trim() || !teamDepartmentId || !teamLeaderUserId) return;
                upsertTeam({
                  id: teamId,
                  name: teamName.trim(),
                  departmentId: teamDepartmentId,
                  leaderUserId: teamLeaderUserId,
                });
                resetTeamForm();
              }}
            >
              <TextInput
                label="Засварын бригадын нэр"
                onChange={(event) => setTeamName(event.target.value)}
                required
                value={teamName}
              />
              <SelectInput
                label="Алба"
                onChange={(event) => setTeamDepartmentId(event.target.value)}
                required
                value={teamDepartmentId}
              >
                <option value="">Алба сонгох</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </SelectInput>
              <SelectInput
                label="Хэрэглэгч"
                onChange={(event) => setTeamLeaderUserId(event.target.value)}
                required
                value={teamLeaderUserId}
              >
                <option value="">Хэрэглэгч сонгох</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </SelectInput>
              <div className="flex gap-3">
                <Button type="submit">{teamId ? "Шинэчлэх" : "Нэмэх"}</Button>
                {teamId ? (
                  <Button onClick={resetTeamForm} type="button" variant="ghost">
                    Болих
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>

          <Card className={scrollCardClass}>
            <div className={scrollBodyClass}>
              {teams.map((team) => (
                <div key={team.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-ink-900">{team.name}</p>
                      <p className="text-sm text-slate-500">
                        {departments.find((department) => department.id === team.departmentId)?.name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {users.find((user) => user.id === team.leaderUserId)?.fullName ?? "Хуваарилагдаагүй"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setTeamId(team.id);
                          setTeamName(team.name);
                          setTeamDepartmentId(team.departmentId);
                          setTeamLeaderUserId(team.leaderUserId);
                        }}
                        type="button"
                        variant="secondary"
                      >
                        Засах
                      </Button>
                      <Button onClick={() => deleteTeam(team.id)} type="button" variant="danger">
                        Устгах
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "users" ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="space-y-4">
            <h2 className="text-xl font-bold text-ink-900">
              {userId ? "Хэрэглэгч засах" : "Хэрэглэгч нэмэх"}
            </h2>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!fullName.trim() || !username.trim() || !password.trim()) return;
                upsertUser({
                  id: userId,
                  fullName: fullName.trim(),
                  username: username.trim(),
                  password: password.trim(),
                  role,
                  departmentId: userDepartmentId || undefined,
                  teamId: userTeamId || undefined,
                  phone: phone.trim(),
                });
                resetUserForm();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Нэр" onChange={(event) => setFullName(event.target.value)} required value={fullName} />
                <TextInput label="Утас" onChange={(event) => setPhone(event.target.value)} value={phone} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Нэвтрэх нэр" onChange={(event) => setUsername(event.target.value)} required value={username} />
                <TextInput label="Нууц үг" onChange={(event) => setPassword(event.target.value)} required value={password} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectInput label="Role" onChange={(event) => setRole(event.target.value as Role)} value={role}>
                  {roleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </SelectInput>
                <SelectInput
                  label="Алба"
                  onChange={(event) => {
                    setUserDepartmentId(event.target.value);
                    setUserTeamId("");
                  }}
                  value={userDepartmentId}
                >
                  <option value="">Сонгох</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </SelectInput>
                <SelectInput label="Засварын бригад" onChange={(event) => setUserTeamId(event.target.value)} value={userTeamId}>
                  <option value="">Сонгох</option>
                  {teams
                    .filter((team) => !userDepartmentId || team.departmentId === userDepartmentId)
                    .map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                </SelectInput>
              </div>
              <div className="flex gap-3">
                <Button type="submit">{userId ? "Шинэчлэх" : "Нэмэх"}</Button>
                {userId ? (
                  <Button onClick={resetUserForm} type="button" variant="ghost">
                    Болих
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>

          <Card className={scrollCardClass}>
            <div className={scrollBodyClass}>
              {users.map((user) => (
                <div key={user.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-ink-900">{user.fullName}</p>
                      <p className="text-sm text-slate-500">
                        {user.username} | {user.role}
                      </p>
                      <p className="text-sm text-slate-500">
                        {departments.find((department) => department.id === user.departmentId)?.name ?? "Албагүй"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setUserId(user.id);
                          setFullName(user.fullName);
                          setUsername(user.username);
                          setPassword(user.password);
                          setRole(user.role);
                          setUserDepartmentId(user.departmentId ?? "");
                          setUserTeamId(user.teamId ?? "");
                          setPhone(user.phone);
                        }}
                        type="button"
                        variant="secondary"
                      >
                        Засах
                      </Button>
                      <Button onClick={() => deleteUser(user.id)} type="button" variant="danger">
                        Устгах
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "stations" ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="space-y-4">
            <h2 className="text-xl font-bold text-ink-900">
              {stationId ? "Ус түгээх байр засах" : "Ус түгээх байр нэмэх"}
            </h2>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const normalizedCode = stationCode.trim();
                const derivedBagNo = Number(normalizedCode.split("-")[0]);
                if (!normalizedCode || !derivedBagNo) return;
                upsertStation({
                  id: stationId,
                  code: normalizedCode,
                  name: "",
                  bagNo: derivedBagNo,
                  location: location.trim(),
                  caretakerName: caretakerName.trim(),
                  caretakerPhone: caretakerPhone.trim(),
                });
                resetStationForm();
              }}
            >
              <TextInput label="Код" onChange={(event) => setStationCode(event.target.value)} required value={stationCode} />
              <TextInput label="Байршил" onChange={(event) => setLocation(event.target.value)} value={location} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Хянагч" onChange={(event) => setCaretakerName(event.target.value)} value={caretakerName} />
                <TextInput label="Хянагчийн утас" onChange={(event) => setCaretakerPhone(event.target.value)} value={caretakerPhone} />
              </div>
              <div className="flex gap-3">
                <Button type="submit">{stationId ? "Шинэчлэх" : "Нэмэх"}</Button>
                {stationId ? (
                  <Button onClick={resetStationForm} type="button" variant="ghost">
                    Болих
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>

          <Card className={scrollCardClass}>
            <div className="border-b border-slate-200 pb-4">
              <TextInput
                label="Ус түгээх байр хайх"
                onChange={(event) => setStationSearch(event.target.value)}
                placeholder="Код, нэр, байршил, хянагчаар хайх"
                value={stationSearch}
              />
            </div>

            <div className="grid content-start gap-3.5 md:grid-cols-2 2xl:grid-cols-3 scroll-pane">
              {filteredStations.length ? (
                filteredStations.map((station) => (
                  <div
                    key={station.id}
                    className="flex h-full min-h-[188px] flex-col rounded-2xl border border-slate-200 bg-slate-50 p-3.5"
                  >
                    <div className="space-y-3">
                      <h3 className="whitespace-nowrap text-[1.85rem] font-extrabold leading-none text-ink-900">{station.code}</h3>
                      <p className="line-clamp-2 text-sm text-slate-500">{station.location || "Байршил оруулаагүй"}</p>
                      <p className="line-clamp-2 text-sm text-slate-500">
                        {station.caretakerName || "Хянагч оруулаагүй"}
                        {station.caretakerPhone ? ` | ${station.caretakerPhone}` : ""}
                      </p>
                    </div>

                    <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                      <Button
                        onClick={() => {
                          setStationId(station.id);
                          setStationCode(station.code);
                          setLocation(station.location);
                          setCaretakerName(station.caretakerName);
                          setCaretakerPhone(station.caretakerPhone);
                        }}
                        type="button"
                        variant="secondary"
                      >
                        Засах
                      </Button>
                      <Button onClick={() => deleteStation(station.id)} type="button" variant="danger">
                        Устгах
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full"><EmptyState title="Ус түгээх байр олдсонгүй" /></div>
              )}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
};




