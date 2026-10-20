"use client";

import { useEffect, useState } from "react";
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
  const [statistik, setStatistik] = useState<{ balai: number; proyek: number; periode: string | null } | null>(null);
  useEffect(() => {
    api
      .get("/statistik-login")
      .then((r) => setStatistik(r.data))
      .catch(() => setStatistik(null));
  }, []);

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
      {/* Panel kiri (hi-fi HfLogin): angka dari data asli, disembunyikan kalau gagal dimuat. */}
      <div className="hidden lg:flex lg:w-[560px] lg:flex-none bg-primary-soft flex-col justify-between p-11">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-sd-rm flex items-center justify-center">
            <span className="text-white font-bold text-xs">eP</span>
          </div>
          <span className="font-bold text-[15px]">ePerencanaan</span>
        </div>

        <div className="space-y-3.5">
          <h1 className="text-[38px] font-semibold leading-[1.1] tracking-tight">
            Rencana dan realisasi anggaran, dari usulan sampai paket.
          </h1>
          <p className="max-w-md text-[15px] text-muted-foreground">
            Satu tempat untuk menyusun usulan proyek, memeriksa, dan memantau saldo setiap kegiatan.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 min-h-[86px]">
          {statistik &&
            [
              { label: "Balai", value: statistik.balai.toLocaleString("id-ID") },
              { label: "Proyek aktif", value: statistik.proyek.toLocaleString("id-ID") },
              { label: "Periode aktif", value: statistik.periode ?? "—" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-card p-3.5">
                <div className="text-[22px] font-bold tabular-nums">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[380px] space-y-8">
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

            <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
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
