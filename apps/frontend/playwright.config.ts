import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // fullyParallel + banyak worker melawan `next dev` bisa memicu recompile/HMR
  // yang mereset state React di tengah test (toast hilang, form ke-reset).
  // Matikan paralelisme di sini; kalau butuh lebih cepat, ganti `webServer.command`
  // jadi "npm run build && npm run start" (production build, aman diparalelkan).
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "html",

  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // Otomatis nyalakan `next dev` sebelum test jalan (dan matikan setelahnya),
  // supaya `npx playwright test` cukup satu perintah tanpa langkah manual.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
