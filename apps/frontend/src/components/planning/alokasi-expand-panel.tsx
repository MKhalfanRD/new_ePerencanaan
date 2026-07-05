"use client";

import { useEffect, useState } from "react";
import {
  MapPin,
  Plus,
  Pencil,
  Loader2,
  ChevronRight,
  Clock,
  TrendingUp,
  TrendingDown,
  History,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { LokasiFormDialog } from "../map/lokasi-form-dialog";

const formatRupiah = (val: number | string) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(val));

// Format ringkas ala mockup drawer ("Rp 12,0 M" / "Rp 500 jt") — dipakai di
// total & grid sumber dana supaya angka besar tetap gampang dipindai,
// bukan string panjang penuh (mis. "Rp8.000.000.000").
const formatRupiahShort = (val: number | string) => {
  const num = Number(val);
  if (num >= 1_000_000_000) {
    const m = (num / 1_000_000_000).toLocaleString("id-ID", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `Rp ${m} M`;
  }
  if (num >= 1_000_000) {
    const jt = (num / 1_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 0,
    });
    return `Rp ${jt} jt`;
  }
  if (num === 0) return "-";
  return formatRupiah(num);
};

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
  alokasiId: string;
  onRefreshParent: () => void;
  /** Nama proyek — diteruskan ke breadcrumb Sheet lapis-2 (Form Lokasi). */
  projectName?: string;
  /** Klik "Daftar Planning" di breadcrumb lapis-2 — kembali ke daftar. */
  onNavigateToList?: () => void;
  /** Lapor ke parent (PlanningDetailSheet) saat Sheet lapis-2 di panel ini
   * buka/tutup, supaya Sheet lapis-1 tahu kapan pakai efek "pushed" (§Fase 3). */
  onSubDrawerOpenChange?: (isOpen: boolean) => void;
  /** Buka form Edit Alokasi (Sheet lapis-2) — dipanggil dari tombol "Edit"
   * di footer panel ini, bukan lagi dari ikon di baris ter-collapse. */
  onEdit?: () => void;
}

/**
 * AlokasiExpandPanel — konten "Detail Alokasi" yang dulunya modal terpisah
 * (`alokasi-detail-dialog.tsx`), sekarang dirender inline di bawah baris
 * alokasi yang di-expand, di dalam Sheet lapis-1 (Fase 2).
 *
 * Catatan cakupan: tombol Edit & Hapus Alokasi TIDAK lagi ada sebagai ikon
 * di baris ter-collapse — Edit sekarang ada di footer panel ini (tombol
 * "Edit"/"+ Lokasi"/"Riwayat" sejajar, sesuai mockup), Hapus tetap di baris
 * (aksi destruktif yang jarang dipakai, sengaja tidak dicampur ke tombol
 * primer).
 */
export function AlokasiExpandPanel({
  alokasiId,
  onRefreshParent,
  projectName,
  onNavigateToList,
  onSubDrawerOpenChange,
  onEdit,
}: Props) {
  const { user } = useAuthStore();
  const [data, setData] = useState<AlokasiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRiwayat, setShowRiwayat] = useState(false);

  const [showLokasiForm, setShowLokasiForm] = useState(false);
  const [editLokasiData, setEditLokasiData] = useState<any>(null);
  const [deleteLokasiId, setDeleteLokasiId] = useState<string | null>(null);
  const [deletingLokasi, setDeletingLokasi] = useState(false);

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
    if (alokasiId) fetchData();
  }, [alokasiId]);

  // Lapor ke parent tiap kali Sheet lapis-2 (Form Lokasi) buka/tutup.
  useEffect(() => {
    onSubDrawerOpenChange?.(showLokasiForm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLokasiForm]);

  // Cleanup: kalau baris di-collapse sementara Sheet lapis-2 masih terbuka,
  // pastikan parent tidak menganggap sub-drawer ini masih aktif.
  useEffect(() => {
    return () => onSubDrawerOpenChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteLokasi = async () => {
    if (!deleteLokasiId) return;
    setDeletingLokasi(true);
    try {
      await api.delete(`/alokasi/lokasi/${deleteLokasiId}`);
      toast.success("Lokasi berhasil dihapus");
      setDeleteLokasiId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus lokasi");
    } finally {
      setDeletingLokasi(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-8 border-t bg-muted/10">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    );
  }

  // Semua 5 jenis sumber dana selalu ditampilkan (tanda "-" bila kosong),
  // sesuai grid 5-kolom flat `.fund-grid` di mockup — bukan cuma yang > 0.
  const sumberDana = [
    { label: "RM", value: Number(data.rm) },
    { label: "RMP", value: Number(data.rmp) },
    { label: "PLN", value: Number(data.pln) },
    { label: "SBSN", value: Number(data.sbsn) },
    { label: "KPBU", value: Number(data.kpbu) },
  ];

  return (
    <div className="border-t bg-muted/10 px-4 py-5 space-y-5">
      {/* Breadcrumb nomenklatur RO */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {[
          data.ro.kro.kegiatan.program.code,
          data.ro.kro.kegiatan.code,
          data.ro.kro.code,
          data.ro.code,
        ].map((code, i, arr) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-xs font-mono bg-background border px-2 py-0.5 rounded text-muted-foreground">
              {code}
            </span>
            {i < arr.length - 1 && (
              <ChevronRight size={11} className="text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Total + Sumber Dana — grid 5-kolom flat (fund-chip), sesuai mockup.
          Total ditaruh di atas grid, bukan di dalam kartu besar bergaya lama. */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Sumber Dana
          </p>
          <p className="text-sm font-bold">{formatRupiahShort(data.total)}</p>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {sumberDana.map((s) => (
            <div
              key={s.label}
              className="rounded-md border bg-background px-2 py-1.5 text-center"
            >
              <p className="text-[9.5px] font-bold text-muted-foreground">
                {s.label}
              </p>
              <p className="text-[11.5px] font-bold truncate">
                {s.value > 0 ? formatRupiahShort(s.value) : "-"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* RO & Indikator */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Rincian Output
          </p>
          <div className="rounded-lg border bg-background p-3 space-y-1.5">
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
            <div className="rounded-lg border bg-background divide-y divide-border overflow-hidden">
              {data.ro.indikatorRO.map((ind) => (
                <div key={ind.id} className="px-3 py-2 text-xs">
                  <p className="font-medium">{ind.nama}</p>
                  <p className="text-muted-foreground">Satuan: {ind.satuan}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-3 text-center border rounded-lg bg-background">
              Tidak ada indikator
            </p>
          )}
        </div>
      </div>

      {data.catatan && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-xs font-medium text-amber-800 mb-0.5">Catatan</p>
          <p className="text-xs text-amber-700">{data.catatan}</p>
        </div>
      )}

      {/* Lokasi */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Lokasi ({data.lokasi.length})
          </p>
        </div>

        {data.lokasi.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed p-5 text-center text-muted-foreground text-xs bg-background">
            Belum ada lokasi ditambahkan
          </div>
        ) : (
          // List vertikal ringkas satu-kolom (bukan grid 2-kolom kartu tebal),
          // sesuai `.loc-list`/`.loc-chip` di mockup: ikon pin + nama + tipe.
          <div className="flex flex-col gap-1.5">
            {data.lokasi.map((lok) => (
              <div
                key={lok.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setEditLokasiData(lok);
                  setShowLokasiForm(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEditLokasiData(lok);
                    setShowLokasiForm(true);
                  }
                }}
                className="group flex items-center gap-2.5 rounded-md border bg-background px-2.5 py-2 cursor-pointer hover:border-blue-200 hover:bg-blue-50/60 transition-colors outline-none focus-visible:bg-accent/40"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-50 text-emerald-600">
                  <MapPin size={11} />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                  {lok.name || "Lokasi"}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {lok.tipeKoordinat === "TITIK"
                    ? "Titik"
                    : lok.tipeKoordinat === "GARIS"
                      ? "Garis"
                      : "Poligon"}
                </span>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteLokasiId(lok.id);
                    }}
                  >
                    <Trash2 size={12} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer aksi — Edit / + Lokasi / Riwayat sejajar, persis mockup.
          Edit Alokasi & Hapus dulu ada sebagai ikon di baris ter-collapse;
          sekarang Edit pindah ke sini (Hapus tetap di baris, lihat catatan
          di komentar Props di atas). */}
      <div className="flex items-center gap-2 pt-1">
        {canManage && onEdit && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={onEdit}
          >
            <Pencil size={12} className="mr-1.5" /> Edit
          </Button>
        )}
        {canManage && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => {
              setEditLokasiData(null);
              setShowLokasiForm(true);
            }}
          >
            <Plus size={12} className="mr-1.5" /> Lokasi
          </Button>
        )}
        {data.historiAlokasi.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => setShowRiwayat((v) => !v)}
          >
            <History size={12} className="mr-1.5" /> Riwayat
          </Button>
        )}
      </div>

      {/* Riwayat — konten collapsible, dipicu tombol "Riwayat" di footer
          (bukan lagi Accordion dengan trigger sendiri). */}
      {showRiwayat && data.historiAlokasi.length > 0 && (
        <div className="border rounded-lg bg-background px-3 py-3">
          <div className="relative pl-6 space-y-5">
            <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
            {data.historiAlokasi.map((h, i) => {
              const prevTotal = data.historiAlokasi[i + 1]?.total;
              const diff = prevTotal ? Number(h.total) - Number(prevTotal) : 0;
              return (
                <div key={h.id} className="relative">
                  <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium">{h.changedBy}</p>
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
                        className={`flex items-center gap-0.5 text-xs ${
                          diff > 0 ? "text-green-600" : "text-red-600"
                        }`}
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

      {/* Form Tambah/Edit Lokasi — Sheet lapis-2 (Fase 4). Klik chip lokasi
          langsung membuka form ini (bukan popover/detail terpisah), sesuai
          mockup-redesign-planning.html yang sudah disetujui. */}
      <LokasiFormDialog
        open={showLokasiForm}
        onClose={() => setShowLokasiForm(false)}
        onSuccess={() => {
          setShowLokasiForm(false);
          fetchData();
        }}
        alokasiId={data.id}
        editData={editLokasiData}
        projectName={projectName}
        onNavigateToList={onNavigateToList}
      />

      {/* Delete Lokasi Confirm — tetap AlertDialog kecil terpusat, §3 */}
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
              disabled={deletingLokasi}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletingLokasi ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
