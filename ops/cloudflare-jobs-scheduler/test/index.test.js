import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import worker, { executeJobs, SchedulerError } from "../src/index.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function environment(overrides = {}) {
  return {
    API_BASE_URL: "https://api.subsmarket.xyz",
    INTERNAL_JOB_TOKEN: "jobs-secret",
    HEARTBEAT_URL: "https://heartbeat.example/success",
    HEARTBEAT_FAILURE_URL: "https://heartbeat.example/failure",
    TRIGGER_TOKEN: "trigger-secret",
    ...overrides,
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("runs due jobs, dispatch, health and success heartbeat in order", async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/run-due")) return jsonResponse({ job_errors: [] });
    if (String(url).endsWith("/dispatch-notifications")) {
      return jsonResponse({ selected: 2, sent: 2, retried: 0, failed: 0 });
    }
    if (String(url).endsWith("/health")) {
      return jsonResponse({ status: "ok", warnings: [] });
    }
    return new Response("ok");
  };

  const result = await executeJobs(environment());

  assert.equal(result.ok, true);
  assert.deepEqual(
    calls.map(({ url }) => url),
    [
      "https://api.subsmarket.xyz/api/internal/jobs/run-due",
      "https://api.subsmarket.xyz/api/internal/jobs/dispatch-notifications",
      "https://api.subsmarket.xyz/api/internal/jobs/health",
      "https://heartbeat.example/success",
    ],
  );
  assert.equal(calls[0].options.headers["X-Internal-Job-Token"], "jobs-secret");
});

test("does not send success heartbeat when run-due reports an error", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith("/run-due")) {
      return jsonResponse({ job_errors: [{ step: "payments" }] });
    }
    return new Response("failure recorded");
  };

  await assert.rejects(
    executeJobs(environment()),
    (error) => error instanceof SchedulerError && error.message.includes("job errors"),
  );
  assert.deepEqual(calls, [
    "https://api.subsmarket.xyz/api/internal/jobs/run-due",
    "https://heartbeat.example/failure",
  ]);
});

test("treats notification failures as a failed scheduler run", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith("/run-due")) return jsonResponse({ job_errors: [] });
    if (String(url).endsWith("/dispatch-notifications")) {
      return jsonResponse({ selected: 1, sent: 0, retried: 0, failed: 1 });
    }
    return new Response("failure recorded");
  };

  await assert.rejects(executeJobs(environment()), /dispatch reported failures/);
  assert.equal(calls.at(-1), "https://heartbeat.example/failure");
  assert.ok(!calls.includes("https://heartbeat.example/success"));
});

test("manual failure test is protected and calls the failure heartbeat", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response("failure recorded");
  };

  const unauthorized = await worker.fetch(
    new Request("https://scheduler.example/run?simulate_failure=true", {
      method: "POST",
    }),
    environment(),
  );
  assert.equal(unauthorized.status, 401);

  const response = await worker.fetch(
    new Request("https://scheduler.example/run?simulate_failure=true", {
      method: "POST",
      headers: { Authorization: "Bearer trigger-secret" },
    }),
    environment({ TRIGGER_TOKEN: "trigger-secret\r\n" }),
  );
  assert.equal(response.status, 503);
  assert.deepEqual(calls, ["https://heartbeat.example/failure"]);
});

test("rejects an insecure API base URL before sending requests", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return jsonResponse({});
  };

  await assert.rejects(
    executeJobs(environment({ API_BASE_URL: "http://api.example" })),
    /must use HTTPS/,
  );
  assert.equal(called, true, "the configured failure heartbeat should still be called");
});
