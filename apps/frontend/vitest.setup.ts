import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Bersihkan DOM (RTL) setelah tiap test supaya test tidak saling bocor
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});
