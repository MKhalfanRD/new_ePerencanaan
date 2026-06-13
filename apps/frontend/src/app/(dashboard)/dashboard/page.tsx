"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Planning, PaginatedResponse } from "@/types";

const statusConfig = {
  DRAFT: { label: "Draft", color: "secondary" as const },
  SUBMITTED: { label: "Diajukan", color: "default" as const },
  REVISION: { label: "Revisi", color: "secondary" as const },
  REJECTED: { label: "Ditolak", color: "destructive" as const },
  APPROVED: { label: "Disetujui", color: "default" as const },
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<PaginatedResponse<Planning>>("/plannings?limit=100")
      .then((res) => setPlannings(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: plannings.length,
    draft: plannings.filter((p) => p.status === "DRAFT").length,
    submitted: plannings.filter((p) => p.status === "SUBMITTED").length,
    approved: plannings.filter((p) => p.status === "APPROVED").length,
  };

  const totalAnggaran = plannings.reduce(
    (acc, p) =>
      acc +
      p.alokasi
        .filter((a) => a.status === "RENCANA")
        .reduce((s, a) => s + Number(a.total), 0),
    0,
  );

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);

  const cards = [
    { title: "Total Planning", value: stats.total, icon: FileText },
    { title: "Draft", value: stats.draft, icon: FileText },
    { title: "Menunggu Review", value: stats.submitted, icon: Clock },
    { title: "Disetujui", value: stats.approved, icon: CheckCircle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Selamat datang,{" "}
          <span className="font-medium text-foreground">{user?.name}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    {card.title}
                  </p>
                  <p className="text-3xl font-bold mt-1">
                    {loading ? "—" : card.value}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <card.icon size={18} className="text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Total Rencana Anggaran
              </p>
              <p className="text-2xl font-bold mt-1">
                {loading ? "—" : formatRupiah(totalAnggaran)}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp size={18} className="text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Planning Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-muted rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : plannings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Belum ada planning</p>
            </div>
          ) : (
            <div className="space-y-2">
              {plannings.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {p.projectName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.balai.shortName} · {p.periode.label}
                    </p>
                  </div>
                  <Badge
                    variant={statusConfig[p.status].color}
                    className="ml-3 shrink-0 text-xs"
                  >
                    {statusConfig[p.status].label}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
