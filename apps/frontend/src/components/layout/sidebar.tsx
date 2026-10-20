"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  LogOut,
  Database,
  ScrollText,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// `roles: undefined` = semua role yang sudah login. Daftar role tidak lagi
// dipatok satu per satu karena sekarang ada role per kegiatan
// (OPERATOR_7691, VERIFIKATOR_7692, dst.) yang jumlahnya bertambah tiap
// kegiatan baru — cukup batasi yang memang khusus admin.
const ADMIN = ["SUPER_ADMIN", "ADMINISTRATOR"];

const navItems: {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
}[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Proyek", href: "/proyek", icon: FolderKanban },
  { label: "Anggaran Kegiatan", href: "/anggaran", icon: Wallet },
  { label: "Pengguna", href: "/users", icon: Users, roles: ADMIN },
  { label: "Master Data", href: "/master", icon: Database, roles: ADMIN },
  {
    label: "Log Aktivitas",
    href: "/activity-log",
    icon: ScrollText,
    roles: ["SUPER_ADMIN"],
  },
];

// Kode role -> label: "SUPER_ADMIN" -> "Super Admin", "OPERATOR_7691" -> "Operator 7691".
const labelRole = (kode?: string) =>
  (kode ?? "")
    .toLowerCase()
    .split("_")
    .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
    .join(" ");

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearAuth();
    toast.success("Berhasil keluar");
    router.push("/login");
  };

  const filteredNav = navItems.filter(
    (item) => user && (!item.roles || item.roles.includes(user.role)),
  );

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="fixed left-0 top-0 h-screen w-16 lg:w-60 bg-card border-r border-border flex flex-col z-40 transition-all duration-200">
        {/* Logo */}
        <div className="h-16 flex items-center px-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-sd-rm flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">
                eP
              </span>
            </div>
            <span className="font-bold text-[15px] hidden lg:block">
              ePerencanaan
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 px-3 space-y-0.5" aria-label="Menu utama">
          {filteredNav.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary-soft text-primary-ink"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    )}
                  >
                    <item.icon size={17} className="shrink-0" />
                    <span className="hidden lg:block">{item.label}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="lg:hidden">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* User & Logout */}
        <div className="mx-3 mb-3 pt-2 border-t border-border space-y-0.5">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-tier-1 flex items-center justify-center shrink-0">
              <span className="text-foreground font-semibold text-xs">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden lg:block min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {labelRole(user?.role)}
              </p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut size={17} className="shrink-0" />
                <span className="hidden lg:block">Keluar</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="lg:hidden">
              Keluar
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
