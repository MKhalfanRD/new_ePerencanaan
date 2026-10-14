"use client";

import { useEffect, useState } from "react";
import {
  Edit,
  CheckCheck,
  RotateCcw,
  Loader2,
  Calendar,
  Building2,
  FileText,
  ChevronDown,
  FileDown,
  FileSpreadsheet,
  Plus,
  Trash2,
  Package,
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
import { RiwayatPerubahan } from "@/components/activity-log/riwayat-panel";
import { PaketDialog } from "./paket-dialog";
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
    <div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className={`text-sm font-semibold mt-0.5 ${valueClassName ?? ""}`}>
        {value}
      </p>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon?: any; title: string }) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon size={14} className="text-muted-foreground" />}
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <div className="flex-1 h-px bg-border" />
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
  const canManagePaket = canEdit && (!akunSatker || proyek.satkerBolehUbahPaket !== false);
  const bisaUbahPaket = (pk: Paket) =>
    canManagePaket && (!akunSatker || pk.satkerId === akunSatker);

  // Template tab Pemaketan (bagian per paket) — kegiatan paket pertama,
  // atau kegiatan balai kalau belum ada paket.
  const kegiatanPaket =
    proyek.paket?.[0]?.ro?.kro?.kegiatan?.id ?? proyek.balai?.kegiatanId ?? null;
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

  const handleApprove = async () => {
    setApproving(true);
    try {
      await api.patch(`/proyek/${proyek.id}/approve`);
      toast.success("Proyek disetujui");
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyetujui proyek");
    } finally {
      setApproving(false);
    }
  };

  const handleUnapprove = async () => {
    setApproving(true);
    try {
      await api.patch(`/proyek/${proyek.id}/unapprove`);
      toast.success("Proyek dikembalikan ke draft");
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Gagal mengembalikan proyek ke draft",
      );
    } finally {
      setApproving(false);
    }
  };

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
  // Backend selalu balikin array, tapi dijaga di sini juga — dipakai berulang di bawah.
  const paket = proyek.paket ?? [];
  const firstRo = paket[0]?.ro;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent layer="1" className="!p-0">
        <SheetHeader className="gap-2 pb-4">
          <SheetBreadcrumb
            items={[
              { label: "Daftar Proyek", onClick: onClose },
              { label: proyek.projectName },
            ]}
          />
          <div className="flex items-center justify-end gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <FileDown size={13} className="mr-1.5" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => exportProyekDetailToExcel(proyek)}
                >
                  <FileSpreadsheet size={14} className="mr-2" /> Export ke Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => exportProyekDetailToPDF(proyek)}
                >
                  <FileDown size={14} className="mr-2" /> Export ke PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(proyek)}
              >
                <Edit size={13} className="mr-1.5" /> Edit Proyek
              </Button>
            )}
            {punyaRole(user, "ADMINISTRATOR") && proyek.status === "DRAFT" && (
              <Button size="sm" onClick={handleApprove} disabled={approving}>
                {approving ? (
                  <Loader2 size={13} className="mr-1.5 animate-spin" />
                ) : (
                  <CheckCheck size={13} className="mr-1.5" />
                )}
                Setujui
              </Button>
            )}
            {punyaRole(user, "ADMINISTRATOR") &&
              proyek.status === "APPROVED" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUnapprove}
                  disabled={approving}
                >
                  {approving ? (
                    <Loader2 size={13} className="mr-1.5 animate-spin" />
                  ) : (
                    <RotateCcw size={13} className="mr-1.5" />
                  )}
                  Kembalikan ke Draft
                </Button>
              )}
          </div>

          <SheetTitle className="text-lg leading-snug">
            {proyek.projectName}
          </SheetTitle>

          {/* Meta line: balai · kode · status (dot inline) — sesuai
              mockup, bukan badge kotak terpisah seperti sebelumnya. */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 size={12} />{" "}
              {proyek.balai.shortName ?? proyek.balai.name}
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {getProyekKode(proyek)}
            </span>
            <Badge variant="dot" dotColor={cfg.dotColor} className="text-xs">
              {cfg.label}
            </Badge>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar size={12} /> {proyek.periode.label}
            </span>
          </div>
        </SheetHeader>

        <SheetBody className="px-6 py-6 space-y-6">
          {/* Info Proyek — kartu ringkas, field detail nomenklatur diambil
              dari paket pertama (Proyek sendiri tidak lagi menyimpan
              Program/Kegiatan/KRO/RO — itu melekat di tiap Paket). */}
          <div className="space-y-2">
            <SectionHeader title="Info Proyek" icon={FileText} />
            <div className="rounded-lg border p-4 grid grid-cols-2 gap-x-4 gap-y-4">
              <InfoStat label="Kode Proyek" value={proyek.kodeProyek || "—"} />
              <InfoStat
                label="Program / Kegiatan"
                value={
                  firstRo
                    ? `${firstRo.kro.kegiatan.program.code} ${firstRo.kro.kegiatan.program.name} · ${firstRo.kro.kegiatan.code}`
                    : "—"
                }
              />
              <InfoStat
                label="Kegiatan"
                value={
                  firstRo
                    ? `${firstRo.kro.kegiatan.code} · ${firstRo.kro.kegiatan.name}`
                    : "—"
                }
              />
              <InfoStat
                label="Kegiatan Prioritas (PN.PP.KP)"
                value={proyek.kegiatanPrioritas?.name ?? "Tidak"}
              />
              <InfoStat
                label="Skor Evaluasi"
                value={
                  proyek.skorEvaluasi
                    ? `${(Number(proyek.skorEvaluasi) * 100).toFixed(1)}%`
                    : "Belum dievaluasi"
                }
              />
              <InfoStat
                label="Diajukan oleh"
                value={`${proyek.createdBy.name} (${proyek.createdBy.role.name})`}
              />
              <InfoStat
                label="Sumber Usulan"
                value={
                  proyek.sumberUsulanProyek
                    ? [
                        "PEMERINTAH_DAERAH",
                        "KEMENTERIAN_LEMBAGA",
                        "LAINNYA",
                      ].includes(proyek.sumberUsulanProyek) &&
                      proyek.sumberUsulanLainnya
                      ? `${proyek.sumberUsulanProyek.replaceAll("_", " ")} — ${proyek.sumberUsulanLainnya}`
                      : proyek.sumberUsulanProyek.replaceAll("_", " ")
                    : "—"
                }
              />
              <InfoStat label="Jumlah Paket" value={String(paket.length)} />
            </div>
          </div>

          {/* Tagging & Dokumen — 1 proyek = 1 set tagging (RPJMN/RENSTRA/
              RENJA/tagging dinamis), lihat proyek-form-dialog.tsx tab
              Tagging & Dokumen. */}
          {(proyek.justifikasiProyek ||
            proyek.pkpn ||
            proyek.indikatorSasaranProgram ||
            proyek.indikatorSasaranKegiatan ||
            proyek.tematikRenja ||
            proyek.fkb ||
            proyek.fkw ||
            proyek.mpa ||
            proyek.taggingDinamis?.length ||
            proyek.catatanPembina ||
            proyek.catatanSspsda ||
            proyek.dokumenPendukung?.length) && (
            <div className="space-y-2">
              <SectionHeader title="Tagging & Dokumen" icon={FileText} />
              <div className="rounded-lg border p-4 space-y-3">
                {proyek.justifikasiProyek && (
                  <InfoStat
                    label="Justifikasi Proyek"
                    value={proyek.justifikasiProyek}
                  />
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {proyek.pkpn && (
                    <InfoStat label="PKPN" value={proyek.pkpn.name} />
                  )}
                  {proyek.tematikRenja && (
                    <InfoStat
                      label="Tematik RENJA"
                      value={proyek.tematikRenja.name}
                    />
                  )}
                  {proyek.indikatorSasaranProgram && (
                    <InfoStat
                      label="Indikator Sasaran Program (ISP)"
                      value={proyek.indikatorSasaranProgram.name}
                    />
                  )}
                  {proyek.indikatorSasaranKegiatan && (
                    <InfoStat
                      label="Indikator Sasaran Kegiatan (ISK)"
                      value={proyek.indikatorSasaranKegiatan.name}
                    />
                  )}
                </div>
                {(proyek.fkb ||
                  proyek.fkw ||
                  proyek.mpa ||
                  !!proyek.taggingDinamis?.length) && (
                  <div className="flex flex-wrap gap-1.5">
                    {proyek.fkb && <Badge variant="secondary">FKB</Badge>}
                    {proyek.fkw && <Badge variant="secondary">FKW</Badge>}
                    {proyek.mpa && <Badge variant="secondary">MPA</Badge>}
                    {proyek.taggingDinamis?.map((t) => (
                      <Badge key={t} variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                {(proyek.catatanPembina || proyek.catatanSspsda) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {proyek.catatanPembina && (
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                          Catatan Pembina
                        </p>
                        <p className="text-xs whitespace-pre-wrap">
                          {proyek.catatanPembina}
                        </p>
                      </div>
                    )}
                    {proyek.catatanSspsda && (
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                          Catatan SSPSDA
                        </p>
                        <p className="text-xs whitespace-pre-wrap">
                          {proyek.catatanSspsda}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {!!proyek.dokumenPendukung?.length && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Dokumen Pendukung
                    </p>
                    {proyek.dokumenPendukung.map((d) => (
                      <a
                        key={d.id}
                        href={`${api.defaults.baseURL}/uploads/${d.filePath}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border px-3 py-2 text-xs hover:bg-accent/40 truncate"
                      >
                        {d.fileName}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Daftar Paket — level baru di antara Proyek & Alokasi. */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionHeader title="Paket" icon={Package} />
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
              <div className="space-y-3">
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
                    <div
                      key={pk.id}
                      className="rounded-lg border overflow-hidden"
                    >
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
                        className="flex items-center gap-3 px-3.5 py-3 bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors outline-none focus-visible:bg-accent/40"
                      >
                        <ChevronDown
                          size={14}
                          className={`shrink-0 text-muted-foreground transition-transform ${isPaketExpanded ? "" : "-rotate-90"}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">
                            {pk.name}
                          </p>
                          <p className="text-[10.5px] font-mono text-muted-foreground truncate">
                            {pk.ro.kro.kegiatan.code} · {pk.ro.name}
                          </p>
                        </div>
                        {pk.satker && (
                          <Badge
                            variant="outline"
                            className="shrink-0 max-w-40 truncate text-[10px]"
                          >
                            {pk.satker.name}
                          </Badge>
                        )}
                        <span
                          className="text-xs font-bold shrink-0 w-28 text-right"
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
                                    className="h-6 w-6"
                                    onClick={() => {
                                      setEditPaket(pk);
                                      setShowPaketForm(true);
                                    }}
                                  >
                                    <Edit size={11} />
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
                                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setDeletePaketId(pk.id)}
                                  >
                                    <Trash2 size={11} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Hapus Paket</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        )}
                      </div>

                      {isPaketExpanded && (
                        <div className="p-3.5 space-y-3 text-xs">
                          <dl className="grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-y-1.5 [&>dd]:mb-1.5 sm:[&>dd]:mb-0">
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
                            <div className="overflow-hidden rounded-lg border">
                              {rencanaPaket.map((a) => (
                                <div
                                  key={a.id}
                                  className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b px-3 py-2 last:border-b-0"
                                >
                                  <span className="w-12 font-semibold">{a.tahun}</span>
                                  <span className="order-last w-full text-muted-foreground sm:order-none sm:w-auto sm:flex-1">
                                    {a.komponen
                                      ? `${a.komponen.code} ${a.komponen.name} (${a.komponen.jenis === "PENDUKUNG" ? "pendukung" : "utama"})`
                                      : "Komponen —"}
                                    {" · "}
                                    {[
                                      a.outputTarget != null &&
                                        `RO ${Number(a.outputTarget).toLocaleString("id-ID")} ${pk.ro.satuan?.name ?? ""}`,
                                      a.outcomeTarget != null &&
                                        `IRO ${Number(a.outcomeTarget).toLocaleString("id-ID")} ${pk.indikatorRo?.[0]?.satuan ?? ""}`,
                                      ...SUMBER_DANA.filter((k) => Number(a[k]) > 0).map(
                                        (k) => `${k.toUpperCase()} ${formatRupiahShort(Number(a[k]))}`,
                                      ),
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                  <span className="ml-auto font-semibold" title={formatRupiah(Number(a.total))}>
                                    {formatRupiahShort(Number(a.total))}
                                  </span>
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

          <RiwayatPerubahan entity="proyek" entityId={proyek.id} />
        </SheetBody>
      </SheetContent>

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
          anggaran: proyek.saldoAnggaran == null ? null : Number(proyek.saldoAnggaran),
          volumeRo: proyek.saldoVolumeRo == null ? null : Number(proyek.saldoVolumeRo),
          volumeIro: proyek.saldoVolumeIro == null ? null : Number(proyek.saldoVolumeIro),
        }}
        paketLain={paket.filter((x) => x.id !== editPaket?.id).flatMap(ringkasPaketServer)}
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
