import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/store/auth";
import type { User } from "@/types";

// Helper: reset store ke kondisi awal sebelum tiap test.
// Zustand store adalah singleton module-level, jadi state HARUS direset manual
// di antara test — kalau tidak, test bisa saling memengaruhi (test pollution).
const resetStore = () => {
  useAuthStore.setState({ user: null, token: null });
  localStorage.clear();
};

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: "user_1",
  username: "satker1",
  name: "Satker Satu",
  role: "SATKER",
  ...overrides,
});

describe("useAuthStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("state awal: belum ada user/token, isAuthenticated() false", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated()).toBe(false);
  });

  it("setAuth() menyimpan user & token ke state", () => {
    const user = buildUser();
    useAuthStore.getState().setAuth(user, "fake.jwt.token");

    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.token).toBe("fake.jwt.token");
    expect(state.isAuthenticated()).toBe(true);
  });

  it("setAuth() juga menulis token ke localStorage key 'access_token'", () => {
    useAuthStore.getState().setAuth(buildUser(), "fake.jwt.token");
    expect(localStorage.getItem("access_token")).toBe("fake.jwt.token");
  });

  it("clearAuth() mengosongkan user & token dari state", () => {
    useAuthStore.getState().setAuth(buildUser(), "fake.jwt.token");
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated()).toBe(false);
  });

  it("clearAuth() menghapus 'access_token' dari localStorage", () => {
    useAuthStore.getState().setAuth(buildUser(), "fake.jwt.token");
    useAuthStore.getState().clearAuth();
    expect(localStorage.getItem("access_token")).toBeNull();
  });

  it("setAuth() dipanggil dua kali (ganti user) menimpa data lama, bukan menggabungkan", () => {
    useAuthStore.getState().setAuth(buildUser({ id: "user_1" }), "token_1");
    useAuthStore
      .getState()
      .setAuth(
        buildUser({ id: "user_2", username: "verifikator1" }),
        "token_2",
      );

    const state = useAuthStore.getState();
    expect(state.user?.id).toBe("user_2");
    expect(state.token).toBe("token_2");
  });
});
