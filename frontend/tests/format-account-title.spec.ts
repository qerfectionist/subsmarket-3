import { test, expect } from "@playwright/test";
import { formatAccountTitle, familyTitle } from "../src/format";

test.describe("formatAccountTitle", () => {
  test("formats Canva Pro stripping годовая подписка", () => {
    expect(formatAccountTitle("Canva", "Canva Pro годовая подписка")).toBe("Canva Pro");
    expect(formatAccountTitle("Canva", "Canva Pro - годовая подписка")).toBe("Canva Pro");
    expect(formatAccountTitle("Canva", "Canva Pro · годовая")).toBe("Canva Pro");
    expect(formatAccountTitle("Canva", "Pro годовая подписка")).toBe("Canva Pro");
    expect(formatAccountTitle("Canva", "Pro")).toBe("Canva Pro");
  });

  test("formats Gemini Advanced stripping на 1 месяц", () => {
    expect(formatAccountTitle("Gemini", "Gemini Advanced на 1 месяц")).toBe("Gemini Advanced");
    expect(formatAccountTitle("Gemini", "Gemini Advanced на месяц")).toBe("Gemini Advanced");
    expect(formatAccountTitle("Gemini", "Gemini Advanced 1 месяц")).toBe("Gemini Advanced");
    expect(formatAccountTitle("Gemini", "Advanced на 1 месяц")).toBe("Gemini Advanced");
    expect(formatAccountTitle("Gemini", "Advanced")).toBe("Gemini Advanced");
  });

  test("formats ChatGPT Plus correctly", () => {
    expect(formatAccountTitle("ChatGPT", "ChatGPT Plus")).toBe("ChatGPT Plus");
    expect(formatAccountTitle("ChatGPT", "ChatGPT Plus на месяц")).toBe("ChatGPT Plus");
    expect(formatAccountTitle("ChatGPT", "Plus на 1 месяц")).toBe("ChatGPT Plus");
    expect(formatAccountTitle("ChatGPT", "Chat gpt pluse")).toBe("Chat gpt pluse");
  });

  test("formats other services cleanly", () => {
    expect(formatAccountTitle("Telegram", "Telegram Premium на 1 год")).toBe("Telegram Premium");
    expect(formatAccountTitle("Spotify", "Premium (1 месяц)")).toBe("Spotify Premium");
    expect(formatAccountTitle("YouTube", "YouTube Premium подписка")).toBe("YouTube Premium");
    expect(formatAccountTitle("Netflix", "Standard 4K на 3 месяца")).toBe("Netflix Standard 4K");
  });

  test("handles empty or fallback cases gracefully", () => {
    expect(formatAccountTitle("Canva", "")).toBe("Canva");
    expect(formatAccountTitle("Canva", null)).toBe("Canva");
    expect(formatAccountTitle("Canva", "годовая подписка")).toBe("Canva");
    expect(formatAccountTitle("", "ChatGPT Plus")).toBe("ChatGPT Plus");
  });
});

test.describe("familyTitle", () => {
  test("formats family subscriptions with default variants when null", () => {
    expect(familyTitle({ service_name: "Netflix", service_variant: null, family_type: "subscription" })).toBe("Netflix Premium");
    expect(familyTitle({ service_name: "Google One", service_variant: null, family_type: "subscription" })).toBe("Google One 2 ТБ");
    expect(familyTitle({ service_name: "Spotify", service_variant: null, family_type: "subscription" })).toBe("Spotify Family");
    expect(familyTitle({ service_name: "Apple Music", service_variant: null, family_type: "subscription" })).toBe("Apple Music Family");
    expect(familyTitle({ service_name: "Apple One", service_variant: null, family_type: "subscription" })).toBe("Apple One Family");
    expect(familyTitle({ service_name: "YouTube Premium", service_variant: null, family_type: "subscription" })).toBe("YouTube Premium Family");
    expect(familyTitle({ service_name: "Яндекс Плюс", service_variant: null, family_type: "subscription" })).toBe("Яндекс Плюс Мульти");
  });

  test("formats family subscriptions with explicit variants", () => {
    expect(familyTitle({ service_name: "Netflix", service_variant: "Premium", family_type: "subscription" })).toBe("Netflix Premium");
    expect(familyTitle({ service_name: "Spotify", service_variant: "Family", family_type: "subscription" })).toBe("Spotify Family");
    expect(familyTitle({ service_name: "Spotify", service_variant: "Spotify Family", family_type: "subscription" })).toBe("Spotify Family");
    expect(familyTitle({ service_name: "Duolingo", service_variant: "Super", family_type: "subscription" })).toBe("Duolingo Super");
  });

  test("formats mobile tariffs with plan_name or default fallback", () => {
    expect(familyTitle({ service_name: "Tele2", family_type: "tariff", service_variant: "Семейный тариф", plan_name: null })).toBe("Tele2 Семейный тариф");
    expect(familyTitle({ service_name: "Tele2", family_type: "tariff", plan_name: "Выгодный" })).toBe("Tele2 Выгодный");
    expect(familyTitle({ service_name: "Beeline", family_type: "tariff", plan_name: "Beeline Семья" })).toBe("Beeline Семья");
  });

  test("handles empty or fallback cases gracefully", () => {
    expect(familyTitle({ service_name: "" })).toBe("Заявка в семью");
    expect(familyTitle({})).toBe("Заявка в семью");
    expect(familyTitle({ service_name: "CustomService", service_variant: null, family_type: "subscription" })).toBe("CustomService");
  });
});
