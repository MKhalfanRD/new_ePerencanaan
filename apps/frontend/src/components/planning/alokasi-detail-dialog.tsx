"use client";

import { useEffect, useState } from "react";
import {
  Edit,
  Trash2,
  MapPin,
  Plus,
  Loader2,
  ChevronRight,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  History,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { AlokasiFormDialog } from "./alokasi-form-dialog";
import { LokasiFormDialog } from "../map/lokasi-form-dialog";
import { LokasiDetailDialog } from "../map/lokasi-detail-dialog";

const formatRupiah = (val: number | string) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(val));

interface AlokasiDetail {
  id: string;
  tahun: number;
  status: "RENCANA" | "REALISASI";
  rm: string;
  rmp: string;
  pln: string;
  sbsn: string;
  kpbu: string;
  total: string;
  outputTarget?: string;
  outputUnit?: string;
  outcomeTarget?: string;
  outcomeUnit?: string;
  catatan?: string;
  planning: { id: string; projectName: string };
  ro: {
    id: string;
    name: string;
    code: string;
    indikatorRO: { id: string; nama: string; satuan: string }[];
    kro: {
      id: string;
      name: string;
      code: string;
      kegiatan: {
        id: string;
        name: string;
        code: string;
        program: { id: string; name: string; code: string };
      };
    };
  };
  lokasi: any[];
  historiAlokasi: {
    id: string;
    rm: string;
    rmp: string;
    pln: string;
    sbsn: string;
    kpbu: string;
    total: string;
    outputTarget?: string;
    outcomeTarget?: string;
    catatan?: string;
    changedAt: string;
    changedBy: string;
  }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  alokasiId: string;
  onRefreshParent: () => void;
}

export function AlokasiDetailDialog({
  open,
  onClose,
  alokasiId,
  onRefreshParent,
}: Props) {
  const { user } = useAuthStore();
  const [data, setData] = useState<AlokasiDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [showEditAlokasi, setShowEditAlokasi] = useState(false);
  const [showLokasiForm, setShowLokasiForm] = useState(false);
  const [editLokasiData, setEditLokasiData] = useState<any>(null);
  const [detailLokasiData, setDetailLokasiData] = useState<any>(null);
  const [deleteLokasiId, setDeleteLokasiId] = useState<string | null>(null);

  const canManage = user?.role === "SATKER" || user?.role === "ADMINISTRATOR";

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<AlokasiDetail>(`/alokasi/${alokasiId}`);
      setData(res.data);
    } catch {
      toast.error("Gagal memuat detail alokasi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && alokasiId) fetchData();
  }, [open, alokasiId]);

  const handleDeleteLokasi = async () => {
    if (!deleteLokasiId) return;
    try {
      await api.delete(`/alokasi/lokasi/${deleteLokasiId}`);
      toast.success("Lokasi berhasil dihapus");
      setDeleteLokasiId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus lokasi");
    }
  };

  if (!data && !loading) return null;

  const sumberDana = data
    ? [
        { label: "RM", value: Number(data.rm) },
        { label: "RMP", value: Number(data.rmp) },
        { label: "PLN", value: Number(data.pln) },
        { label: "SBSN", value: Number(data.sbsn) },
        { label: "KPBU", value: Number(data.kpbu) },
      ].filter((s) => s.value > 0)
    : [];

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="!max-w-3xl !w-[92vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          {loading || !data ? (
            <div className="flex items-center justify-center py-20">
              <Loader2
                className="animate-spin text-muted-foreground"
                size={28}
              />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-8 pt-6 pb-5 border-b shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <Badge
                    variant={
                      data.status === "RENCANA" ? "default" : "secondary"
                    }
                    className="text-xs"
                  >
                    {data.status === "RENCANA" ? "Rencana" : "Realisasi"} ·
                    Tahun {data.tahun}
                  </Badge>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowEditAlokasi(true)}
                    >
                      <Edit size={13} className="mr-1.5" /> Edit Alokasi
                    </Button>
                  )}
                </div>

                <DialogTitle className="text-lg font-semibold">
                  {data.planning.projectName}
                </DialogTitle>

                {/* Breadcrumb nomenklatur */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {[
                    data.ro.kro.kegiatan.program.code,
                    data.ro.kro.kegiatan.code,
                    data.ro.kro.code,
                    data.ro.code,
                  ].map((code, i, arr) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                        {code}
                      </span>
                      {i < arr.length - 1 && (
                        <ChevronRight
                          size={11}
                          className="text-muted-foreground"
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Summary total */}
                <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-xs text-muted-foreground mb-1">
                    Total Alokasi
                  </p>
                  <p className="text-2xl font-bold">
                    {formatRupiah(data.total)}
                  </p>
                  {sumberDana.length > 0 && (
                    <div className="flex gap-4 mt-3 pt-3 border-t border-primary/10">
                      {sumberDana.map((s) => (
                        <div key={s.label}>
                          <p className="text-xs text-muted-foreground">
                            {s.label}
                          </p>
                          <p className="text-sm font-semibold">
                            {formatRupiah(s.value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
                {/* Info RO & Indikator */}
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Rincian Output
                    </p>
                    <div className="rounded-lg border p-3 space-y-1.5">
                      <p className="text-sm font-medium">{data.ro.name}</p>
                      {data.outputTarget && (
                        <p className="text-xs text-muted-foreground">
                          Target:{" "}
                          <span className="font-medium text-foreground">
                            {data.outputTarget} {data.outputUnit}
                          </span>
                        </p>
                      )}
                      {data.outcomeTarget && (
                        <p className="text-xs text-muted-foreground">
                          Outcome:{" "}
                          <span className="font-medium text-foreground">
                            {data.outcomeTarget} {data.outcomeUnit}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Indikator RO
                    </p>
                    {data.ro.indikatorRO.length > 0 ? (
                      <div className="rounded-lg border divide-y divide-border overflow-hidden">
                        {data.ro.indikatorRO.map((ind) => (
                          <div key={ind.id} className="px-3 py-2 text-xs">
                            <p className="font-medium">{ind.nama}</p>
                            <p className="text-muted-foreground">
                              Satuan: {ind.satuan}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground py-3 text-center border rounded-lg">
                        Tidak ada indikator
                      </p>
                    )}
                  </div>
                </div>

                {data.catatan && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-xs font-medium text-amber-800 mb-0.5">
                      Catatan
                    </p>
                    <p className="text-xs text-amber-700">{data.catatan}</p>
                  </div>
                )}

                <Separator />

                {/* Lokasi */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-muted-foreground" />
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Lokasi ({data.lokasi.length})
                      </p>
                    </div>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditLokasiData(null);
                          setShowLokasiForm(true);
                        }}
                      >
                        <Plus size={13} className="mr-1.5" /> Tambah Lokasi
                      </Button>
                    )}
                  </div>

                  {data.lokasi.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed p-6 text-center text-muted-foreground text-sm">
                      Belum ada lokasi ditambahkan
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {data.lokasi.map((lok) => (
                        <div
                          key={lok.id}
                          className="rounded-lg border p-3 cursor-pointer hover:bg-accent/30 transition-colors"
                          onClick={() => setDetailLokasiData(lok)}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">
                              {lok.name || "Lokasi"}
                            </p>
                            <Badge variant="secondary" className="text-xs">
                              {lok.tipeKoordinat}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {[
                              lok.villageName,
                              lok.districtName,
                              lok.cityName,
                              lok.provinceName,
                            ]
                              .filter(Boolean)
                              .join(", ") || "Wilayah belum diisi"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Histori — timeline vertikal */}
                {data.historiAlokasi.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <History size={14} className="text-muted-foreground" />
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Histori Perubahan
                      </p>
                    </div>

                    <div className="relative pl-6 space-y-5">
                      <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
                      {data.historiAlokasi.map((h, i) => {
                        const prevTotal = data.historiAlokasi[i + 1]?.total;
                        const diff = prevTotal
                          ? Number(h.total) - Number(prevTotal)
                          : 0;
                        return (
                          <div key={h.id} className="relative">
                            <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-medium">
                                {h.changedBy}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock size={10} />{" "}
                                {new Date(h.changedAt).toLocaleString("id-ID", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-semibold">
                                {formatRupiah(h.total)}
                              </span>
                              {diff !== 0 && (
                                <span
                                  className={`flex items-center gap-0.5 text-xs ${diff > 0 ? "text-green-600" : "text-red-600"}`}
                                >
                                  {diff > 0 ? (
                                    <TrendingUp size={11} />
                                  ) : (
                                    <TrendingDown size={11} />
                                  )}
                                  {formatRupiah(Math.abs(diff))}
                                </span>
                              )}
                            </div>
                            {h.catatan && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {h.catatan}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Alokasi */}
      {data && (
        <AlokasiFormDialog
          open={showEditAlokasi}
          onClose={() => setShowEditAlokasi(false)}
          onSuccess={() => {
            setShowEditAlokasi(false);
            fetchData();
            onRefreshParent();
          }}
          planningId={data.planning.id}
          editData={data as any}
        />
      )}

      {/* Lokasi Form */}
      {data && (
        <LokasiFormDialog
          open={showLokasiForm}
          onClose={() => setShowLokasiForm(false)}
          onSuccess={() => {
            setShowLokasiForm(false);
            fetchData();
          }}
          alokasiId={data.id}
          editData={editLokasiData}
        />
      )}

      {/* Lokasi Detail */}
      {detailLokasiData && (
        <LokasiDetailDialog
          open={!!detailLokasiData}
          onClose={() => setDetailLokasiData(null)}
          onEdit={() => {
            setEditLokasiData(detailLokasiData);
            setDetailLokasiData(null);
            setShowLokasiForm(true);
          }}
          onDelete={() => {
            setDeleteLokasiId(detailLokasiData.id);
            setDetailLokasiData(null);
          }}
          data={detailLokasiData}
          canManage={canManage}
        />
      )}

      {/* Delete Lokasi Confirm */}
      <AlertDialog
        open={!!deleteLokasiId}
        onOpenChange={() => setDeleteLokasiId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Lokasi?</AlertDialogTitle>
            <AlertDialogDescription>
              Lokasi yang dihapus tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLokasi}
              className="bg-destructive hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
