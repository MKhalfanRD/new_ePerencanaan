"use client";

import { useEffect, useState } from "react";
import {
  Edit,
  CheckCheck,
  RotateCcw,
  Loader2,
  ChevronDown,
  FileDown,
  FileSpreadsheet,
  Plus,
  Trash2,
  Lock,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetBreadcrumb,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { punyaRole } from "@/lib/role";
import { Proyek, Paket } from "@/types";
import {
  exportProyekDetailToExcel,
  exportProyekDetailToPDF,
} from "@/lib/export-utils";
import { RiwayatProyek } from "./riwayat-proyek";
import { PaketDialog } from "./paket-dialog";
import { IsiUsulan } from "./isi-usulan";
import {
  paketDariServer,
  paketKePayload,
  paketSections,
  ringkasPaketServer,
  SUMBER_DANA,
  type PaketIsian,
} from "./paket-template";
import type { FormTabNode } from "./proyek-form-dialog";
import { statusConfig } from "@/components/shared/status-config";

import { formatRupiah, formatRupiahShort } from "@/lib/format-rupiah";
import { cn } from "@/lib/utils";
import { LABEL_SD, WARNA_SD } from "@/components/anggaran/saldo-kegiatan";
import { DialogCatatan } from "./dialog-catatan";
import { RealisasiBaris } from "./realisasi-baris";
import {
  LABEL_AKSI,
  adalahAdmin,
  adalahPemeriksa,
  bisaDiajukan,
  terkunci,
  waktuSingkat,
  type JejakPemeriksaan,
} from "@/lib/alur-status";

// Kode identitas ringkas per proyek (mis. "BWS.07.7755") — logic sama
// persis dengan `getProyekKode` di proyekList/page.tsx, supaya kode yang
// tampil di baris list & di header drawer selalu konsisten.
const getProyekKode = (p: Proyek) => {
  const ro = (p.paket ?? [])[0]?.ro;
  const balaiCode = p.balai.code || p.balai.shortName || "-";
  const programCode = ro?.kro?.kegiatan?.program?.code || "-";
  const kegiatanCode = ro?.kro?.kegiatan?.code || "-";
  return `${balaiCode}.${programCode}.${kegiatanCode}`;
};

function InfoStat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("truncate font-semibold", valueClassName)} title={value}>
        {value}
      </p>
    </div>
  );
}

interface Props {
  open: boolean;
  proyek: Proyek;
  onClose: () => void;
  onEdit: (p: Proyek) => void;
  onRefresh: () => void;
}

export function ProyekDetailSheet({
  open,
  proyek,
  onClose,
  onEdit,
  onRefresh,
}: Props) {
  const { user } = useAuthStore();
  const [approving, setApproving] = useState(false);
  const [showPaketForm, setShowPaketForm] = useState(false);
  const [editPaket, setEditPaket] = useState<Paket | null>(null);
  const [deletePaketId, setDeletePaketId] = useState<string | null>(null);
  const [deletingPaket, setDeletingPaket] = useState(false);

  // Paket yang sedang expand menampilkan daftar Alokasi per tahunnya.
  const [expandedPaket, setExpandedPaket] = useState<Set<string>>(new Set());

  const togglePaket = (id: string) => {
    setExpandedPaket((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canEdit = punyaRole(user, "SATKER", "ADMINISTRATOR");

  // Akun Satker: cuma kalau proyek mengizinkan, dan cuma paket satkernya.
  const akunSatker = user?.balaiId ? user?.satkerId : null;
  const canManagePaket =
    canEdit && !terkunci(proyek.status) && (!akunSatker || proyek.satkerBolehUbahPaket !== false);
  const bisaIsiRealisasi = (pk: Paket) =>
    punyaRole(user, "ADMINISTRATOR") ||
    (canEdit &&
      proyek.status === "APPROVED" &&
      (!akunSatker || (proyek.satkerBolehUbahPaket !== false && pk.satkerId === akunSatker)));
  const bisaUbahPaket = (pk: Paket) =>
    canManagePaket && (!akunSatker || pk.satkerId === akunSatker);

  // Template tab Pemaketan (bagian per paket) & pilihan RO mengikuti
  // kegiatan proyek (data lama: paket pertama / balai).
  const kegiatanPaket =
    proyek.kegiatanId ??
    proyek.paket?.[0]?.ro?.kro?.kegiatan?.id ??
    proyek.balai?.kegiatanId ??
    null;
  const [templateTabs, setTemplateTabs] = useState<FormTabNode[] | undefined>();
  useEffect(() => {
    if (!open || !kegiatanPaket) return setTemplateTabs(undefined);
    api
      .get(`/master/form-template/${kegiatanPaket}?activeOnly=true`)
      .then((r) => setTemplateTabs(r.data.tabs))
      .catch(() => setTemplateTabs(undefined));
  }, [open, kegiatanPaket]);
  const [namaProvinsi, setNamaProvinsi] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    api
      .get("/master/provinsi")
      .then((r) =>
        setNamaProvinsi(
          Object.fromEntries(r.data.map((x: { id: string; name: string }) => [x.id, x.name])),
        ),
      )
      .catch(() => {});
  }, [open]);
  const simpanPaket = async (isian: PaketIsian) => {
    const body = paketKePayload(isian);
    if (isian.id) await api.patch(`/paket/${isian.id}`, body);
    else await api.post("/paket", { ...body, proyekId: proyek.id });
    toast.success(isian.id ? "Paket diperbarui" : "Paket ditambahkan");
    setShowPaketForm(false);
    onRefresh();
  };

  // Alur status (docs-planning/flowchart-alur-status.pdf).
  const [jejak, setJejak] = useState<JejakPemeriksaan[]>([]);
  useEffect(() => {
    if (!open) return;
    api
      .get<JejakPemeriksaan[]>(`/proyek/${proyek.id}/pemeriksaan`)
      .then((r) => setJejak(r.data))
      .catch(() => setJejak([]));
  }, [open, proyek.id, proyek.status]);
  const [dialog, setDialog] = useState<null | "kembalikan" | "revisi" | "sesuai">(null);
  const jalankan = async (url: string, body: object | undefined, pesan: string) => {
    setApproving(true);
    try {
      await api.patch(`/proyek/${proyek.id}/${url}`, body);
      toast.success(pesan);
      setDialog(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memproses proyek");
      throw err;
    } finally {
      setApproving(false);
    }
  };
  const isiTerkunci = terkunci(proyek.status);
  const admin = adalahAdmin(user);
  const pemeriksaSaja = adalahPemeriksa(user) && !admin;
  const pengembalian = jejak.find((j) => j.aksi === "REVISI" || j.aksi === "KEMBALIKAN");

  const handleDeletePaket = async () => {
    if (!deletePaketId) return;
    setDeletingPaket(true);
    try {
      await api.delete(`/paket/${deletePaketId}`);
      toast.success("Paket berhasil dihapus");
      setDeletePaketId(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus paket");
    } finally {
      setDeletingPaket(false);
    }
  };


  const cfg = statusConfig[proyek.status];
  // Riwayat proyek khusus admin (Admin & Super Admin), riset T4.
  const panelRiwayat = adalahAdmin(user);
  // Backend selalu balikin array, tapi dijaga di sini juga — dipakai berulang di bawah.
  const paket = proyek.paket ?? [];
  const firstRo = paket[0]?.ro;
  const kegiatanInfo = proyek.kegiatan ?? firstRo?.kro.kegiatan;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        layer="1"
        className="!p-0 h-[92vh] max-h-[92vh] w-[min(94vw,80rem)] max-w-[80rem]"
      >
        <SheetHeader className="gap-2 pb-4 pl-6 pr-14 pt-5">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <SheetBreadcrumb
                items={[
                  { label: "Daftar proyek", onClick: onClose },
                  { label: proyek.projectName },
                ]}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <FileDown size={13} className="mr-1.5" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportProyekDetailToExcel(proyek)}>
                  <FileSpreadsheet size={14} className="mr-2" /> Export ke Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportProyekDetailToPDF(proyek)}>
                  <FileDown size={14} className="mr-2" /> Export ke PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canEdit && !isiTerkunci && (
              <Button size="sm" variant="outline" onClick={() => onEdit(proyek)}>
                <Edit size={13} className="mr-1.5" /> Edit proyek
              </Button>
            )}
            {pemeriksaSaja && proyek.status === "DIAJUKAN" && (
              <>
                <Button size="sm" variant="outline" onClick={() => setDialog("revisi")} disabled={approving}>
                  <RotateCcw size={13} className="mr-1.5" /> Perlu revisi
                </Button>
                <Button size="sm" onClick={() => setDialog("sesuai")} disabled={approving}>
                  <CheckCheck size={13} className="mr-1.5" /> Sesuai
                </Button>
              </>
            )}
            {admin && ["DIAJUKAN", "DIPERIKSA", "APPROVED"].includes(proyek.status) && (
              <Button size="sm" variant="outline" onClick={() => setDialog("kembalikan")} disabled={approving}>
                <RotateCcw size={13} className="mr-1.5" /> Kembalikan
              </Button>
            )}
            {admin && ["DIAJUKAN", "DIPERIKSA"].includes(proyek.status) && (
              <Button
                size="sm"
                disabled={approving}
                onClick={() => jalankan("putuskan", { hasil: "SETUJU" }, "Proyek disetujui").catch(() => {})}
              >
                {approving ? (
                  <Loader2 size={13} className="mr-1.5 animate-spin" />
                ) : (
                  <CheckCheck size={13} className="mr-1.5" />
                )}
                Setujui
              </Button>
            )}
            {canEdit && bisaDiajukan(proyek.status) && (
              <Button
                size="sm"
                disabled={approving}
                onClick={() =>
                  jalankan("ajukan", undefined, proyek.status === "DIKEMBALIKAN" ? "Proyek diajukan ulang" : "Proyek diajukan").catch(
                    () => {},
                  )
                }
              >
                {approving ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Send size={13} className="mr-1.5" />}
                {proyek.status === "DIKEMBALIKAN" ? "Ajukan ulang" : "Ajukan"}
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SheetTitle className="text-[22px] leading-tight">{proyek.projectName}</SheetTitle>
            <Badge variant="dot" dotColor={cfg.dotColor}>
              {cfg.label}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13.5px] text-muted-foreground">
            <span>{proyek.balai.shortName ?? proyek.balai.name}</span>
            <span className="font-mono text-[12.5px]">{proyek.kodeProyek ?? getProyekKode(proyek)}</span>
            {kegiatanInfo && <span>Kegiatan {kegiatanInfo.code}</span>}
            <span>{proyek.periode.label}</span>
          </div>
        </SheetHeader>

        <SheetBody
          className={cn(
            // Jangan min-h-full: tinggi isi jadi melebihi jendela sebesar header → bawahnya tak bisa di-scroll.
            "grid content-start md:content-stretch",
            panelRiwayat && "md:grid-cols-[minmax(0,1fr)_19rem]",
          )}
        >
          <div className="min-w-0 space-y-5 px-6 py-5">
          {proyek.status === "DIKEMBALIKAN" && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-[13.5px]"
            >
              <RotateCcw size={16} className="shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <p>
                  <b className="text-destructive">Dikembalikan untuk revisi</b>
                  {pengembalian && (
                    <>
                      {" "}
                      oleh {pengembalian.user.name}
                      {pengembalian.user.role?.name ? ` (${pengembalian.user.role.name})` : ""},{" "}
                      {waktuSingkat(pengembalian.createdAt)}
                    </>
                  )}
                </p>
                {pengembalian?.catatan && <p className="whitespace-pre-wrap">&ldquo;{pengembalian.catatan}&rdquo;</p>}
              </div>
              {canEdit && (
                <span className="text-xs text-muted-foreground">Perbaiki lewat Edit proyek, lalu Ajukan ulang.</span>
              )}
            </div>
          )}
          {isiTerkunci && (
            <div className="flex items-start gap-2.5 rounded-xl bg-tier-1 px-4 py-3 text-[13.5px]">
              <Lock size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
              <p>
                Isi proyek dikunci selama berstatus <b>{cfg.label}</b>.
                {jejak[0] && (
                  <span className="text-muted-foreground">
                    {" "}
                    Terakhir: {LABEL_AKSI[jejak[0].aksi]} · {jejak[0].user.name}, {waktuSingkat(jejak[0].createdAt)}
                    {jejak[0].catatan ? ` — "${jejak[0].catatan}"` : ""}
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Info proyek (hi-fi HfDetailIsiTutup) — sisanya ada di Isi usulan. */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-2.5 text-sm font-semibold">Info proyek</h3>
            <div className="grid grid-cols-2 gap-3 text-[13.5px] sm:grid-cols-4">
              <InfoStat label="Kode proyek" value={proyek.kodeProyek || "—"} valueClassName="font-mono text-[13px]" />
              <InfoStat
                label="Skor evaluasi"
                value={
                  proyek.skorEvaluasi != null
                    ? `${(Number(proyek.skorEvaluasi) * 100).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / 100`
                    : "Belum dievaluasi"
                }
              />
              <InfoStat label="Diajukan oleh" value={proyek.createdBy.name} />
              <InfoStat label="Jumlah paket" value={String(paket.length)} />
            </div>
          </div>

          {/* Daftar Paket — level baru di antara Proyek & Alokasi. */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Paket</h2>
              {canManagePaket && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 ml-3"
                  onClick={() => {
                    setEditPaket(null);
                    setShowPaketForm(true);
                  }}
                >
                  <Plus size={13} className="mr-1.5" /> Paket
                </Button>
              )}
            </div>

            {paket.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground text-sm">
                Belum ada paket untuk proyek ini
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border bg-card">
                {paket.map((pk) => {
                  const isPaketExpanded = expandedPaket.has(pk.id);
                  const rencanaPaket = pk.alokasi
                    .filter((a) => a.status === "RENCANA")
                    .sort((a, b) => a.tahun - b.tahun);
                  // Total paket = akumulasi RENCANA saja. Dulu menjumlah
                  // semua alokasi, jadi Rencana + Realisasi tahun yang sama
                  // ikut ditambah dua kali (rencana 9 jt + realisasi 1 jt
                  // tampil sebagai 10 jt).
                  const totalPaket = pk.alokasi
                    .filter((a) => a.status === "RENCANA")
                    .reduce((s, a) => s + Number(a.total), 0);

                  return (
                    <div key={pk.id} className="border-b last:border-b-0">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => togglePaket(pk.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            togglePaket(pk.id);
                          }
                        }}
                        aria-expanded={isPaketExpanded}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent",
                          isPaketExpanded && "border-b bg-tier-2",
                        )}
                      >
                        <ChevronDown
                          size={14}
                          className={`shrink-0 text-muted-foreground transition-transform ${isPaketExpanded ? "" : "-rotate-90"}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{pk.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            <span className="font-mono">RO {pk.ro.code}</span> · {pk.ro.name}
                          </p>
                        </div>
                        {proyek.kegiatanId &&
                          pk.ro.kro.kegiatan.id !== proyek.kegiatanId && (
                            <Badge
                              variant="outline"
                              className="shrink-0 border-destructive/40 text-destructive text-[10px]"
                              title={`RO paket ini milik kegiatan ${pk.ro.kro.kegiatan.code}, bukan kegiatan proyek (${proyek.kegiatan?.code ?? proyek.kegiatanId}). Buat paket ini di proyek kegiatan ${pk.ro.kro.kegiatan.code}, lalu hapus dari sini.`}
                            >
                              Harus dibuat ulang
                            </Badge>
                          )}
                        {pk.satker && (
                          <Badge
                            variant="outline"
                            className="shrink-0 max-w-40 truncate text-[10px]"
                          >
                            {pk.satker.name}
                          </Badge>
                        )}
                        <span
                          className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums"
                          title={formatRupiah(totalPaket)}
                        >
                          {formatRupiahShort(totalPaket)}
                        </span>
                        {bisaUbahPaket(pk) && (
                          <div
                            className="flex items-center gap-0.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <TooltipProvider delayDuration={300}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    aria-label={`Edit paket ${pk.name}`}
                                    onClick={() => {
                                      setEditPaket(pk);
                                      setShowPaketForm(true);
                                    }}
                                  >
                                    <Edit size={14} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Paket</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider delayDuration={300}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    aria-label={`Hapus paket ${pk.name}`}
                                    onClick={() => setDeletePaketId(pk.id)}
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Hapus Paket</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        )}
                      </div>

                      {isPaketExpanded && (
                        <div className="space-y-3 px-4 py-3.5 text-[13px]">
                          <dl className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-[7rem_minmax(0,1fr)_7rem_minmax(0,1fr)] sm:gap-y-2 [&>dd]:mb-1.5 sm:[&>dd]:mb-0 [&>dt]:text-muted-foreground">
                            <dt className="text-muted-foreground">Satker</dt>
                            <dd>{pk.satker?.name ?? "—"}</dd>
                            <dt className="text-muted-foreground">KRO / RO</dt>
                            <dd>
                              {pk.ro.kro.code}.{pk.ro.code} — {pk.ro.name}
                            </dd>
                            <dt className="text-muted-foreground">Lokasi RO</dt>
                            <dd>
                              {(pk.lokasiRo ?? []).map((id) => namaProvinsi[id] ?? id).join(", ") || "—"}
                            </dd>
                            <dt className="text-muted-foreground">Indikator RO</dt>
                            <dd>
                              {pk.indikatorRo?.[0]
                                ? `${pk.indikatorRo[0].indikatorRo?.nama ?? "—"} (${pk.indikatorRo[0].satuan ?? "—"})`
                                : "—"}
                            </dd>
                            <dt className="text-muted-foreground">Tahun</dt>
                            <dd>
                              {pk.tahunMulai
                                ? pk.tahunMulai === pk.tahunSelesai
                                  ? pk.tahunMulai
                                  : `${pk.tahunMulai}–${pk.tahunSelesai}`
                                : "—"}
                            </dd>
                            <dt className="text-muted-foreground">Lokasi paket</dt>
                            <dd>
                              {pk.lokasiSamaProyek !== false
                                ? "Sama dengan lokasi proyek"
                                : [pk.villageName, pk.districtName, pk.cityName, pk.provinceName]
                                      .filter(Boolean)
                                      .join(", ") ||
                                  (pk.tipeKoordinat === "TITIK"
                                  ? `Titik ${pk.latitude?.toFixed(5)}, ${pk.longitude?.toFixed(5)}`
                                  : `${pk.tipeKoordinat === "GARIS" ? "Garis" : "Poligon"} · ${pk.coordinates?.length ?? 0} titik`)}
                            </dd>
                          </dl>
                          {rencanaPaket.length === 0 ? (
                            <div className="rounded-lg border-2 border-dashed p-4 text-center text-muted-foreground">
                              Belum ada alokasi anggaran
                            </div>
                          ) : (
                            <div className="overflow-hidden rounded-lg border bg-card">
                              {rencanaPaket.map((a) => (
                                <div key={a.id} className="border-b last:border-b-0">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2.5">
                                  <span className="w-12 font-semibold">{a.tahun}</span>
                                  <span className="order-last w-full space-y-1 sm:order-none sm:w-auto sm:flex-1">
                                    <span className="block text-muted-foreground">
                                      {a.komponen
                                        ? `Komponen ${a.komponen.code} ${a.komponen.name} (${a.komponen.jenis === "PENDUKUNG" ? "pendukung" : "utama"})`
                                        : "Komponen —"}
                                      {a.outputTarget != null &&
                                        ` · Vol RO ${Number(a.outputTarget).toLocaleString("id-ID")} ${pk.ro.satuan?.name ?? ""}`}
                                      {a.outcomeTarget != null &&
                                        ` · Vol IRO ${Number(a.outcomeTarget).toLocaleString("id-ID")} ${pk.indikatorRo?.[0]?.satuan ?? ""}`}
                                    </span>
                                    <span className="flex flex-wrap gap-x-3">
                                      {SUMBER_DANA.filter((k) => Number(a[k]) > 0).map((k) => (
                                        <span key={k} className="inline-flex items-center gap-1.5">
                                          <i aria-hidden className={cn("h-2 w-2 rounded-[2px]", WARNA_SD[k])} />
                                          {LABEL_SD[k]} <b className="tabular-nums">{formatRupiahShort(Number(a[k]))}</b>
                                        </span>
                                      ))}
                                    </span>
                                  </span>
                                  <span className="ml-auto font-semibold" title={formatRupiah(Number(a.total))}>
                                    {formatRupiahShort(Number(a.total))}
                                  </span>
                                </div>
                                <RealisasiBaris
                                  paketId={pk.id}
                                  tahun={a.tahun}
                                  rencana={a}
                                  realisasi={pk.alokasi.find((x) => x.tahun === a.tahun && x.status === "REALISASI")}
                                  bisaIsi={bisaIsiRealisasi(pk)}
                                  alasanTidak={proyek.status !== "APPROVED" ? "diisi setelah proyek disetujui" : undefined}
                                  onSaved={onRefresh}
                                />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Isi usulan — dibangkitkan dari template form kegiatan proyek. */}
          <IsiUsulan
            proyek={proyek}
            kegiatanId={kegiatanPaket}
            judul={
              <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5">
                <h2 className="text-base font-semibold">Isi usulan</h2>
                {kegiatanPaket && (
                  <span className="text-xs text-muted-foreground">
                    Mengikuti form kegiatan {kegiatanPaket} · Master Data › Form Proyek
                  </span>
                )}
              </span>
            }
          />
          </div>

          {panelRiwayat && (
            <aside className="border-t bg-tier-2 px-5 py-5 md:border-l md:border-t-0">
              <RiwayatProyek proyekId={proyek.id} versi={`${proyek.status}:${proyek.updatedAt}`} />
            </aside>
          )}
        </SheetBody>
      </SheetContent>

      <DialogCatatan
        open={dialog === "kembalikan" || dialog === "revisi"}
        judul={dialog === "revisi" ? "Perlu revisi" : "Kembalikan proyek"}
        keterangan="Proyek dikembalikan ke pengisi dan bisa diubah lagi. Catatan tampil di detail proyek."
        label="Catatan untuk pengisi"
        tombol="Kembalikan"
        wajib
        bahaya
        onClose={() => setDialog(null)}
        onKirim={(catatan) =>
          dialog === "revisi"
            ? jalankan("periksa", { hasil: "REVISI", catatan }, "Proyek dikembalikan untuk revisi")
            : jalankan("putuskan", { hasil: "KEMBALIKAN", catatan }, "Proyek dikembalikan untuk revisi")
        }
      />
      <DialogCatatan
        open={dialog === "sesuai"}
        judul="Hasil pemeriksaan: Sesuai"
        keterangan="Proyek diteruskan ke Admin untuk keputusan akhir."
        tombol="Kirim hasil"
        onClose={() => setDialog(null)}
        onKirim={(catatan) => jalankan("periksa", { hasil: "SESUAI", catatan }, "Hasil pemeriksaan dikirim")}
      />

      {/* Form Tambah/Edit Paket — Sheet lapis-2 */}
      <PaketDialog
        open={showPaketForm}
        onClose={() => setShowPaketForm(false)}
        onSave={simpanPaket}
        sections={paketSections(templateTabs)}
        value={editPaket ? paketDariServer(editPaket) : null}
        kegiatanId={kegiatanPaket}
        balaiId={proyek.balai?.id}
        satkerTerkunci={akunSatker}
        tahunMin={proyek.periode?.startYear}
        tahunMax={proyek.periode?.endYear}
        saldo={{
          volumeRo: proyek.saldoVolumeRo == null ? null : Number(proyek.saldoVolumeRo),
          volumeIro: proyek.saldoVolumeIro == null ? null : Number(proyek.saldoVolumeIro),
        }}
        paketLain={paket.filter((x) => x.id !== editPaket?.id).flatMap(ringkasPaketServer)}
        proyekId={proyek.id}
        alokasiLain={paket
          .filter((x) => x.id !== editPaket?.id)
          .flatMap((x) => (x.alokasi ?? []).filter((a) => a.status === "RENCANA"))}
        breadcrumb={[
          { label: "Daftar Proyek", onClick: onClose },
          { label: proyek.projectName || "Proyek", onClick: () => setShowPaketForm(false) },
          { label: editPaket ? "Edit paket" : "Tambah paket" },
        ]}
      />

      {/* Delete Paket Confirm */}
      <AlertDialog
        open={!!deletePaketId}
        onOpenChange={() => setDeletePaketId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Paket?</AlertDialogTitle>
            <AlertDialogDescription>
              Paket beserta seluruh alokasi & lokasinya akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePaket}
              disabled={deletingPaket}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletingPaket ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Sheet>
  );
}
