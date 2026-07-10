import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { InternalAxiosRequestConfig, AxiosError } from "axios";

// api.ts membaca localStorage & window.location saat modul di-load DAN saat
// interceptor jalan, jadi kita import ulang modulnya tiap test lewat
// vi.resetModules() supaya tidak ada state bocor antar test.

describe("lib/api", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("request interceptor menambahkan header Authorization jika ada access_token", async () => {
    localStorage.setItem("access_token", "token-123");
    const { default: api } = await import("@/lib/api");

    const config = { headers: {} } as InternalAxiosRequestConfig;
    const requestInterceptor = (api.interceptors.request as any).handlers[0]
      .fulfilled;
    const result = requestInterceptor(config);

    expect(result.headers.Authorization).toBe("Bearer token-123");
  });

  it("request interceptor TIDAK menambahkan header Authorization jika belum login", async () => {
    const { default: api } = await import("@/lib/api");

    const config = { headers: {} } as InternalAxiosRequestConfig;
    const requestInterceptor = (api.interceptors.request as any).handlers[0]
      .fulfilled;
    const result = requestInterceptor(config);

    expect(result.headers.Authorization).toBeUndefined();
  });

  it("response interceptor pada error 401: menghapus access_token dari localStorage", async () => {
    localStorage.setItem("access_token", "token-123");

    // window.location.href tidak bisa di-assign langsung di jsdom tanpa
    // konfigurasi navigation, jadi kita stub seluruh window.location.
    const locationStub = { href: "" };
    vi.stubGlobal("location", locationStub);

    const { default: api } = await import("@/lib/api");
    const responseErrorInterceptor = (api.interceptors.response as any)
      .handlers[0].rejected;

    const fakeError = {
      response: { status: 401 },
    } as AxiosError;

    await expect(responseErrorInterceptor(fakeError)).rejects.toBe(fakeError);
    expect(localStorage.getItem("access_token")).toBeNull();
  });

  it("response interceptor pada error 401: redirect ke /login", async () => {
    localStorage.setItem("access_token", "token-123");
    const locationStub = { href: "" };
    vi.stubGlobal("location", locationStub);

    const { default: api } = await import("@/lib/api");
    const responseErrorInterceptor = (api.interceptors.response as any)
      .handlers[0].rejected;

    const fakeError = { response: { status: 401 } } as AxiosError;
    await responseErrorInterceptor(fakeError).catch(() => {});

    expect(locationStub.href).toBe("/login");
  });

  it("response interceptor pada error selain 401 (mis. 500): TIDAK menghapus token / redirect", async () => {
    localStorage.setItem("access_token", "token-123");
    const locationStub = { href: "" };
    vi.stubGlobal("location", locationStub);

    const { default: api } = await import("@/lib/api");
    const responseErrorInterceptor = (api.interceptors.response as any)
      .handlers[0].rejected;

    const fakeError = { response: { status: 500 } } as AxiosError;
    await responseErrorInterceptor(fakeError).catch(() => {});

    expect(localStorage.getItem("access_token")).toBe("token-123");
    expect(locationStub.href).toBe("");
  });

  it("response interceptor pada 401 dari /auth/login sendiri: TIDAK redirect paksa (biar halaman login yang tangani)", async () => {
    // Regresi bug: sebelumnya SEMUA 401 (termasuk saat login gagal) memicu
    // window.location.href = "/login", yang menyebabkan full page reload dan
    // menghapus toast error yang seharusnya tampil ke user.
    localStorage.setItem("access_token", "token-lama");
    const locationStub = { href: "" };
    vi.stubGlobal("location", locationStub);

    const { default: api } = await import("@/lib/api");
    const responseErrorInterceptor = (api.interceptors.response as any)
      .handlers[0].rejected;

    const fakeLoginError = {
      config: { url: "/auth/login" },
      response: {
        status: 401,
        data: { message: "Username atau password salah" },
      },
    } as AxiosError;

    await expect(responseErrorInterceptor(fakeLoginError)).rejects.toBe(
      fakeLoginError,
    );
    expect(locationStub.href).toBe("");
    // token lama (bukan milik sesi login yang gagal ini) tidak ikut terhapus
    expect(localStorage.getItem("access_token")).toBe("token-lama");
  });

  it("baseURL memakai NEXT_PUBLIC_API_URL jika di-set, fallback ke localhost:3000", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.eperencanaan.example");
    const { default: api } = await import("@/lib/api");
    expect(api.defaults.baseURL).toBe("https://api.eperencanaan.example");
  });
});
