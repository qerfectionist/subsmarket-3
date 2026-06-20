import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = (__ENV.BASE_URL || "").replace(/\/+$/, "");
const virtualUsers = Number(__ENV.K6_VUS || "10");
const duration = __ENV.K6_DURATION || "30s";
const telegramInitData = __ENV.TELEGRAM_INIT_DATA || "";

if (!baseUrl.startsWith("https://") && !baseUrl.startsWith("http://")) {
  throw new Error("BASE_URL must start with http:// or https://");
}

export const options = {
  vus: virtualUsers,
  duration,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
    checks: ["rate>0.99"],
  },
};

function expectOk(response, name) {
  check(response, {
    [`${name} returned HTTP 200`]: (result) => result.status === 200,
  });
}

export default function () {
  expectOk(http.get(`${baseUrl}/health`), "health");
  expectOk(http.get(`${baseUrl}/ready`), "readiness");
  expectOk(
    http.get(`${baseUrl}/api/catalog/family-services?status=active`),
    "catalog",
  );

  if (telegramInitData) {
    expectOk(
      http.get(`${baseUrl}/api/families/page?limit=20`, {
        headers: {
          "X-Telegram-Init-Data": telegramInitData,
        },
      }),
      "authenticated family search",
    );
  }

  sleep(1);
}

