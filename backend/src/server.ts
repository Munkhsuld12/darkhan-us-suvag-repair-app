import dotenv from "dotenv";
import app from "./app";
import { testDbConnection } from "./db";

dotenv.config();

const port = Number(process.env.PORT || 4000);

const startServer = async () => {
  try {
    await testDbConnection();

    app.listen(port, "0.0.0.0", () => {
      console.log(`Backend server running on http://localhost:${port}`);
      console.log(`Health check: http://localhost:${port}/api/health`);
    });
  } catch (error) {
    console.error("Failed to start backend:", error);
    process.exit(1);
  }
};

void startServer();