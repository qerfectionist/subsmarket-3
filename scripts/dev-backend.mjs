#!/usr/bin/env node

process.env.APP_ENV = "development";
process.env.DEV_AUTH_ENABLED = "true";
process.argv.splice(
  2,
  process.argv.length - 2,
  "-m",
  "uvicorn",
  "subsmarket.main:app",
  "--host",
  "127.0.0.1",
  "--port",
  "8000",
  "--reload"
);

await import("./run-python.mjs");
