import { test, expect } from "@playwright/test";

// Backend di-mock lewat page.route() supaya test ini deterministik dan tidak
// bergantung pada backend/DB nyala. Skenario yang butuh backend asli (alur
// planning penuh, dll) ada di file e2e terpisah dan didokumentasikan perlu
// backend berjalan (lihat TESTING_PLAN.md §7-8).
const API_BASE = "http://localhost:3000";

test.describe("Login", () => {
  test("login sukses redirect ke /dashboard", async ({ page }) => {
    await page.route(`${API_BASE}/auth/login`, async (route) => {
      const body = route.request().postDataJSON();
      expect(body).toEqual({ username: "admin", password: "admin123" });

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "fake.jwt.token",
          user: {
            id: "u1",
            username: "admin",
            name: "Admin",
            role: "ADMINISTRATOR",
          },
        }),
      });
    });

    await page.goto("/login");
    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password").fill("admin123");
    await page.getByRole("button", { name: /masuk/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("main").getByText(/selamat datang, admin/i),
    ).toBeVisible();
  });

  test("login gagal (username/password salah) menampilkan pesan error, tidak redirect", async ({
    page,
  }) => {
    await page.route(`${API_BASE}/auth/login`, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Username atau password salah" }),
      });
    });

    await page.goto("/login");
    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password").fill("salahsekali");
    await page.getByRole("button", { name: /masuk/i }).click();

    await expect(
      page
        .getByRole("region", { name: /notifications/i })
        .getByText(/username atau password salah/i),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("validasi client-side: password < 6 karakter tidak mengirim request ke API", async ({
    page,
  }) => {
    let apiCalled = false;
    await page.route(`${API_BASE}/auth/login`, async (route) => {
      apiCalled = true;
      await route.fulfill({ status: 200, body: "{}" });
    });

    await page.goto("/login");
    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password").fill("123");
    await page.getByRole("button", { name: /masuk/i }).click();

    await expect(page.getByText(/password minimal 6 karakter/i)).toBeVisible();
    expect(apiCalled).toBe(false);
  });

  test("validasi client-side: username kosong menampilkan error", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Password").fill("admin123");
    await page.getByRole("button", { name: /masuk/i }).click();

    await expect(page.getByText(/username wajib diisi/i)).toBeVisible();
  });

  test("tombol show/hide password mengganti tipe input", async ({ page }) => {
    await page.goto("/login");
    const passwordInput = page.getByLabel("Password");
    await expect(passwordInput).toHaveAttribute("type", "password");

    await page.getByTestId("toggle-password-visibility").click();
    await expect(passwordInput).toHaveAttribute("type", "text");
  });
});
