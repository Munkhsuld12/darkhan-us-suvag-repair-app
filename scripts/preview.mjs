import react from "@vitejs/plugin-react";
import { preview } from "vite";

const parseServerOptions = (argv, defaults) => {
  let host = defaults.host;
  let port = defaults.port;
  let strictPort = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--host") {
      const nextValue = argv[index + 1];
      if (!nextValue || nextValue.startsWith("--")) {
        host = "0.0.0.0";
      } else {
        host = nextValue;
        index += 1;
      }
      continue;
    }

    if (arg.startsWith("--host=")) {
      host = arg.slice("--host=".length) || "0.0.0.0";
      continue;
    }

    if (arg === "--port") {
      const nextValue = argv[index + 1];
      if (nextValue && !nextValue.startsWith("--")) {
        const parsedPort = Number(nextValue);
        if (Number.isFinite(parsedPort)) {
          port = parsedPort;
        }
        index += 1;
      }
      continue;
    }

    if (arg.startsWith("--port=")) {
      const parsedPort = Number(arg.slice("--port=".length));
      if (Number.isFinite(parsedPort)) {
        port = parsedPort;
      }
      continue;
    }

    if (arg === "--strictPort") {
      strictPort = true;
    }
  }

  return { host, port, strictPort };
};

const { host, port, strictPort } = parseServerOptions(process.argv.slice(2), {
  host: "0.0.0.0",
  port: 4173,
});

const server = await preview({
  configFile: false,
  plugins: [react()],
  preview: {
    host,
    port,
    strictPort,
  },
});

server.printUrls();

const shutdown = async () => {
  await server.httpServer?.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
