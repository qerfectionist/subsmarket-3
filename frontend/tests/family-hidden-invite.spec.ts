import { expect, test, type Page } from "@playwright/test";

const appUrl = process.env.TMA_APP_URL ?? "http://127.0.0.1:5174/";
const apiUrl = process.env.TMA_API_URL ?? "http://127.0.0.1:8001";

const owner = { id: 200001, username: "demo_owner", firstName: "Demo Owner" };

function devHeaders(user: { id: number; username: string; firstName: string }) {
  return {
    "X-Dev-Telegram-User-Id": String(user.id),
    "X-Dev-Telegram-Username": user.username,
    "X-Dev-Telegram-First-Name": user.firstName
  };
}

test.use({
  deviceScaleFactor: 1,
  isMobile: true,
  viewport: { width: 390, height: 844 }
});

test.beforeEach(async ({ page }) => {
  await page.request.post(`${apiUrl}/api/dev/reset-demo-data`);
  await page.request.post(`${apiUrl}/api/catalog/import-family-services`);
});

test.afterEach(async ({ page }) => {
  await page.request.post(`${apiUrl}/api/dev/reset-demo-data`);
});

async function openAsDevUser(page: Page, userId: number, startParam: string) {
  await page.addInitScript((id) => {
    window.localStorage.clear();
    window.localStorage.setItem("subsmarket.devTelegramUser", String(id));
  }, userId);
  await page.goto(`${appUrl}?tgWebAppStartParam=${startParam}`, {
    waitUntil: "domcontentloaded"
  });
}

test("hidden family accepts a request only through its current invite link", async ({
  page,
  browser
}) => {
  const services = await (
    await page.request.get(`${apiUrl}/api/catalog/family-services`)
  ).json();
  const service = services.find(
    (item: { family_type: string; max_members: number }) =>
      item.family_type === "subscription" && item.max_members >= 3
  );
  const nextPaymentDate = new Date(Date.now() + 7 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  const created = await page.request.post(`${apiUrl}/api/families`, {
    headers: devHeaders(owner),
    data: {
      service_id: service.id,
      period: "monthly",
      max_members: 3,
      total_price_kzt: 3000,
      payment_day: 15,
      next_payment_date: nextPaymentDate,
      payment_bank: "kaspi",
      payment_phone: "+77001234567"
    }
  });
  expect(created.status()).toBe(201);
  const familyId = (await created.json()).family.id as string;
  const oldCode = (
    await (
      await page.request.post(`${apiUrl}/api/families/${familyId}/invite`, {
        headers: devHeaders(owner)
      })
    ).json()
  ).code as string;
  const hidden = await page.request.patch(
    `${apiUrl}/api/families/${familyId}/visibility`,
    { headers: devHeaders(owner), data: { is_search_visible: false } }
  );
  expect(hidden.status()).toBe(200);
  const newCode = (
    await (
      await page.request.post(`${apiUrl}/api/families/${familyId}/invite/rotate`, {
        headers: devHeaders(owner)
      })
    ).json()
  ).code as string;

  // The current link opens the family and the request goes through.
  await openAsDevUser(page, 200002, `invite_${newCode}`);
  const sendButton = page.getByTestId("detail-send-request-button");
  await expect(sendButton).toBeVisible();
  await sendButton.click();
  await expect
    .poll(async () => {
      const response = await page.request.get(
        `${apiUrl}/api/families/${familyId}/requests`,
        { headers: devHeaders(owner) }
      );
      const requests = (await response.json()) as Array<{ status: string }>;
      return requests.filter((item) => item.status === "pending").length;
    })
    .toBe(1);

  // A rotated link no longer opens the family.
  const stalePage = await browser.newPage();
  await openAsDevUser(stalePage, 200003, `invite_${oldCode}`);
  await expect(stalePage.getByTestId("detail-send-request-button")).toHaveCount(0);
  const staleView = await stalePage.request.get(
    `${apiUrl}/api/families/${familyId}/view?invite_code=${oldCode}`,
    { headers: devHeaders({ id: 200003, username: "demo_newbie", firstName: "New" }) }
  );
  expect(staleView.status()).toBe(404);
  await stalePage.close();
});
