"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";

const loginSchema = z.object({
  username: z.string().min(1, "Username wajib diisi"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    try {
      const res = await api.post("/auth/login", data);
      const { accessToken, user } = res.data;
      setAuth(user, accessToken);
      toast.success(`Selamat datang, ${user.name}`);
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Username atau password salah",
      );
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">
                eP
              </span>
            </div>
            <span className="text-primary-foreground font-semibold text-lg">
              ePerencanaan
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-primary-foreground leading-tight">
            Sistem Perencanaan
            <br />
            Anggaran Terpadu
          </h1>
          <p className="text-primary-foreground/70 text-lg leading-relaxed">
            Kelola rencana dan realisasi anggaran proyek infrastruktur secara
            efisien dan transparan.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Balai", value: "3+" },
            { label: "Proyek Aktif", value: "120+" },
            { label: "Periode", value: "2025–2029" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-primary-foreground/10 rounded-xl p-4"
            >
              <div className="text-2xl font-bold text-primary-foreground">
                {stat.value}
              </div>
              <div className="text-primary-foreground/60 text-sm mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">
                eP
              </span>
            </div>
            <span className="font-semibold text-lg">ePerencanaan</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Masuk ke akun</h2>
            <p className="text-muted-foreground text-sm">
              Masukkan username dan password untuk melanjutkan
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Masukkan username"
                autoComplete="username"
                {...register("username")}
              />
              {errors.username && (
                <p className="text-destructive text-xs">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  className="pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  data-testid="toggle-password-visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-destructive text-xs">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isSubmitting ? "Memproses..." : "Masuk"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Hubungi administrator jika mengalami kendala akses
          </p>
        </div>
      </div>
    </div>
  );
}
