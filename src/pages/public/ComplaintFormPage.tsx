import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { SelectInput, TextInput, TextareaInput } from "../../components/forms/FormField";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { issueTypeOptions } from "../../data/seed";
import { getStationOptionLabel } from "../../lib/utils";

export const ComplaintFormPage = ({ modal = false }: { modal?: boolean }) => {
  const { waterStations, submitComplaint } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const stationIdFromQuery = searchParams.get("stationId");
  const state = location.state as { backgroundLocation?: unknown } | undefined;

  const [stationCode, setStationCode] = useState("");
  const [issueType, setIssueType] = useState(issueTypeOptions[0]);
  const [description, setDescription] = useState("");
  const [citizenName, setCitizenName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!stationIdFromQuery) {
      return;
    }

    const station = waterStations.find((item) => item.id === stationIdFromQuery);
    if (station) {
      setStationCode(station.code);
    }
  }, [stationIdFromQuery, waterStations]);

  const stationOptions = useMemo(
    () => waterStations.map((station) => ({ value: station.code, label: getStationOptionLabel(station) })),
    [waterStations],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const station = waterStations.find(
      (item) => item.code.toLowerCase() === stationCode.trim().toLowerCase(),
    );

    const nextErrors: Record<string, string> = {};
    if (!station) nextErrors.stationCode = "Код буруу байна.";
    if (!issueType) nextErrors.issueType = "Төрөл сонгоно уу.";
    if (!description.trim()) nextErrors.description = "Тайлбар оруулна уу.";
    if (!citizenName.trim()) nextErrors.citizenName = "Нэр оруулна уу.";
    if (!phoneNumber.trim()) nextErrors.phoneNumber = "Утас оруулна уу.";

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || !station) {
      return;
    }

    submitComplaint({
      stationId: station.id,
      issueType,
      description: description.trim(),
      citizenName: citizenName.trim(),
      phoneNumber: phoneNumber.trim(),
      source: "web",
      photoName,
      createdByLabel: "Иргэн",
    });

    setSuccess("Амжилттай бүртгэгдлээ.");
    setDescription("");
    setCitizenName("");
    setPhoneNumber("");
    setPhotoName("");
    setErrors({});
  };

  const handleClose = () => {
    if (state?.backgroundLocation) {
      navigate(-1);
      return;
    }

    navigate("/", { replace: true });
  };

  const formContent = (
    <form className="field-grid" onSubmit={handleSubmit}>
      <TextInput
        label="Ус түгээх байрны код"
        list="station-code-options"
        onChange={(event) => setStationCode(event.target.value)}
        placeholder="Жишээ: 1-14"
        required
        value={stationCode}
      />
      <datalist id="station-code-options">
        {stationOptions.map((station) => (
          <option key={station.value} value={station.value}>
            {station.label}
          </option>
        ))}
      </datalist>
      {errors.stationCode ? <p className="text-sm text-rose-600">{errors.stationCode}</p> : null}

      <SelectInput
        label="Асуудлын төрөл"
        onChange={(event) => setIssueType(event.target.value)}
        required
        value={issueType}
      >
        {issueTypeOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectInput>

      <TextareaInput
        label="Тайлбар"
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Асуудлаа бичнэ үү"
        required
        value={description}
      />
      {errors.description ? <p className="text-sm text-rose-600">{errors.description}</p> : null}

      <div className="field-grid sm:grid-cols-2">
        <div>
          <TextInput
            label="Нэр"
            onChange={(event) => setCitizenName(event.target.value)}
            required
            value={citizenName}
          />
          {errors.citizenName ? <p className="mt-2 text-sm text-rose-600">{errors.citizenName}</p> : null}
        </div>
        <div>
          <TextInput
            label="Утас"
            onChange={(event) => setPhoneNumber(event.target.value)}
            required
            value={phoneNumber}
          />
          {errors.phoneNumber ? <p className="mt-2 text-sm text-rose-600">{errors.phoneNumber}</p> : null}
        </div>
      </div>

      <TextInput
        accept="image/*"
        label="Зураг"
        onChange={(event) => setPhotoName(event.target.files?.[0]?.name ?? "")}
        type="file"
      />
      {photoName ? <p className="text-sm text-slate-500">{photoName}</p> : null}

      {success ? (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{success}</div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit">Илгээх</Button>
      </div>
    </form>
  );

  if (modal) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-ink-900/40 p-3 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-4">
        <div className="flex min-h-full w-full items-start sm:min-h-0 sm:max-w-2xl sm:items-center">
          <Card className="w-full" padding="md">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
              <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">Гомдол, хүсэлт илгээх</h1>
              <button
                className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
                onClick={handleClose}
                type="button"
              >
                Хаах
              </button>
            </div>
            <div className="mt-4">{formContent}</div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl app-page">
      <PageHeader title="Гомдол, хүсэлт илгээх" />
      <Card padding="md">{formContent}</Card>
    </div>
  );
};
