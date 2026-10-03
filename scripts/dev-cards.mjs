#!/usr/bin/env node
/**
 * Developer CLI tool for SubsMarket test cards & dev data.
 *
 * Usage:
 *   node scripts/dev-cards.mjs seed       - Reset & seed incoming test cards
 *   node scripts/dev-cards.mjs clean      - Clean all test cards & archive
 *   node scripts/dev-cards.mjs archive    - Clean only archive
 *   node scripts/dev-cards.mjs orders     - Seed demo account orders
 */

const BACKEND_PORT = process.env.PORT || 8002;
const BASE_URL = process.env.API_URL || `http://127.0.0.1:${BACKEND_PORT}`;

const command = process.argv[2] || "help";

async function postDevEndpoint(path) {
  const url = `${BASE_URL}${path}`;
  console.log(`[dev-cards] Calling POST ${url}...`);
  try {
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      console.error(`[dev-cards] Error: HTTP ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.error(text);
      process.exit(1);
    }
    const data = await res.json();
    console.log(`[dev-cards] Success:`, data);
  } catch (err) {
    console.error(`[dev-cards] Connection failed:`, err.message);
    process.exit(1);
  }
}

switch (command) {
  case "seed":
    await postDevEndpoint("/api/dev/reset-and-seed");
    break;
  case "clean":
  case "clear":
    await postDevEndpoint("/api/dev/clean-all");
    break;
  case "archive":
    await postDevEndpoint("/api/dev/clear-archive");
    break;
  case "orders":
    await postDevEndpoint("/api/dev/seed-account-orders");
    break;
  default:
    console.log(`
SubsMarket Dev Cards CLI:
  node scripts/dev-cards.mjs seed      - Сгенерировать базовый набор карточек в БД
  node scripts/dev-cards.mjs clean     - Очистить все заявки и архив
  node scripts/dev-cards.mjs archive   - Очистить только архив
  node scripts/dev-cards.mjs orders    - Засеять демо-заказы аккаунтов
`);
    break;
}
