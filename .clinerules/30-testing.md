# 30-testing.md: Testing & Verification Strategy

1. **Targeted Module Testing**:
   - After editing a specific module, run ONLY relevant tests:
     `npx playwright test tests/tma-smoke.spec.ts -g "<Filter>"`
     or `node scripts/run-python.mjs -m pytest backend/tests/test_xxx.py`.

2. **Full Regression Cadence**:
   - Run full regression (`npm run check` or `verify -Full`) strictly once every 10 changes.
   - Do NOT run heavy full regressions on minor incremental edits.

3. **Mandatory Visual Inspection**:
   - Before completing UI tasks, take a screenshot via Playwright.
   - Inspect the generated artifact visually to guarantee layout fidelity.
