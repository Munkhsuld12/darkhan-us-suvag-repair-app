import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "path";
import adminRoutes from "./routes/admin.routes";
import authRoutes from "./routes/auth.routes";
import complaintRoutes from "./routes/complaint.routes";
import metaRoutes from "./routes/meta.routes";
import reportRoutes from "./routes/report.routes";
import stationRoutes from "./routes/station.routes";
import taskRoutes from "./routes/task.routes";
import ticketRoutes from "./routes/ticket.routes";
import workerRoutes from "./routes/worker.routes";

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:3000", "http://localhost:5173"];

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src-attr": ["'none'"],
      upgradeInsecureRequests: null,   // disable — server is HTTP only
    },
  },
}));
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "Backend is running", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/workers", workerRoutes);

const frontendPath = path.resolve(__dirname, "../../frontend");

// Landing page at root
app.get("/", (_req, res) => {
  res.sendFile(path.join(frontendPath, "about.html"));
});

app.use(express.static(frontendPath));
app.use("/uploads", express.static(path.join(frontendPath, "uploads")));

app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.use((_req, res) => {
  res.status(404).json({ ok: false, message: "Route not found" });
});

export default app;
