"use client";

import { Suspense, useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  FileText,
  Trash2,
  CheckCheck,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Maximize2,
  Minimize2,
  MapPin,
  SlidersHorizontal,
  StickyNote,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { exportProyekToExcel } from "@/lib/export-proyek-excel";
import { nilaiRealisasi, statusConfig } from "@/components/shared/status-config";
import type { Dana, SaldoNilai } from "@/components/anggaran/saldo-kegiatan";
import { cn } from "@/lib/utils";
import { punyaRole } from "@/lib/role";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Proyek, PaginatedResponse, Periode } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProyekFormDialog } from "@/components/proyek/proyek-form-dialog";
import { ProyekDetailSheet } from "@/components/proyek/proyek-detail-sheet";

const formatRupiah = (val: string | number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(
    Number(val),
  );

/** Angka tabel ringkas gaya hi-fi: "10,0 M", "350 jt", nol = "–". */
const fmtM = (val: number) => {
  const satu = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  if (Math.abs(val) >= 1_000_000_000) return `${(val / 1_000_000_000).toLocaleString("id-ID", satu)} M`;
  if (Math.abs(val) >= 1_000_000) return `${Math.round(val / 1_000_000).toLocaleString("id-ID")} jt`;
  if (val === 0) return "–";
  return formatRupiah(val);
};

const jumlahTahun = (byYear: Record<number, { rencana: number; realisasi: number }>) =>
  Object.values(byYear).reduce(
    (acc, v) => ({ rencana: acc.rencana + v.rencana, realisasi: acc.realisasi + v.realisasi }),
    { rencana: 0, realisasi: 0 },
  );

// Satu template kolom untuk semua tingkat baris (lihat --kolom di tabel):
// nama | status | total | tahun… | aksi. Di layar kecil cuma nama + total.
const BARIS = "grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 px-4 text-sm md:grid-cols-[var(--kolom)]";

function Chevron({ buka }: { buka: boolean }) {
  return (
    <ChevronRight
      size={15}
      aria-hidden
      className={cn("mt-0.5 shrink-0 text-muted-foreground transition-transform", buka && "rotate-90")}
    />
  );
}

/** Sel angka: atas rencana, bawah realisasi (abu; merah kalau melebihi rencana). */
function SelAngka({
  rencana,
  realisasi,
  tebal,
  sembunyi,
}: {
  rencana: number;
  realisasi: number;
  tebal?: boolean;
  sembunyi?: boolean;
}) {
  const n = nilaiRealisasi(realisasi, rencana);
  return (
    <span className={cn("text-right tabular-nums", sembunyi && "hidden md:block")} title={formatRupiah(rencana)}>
      <span className={cn("block", tebal ? "font-semibold" : rencana ? "" : "text-muted-foreground")}>
        {fmtM(rencana)}
      </span>
      {realisasi > 0 && (
        <span className={cn("block text-[11px]", n.over ? "text-destructive" : "text-muted-foreground")}>
          {fmtM(realisasi)}
        </span>
      )}
    </span>
  );
}

function Penanda({
  ada,
  ikon: Ikon,
  teksAda,
  teksBelum,
  kelasAda,
}: {
  ada: boolean;
  ikon: typeof MapPin;
  teksAda: string;
  teksBelum: string;
  kelasAda: string;
}) {
  return (
    <span title={ada ? teksAda : teksBelum} aria-label={ada ? teksAda : teksBelum} role="img">
      <Ikon size={11} className={ada ? kelasAda : "text-muted-foreground/40"} />
    </span>
  );
}

// `paket` selalu array dari backend, tapi dijaga di sini juga karena dipakai
// berulang lintas fungsi di file ini.
const paketOf = (p: Proyek) => p.paket ?? [];
/** Kegiatan proyek; data lama tanpa kegiatan jatuh ke RO paket pertama. */
const kegiatanProyek = (p: Proyek) => p.kegiatan ?? paketOf(p)[0]?.ro?.kro?.kegiatan;
const alokasiOf = (p: Proyek) => paketOf(p).flatMap((pk) => pk.alokasi);

// Penanda cepat di luar tabel: proyek ini sudah punya titik lokasi di peta
// atau belum, tanpa perlu buka detail.
const hasLokasi = (p: Proyek) => alokasiOf(p).some((a) => a.lokasi.length > 0);

// Rekap Rencana/Realisasi per tahun dari satu daftar alokasi — dipakai baik
// di level Proyek (semua paket) maupun di level Paket (satu paket saja).
const byYearOf = (
  alokasi: { tahun: number; status: string; total: string }[],
) => {
  const byYear: Record<number, { rencana: number; realisasi: number }> = {};
  for (const a of alokasi) {
    if (!byYear[a.tahun]) byYear[a.tahun] = { rencana: 0, realisasi: 0 };
    if (a.status === "RENCANA") byYear[a.tahun].rencana += Number(a.total);
    else byYear[a.tahun].realisasi += Number(a.total);
  }
  return byYear;
};

export default function ProyekPage() {
  return (
    <Suspense>
      <ProyekPageInner />
    </Suspense>
  );
}

function ProyekPageInner() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const [proyekList, setProyekList] = useState<Proyek[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
  const [expandedProyek, setExpandedProyek] = useState<Set<string>>(new Set());

  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Proyek | null>(null);
  const [detailData, setDetailData] = useState<Proyek | null>(null);
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

  // Periode — filter server-side (bukan cascading dari data ter-load kayak
  // Balai/Program/dst) karena tabel rekap tahun menggabungkan rentang
  // periode SEMUA proyek yang tampil; tanpa filter ini, satu proyek lama
  // berperiode beda bikin kolom tahun melebar ke rentang periode itu juga.
  const [periodeList, setPeriodeList] = useState<Periode[]>([]);
  const [filterPeriode, setFilterPeriode] = useState("");
  // Hanya proyek dari import terakhir user (periode diabaikan supaya semua
  // hasil import tampil, apa pun periodenya).
  const [filterImport, setFilterImport] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");

  // Saldo kegiatan tahun berjalan (baris kegiatan: "pakai X dari saldo Y").
  const periodeAktif = periodeList.find((pr) => String(pr.id) === filterPeriode);
  const kini = new Date().getFullYear();
  const tahunSaldo = periodeAktif
    ? kini >= periodeAktif.startYear && kini <= periodeAktif.endYear
      ? kini
      : periodeAktif.startYear
    : null;
  const [saldoKegiatan, setSaldoKegiatan] = useState<Record<
    string,
    { saldo: SaldoNilai | null; terpakai: Dana }
  > | null>(null);
  useEffect(() => {
    if (!tahunSaldo) return;
    api
      .get<{ kegiatanId: string; saldo: SaldoNilai | null; terpakai: Dana }[]>("/saldo-kegiatan", {
        params: { tahun: tahunSaldo },
      })
      .then((r) => setSaldoKegiatan(Object.fromEntries(r.data.map((k) => [k.kegiatanId, k]))))
      .catch(() => setSaldoKegiatan(null));
  }, [tahunSaldo]);

  useEffect(() => {
    api
      .get<Periode[]>("/master/periodes")
      .then((res) => {
        setPeriodeList(res.data);
        if (res.data.length > 0) setFilterPeriode(String(res.data[0].id));
      })
      .catch(() => {});
  }, []);

  const fetchProyek = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "100",
        ...(search && { search }),
        ...(filterImport
          ? { importTerakhir: "1" }
          : filterPeriode && { periodeId: filterPeriode }),
      });
      const res = await api.get<PaginatedResponse<Proyek>>(`/proyek?${params}`);
      setProyekList(res.data.data);
      setTotalPages(res.data.meta.totalPages);
      setTotal(res.data.meta.total);
      // detailData adalah snapshot terpisah (dipilih saat Sheet dibuka) —
      // kalau tidak disegarkan juga di sini, perubahan (tambah/edit alokasi,
      // paket, dst) baru kelihatan setelah Sheet ditutup lalu dibuka lagi.
      setDetailData((prev) =>
        prev ? (res.data.data.find((p) => p.id === prev.id) ?? prev) : prev,
      );
    } catch {
      toast.error("Gagal memuat data proyek");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Tunggu filterPeriode ke-resolve (default periode dulu dipilih otomatis
    // setelah periodeList termuat) — kalau tidak, fetch awal tanpa periodeId
    // bisa menang race melawan fetch ber-periodeId begitu default terpasang.
    if (!filterPeriode && !filterImport) return;
    fetchProyek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterPeriode, filterImport]);
  const prevSearch = useRef(search);
  useEffect(() => {
    // Skip di mount (search belum benar-benar berubah) — kalau tidak, fetch
    // tanpa periodeId ini terjadwal dengan closure lama (filterPeriode masih
    // "") dan bisa menimpa hasil fetch ber-periodeId begitu default periode
    // terpasang.
    if (prevSearch.current === search) return;
    prevSearch.current = search;
    const timeout = setTimeout(() => {
      setPage(1);
      fetchProyek();
    }, 400);
    return () => clearTimeout(timeout);
  }, [search]);

  // Deep-link dari Log Aktivitas (`/proyek?id=...`) — buka langsung sheet
  // detail proyek itu tanpa user harus cari manual di list.
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    api
      .get<Proyek>(`/proyek/${id}`)
      .then((res) => setDetailData(res.data))
      .catch(() => toast.error("Proyek tidak ditemukan"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Data baris daftar bisa tertinggal (cache 60 dtk, skor ikut form terbaru) —
  // tampilkan dulu, lalu segarkan dari detail.
  const bukaDetail = (p: Proyek) => {
    setDetailData(p);
    api
      .get<Proyek>(`/proyek/${p.id}`)
      .then((res) => setDetailData((cur) => (cur?.id === p.id ? res.data : cur)))
      .catch(() => {});
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/proyek/${deleteId}`);
      toast.success("Proyek berhasil dihapus");
      setDeleteId(null);
      fetchProyek();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus proyek");
    } finally {
      setDeleting(false);
    }
  };

  // Export selalu ambil SEMUA proyek (semua status), bukan cuma
  // halaman/hasil filter yang sedang tampil di layar.
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      // Backend membatasi limit maks 100/request — tarik semua halaman.
      const all: Proyek[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const res = await api.get<PaginatedResponse<Proyek>>("/proyek", {
          params: { page, limit: 100 },
        });
        all.push(...res.data.data);
        totalPages = res.data.meta.totalPages;
        page++;
      } while (page <= totalPages);
      await exportProyekToExcel(all);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengexport ke Excel");
    } finally {
      setExporting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/proyek/${id}/approve`);
      toast.success("Proyek disetujui");
      fetchProyek();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyetujui proyek");
    }
  };

  const canApprove = (p: Proyek) =>
    p.status === "DRAFT" && punyaRole(user, "ADMINISTRATOR");

  const canDelete = (p: Proyek) =>
    punyaRole(user, "ADMINISTRATOR") || p.createdBy.id === user?.id;

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

    for (const p of proyekList) {
      balaiMap.set(p.balai.id, p.balai.name);
      if (p.kegiatan) {
        const prog = p.kegiatan.program;
        programMap.set(prog.id, `${prog.code} — ${prog.name}`);
        kegiatanMap.set(p.kegiatan.id, {
          name: `${p.kegiatan.code} — ${p.kegiatan.name}`,
          programId: prog.id,
        });
      }
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
        kroMap.set(kro.id, {
          name: `${kro.code} — ${kro.name}`,
          kegiatanId: keg.id,
        });
        roMap.set(ro.id, { code: ro.code, name: ro.name, kroId: kro.id });
      }
    }

    // Semua opsi urut kode (id = kode/kode berjenjang), terkecil dulu.
    const byKode = (a: [string | number, unknown], b: [string | number, unknown]) =>
      urutKode(a[0], b[0]);
    return {
      balai: [...balaiMap.entries()].sort(byKode),
      program: [...programMap.entries()].sort(byKode),
      kegiatan: [...kegiatanMap.entries()]
        .filter(([, v]) => !filterProgram || v.programId === filterProgram)
        .sort(byKode),
      kro: [...kroMap.entries()]
        .filter(([, v]) => !filterKegiatan || v.kegiatanId === filterKegiatan)
        .sort(byKode),
      ro: [...roMap.entries()]
        .filter(([, v]) => !filterKro || v.kroId === filterKro)
        .sort(byKode),
    };
  }, [proyekList, filterProgram, filterKegiatan, filterKro]);

  // Proyek lolos filter kalau salah satu paketnya cocok dengan pilihan
  // Program/Kegiatan/KRO/RO (bukan cuma paket pertama) — Balai difilter di
  // level proyek langsung.
  const filteredProyek = useMemo(() => {
    return proyekList.filter((p) => {
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterBalai && String(p.balai.id) !== filterBalai) return false;
      // Program & kegiatan milik proyek; KRO/RO dari paketnya.
      const keg = kegiatanProyek(p);
      if (filterProgram && keg?.program.id !== filterProgram) return false;
      if (filterKegiatan && keg?.id !== filterKegiatan) return false;
      if (!filterKro && !filterRo) return true;
      return paketOf(p).some((pk) =>
        filterRo ? pk.ro?.id === filterRo : pk.ro?.kro.id === filterKro,
      );
    });
  }, [
    proyekList,
    filterBalai,
    filterProgram,
    filterKegiatan,
    filterKro,
    filterRo,
    filterStatus,
  ]);
  // Jumlah per status dari semua proyek termuat.
  const jumlahStatus = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of proyekList) m[p.status] = (m[p.status] ?? 0) + 1;
    return m;
  }, [proyekList]);
  const filterLainAktif = [filterProgram, filterKro, filterRo].filter(Boolean).length;

  type KegiatanGroup = {
    kegiatanId: string;
    kegiatanCode: string;
    kegiatanName: string;
    programCode: string;
    proyekList: Proyek[];
    rencanaByYear: Record<number, number>;
    realisasiByYear: Record<number, number>;
    grandTotalRencana: number;
    grandTotalRealisasi: number;
  };
  type BalaiGroup = {
    balai: Proyek["balai"];
    kegiatanGroups: KegiatanGroup[];
    rencanaByYear: Record<number, number>;
    realisasiByYear: Record<number, number>;
    grandTotalRencana: number;
    grandTotalRealisasi: number;
  };

  const groups = useMemo(() => {
    const balaiMap = new Map<
      number,
      Omit<BalaiGroup, "kegiatanGroups"> & {
        kegiatanMap: Map<string, KegiatanGroup>;
      }
    >();
    const years = new Set<number>();

    const addAlokasi = (
      target: {
        rencanaByYear: Record<number, number>;
        realisasiByYear: Record<number, number>;
        grandTotalRencana: number;
        grandTotalRealisasi: number;
      },
      a: { tahun: number; status: string; total: string },
    ) => {
      const value = Number(a.total);
      if (a.status === "RENCANA") {
        target.rencanaByYear[a.tahun] =
          (target.rencanaByYear[a.tahun] || 0) + value;
        target.grandTotalRencana += value;
      } else {
        target.realisasiByYear[a.tahun] =
          (target.realisasiByYear[a.tahun] || 0) + value;
        target.grandTotalRealisasi += value;
      }
    };

    for (const p of filteredProyek) {
      // Kolom tahun mengikuti rentang periode proyek, bukan cuma tahun yang
      // kebetulan sudah punya alokasi — tahun kosong tetap ditampilkan.
      for (let y = p.periode.startYear; y <= p.periode.endYear; y++)
        years.add(y);

      const keg = kegiatanProyek(p);
      const kegiatanCode = keg?.code || "LAINNYA";
      const kegiatanName = keg?.name || "Kegiatan belum ditentukan";
      const programCode = keg?.program?.code || "-";

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
          kegiatanId: keg?.id ?? "",
          kegiatanCode,
          kegiatanName,
          programCode,
          proyekList: [],
          rencanaByYear: {},
          realisasiByYear: {},
          grandTotalRencana: 0,
          grandTotalRealisasi: 0,
        });
      }
      const kegGroup = balaiGroup.kegiatanMap.get(kegiatanCode)!;
      kegGroup.proyekList.push(p);

      for (const a of alokasiOf(p)) {
        addAlokasi(kegGroup, a);
        addAlokasi(balaiGroup, a);
      }
    }

    const sortedYears = [...years].sort((a, b) => a - b);
    const balaiGroups: BalaiGroup[] = [...balaiMap.values()]
      .map((bg) => ({
        ...bg,
        kegiatanGroups: [...bg.kegiatanMap.values()]
          .sort((a, b) => urutKode(a.kegiatanCode, b.kegiatanCode))
          .map((kg) => ({
            ...kg,
            proyekList: [...kg.proyekList].sort((a, b) =>
              urutKode(a.kodeProyek ?? "", b.kodeProyek ?? ""),
            ),
          })),
      }))
      .sort((a, b) => urutKode(a.balai.id, b.balai.id));

    return { balaiGroups, years: sortedYears };
  }, [filteredProyek]);
  const kolomTabel = `minmax(0,3.2fr) 7.5rem 6rem repeat(${groups.years.length}, minmax(4.25rem,0.8fr)) 4.5rem`;
  const jumlahPaket = filteredProyek.reduce((n, p) => n + paketOf(p).length, 0);

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
      setExpandedProyek(new Set(filteredProyek.map((p) => p.id)));
    } else {
      setExpandedBalai(new Set());
      setExpandedKegiatan(new Set());
      setExpandedProyek(new Set());
    }
  };

  // Kode identitas ringkas per proyek, mis. "WA.7755.EBA" — dari kode Balai +
  // Program.Kegiatan pada alokasi pertamanya. Ditampilkan langsung di baris
  // list supaya user tidak perlu buka detail hanya untuk mengenali proyek.
  const getProyekKode = (p: Proyek) => {
    const keg = kegiatanProyek(p);
    const balaiCode = p.balai.code || p.balai.shortName || "-";
    const programCode = keg?.program?.code || "-";
    const kegiatanCode = keg?.code || "-";
    return `${balaiCode}.${programCode}.${kegiatanCode}`;
  };

  const renderActions = (p: Proyek) => (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 shrink-0">
        {canApprove(p) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-ok hover:text-ok hover:bg-ok/10"
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
            {total} proyek · {jumlahPaket} paket
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
          {punyaRole(user, "SATKER", "ADMINISTRATOR") && (
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

      {/* Filter baris 1: cari + periode/balai/kegiatan + filter lain (hi-fi HfProyek). */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Cari nama proyek…"
              aria-label="Cari nama proyek"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <FilterSelect
            label="Periode"
            value={filterPeriode}
            disabled={filterImport}
            onChange={(v) => {
              setFilterPeriode(v);
              setPage(1);
            }}
            opsi={periodeList.map((p) => [String(p.id), p.label])}
          />
          <FilterSelect
            label="Balai"
            value={filterBalai}
            onChange={setFilterBalai}
            semua="Semua balai"
            opsi={filterOptions.balai.map(([id, name]) => [String(id), name])}
          />
          <FilterSelect
            label="Kegiatan"
            value={filterKegiatan}
            onChange={(v) => {
              setFilterKegiatan(v);
              setFilterKro("");
              setFilterRo("");
            }}
            semua="Semua kegiatan"
            opsi={filterOptions.kegiatan.map(([id, v]) => [String(id), v.name])}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <SlidersHorizontal size={14} />
                Filter lain
                {filterLainAktif > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">
                    {filterLainAktif}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 space-y-2.5">
              <FilterSelect
                label="Program"
                lebar
                value={filterProgram}
                onChange={(v) => {
                  setFilterProgram(v);
                  setFilterKegiatan("");
                  setFilterKro("");
                  setFilterRo("");
                }}
                semua="Semua program"
                opsi={filterOptions.program.map(([id, name]) => [String(id), name])}
              />
              <FilterSelect
                label="KRO"
                lebar
                value={filterKro}
                onChange={(v) => {
                  setFilterKro(v);
                  setFilterRo("");
                }}
                semua="Semua KRO"
                opsi={filterOptions.kro.map(([id, v]) => [String(id), v.name])}
              />
              <FilterSelect
                label="RO"
                lebar
                value={filterRo}
                onChange={setFilterRo}
                semua="Semua RO"
                opsi={filterOptions.ro.map(([id, v]) => [String(id), `${v.code} — ${v.name}`])}
              />
            </PopoverContent>
          </Popover>
          {(filterBalai || filterProgram || filterKegiatan || filterKro || filterRo || filterStatus) && (
            <button
              type="button"
              onClick={() => {
                setFilterBalai("");
                setFilterProgram("");
                setFilterKegiatan("");
                setFilterKro("");
                setFilterRo("");
                setFilterStatus("");
              }}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Reset filter
            </button>
          )}
        </div>

        {/* Filter baris 2: status + hasil import + buka/tutup semua. */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["", "Semua status"],
              ...Object.entries(statusConfig).map(([k, v]) => [k, `${v.label} · ${jumlahStatus[k] ?? 0}`]),
            ] as [string, string][]
          ).map(([k, label]) => (
            <button
              key={k || "semua"}
              type="button"
              aria-pressed={filterStatus === k}
              onClick={() => setFilterStatus(k)}
              className={cn(
                "h-8 rounded-full border px-3 text-[13px] transition-colors",
                filterStatus === k
                  ? "border-foreground bg-foreground text-background"
                  : "bg-card hover:bg-accent",
              )}
            >
              {label}
            </button>
          ))}
          {punyaRole(user, "SATKER", "ADMINISTRATOR") && (
            <button
              type="button"
              aria-pressed={filterImport}
              onClick={() => {
                setFilterImport((v) => !v);
                setPage(1);
              }}
              className={cn(
                "h-8 rounded-full border px-3 text-[13px] transition-colors",
                filterImport
                  ? "border-primary bg-primary-soft font-medium text-primary-ink"
                  : "bg-card hover:bg-accent",
              )}
            >
              Hasil import terakhir{filterImport && " ✕"}
            </button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAllGroups}
            className="ml-auto h-8 gap-1.5 text-[13px] text-muted-foreground"
          >
            {allCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            {allCollapsed ? "Buka semua" : "Tutup semua"}
          </Button>
        </div>
      </div>

      {/* Satu tabel berjenjang: Balai › Kegiatan › Proyek › Paket. Judul kolom
          menempel (overflow-clip, bukan hidden, supaya sticky tetap jalan). */}
      {loading ? (
        <div className="space-y-2 rounded-xl border bg-card p-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : groups.balaiGroups.length === 0 ? (
        <div className="rounded-xl border bg-card py-16 text-center text-muted-foreground">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Tidak ada proyek</p>
          <p className="mt-1 text-xs">
            {filterImport
              ? "Import terakhir Anda tidak menambah proyek."
              : "Ubah filter atau pencarian, atau buat proyek baru."}
          </p>
        </div>
      ) : (
        <div className="overflow-clip rounded-xl border bg-card" style={{ ["--kolom" as string]: kolomTabel }}>
          <div
            className={cn(
              BARIS,
              "sticky top-0 z-10 border-b bg-card py-2.5 text-xs font-semibold text-muted-foreground",
            )}
          >
            <span>Balai › Kegiatan › Proyek › Paket</span>
            <span className="hidden md:block">Status</span>
            <span className="text-right">Total</span>
            {groups.years.map((y) => (
              <span key={y} className="hidden text-right md:block">
                {y}
              </span>
            ))}
            <span className="hidden md:block" />
          </div>

          {groups.balaiGroups.map((balaiGroup) => {
            const balaiOpen = expandedBalai.has(balaiGroup.balai.id);
            const proyekCount = balaiGroup.kegiatanGroups.reduce((acc, kg) => acc + kg.proyekList.length, 0);
            return (
              <div key={balaiGroup.balai.id}>
                {/* Tingkat 1: Balai */}
                <button
                  type="button"
                  aria-expanded={balaiOpen}
                  onClick={() => toggleBalai(balaiGroup.balai.id)}
                  className={cn(BARIS, "w-full border-b bg-tier-1 py-3 text-left hover:bg-accent")}
                >
                  <span className="flex min-w-0 items-start gap-2">
                    <Chevron buka={balaiOpen} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold" title={balaiGroup.balai.name}>
                        {balaiGroup.balai.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {balaiGroup.kegiatanGroups.length} kegiatan · {proyekCount} proyek
                      </span>
                    </span>
                  </span>
                  <span className="hidden md:block" />
                  <SelAngka rencana={balaiGroup.grandTotalRencana} realisasi={balaiGroup.grandTotalRealisasi} tebal />
                  {groups.years.map((y) => (
                    <SelAngka
                      key={y}
                      sembunyi
                      rencana={balaiGroup.rencanaByYear[y] || 0}
                      realisasi={balaiGroup.realisasiByYear[y] || 0}
                    />
                  ))}
                  <span className="hidden md:block" />
                </button>

                {balaiOpen &&
                  balaiGroup.kegiatanGroups.map((kegGroup) => {
                    const kegKey = `${balaiGroup.balai.id}:${kegGroup.kegiatanCode}`;
                    const kegOpen = expandedKegiatan.has(kegKey);
                    const sk = saldoKegiatan?.[kegGroup.kegiatanId];
                    return (
                      <div key={kegKey}>
                        {/* Tingkat 2: Kegiatan (+ saldo kegiatan tahun berjalan) */}
                        <button
                          type="button"
                          aria-expanded={kegOpen}
                          onClick={() => toggleKegiatan(kegKey)}
                          className={cn(BARIS, "w-full border-b bg-tier-2 py-2.5 text-left hover:bg-accent")}
                        >
                          <span className="flex min-w-0 items-start gap-2 pl-5">
                            <Chevron buka={kegOpen} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium" title={kegGroup.kegiatanName}>
                                {kegGroup.kegiatanName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Kegiatan <span className="font-mono">{kegGroup.kegiatanCode}</span> ·{" "}
                                {kegGroup.proyekList.length} proyek
                                {saldoKegiatan && tahunSaldo && kegGroup.kegiatanId && (
                                  <>
                                    {" · "}
                                    {sk?.saldo ? (
                                      <span
                                        className={cn(sk.terpakai.total > sk.saldo.total && "font-medium text-destructive")}
                                      >
                                        pakai {fmtM(sk.terpakai.total)} dari saldo {fmtM(sk.saldo.total)} ({tahunSaldo})
                                      </span>
                                    ) : (
                                      <>saldo {tahunSaldo} belum ditetapkan</>
                                    )}
                                  </>
                                )}
                              </span>
                            </span>
                          </span>
                          <span className="hidden md:block" />
                          <SelAngka rencana={kegGroup.grandTotalRencana} realisasi={kegGroup.grandTotalRealisasi} tebal />
                          {groups.years.map((y) => (
                            <SelAngka
                              key={y}
                              sembunyi
                              rencana={kegGroup.rencanaByYear[y] || 0}
                              realisasi={kegGroup.realisasiByYear[y] || 0}
                            />
                          ))}
                          <span className="hidden md:block" />
                        </button>

                        {kegOpen &&
                          kegGroup.proyekList.map((p) => {
                            const byYear = byYearOf(alokasiOf(p));
                            const total = jumlahTahun(byYear);
                            const proyekOpen = expandedProyek.has(p.id);
                            const st = statusConfig[p.status as keyof typeof statusConfig];
                            return (
                              <div key={p.id}>
                                {/* Tingkat 3: Proyek — klik nama = detail, klik baris = buka paket. */}
                                <div
                                  role="button"
                                  tabIndex={0}
                                  aria-expanded={proyekOpen}
                                  onClick={() => toggleProyek(p.id)}
                                  onKeyDown={(e) => {
                                    if (e.target !== e.currentTarget) return;
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      toggleProyek(p.id);
                                    }
                                  }}
                                  className={cn(
                                    BARIS,
                                    "cursor-pointer border-b py-2.5 outline-none hover:bg-accent/60 focus-visible:bg-accent",
                                  )}
                                >
                                  <span className="flex min-w-0 items-start gap-2 pl-10">
                                    <Chevron buka={proyekOpen} />
                                    <span className="min-w-0">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          bukaDetail(p);
                                        }}
                                        className="block max-w-full truncate text-left font-semibold hover:text-primary-ink hover:underline"
                                        title={`${p.projectName} (buka detail)`}
                                      >
                                        {p.projectName}
                                      </button>
                                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <span className="font-mono">{p.kodeProyek ?? getProyekKode(p)}</span>
                                        <span>· {paketOf(p).length} paket</span>
                                        <Penanda
                                          ada={hasLokasi(p)}
                                          ikon={MapPin}
                                          teksAda="Sudah ada lokasi"
                                          teksBelum="Belum ada lokasi"
                                          kelasAda="text-ok"
                                        />
                                        <Penanda
                                          ada={!!p.catatan}
                                          ikon={StickyNote}
                                          teksAda="Ada catatan"
                                          teksBelum="Belum ada catatan"
                                          kelasAda="text-warn-ink"
                                        />
                                      </span>
                                    </span>
                                  </span>
                                  <span className="hidden md:block">
                                    {st && (
                                      <Badge variant="dot" dotColor={st.dotColor}>
                                        {st.label}
                                      </Badge>
                                    )}
                                  </span>
                                  <SelAngka rencana={total.rencana} realisasi={total.realisasi} tebal />
                                  {groups.years.map((y) => (
                                    <SelAngka
                                      key={y}
                                      sembunyi
                                      rencana={byYear[y]?.rencana || 0}
                                      realisasi={byYear[y]?.realisasi || 0}
                                    />
                                  ))}
                                  <span className="hidden justify-end md:flex" onClick={(e) => e.stopPropagation()}>
                                    {renderActions(p)}
                                  </span>
                                </div>

                                {/* Tingkat 4: Paket */}
                                {proyekOpen &&
                                  (paketOf(p).length === 0 ? (
                                    <p className="border-b py-2.5 pl-[4.75rem] pr-4 text-xs italic text-muted-foreground">
                                      Belum ada paket
                                    </p>
                                  ) : (
                                    paketOf(p).map((pk) => {
                                      const pkByYear = byYearOf(pk.alokasi);
                                      const pkTotal = jumlahTahun(pkByYear);
                                      return (
                                        <div
                                          key={pk.id}
                                          role="button"
                                          tabIndex={0}
                                          onClick={() => bukaDetail(p)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              bukaDetail(p);
                                            }
                                          }}
                                          className={cn(
                                            BARIS,
                                            "cursor-pointer border-b py-2.5 outline-none hover:bg-accent/60 focus-visible:bg-accent",
                                          )}
                                        >
                                          <span className="min-w-0 pl-[4.75rem]">
                                            <span className="block truncate text-[13.5px]" title={pk.name}>
                                              {pk.name}
                                            </span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                              <span className="font-mono">RO {pk.ro?.code}</span> · {pk.ro?.name}
                                            </span>
                                          </span>
                                          <span className="hidden md:block" />
                                          <SelAngka rencana={pkTotal.rencana} realisasi={pkTotal.realisasi} />
                                          {groups.years.map((y) => (
                                            <SelAngka
                                              key={y}
                                              sembunyi
                                              rencana={pkByYear[y]?.rencana || 0}
                                              realisasi={pkByYear[y]?.realisasi || 0}
                                            />
                                          ))}
                                          <span className="hidden md:block" />
                                        </div>
                                      );
                                    })
                                  ))}
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Angka atas = rencana; angka bawah abu = realisasi (tampil kalau sudah ada). Klik nama proyek untuk membuka
        detailnya.
      </p>

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

      <ProyekFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          setShowForm(false);
          fetchProyek();
        }}
        editData={editData}
      />

      {detailData && (
        <ProyekDetailSheet
          open={!!detailData}
          proyek={detailData}
          onClose={() => setDetailData(null)}
          onEdit={(p) => {
            setDetailData(null);
            setEditData(p);
            setShowForm(true);
          }}
          onRefresh={fetchProyek}
        />
      )}

      <ImportExcelDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={(lihatHasil) => {
          setShowImport(false);
          if (lihatHasil && !filterImport) {
            setPage(1);
            setFilterImport(true);
          } else fetchProyek();
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

// Radix Select tidak menerima value "" — opsi "Semua …" memakai penanda ini.
const SEMUA = "__semua";

/** Dropdown filter daftar proyek (pakai Select sistem, jadi ikut punya pencarian). */
function FilterSelect({
  label,
  value,
  onChange,
  semua,
  opsi,
  disabled,
  lebar,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  semua?: string;
  opsi: [string, string][];
  disabled?: boolean;
  /** Isi lebar penuh (di dalam popover Filter lain). */
  lebar?: boolean;
}) {
  return (
    <Select
      value={value || SEMUA}
      onValueChange={(v) => onChange(v === SEMUA ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger aria-label={label} className={cn("h-9 text-[13px]", lebar ? "w-full" : "w-[150px]")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {semua && (
          <SelectItem value={SEMUA} className="text-xs">
            {semua}
          </SelectItem>
        )}
        {opsi.map(([v, label]) => (
          <SelectItem key={v} value={v} className="text-xs">
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Urutan kode/nomor terkecil dulu ("2" sebelum "10", "7691.CBR" sebelum "7692"). */
function urutKode(a: string | number, b: string | number) {
  return String(a).localeCompare(String(b), "id", { numeric: true });
}
