"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Search,
  FileText,
  Eye,
  Trash2,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Maximize2,
  Minimize2,
  CheckCircle2,
  MapPin,
  StickyNote,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { exportPlanningsToExcel } from "@/lib/export-plannings-excel";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { ImportExcelDialog } from "@/components/import/import-excel-dialog";
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
import { Planning, PaginatedResponse } from "@/types";
import { PlanningFormDialog } from "@/components/planning/planning-form-dialog";
import { PlanningDetailSheet } from "@/components/planning/planning-detail-sheet";

const formatRupiah = (val: string | number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(
    Number(val),
  );

const formatRupiahShort = (val: number) => {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}M`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}jt`;
  if (val === 0) return "-";
  return formatRupiah(val);
};

// `paket` selalu array dari backend, tapi dijaga di sini juga karena dipakai
// berulang lintas fungsi di file ini.
const paketOf = (p: Planning) => p.paket ?? [];
const alokasiOf = (p: Planning) => paketOf(p).flatMap((pk) => pk.alokasi);

// Penanda cepat di luar tabel: proyek ini sudah punya titik lokasi di peta
// atau belum, tanpa perlu buka detail.
const hasLokasi = (p: Planning) =>
  alokasiOf(p).some((a) => a.lokasi.length > 0);

// Rekap Rencana/Realisasi per tahun dari satu daftar alokasi — dipakai baik
// di level Proyek (semua paket) maupun di level Paket (satu paket saja).
const byYearOf = (alokasi: { tahun: number; status: string; total: string }[]) => {
  const byYear: Record<number, { rencana: number; realisasi: number }> = {};
  for (const a of alokasi) {
    if (!byYear[a.tahun]) byYear[a.tahun] = { rencana: 0, realisasi: 0 };
    if (a.status === "RENCANA") byYear[a.tahun].rencana += Number(a.total);
    else byYear[a.tahun].realisasi += Number(a.total);
  }
  return byYear;
};

export default function PlanningsPage() {
  const { user } = useAuthStore();
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Cuma 2 tampilan: "proyek" (default, status APPROVED) & "draft" (punya sendiri)
  const [view, setView] = useState<"proyek" | "draft">("proyek");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  // Drill-down 4 level: Balai > Kegiatan > Proyek > Paket. Default semuanya
  // tertutup — yang tampil pertama cuma Balai, sisanya baru muncul saat
  // di-expand berurutan.
  const [expandedBalai, setExpandedBalai] = useState<Set<number>>(new Set());
  const [expandedKegiatan, setExpandedKegiatan] = useState<Set<string>>(
    new Set(),
  );
  const [expandedProyek, setExpandedProyek] = useState<Set<string>>(
    new Set(),
  );

  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Planning | null>(null);
  const [detailData, setDetailData] = useState<Planning | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filter Program/Kegiatan/KRO/RO/Balai — cascading, opsi diambil dari data
  // yang sudah ter-load (bukan fetch master terpisah, selalu sinkron dengan
  // apa yang benar-benar tampil).
  const [filterBalai, setFilterBalai] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [filterKegiatan, setFilterKegiatan] = useState("");
  const [filterKro, setFilterKro] = useState("");
  const [filterRo, setFilterRo] = useState("");

  const fetchPlannings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "100",
        status: view === "draft" ? "DRAFT" : "APPROVED",
        ...(search && { search }),
      });
      const res = await api.get<PaginatedResponse<Planning>>(
        `/plannings?${params}`,
      );
      setPlannings(res.data.data);
      setTotalPages(res.data.meta.totalPages);
      setTotal(res.data.meta.total);
      // detailData adalah snapshot terpisah (dipilih saat Sheet dibuka) —
      // kalau tidak disegarkan juga di sini, perubahan (tambah/edit alokasi,
      // paket, dst) baru kelihatan setelah Sheet ditutup lalu dibuka lagi.
      setDetailData((prev) =>
        prev
          ? (res.data.data.find((p) => p.id === prev.id) ?? prev)
          : prev,
      );
    } catch {
      toast.error("Gagal memuat data proyek");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlannings();
  }, [page, view]);
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchPlannings();
    }, 400);
    return () => clearTimeout(timeout);
  }, [search]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/plannings/${deleteId}`);
      toast.success("Proyek berhasil dihapus");
      setDeleteId(null);
      fetchPlannings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus proyek");
    } finally {
      setDeleting(false);
    }
  };

  // Export selalu ambil SEMUA proyek pada tampilan aktif (Proyek/Draft),
  // bukan cuma halaman/hasil filter yang sedang tampil di layar.
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      // Backend membatasi limit maks 100/request — tarik semua halaman.
      const status = view === "draft" ? "DRAFT" : "APPROVED";
      const all: Planning[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const res = await api.get<PaginatedResponse<Planning>>("/plannings", {
          params: { page, limit: 100, status },
        });
        all.push(...res.data.data);
        totalPages = res.data.meta.totalPages;
        page++;
      } while (page <= totalPages);
      await exportPlanningsToExcel(all);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengexport ke Excel");
    } finally {
      setExporting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/plannings/${id}/approve`);
      toast.success("Proyek disetujui");
      fetchPlannings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyetujui proyek");
    }
  };

  const canApprove = () => view === "draft" && user?.role === "ADMINISTRATOR";

  const canDelete = (p: Planning) =>
    user?.role === "ADMINISTRATOR" || p.createdBy.id === user?.id;

  // Opsi filter, dicascade dari data yang sudah termuat: Balai independen;
  // Program > Kegiatan > KRO > RO mengikuti pilihan level di atasnya.
  const filterOptions = useMemo(() => {
    const balaiMap = new Map<number, string>();
    const programMap = new Map<string, string>();
    const kegiatanMap = new Map<string, { name: string; programId: string }>();
    const kroMap = new Map<string, { name: string; kegiatanId: string }>();
    const roMap = new Map<
      string,
      { code: string; name: string; kroId: string }
    >();

    for (const p of plannings) {
      balaiMap.set(p.balai.id, p.balai.name);
      for (const pk of paketOf(p)) {
        const ro = pk.ro;
        if (!ro) continue;
        const kro = ro.kro;
        const keg = kro.kegiatan;
        const prog = keg.program;
        programMap.set(prog.id, `${prog.code} — ${prog.name}`);
        kegiatanMap.set(keg.id, {
          name: `${keg.code} — ${keg.name}`,
          programId: prog.id,
        });
        kroMap.set(kro.id, { name: `${kro.code} — ${kro.name}`, kegiatanId: keg.id });
        roMap.set(ro.id, { code: ro.code, name: ro.name, kroId: kro.id });
      }
    }

    return {
      balai: [...balaiMap.entries()].sort((a, b) => a[1].localeCompare(b[1])),
      program: [...programMap.entries()].sort((a, b) =>
        a[1].localeCompare(b[1]),
      ),
      kegiatan: [...kegiatanMap.entries()]
        .filter(([, v]) => !filterProgram || v.programId === filterProgram)
        .sort((a, b) => a[1].name.localeCompare(b[1].name)),
      kro: [...kroMap.entries()]
        .filter(([, v]) => !filterKegiatan || v.kegiatanId === filterKegiatan)
        .sort((a, b) => a[1].name.localeCompare(b[1].name)),
      ro: [...roMap.entries()]
        .filter(([, v]) => !filterKro || v.kroId === filterKro)
        .sort((a, b) => a[1].name.localeCompare(b[1].name)),
    };
  }, [plannings, filterProgram, filterKegiatan, filterKro]);

  // Proyek lolos filter kalau salah satu paketnya cocok dengan pilihan
  // Program/Kegiatan/KRO/RO (bukan cuma paket pertama) — Balai difilter di
  // level proyek langsung.
  const filteredPlannings = useMemo(() => {
    return plannings.filter((p) => {
      if (filterBalai && String(p.balai.id) !== filterBalai) return false;
      if (!filterProgram && !filterKegiatan && !filterKro && !filterRo)
        return true;
      return paketOf(p).some((pk) => {
        const ro = pk.ro;
        if (!ro) return false;
        if (filterRo) return ro.id === filterRo;
        if (filterKro) return ro.kro.id === filterKro;
        if (filterKegiatan) return ro.kro.kegiatan.id === filterKegiatan;
        if (filterProgram) return ro.kro.kegiatan.program.id === filterProgram;
        return true;
      });
    });
  }, [plannings, filterBalai, filterProgram, filterKegiatan, filterKro, filterRo]);

  type KegiatanGroup = {
    kegiatanCode: string;
    kegiatanName: string;
    programCode: string;
    plannings: Planning[];
    rencanaByYear: Record<number, number>;
    realisasiByYear: Record<number, number>;
    grandTotalRencana: number;
    grandTotalRealisasi: number;
  };
  type BalaiGroup = {
    balai: Planning["balai"];
    kegiatanGroups: KegiatanGroup[];
    rencanaByYear: Record<number, number>;
    realisasiByYear: Record<number, number>;
    grandTotalRencana: number;
    grandTotalRealisasi: number;
  };

  const groups = useMemo(() => {
    const balaiMap = new Map<
      number,
      Omit<BalaiGroup, "kegiatanGroups"> & { kegiatanMap: Map<string, KegiatanGroup> }
    >();
    const years = new Set<number>();

    const addAlokasi = (
      target: { rencanaByYear: Record<number, number>; realisasiByYear: Record<number, number>; grandTotalRencana: number; grandTotalRealisasi: number },
      a: { tahun: number; status: string; total: string },
    ) => {
      const value = Number(a.total);
      if (a.status === "RENCANA") {
        target.rencanaByYear[a.tahun] = (target.rencanaByYear[a.tahun] || 0) + value;
        target.grandTotalRencana += value;
      } else {
        target.realisasiByYear[a.tahun] = (target.realisasiByYear[a.tahun] || 0) + value;
        target.grandTotalRealisasi += value;
      }
    };

    for (const p of filteredPlannings) {
      // Kolom tahun mengikuti rentang periode proyek, bukan cuma tahun yang
      // kebetulan sudah punya alokasi — tahun kosong tetap ditampilkan.
      for (let y = p.periode.startYear; y <= p.periode.endYear; y++) years.add(y);

      const firstRo = paketOf(p)[0]?.ro;
      const kegiatanCode = firstRo?.kro?.kegiatan?.code || "LAINNYA";
      const kegiatanName = firstRo?.kro?.kegiatan?.name || "Belum ada paket";
      const programCode = firstRo?.kro?.kegiatan?.program?.code || "-";

      if (!balaiMap.has(p.balai.id)) {
        balaiMap.set(p.balai.id, {
          balai: p.balai,
          kegiatanMap: new Map(),
          rencanaByYear: {},
          realisasiByYear: {},
          grandTotalRencana: 0,
          grandTotalRealisasi: 0,
        });
      }
      const balaiGroup = balaiMap.get(p.balai.id)!;

      if (!balaiGroup.kegiatanMap.has(kegiatanCode)) {
        balaiGroup.kegiatanMap.set(kegiatanCode, {
          kegiatanCode,
          kegiatanName,
          programCode,
          plannings: [],
          rencanaByYear: {},
          realisasiByYear: {},
          grandTotalRencana: 0,
          grandTotalRealisasi: 0,
        });
      }
      const kegGroup = balaiGroup.kegiatanMap.get(kegiatanCode)!;
      kegGroup.plannings.push(p);

      for (const a of alokasiOf(p)) {
        addAlokasi(kegGroup, a);
        addAlokasi(balaiGroup, a);
      }
    }

    const sortedYears = [...years].sort((a, b) => a - b);
    const balaiGroups: BalaiGroup[] = [...balaiMap.values()]
      .map((bg) => ({
        ...bg,
        kegiatanGroups: [...bg.kegiatanMap.values()].sort((a, b) =>
          a.kegiatanCode.localeCompare(b.kegiatanCode),
        ),
      }))
      .sort((a, b) => a.balai.name.localeCompare(b.balai.name));

    return { balaiGroups, years: sortedYears };
  }, [filteredPlannings]);

  const allCollapsed =
    groups.balaiGroups.length > 0 && expandedBalai.size === 0;

  const toggleSet = <T,>(
    setState: React.Dispatch<React.SetStateAction<Set<T>>>,
    key: T,
  ) => {
    setState((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleBalai = (id: number) => toggleSet(setExpandedBalai, id);
  const toggleKegiatan = (key: string) => toggleSet(setExpandedKegiatan, key);
  const toggleProyek = (id: string) => toggleSet(setExpandedProyek, id);

  const toggleAllGroups = () => {
    if (allCollapsed) {
      // Buka Semua: expand seluruh Balai + Kegiatan + Proyek sekaligus.
      setExpandedBalai(new Set(groups.balaiGroups.map((g) => g.balai.id)));
      setExpandedKegiatan(
        new Set(
          groups.balaiGroups.flatMap((bg) =>
            bg.kegiatanGroups.map((kg) => `${bg.balai.id}:${kg.kegiatanCode}`),
          ),
        ),
      );
      setExpandedProyek(new Set(filteredPlannings.map((p) => p.id)));
    } else {
      setExpandedBalai(new Set());
      setExpandedKegiatan(new Set());
      setExpandedProyek(new Set());
    }
  };

  // Kode identitas ringkas per proyek, mis. "WA.7755.EBA" — dari kode Balai +
  // Program.Kegiatan pada alokasi pertamanya. Ditampilkan langsung di baris
  // list supaya user tidak perlu buka detail hanya untuk mengenali proyek.
  const getPlanningKode = (p: Planning) => {
    const ro = paketOf(p)[0]?.ro;
    const balaiCode = p.balai.code || p.balai.shortName || "-";
    const programCode = ro?.kro?.kegiatan?.program?.code || "-";
    const kegiatanCode = ro?.kro?.kegiatan?.code || "-";
    return `${balaiCode}.${programCode}.${kegiatanCode}`;
  };

  // Sel angka per tahun: baris atas = Rencana, baris bawah = Realisasi
  // (dengan centang bila sudah terisi). Dipakai di baris tiap proyek.
  const renderYearCell = (
    year: number,
    v: { rencana: number; realisasi: number } | undefined,
  ) => {
    const rencana = v?.rencana || 0;
    const realisasi = v?.realisasi || 0;
    return (
      <div key={year} className="w-24 shrink-0 text-right">
        <p className="text-xs font-semibold">{formatRupiahShort(rencana)}</p>
        <p className="text-[11px] text-emerald-600 flex items-center justify-end gap-1">
          {realisasi > 0 && (
            <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
          )}
          {formatRupiahShort(realisasi)}
        </p>
      </div>
    );
  };

  const renderActions = (p: Planning) => (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setDetailData(p)}
            >
              <Eye size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Lihat Detail</TooltipContent>
        </Tooltip>
        {canApprove() && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={() => handleApprove(p.id)}
              >
                <CheckCheck size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Setujui Proyek</TooltipContent>
          </Tooltip>
        )}
        {canDelete(p) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteId(p.id)}
              >
                <Trash2 size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Hapus Proyek</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proyek</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total} proyek ditemukan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet size={16} className="mr-2" />
            )}
            Export Excel
          </Button>
          {(user?.role === "SATKER" || user?.role === "ADMINISTRATOR") && (
            <>
              <Button variant="outline" onClick={() => setShowImport(true)}>
                <Upload size={16} className="mr-2" /> Import Excel
              </Button>
              <Button
                onClick={() => {
                  setEditData(null);
                  setShowForm(true);
                }}
              >
                <Plus size={16} className="mr-2" /> Buat Proyek
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Cari nama proyek..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {/* 2 tampilan saja: Proyek (default, sudah disetujui) & Draft (punya sendiri) */}
          <div className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setView("proyek");
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === "proyek"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Proyek
            </button>
            <button
              type="button"
              onClick={() => {
                setView("draft");
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === "draft"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Draft
            </button>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={toggleAllGroups}
          className="shrink-0 text-xs"
        >
          {allCollapsed ? (
            <Maximize2 size={13} className="mr-1.5" />
          ) : (
            <Minimize2 size={13} className="mr-1.5" />
          )}
          {allCollapsed ? "Buka Semua" : "Tutup Semua"}
        </Button>
      </div>

      {/* Filter Program/Kegiatan/KRO/RO/Balai — cascading, opsi dari data
          yang sudah termuat di halaman ini. */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterBalai}
          onChange={(e) => setFilterBalai(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value="">Semua Balai</option>
          {filterOptions.balai.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={filterProgram}
          onChange={(e) => {
            setFilterProgram(e.target.value);
            setFilterKegiatan("");
            setFilterKro("");
            setFilterRo("");
          }}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value="">Semua Program</option>
          {filterOptions.program.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={filterKegiatan}
          onChange={(e) => {
            setFilterKegiatan(e.target.value);
            setFilterKro("");
            setFilterRo("");
          }}
          className="h-8 rounded-md border bg-background px-2 text-xs max-w-[220px]"
        >
          <option value="">Semua Kegiatan</option>
          {filterOptions.kegiatan.map(([id, v]) => (
            <option key={id} value={id}>
              {v.name}
            </option>
          ))}
        </select>
        <select
          value={filterKro}
          onChange={(e) => {
            setFilterKro(e.target.value);
            setFilterRo("");
          }}
          className="h-8 rounded-md border bg-background px-2 text-xs max-w-[220px]"
        >
          <option value="">Semua KRO</option>
          {filterOptions.kro.map(([id, v]) => (
            <option key={id} value={id}>
              {v.name}
            </option>
          ))}
        </select>
        <select
          value={filterRo}
          onChange={(e) => setFilterRo(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs max-w-[220px]"
        >
          <option value="">Semua RO</option>
          {filterOptions.ro.map(([id, v]) => (
            <option key={id} value={id}>
              {v.code} — {v.name}
            </option>
          ))}
        </select>
        {(filterBalai || filterProgram || filterKegiatan || filterKro || filterRo) && (
          <button
            type="button"
            onClick={() => {
              setFilterBalai("");
              setFilterProgram("");
              setFilterKegiatan("");
              setFilterKro("");
              setFilterRo("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Reset filter
          </button>
        )}
      </div>

      {/* Sub-header kolom tahun — sekali saja untuk seluruh daftar */}
      {!loading && groups.balaiGroups.length > 0 && (
        <div className="hidden md:flex items-center gap-4 px-5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-4">
            <div className="w-24 shrink-0 text-right border-r pr-3">Total</div>
            {groups.years.map((year) => (
              <div key={year} className="w-24 shrink-0 text-right">
                {year}
              </div>
            ))}
          </div>
          <div className="w-[76px] shrink-0" />
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : groups.balaiGroups.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16 text-muted-foreground">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Tidak ada proyek</p>
            </CardContent>
          </Card>
        ) : (
          groups.balaiGroups.map((balaiGroup) => {
            const balaiOpen = expandedBalai.has(balaiGroup.balai.id);
            const proyekCount = balaiGroup.kegiatanGroups.reduce(
              (acc, kg) => acc + kg.plannings.length,
              0,
            );

            return (
              <Card
                key={balaiGroup.balai.id}
                className="overflow-hidden border-l-4 border-l-blue-600 py-0"
              >
                {/* Level 1: Balai */}
                <button
                  onClick={() => toggleBalai(balaiGroup.balai.id)}
                  className="w-full text-left bg-card text-foreground transition-colors hover:bg-accent/40"
                >
                  <div className="flex items-center gap-3 px-5 py-3">
                    {balaiOpen ? (
                      <ChevronDown
                        size={16}
                        className="text-muted-foreground shrink-0"
                      />
                    ) : (
                      <ChevronRight
                        size={16}
                        className="text-muted-foreground shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {balaiGroup.balai.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {balaiGroup.kegiatanGroups.length} kegiatan &middot;{" "}
                        {proyekCount} proyek
                      </p>
                    </div>

                    {/* Total per tahun & keseluruhan — atas Rencana, bawah Realisasi.
                        Total di kiri (sebelum kolom tahun), bukan paling kanan. */}
                    <div className="hidden md:flex items-center gap-4 shrink-0">
                      <div className="w-24 shrink-0 text-right border-r pr-3">
                        <p className="text-sm font-bold tabular-nums">
                          {formatRupiahShort(balaiGroup.grandTotalRencana)}
                        </p>
                        <p className="text-[11px] text-emerald-600 tabular-nums">
                          {formatRupiahShort(balaiGroup.grandTotalRealisasi)}
                        </p>
                      </div>
                      {groups.years.map((year) => (
                        <div key={year} className="w-24 shrink-0 text-right">
                          <p className="text-xs font-semibold tabular-nums">
                            {formatRupiahShort(
                              balaiGroup.rencanaByYear[year] || 0,
                            )}
                          </p>
                          <p className="text-[11px] text-emerald-600 tabular-nums">
                            {formatRupiahShort(
                              balaiGroup.realisasiByYear[year] || 0,
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="w-[76px] shrink-0" />
                  </div>
                </button>

                {balaiOpen && (
                  <CardContent className="p-0 divide-y divide-border border-t">
                    {balaiGroup.kegiatanGroups.map((kegGroup) => {
                      const kegKey = `${balaiGroup.balai.id}:${kegGroup.kegiatanCode}`;
                      const kegOpen = expandedKegiatan.has(kegKey);

                      return (
                        <div key={kegKey} className="bg-muted/20">
                          {/* Level 2: Kegiatan */}
                          <button
                            onClick={() => toggleKegiatan(kegKey)}
                            className="w-full text-left transition-colors hover:bg-accent/30"
                          >
                            <div className="flex items-center gap-3 pl-9 pr-5 py-2.5">
                              {kegOpen ? (
                                <ChevronDown
                                  size={14}
                                  className="text-muted-foreground shrink-0"
                                />
                              ) : (
                                <ChevronRight
                                  size={14}
                                  className="text-muted-foreground shrink-0"
                                />
                              )}
                              <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold shrink-0">
                                {kegGroup.programCode}.{kegGroup.kegiatanCode}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">
                                  {kegGroup.kegiatanName}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {kegGroup.plannings.length} proyek
                                </p>
                              </div>
                              <div className="hidden md:flex items-center gap-4 shrink-0">
                                <div className="w-24 shrink-0 text-right border-r pr-3">
                                  <p className="text-sm font-bold tabular-nums">
                                    {formatRupiahShort(
                                      kegGroup.grandTotalRencana,
                                    )}
                                  </p>
                                  <p className="text-[11px] text-emerald-600 tabular-nums">
                                    {formatRupiahShort(
                                      kegGroup.grandTotalRealisasi,
                                    )}
                                  </p>
                                </div>
                                {groups.years.map((year) => (
                                  <div
                                    key={year}
                                    className="w-24 shrink-0 text-right"
                                  >
                                    <p className="text-xs font-semibold tabular-nums">
                                      {formatRupiahShort(
                                        kegGroup.rencanaByYear[year] || 0,
                                      )}
                                    </p>
                                    <p className="text-[11px] text-emerald-600 tabular-nums">
                                      {formatRupiahShort(
                                        kegGroup.realisasiByYear[year] || 0,
                                      )}
                                    </p>
                                  </div>
                                ))}
                              </div>
                              <div className="w-[76px] shrink-0" />
                            </div>
                          </button>

                          {kegOpen && (
                            <div className="divide-y divide-border border-t bg-background">
                              {kegGroup.plannings.map((p) => {
                                const byYear = byYearOf(alokasiOf(p));
                                const total = Object.values(byYear).reduce(
                                  (acc, v) => {
                                    acc.rencana += v.rencana;
                                    acc.realisasi += v.realisasi;
                                    return acc;
                                  },
                                  { rencana: 0, realisasi: 0 },
                                );
                                const proyekOpen = expandedProyek.has(p.id);

                                return (
                                  <div key={p.id}>
                                    {/* Level 3: Proyek */}
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => toggleProyek(p.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          toggleProyek(p.id);
                                        }
                                      }}
                                      className="group pl-14 pr-5 py-3 hover:bg-accent/30 transition-colors cursor-pointer outline-none focus-visible:bg-accent/40"
                                    >
                                      <div className="flex items-center gap-3">
                                        {proyekOpen ? (
                                          <ChevronDown
                                            size={13}
                                            className="text-muted-foreground shrink-0"
                                          />
                                        ) : (
                                          <ChevronRight
                                            size={13}
                                            className="text-muted-foreground shrink-0"
                                          />
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <span className="inline-block text-[11px] font-mono font-medium text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded shrink-0 truncate mb-1">
                                            {getPlanningKode(p)}
                                          </span>
                                          <p className="text-sm font-medium truncate mb-0.5 group-hover:text-primary transition-colors">
                                            {p.projectName}
                                          </p>
                                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate">
                                            <span>{paketOf(p).length} paket</span>
                                            <TooltipProvider delayDuration={300}>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <MapPin
                                                    size={11}
                                                    className={
                                                      hasLokasi(p)
                                                        ? "text-emerald-600"
                                                        : "text-muted-foreground/40"
                                                    }
                                                  />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  {hasLokasi(p)
                                                    ? "Sudah ada lokasi"
                                                    : "Belum ada lokasi"}
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                            <TooltipProvider delayDuration={300}>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <StickyNote
                                                    size={11}
                                                    className={
                                                      p.catatan
                                                        ? "text-amber-600"
                                                        : "text-muted-foreground/40"
                                                    }
                                                  />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  {p.catatan
                                                    ? "Ada catatan"
                                                    : "Belum ada catatan"}
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          </div>
                                        </div>

                                        <div className="hidden md:flex items-center gap-4 shrink-0">
                                          <div className="w-24 shrink-0 text-right border-r pr-3">
                                            <p className="text-xs font-bold">
                                              {formatRupiahShort(total.rencana)}
                                            </p>
                                            <p className="text-[11px] font-semibold text-emerald-600">
                                              {formatRupiahShort(
                                                total.realisasi,
                                              )}
                                            </p>
                                          </div>
                                          {groups.years.map((year) =>
                                            renderYearCell(year, byYear[year]),
                                          )}
                                        </div>

                                        <div
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {renderActions(p)}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Level 4: Paket */}
                                    {proyekOpen && (
                                      <div className="divide-y divide-border border-t bg-muted/10">
                                        {paketOf(p).length === 0 ? (
                                          <p className="pl-20 pr-5 py-2.5 text-[11px] text-muted-foreground italic">
                                            Belum ada paket
                                          </p>
                                        ) : (
                                          paketOf(p).map((pk) => {
                                            const pkByYear = byYearOf(
                                              pk.alokasi,
                                            );
                                            return (
                                              <div
                                                key={pk.id}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() =>
                                                  setDetailData(p)
                                                }
                                                onKeyDown={(e) => {
                                                  if (
                                                    e.key === "Enter" ||
                                                    e.key === " "
                                                  ) {
                                                    e.preventDefault();
                                                    setDetailData(p);
                                                  }
                                                }}
                                                className="flex items-center gap-3 pl-20 pr-5 py-2.5 hover:bg-accent/30 transition-colors cursor-pointer outline-none focus-visible:bg-accent/40"
                                              >
                                                <div className="min-w-0 flex-1">
                                                  <p className="text-[13px] font-medium truncate">
                                                    {pk.name}
                                                  </p>
                                                  <p className="text-[11px] text-muted-foreground truncate">
                                                    {pk.ro?.code} &middot;{" "}
                                                    {pk.ro?.name}
                                                  </p>
                                                </div>
                                                <div className="hidden md:flex items-center gap-4 shrink-0">
                                                  <div className="w-24 shrink-0" />
                                                  {groups.years.map((year) =>
                                                    renderYearCell(
                                                      year,
                                                      pkByYear[year],
                                                    ),
                                                  )}
                                                </div>
                                                <div className="w-[76px] shrink-0" />
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>

      {!loading && groups.balaiGroups.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            Halaman {page} dari {totalPages} &middot; {total} proyek total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(1)}
              disabled={page <= 1}
              title="Halaman pertama"
            >
              <ChevronsLeft size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft size={14} className="mr-1" /> Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Berikutnya <ChevronRight size={14} className="ml-1" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              title="Halaman terakhir"
            >
              <ChevronsRight size={14} />
            </Button>
          </div>
        </div>
      )}

      <PlanningFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          setShowForm(false);
          fetchPlannings();
        }}
        editData={editData}
      />

      {detailData && (
        <PlanningDetailSheet
          open={!!detailData}
          planning={detailData}
          onClose={() => setDetailData(null)}
          onEdit={(p) => {
            setDetailData(null);
            setEditData(p);
            setShowForm(true);
          }}
          onRefresh={fetchPlannings}
        />
      )}

      <ImportExcelDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() => {
          setShowImport(false);
          fetchPlannings();
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Proyek?</AlertDialogTitle>
            <AlertDialogDescription>
              Proyek yang dihapus tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
