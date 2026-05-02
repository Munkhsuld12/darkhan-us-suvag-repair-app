import dotenv from "dotenv";
import { pool, testDbConnection } from "./db"; // dotenv.config() db.ts-д эхлүүлнэ → JWT_SECRET/DATABASE_URL бэлэн болно
import app from "./app";

dotenv.config(); // db.ts аль хэдийн дуудсан ч redundant байх нь дээр

const portEnv = process.env.PORT;
const port = portEnv ? parseInt(portEnv, 10) : 4000;
if (isNaN(port)) throw new Error(`PORT env буруу утга: "${portEnv}"`);

const startServer = async () => {
  try {
    await testDbConnection();

    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`Backend server running on http://localhost:${port}`);
      console.log(`Health check: http://localhost:${port}/api/health`);
    });

    const shutdown = async (signal: string) => {
      console.log(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        try {
          await pool.end();
          console.log("PostgreSQL pool closed");
        } catch (err) {
          console.error("Error closing pool:", err);
        }
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start backend:", error);
    process.exit(1);
  }
};

void startServer();