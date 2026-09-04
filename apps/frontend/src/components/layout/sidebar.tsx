"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  LogOut,
  ChevronRight,
  Database,
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

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["ADMINISTRATOR", "SATKER", "VERIFICATOR"],
  },
  {
    label: "Proyek",
    href: "/plannings",
    icon: FolderKanban,
    roles: ["ADMINISTRATOR", "SATKER", "VERIFICATOR"],
  },
  {
    label: "Pengguna",
    href: "/users",
    icon: Users,
    roles: ["ADMINISTRATOR"],
  },
  {
    label: "Master Data",
    href: "/master",
    icon: Database,
    roles: ["ADMINISTRATOR"],
  },
];

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
    (item) => user && item.roles.includes(user.role),
  );

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="fixed left-0 top-0 h-screen w-16 lg:w-60 bg-card border-r border-border flex flex-col z-40 transition-all duration-200">
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground font-bold text-xs">
                eP
              </span>
            </div>
            <span className="font-semibold text-sm hidden lg:block">
              ePerencanaan
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {filteredNav.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    )}
                  >
                    <item.icon size={18} className="shrink-0" />
                    <span className="hidden lg:block">{item.label}</span>
                    {isActive && (
                      <ChevronRight
                        size={14}
                        className="ml-auto hidden lg:block"
                      />
                    )}
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
        <div className="p-2 border-t border-border space-y-1">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-primary font-semibold text-xs">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden lg:block min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.role}
              </p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut size={18} className="shrink-0" />
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
