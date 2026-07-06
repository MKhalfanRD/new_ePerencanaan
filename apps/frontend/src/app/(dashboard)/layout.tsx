"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuthStore } from "@/store/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar />
      <main className="ml-16 lg:ml-60 min-h-screen">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
