const REQUEST_TIMEOUT_MS = 60_000;

export class SchedulerError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "SchedulerError";
    this.details = details;
  }
}

async function readJson(response, label) {
  const body = await response.text();
  let payload;
  try {
    payload = body ? JSON.parse(body) : {};
  } catch {
    throw new SchedulerError(`${label} returned invalid JSON`, {
      status: response.status,
    });
  }
  if (!response.ok) {
    throw new SchedulerError(`${label} returned HTTP ${response.status}`, {
      status: response.status,
      payload,
    });
  }
  return payload;
}

async function callApi(env, path, { method = "GET" } = {}) {
  const response = await fetch(`${env.API_BASE_URL.replace(/\/$/, "")}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "User-Agent": "SubsMarket Cloudflare jobs scheduler",
      "X-Internal-Job-Token": env.INTERNAL_JOB_TOKEN,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return readJson(response, path);
}

async function ping(url, label) {
  if (!url) return;
  const response = await fetch(url, {
    headers: { "User-Agent": "SubsMarket Cloudflare jobs scheduler" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new SchedulerError(`${label} returned HTTP ${response.status}`);
  }
}

function validateEnvironment(env) {
  for (const key of ["API_BASE_URL", "INTERNAL_JOB_TOKEN"]) {
    if (!env[key]) throw new SchedulerError(`${key} is not configured`);
  }
  const apiUrl = new URL(env.API_BASE_URL);
  if (apiUrl.protocol !== "https:") {
    throw new SchedulerError("API_BASE_URL must use HTTPS");
  }
}

export async function executeJobs(env, { simulateFailure = false } = {}) {
  const runId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    validateEnvironment(env);
    if (simulateFailure) {
      throw new SchedulerError("Simulated scheduler failure");
    }

    const due = await callApi(env, "/api/internal/jobs/run-due", {
      method: "POST",
    });
    if (!Array.isArray(due.job_errors) || due.job_errors.length !== 0) {
      throw new SchedulerError("run-due reported job errors", {
        jobErrorCount: Array.isArray(due.job_errors) ? due.job_errors.length : null,
      });
    }

    const dispatch = await callApi(
      env,
      "/api/internal/jobs/dispatch-notifications",
      { method: "POST" },
    );
    if (typeof dispatch.failed !== "number" || dispatch.failed !== 0) {
      throw new SchedulerError("notification dispatch reported failures", {
        failed: dispatch.failed ?? null,
      });
    }

    const health = await callApi(env, "/api/internal/jobs/health");
    if (health.status !== "ok" || (health.warnings?.length ?? 0) !== 0) {
      throw new SchedulerError("jobs health is not ok", {
        status: health.status ?? null,
        warningCount: health.warnings?.length ?? null,
      });
    }

    await ping(env.HEARTBEAT_URL, "success heartbeat");
    const result = {
      ok: true,
      runId,
      durationMs: Date.now() - startedAt,
      due,
      dispatch,
      healthStatus: health.status,
    };
    console.log(JSON.stringify({ ...result, due: undefined }));
    return result;
  } catch (error) {
    const schedulerError =
      error instanceof SchedulerError
        ? error
        : new SchedulerError(error instanceof Error ? error.message : String(error));
    try {
      await ping(env.HEARTBEAT_FAILURE_URL, "failure heartbeat");
    } catch (heartbeatError) {
      console.error(
        JSON.stringify({
          event: "failure_heartbeat_failed",
          runId,
          error: heartbeatError instanceof Error ? heartbeatError.message : String(heartbeatError),
        }),
      );
    }
    console.error(
      JSON.stringify({
        event: "jobs_scheduler_failed",
        runId,
        durationMs: Date.now() - startedAt,
        error: schedulerError.message,
        details: schedulerError.details,
      }),
    );
    throw schedulerError;
  }
}

function isAuthorized(request, env) {
  if (!env.TRIGGER_TOKEN) return false;
  return request.headers.get("Authorization") === `Bearer ${env.TRIGGER_TOKEN}`;
}

export default {
  async scheduled(_controller, env) {
    await executeJobs(env);
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }
    if (request.method !== "POST" || url.pathname !== "/run") {
      return Response.json({ detail: "NOT_FOUND" }, { status: 404 });
    }
    if (!isAuthorized(request, env)) {
      return Response.json({ detail: "UNAUTHORIZED" }, { status: 401 });
    }
    try {
      const result = await executeJobs(env, {
        simulateFailure: url.searchParams.get("simulate_failure") === "true",
      });
      return Response.json({
        ok: result.ok,
        run_id: result.runId,
        duration_ms: result.durationMs,
      });
    } catch (error) {
      return Response.json(
        {
          ok: false,
          detail: error instanceof Error ? error.message : "SCHEDULER_FAILED",
        },
        { status: 503 },
      );
    }
  },
};
