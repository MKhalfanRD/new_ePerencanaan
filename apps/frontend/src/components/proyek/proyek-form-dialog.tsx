"use client";

import React, { useEffect, useState } from "react";
import { useForm, FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSearchBox,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  FieldControl,
  type FieldControlValue,
} from "@/components/master/field-control";
import { rowsForItem, subLabel, useSourceData } from "@/lib/option-sources";
import { kondisiTerpenuhi } from "@/lib/form-condition";
import { fmtSkor, ringkasPaket, skorField } from "@/lib/form-score";
import {
  PaketLabel,
  PAKET_ALWAYS_REQUIRED_KEYS,
  PAKET_BAKU_KEYS,
  PEMAKETAN_PROYEK_KEYS,
  PemaketanBakuPreview,
  fromFormValueRows,
  paketDariServer,
  paketKePayload,
  paketSections,
  ringkasIsianPaket,
  toFormValueList,
  totalPaket,
  type PaketIsian,
} from "./paket-template";
import { AngkaInput, PaketDialog, statusSaldo, teksAngka } from "./paket-dialog";
import { formatRupiah } from "@/lib/format-rupiah";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import {
  isItemWide,
  TAB_GRID_CLASS,
  KEGIATAN_GRID_CLASS,
  TAB_ICONS,
  TAB_DEFAULT_DESCRIPTIONS,
} from "@/lib/form-item-width";
import type { TabKey } from "@/lib/form-item-width";
import api from "@/lib/api";
import { CascadingWilayah } from "@/components/map/cascading-wilayah";
import { LokasiPeta } from "@/components/map/lokasi-peta";
import {
  Balai,
  Periode,
  RO,
  Komponen,
  Proyek,
  PrioritasNasional,
} from "@/types";

const toOptionalNumber = (v: string) => (v === "" ? undefined : Number(v));
const angkaAtauNull = (v: unknown) => (v == null || v === "" ? null : Number(v));

// Sentinel untuk opsi "tidak dipilih" pada Select opsional — Radix Select
// tidak mengizinkan value="".
const NONE = "__NONE__";

interface KegiatanOpt {
  id: string;
  name: string;
  code: string;
  program: { id: string; name: string; code: string };
  formTemplate?: { id: string } | null;
}

export interface FormItemOption {
  id: string;
  value: string;
  label: string;
  isActive?: boolean;
  score?: number | null;
}
export interface FormItemNode {
  id: string;
  key: string;
  label: string;
  fieldType: string;
  thresholdValue?: number | null;
  conditionItemId?: string | null;
  conditionValue?: string | null;
  width?: "HALF" | "FULL" | null;
  isActive?: boolean;
  score?: number | null;
  required?: boolean;
  optionSource?: string | null;
  optionParentKey?: string | null;
  // Field RASIO: rumus pembilang:penyebut, simbol & satuan standar.
  rasio?: { pembilang?: string; penyebut?: string; operator?: string; satuan?: string } | null;
  subLabels?: Record<string, string> | null;
  options: FormItemOption[];
}
export interface FormTabNode {
  id: string;
  key: string;
  label: string;
  description: string | null;
  isActive?: boolean;
  bobot?: number | null;
  sections: {
    id: string;
    key: string;
    label: string;
    isActive?: boolean;
    // Syarat tampil bagian (KEY field pemicu + JSON array nilai).
    conditionItemId?: string | null;
    conditionValue?: string | null;
    // Tab Pemaketan: true = diisi per paket (kartu dialog paket).
    perPaket?: boolean;
    items: FormItemNode[];
  }[];
}
interface FormTemplateTree {
  tabs: FormTabNode[];
}


interface PkpnOpt {
  id: string;
  name: string;
}
interface TematikOpt {
  id: string;
  name: string;
}
interface SasaranProgramOpt {
  id: string;
  programId: string;
  name: string;
  indikator: { id: string; name: string; satuan?: string }[];
}
interface SasaranKegiatanOpt {
  id: string;
  kegiatanId: string;
  name: string;
  indikator: { id: string; name: string; satuan?: string }[];
}

const schema = z.object({
  // Tab 1: Identitas Proyek
  balaiId: z.number({ error: "Balai wajib dipilih" }),
  periodeId: z.number({ error: "Periode wajib dipilih" }),
  projectName: z.string().min(1, "Nama proyek wajib diisi"),
  wilayahSungaiId: z.string().optional(),

  // Tab Lokasi Proyek — format sama dgn lokasi alokasi
  tipeKoordinat: z.enum(["TITIK", "GARIS", "POLIGON"]),
  coordinates: z.array(z.array(z.number())),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  provinceId: z.string().optional(),
  provinceName: z.string().optional(),
  cityId: z.string().optional(),
  cityName: z.string().optional(),
  districtId: z.string().optional(),
  districtName: z.string().optional(),
  villageId: z.string().optional(),
  villageName: z.string().optional(),

  // Tab 2: Dasar Pelaksanaan — nilai dari master data SumberUsulanProyek
  sumberUsulanProyek: z.string().optional(),
  sumberUsulanLainnya: z.string().optional(),
  justifikasiProyek: z.string().optional(),

  // Tab 3: Kriteria Teknis
  tahunStudiLayak: z.number().optional(),
  statusStudiLayak: z.enum(["RENCANA", "SUDAH_ADA", "TIDAK_PERLU"]),
  tahunDed: z.number().optional(),
  statusDed: z.enum(["RENCANA", "SUDAH_ADA", "TIDAK_PERLU"]),
  tahunLarap: z.number().optional(),
  statusLarap: z.enum(["RENCANA", "SUDAH_ADA", "TIDAK_PERLU"]),
  tahunDokumenLingkungan: z.number().optional(),
  statusDokumenLingkungan: z.enum(["RENCANA", "SUDAH_ADA", "TIDAK_PERLU"]),
  kebutuhanTanah: z.boolean(),
  kewenangan: z.enum(["PUSAT", "DAERAH"]),

  // Tab 4: Pemaketan — saldo & izin satker milik proyek. Daftar paket
  // (PaketIsian) cuma dipakai saat buat proyek baru; proyek yang sudah ada
  // menyimpan paket langsung lewat /paket.
  saldoAnggaran: z.number().nullable().optional(),
  saldoVolumeRo: z.number().nullable().optional(),
  saldoVolumeIro: z.number().nullable().optional(),
  satkerBolehUbahPaket: z.boolean(),
  paket: z.array(z.custom<PaketIsian>()),

  // Tab 5: Tagging
  kegiatanPrioritasId: z.string().optional(),
  pkpnId: z.string().optional(),
  indikatorSasaranProgramId: z.string().optional(),
  indikatorSasaranKegiatanId: z.string().optional(),
  tematikRenjaId: z.string().optional(),
  fkb: z.boolean(),
  fkw: z.boolean(),
  mpa: z.boolean(),
  taggingDinamis: z.array(z.string()),

  // Tab 6: Dokumen & Catatan
  catatanPembina: z.string().optional(),
  catatanSspsda: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// Kontrak yang diimplementasikan kanvas Master Data (form-proyek-tab.tsx) —
// dialog ini cuma manggil fungsi ini utk render header tab & body section,
// semua state/mutation/DnD CRUD-nya tetap tinggal di form-proyek-tab.tsx.
// Ini yang bikin kanvas admin & form user PERSIS sama tanpa 2 file JSX
// terpisah yang gampang desync.
export interface ProyekFormAdminHandlers {
  tabHeader: (tabKey: TabKey, tab: FormTabNode | undefined) => React.ReactNode;
  sectionsBody: (
    tabKey: TabKey,
    tabId: string,
    sections: FormTabNode["sections"],
    renderItem: (item: FormItemNode) => React.ReactNode,
    gridClass: string,
  ) => React.ReactNode;
  note: (tabKey: TabKey) => React.ReactNode;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: Proyek | null;
  // Dipakai kanvas Master Data untuk menampilkan UI form user asli sebagai
  // pratinjau — kegiatan dikunci ke `initialKegiatanId`, tidak ada submit.
  previewMode?: boolean;
  // Dipakai kanvas Master Data buat MENGELOLA struktur template (bukan
  // sekadar pratinjau) — field baku (balaiId dst) tetap tampil PERSIS sama
  // dengan form asli, tapi section/item generik dirender lewat
  // `adminHandlers` supaya admin bisa toggle/drag/edit/hapus/tambah.
  adminMode?: boolean;
  adminHandlers?: ProyekFormAdminHandlers;
  // Tanam langsung di halaman (tanpa Sheet/modal/backdrop) — dipakai kanvas
  // Master Data supaya kelola form tampil begitu kegiatan dipilih, tidak
  // perlu buka dialog lagi.
  embedded?: boolean;
  // Naikkan angka ini (mis. counter) tiap kali form-proyek-tab.tsx berhasil
  // ubah struktur template (toggle/tambah/hapus/dst) — dipakai trigger
  // refetch `formTemplate` di sini, karena mode admin TIDAK simpan salinan
  // template terpisah (dialog ini satu-satunya sumber datanya).
  adminRefreshToken?: number;
  // Naik tiap isi tabel master diubah dari kanvas ("Kelola data …") —
  // daftar Balai/PKPN/dst di form ikut di-fetch ulang.
  masterRefreshToken?: number;
  // Kanvas admin perlu tahu tab yang sedang dibuka (panel "Atur tab").
  onActiveTabChange?: (tabKey: string) => void;
  initialKegiatanId?: string;
}

const TABS = [
  { value: "identitas", label: "Identitas Proyek" },
  { value: "dasar", label: "Dasar Pelaksanaan" },
  { value: "lokasi", label: "Lokasi Proyek" },
  { value: "kriteria", label: "Kriteria Teknis" },
  { value: "pemaketan", label: "Pemaketan" },
  { value: "tagging", label: "Tagging" },
  { value: "valuasi", label: "Valuasi Proyek" },
  { value: "kinerja", label: "Kinerja Proyek" },
  { value: "dokumen", label: "Dokumen & Catatan" },
  { value: "evaluasi", label: "Evaluasi Proyek" },
] as const;

// Field name (prefix sebelum titik untuk array, mis. "paket") -> tab yang
// menampungnya — dipakai buat lompat ke tab yang error saat validasi gagal.
const FIELD_TO_TAB: Record<string, (typeof TABS)[number]["value"]> = {
  balaiId: "identitas",
  periodeId: "identitas",
  projectName: "identitas",
  wilayahSungaiId: "identitas",
  provinceId: "lokasi",
  cityId: "lokasi",
  latitude: "lokasi",
  longitude: "lokasi",
  sumberUsulanProyek: "dasar",
  sumberUsulanLainnya: "dasar",
  justifikasiProyek: "dasar",
  tahunStudiLayak: "kriteria",
  statusStudiLayak: "kriteria",
  tahunDed: "kriteria",
  statusDed: "kriteria",
  tahunLarap: "kriteria",
  statusLarap: "kriteria",
  tahunDokumenLingkungan: "kriteria",
  statusDokumenLingkungan: "kriteria",
  kebutuhanTanah: "kriteria",
  kewenangan: "kriteria",
  paket: "pemaketan",
  saldoAnggaran: "pemaketan",
  saldoVolumeRo: "pemaketan",
  saldoVolumeIro: "pemaketan",
  satkerBolehUbahPaket: "pemaketan",
  kegiatanPrioritasId: "tagging",
  pkpnId: "tagging",
  indikatorSasaranProgramId: "tagging",
  indikatorSasaranKegiatanId: "tagging",
  tematikRenjaId: "tagging",
  fkb: "tagging",
  fkw: "tagging",
  mpa: "tagging",
  taggingDinamis: "tagging",
  catatanPembina: "dokumen",
  catatanSspsda: "dokumen",
};

// Field yang dirender lewat renderer khusus di atas (BUKAN FieldControl
// generik) — renderer-nya TIDAK PERNAH baca item.options/item.score sama
// sekali (lihat identitasRenderers dst di bawah), jadi kalau admin edit opsi
// dropdown/skor field ini di kanvas Master Data, perubahannya diam-diam
// tidak akan pernah muncul di form asli. Dipakai form-proyek-tab.tsx buat
// menyembunyikan bagian edit yang percuma itu. (Pengecualian: "kategoriProyek"
// TIDAK masuk sini walau juga renderer khusus — opsinya beneran dipakai,
// lihat tab Valuasi.)
export const BAKU_ITEM_KEYS = new Set<string>([
  ...Object.keys(FIELD_TO_TAB),
  "dokumenPendukung",
  ...PAKET_BAKU_KEYS,
  ...PEMAKETAN_PROYEK_KEYS,
]);

// Subset BAKU_ITEM_KEYS yang kolomnya NOT NULL di tabel Proyek (lihat
// schema.prisma) — wajib-nya dikunci di zod `schema`, TIDAK BISA dibikin
// opsional dari kanvas admin walau field lain di BAKU_ITEM_KEYS bisa.
export const ALWAYS_REQUIRED_BAKU_KEYS = new Set<string>([
  "balaiId",
  "periodeId",
  "projectName",
  ...PAKET_ALWAYS_REQUIRED_KEYS,
]);

function SectionHeader({
  icon: Icon,
  title,
  description,
  aside,
}: {
  icon: any;
  title: string;
  description?: string;
  // Isi di kanan, sebaris dengan judul (mis. "Total skor").
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 pb-1">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {aside}
    </div>
  );
}

export function ProyekFormDialog({
  open,
  onClose,
  onSuccess,
  editData,
  previewMode = false,
  adminMode = false,
  adminHandlers,
  adminRefreshToken,
  masterRefreshToken,
  onActiveTabChange,
  embedded = false,
  initialKegiatanId,
}: Props) {
  const [activeTab, setActiveTab] = useState<string>(TABS[0].value);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(
    new Set([TABS[0].value]),
  );
  const [loadingMaster, setLoadingMaster] = useState(false);
  const isEdit = !!editData;
  // Tingkat akun (lihat types User): Balai/Satker -> balai & kegiatan
  // otomatis terkunci; Satker -> satker paket terkunci.
  const user = useAuthStore((st) => st.user);
  const akunBalaiId = user?.balaiId ?? null;
  const akunSatkerId = akunBalaiId ? (user?.satkerId ?? null) : null;
  const akunKegiatanId = akunBalaiId ? (user?.balaiKegiatanId ?? null) : null;

  const [balaiList, setBalaiList] = useState<Balai[]>([]);
  const [balaiSearch, setBalaiSearch] = useState("");
  const [periodeList, setPeriodeList] = useState<Periode[]>([]);
  const [roList, setROList] = useState<RO[]>([]);
  const [roSearch, setRoSearch] = useState("");
  const [komponenList, setKomponenList] = useState<Komponen[]>([]);
  const [wilayahSungaiList, setWilayahSungaiList] = useState<
    { id: string; name: string }[]
  >([]);
  const [wsSearch, setWsSearch] = useState("");
  const [kegiatanList, setKegiatanList] = useState<KegiatanOpt[]>([]);
  const [selectedKegiatanId, setSelectedKegiatanId] = useState("");

  const [formTemplate, setFormTemplate] = useState<FormTemplateTree | null>(
    null,
  );
  const [formValuesMap, setFormValuesMap] = useState<
    Record<string, FieldControlValue>
  >({});

  const [pnList, setPnList] = useState<PrioritasNasional[]>([]);
  const [selectedPnId, setSelectedPnId] = useState("");
  const [selectedPpId, setSelectedPpId] = useState("");
  const [pkpnList, setPkpnList] = useState<PkpnOpt[]>([]);
  const [tematikList, setTematikList] = useState<TematikOpt[]>([]);
  const [sumberUsulanList, setSumberUsulanList] = useState<
    { id: string; name: string }[]
  >([]);
  const [taggingDinamisMaster, setTaggingDinamisMaster] = useState<
    { id: string; name: string }[]
  >([]);
  const [sasaranProgramList, setSasaranProgramList] = useState<
    SasaranProgramOpt[]
  >([]);
  const [sasaranKegiatanList, setSasaranKegiatanList] = useState<
    SasaranKegiatanOpt[]
  >([]);
  const [selectedSpId, setSelectedSpId] = useState("");
  const [selectedSkId, setSelectedSkId] = useState("");
  const [ispSearch, setIspSearch] = useState("");
  const [iskSearch, setIskSearch] = useState("");

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingDokumen, setUploadingDokumen] = useState(false);
  const [dokumenList, setDokumenList] = useState<
    { id: string; fileName: string; filePath: string }[]
  >([]);

  // Field UPLOAD di form dinamis (per FormItem) — pola sama seperti
  // pendingFiles/dokumenList di atas, tapi per-item (key = FormItem.key):
  // belum ada proyekId (create) -> ditahan di pendingItemFiles, diupload
  // setelah proyek dibuat; sudah ada proyekId (edit) -> upload langsung.
  const [pendingItemFiles, setPendingItemFiles] = useState<
    Record<string, File>
  >({});
  const [uploadingItemKeys, setUploadingItemKeys] = useState<Set<string>>(
    new Set(),
  );
  const [itemDokumen, setItemDokumen] = useState<
    Record<string, { id: string; fileName: string }>
  >({});

  const [preview, setPreview] = useState<{
    skorEvaluasi: number | null;
    // Nilai per tab ber-bobot (bobot % didapat / bobot tab).
    rincian?: { key?: string; label?: string; dapat: number; bobot: number }[];
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      kewenangan: "PUSAT",
      kebutuhanTanah: false,
      tipeKoordinat: "TITIK",
      coordinates: [],
      statusStudiLayak: "RENCANA",
      statusDed: "RENCANA",
      statusLarap: "RENCANA",
      statusDokumenLingkungan: "RENCANA",
      fkb: false,
      fkw: false,
      mpa: false,
      taggingDinamis: [],
      paket: [],
      satkerBolehUbahPaket: true,
    },
  });
  // Paket proyek yang sudah ada (edit) — disimpan langsung ke /paket.
  const [paketServer, setPaketServer] = useState<PaketIsian[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoadingMaster(true);
    Promise.all([
      api.get("/master/balai"),
      api.get("/master/periodes"),
      api.get("/master/ro"),
      api.get("/master/komponen"),
      api.get("/master/wilayah-sungai"),
      api.get("/master/kegiatan"),
      api.get("/master/prioritas-nasional"),
      api.get("/master/pkpn"),
      api.get("/master/tematik-renja"),
      api.get("/master/sasaran-program"),
      api.get("/master/sasaran-kegiatan"),
      api.get("/master/sumber-usulan-proyek"),
      api.get("/master/tagging-dinamis"),
    ])
      .then(
        ([b, p, r, k, ws, keg, pn, pkpn, tematik, sp, sk, sumber, tagging]) => {
          setBalaiList(b.data);
          setPeriodeList(p.data);
          setROList(r.data);
          setKomponenList(k.data);
          setWilayahSungaiList(ws.data);
          setKegiatanList(keg.data);
          setPnList(pn.data);
          setPkpnList(pkpn.data);
          setTematikList(tematik.data);
          setSasaranProgramList(sp.data);
          setSasaranKegiatanList(sk.data);
          setSumberUsulanList(sumber.data);
          setTaggingDinamisMaster(tagging.data);
        },
      )
      .finally(() => setLoadingMaster(false));
  }, [open, masterRefreshToken]);

  useEffect(() => {
    if (!open) return;
    setActiveTab(TABS[0].value);
    setVisitedTabs(new Set([TABS[0].value]));
    setPendingFiles([]);
    if (editData) {
      reset({
        balaiId: editData.balai.id,
        periodeId: editData.periode.id,
        projectName: editData.projectName,
        wilayahSungaiId: editData.wilayahSungaiId || "",
        tipeKoordinat: editData.tipeKoordinat ?? "TITIK",
        coordinates: editData.coordinates ?? [],
        latitude: editData.latitude ?? undefined,
        longitude: editData.longitude ?? undefined,
        provinceId: editData.provinceId ?? undefined,
        provinceName: editData.provinceName ?? undefined,
        cityId: editData.cityId ?? undefined,
        cityName: editData.cityName ?? undefined,
        districtId: editData.districtId ?? undefined,
        districtName: editData.districtName ?? undefined,
        villageId: editData.villageId ?? undefined,
        villageName: editData.villageName ?? undefined,
        sumberUsulanProyek: editData.sumberUsulanProyek,
        sumberUsulanLainnya: editData.sumberUsulanLainnya || "",
        justifikasiProyek: editData.justifikasiProyek || "",
        tahunStudiLayak: editData.tahunStudiLayak,
        statusStudiLayak: editData.statusStudiLayak || "RENCANA",
        tahunDed: editData.tahunDed,
        statusDed: editData.statusDed || "RENCANA",
        tahunLarap: editData.tahunLarap,
        statusLarap: editData.statusLarap || "RENCANA",
        tahunDokumenLingkungan: editData.tahunDokumenLingkungan,
        statusDokumenLingkungan:
          editData.statusDokumenLingkungan || "RENCANA",
        kebutuhanTanah: editData.kebutuhanTanah,
        kewenangan: editData.kewenangan,
        paket: [],
        saldoAnggaran: angkaAtauNull(editData.saldoAnggaran),
        saldoVolumeRo: angkaAtauNull(editData.saldoVolumeRo),
        saldoVolumeIro: angkaAtauNull(editData.saldoVolumeIro),
        satkerBolehUbahPaket: editData.satkerBolehUbahPaket ?? true,
        kegiatanPrioritasId: editData.kegiatanPrioritasId || "",
        pkpnId: editData.pkpnId || "",
        indikatorSasaranProgramId: editData.indikatorSasaranProgramId || "",
        indikatorSasaranKegiatanId: editData.indikatorSasaranKegiatanId || "",
        tematikRenjaId: editData.tematikRenjaId || "",
        fkb: editData.fkb,
        fkw: editData.fkw,
        mpa: editData.mpa,
        taggingDinamis: editData.taggingDinamis || [],
        catatanPembina: editData.catatanPembina || "",
        catatanSspsda: editData.catatanSspsda || "",
      });
      setSelectedPnId(
        editData.kegiatanPrioritas?.programPrioritas.prioritasNasional.id ?? "",
      );
      setSelectedPpId(editData.kegiatanPrioritas?.programPrioritas.id ?? "");
      setPaketServer((editData.paket ?? []).map(paketDariServer));
      setSelectedKegiatanId(
        editData.paket?.[0]?.ro?.kro?.kegiatan?.id ?? editData.balai.kegiatanId ?? "",
      );
      setSelectedSpId(
        editData.indikatorSasaranProgram?.sasaranProgram.id ?? "",
      );
      setSelectedSkId(
        editData.indikatorSasaranKegiatan?.sasaranKegiatan.id ?? "",
      );
      const semuaDokumen = editData.dokumenPendukung ?? [];
      setDokumenList(semuaDokumen.filter((d) => !d.formItemId));
      setItemDokumen(
        Object.fromEntries(
          semuaDokumen
            .filter((d) => d.formItemId)
            .map((d) => [d.formItemId as string, d]),
        ),
      );
    } else {
      setSelectedPnId("");
      setSelectedPpId("");
      setSelectedKegiatanId(akunKegiatanId ?? "");
      setPaketServer([]);
      setSelectedSpId("");
      setSelectedSkId("");
      setDokumenList([]);
      setItemDokumen({});
      setPendingItemFiles({});
      reset({
        kewenangan: "PUSAT",
        kebutuhanTanah: false,
        tipeKoordinat: "TITIK",
        coordinates: [],
        statusStudiLayak: "RENCANA",
        statusDed: "RENCANA",
        statusLarap: "RENCANA",
        statusDokumenLingkungan: "RENCANA",
        fkb: false,
        fkw: false,
        mpa: false,
        taggingDinamis: [],
        paket: [],
        satkerBolehUbahPaket: true,
        ...(akunBalaiId ? { balaiId: akunBalaiId } : {}),
      });
    }
  }, [editData, open]);

  useEffect(() => {
    if ((previewMode || adminMode) && open) {
      setSelectedKegiatanId(initialKegiatanId ?? "");
    }
  }, [previewMode, adminMode, open, initialKegiatanId]);

  // Template Form Proyek aktif kegiatan terpilih — dipakai render tab
  // Valuasi (dropdown Kategori Proyek) & Kinerja (checkbox per kategori),
  // dan (mode admin) seluruh section/item generik tiap tab. Mode admin
  // fetch tanpa activeOnly supaya section/item nonaktif tetap kelihatan
  // (admin butuh toggle balik), mode lain cuma yang aktif (persis form asli).
  useEffect(() => {
    if (!open || !selectedKegiatanId) {
      setFormTemplate(null);
      return;
    }
    api
      .get(
        `/master/form-template/${selectedKegiatanId}${adminMode ? "" : "?activeOnly=true"}`,
      )
      .then((res) => setFormTemplate(res.data))
      .catch(() => setFormTemplate(null));
  }, [open, selectedKegiatanId, adminMode, adminRefreshToken]);

  // Isi ulang formValuesMap dari data proyek yang diedit (ProyekFormValue).
  useEffect(() => {
    if (!open) return;
    if (!editData?.formValues?.length) {
      setFormValuesMap({});
      return;
    }
    const map: typeof formValuesMap = fromFormValueRows(editData.formValues);
    setFormValuesMap(map);
  }, [editData, open]);

  const setFormValue = (
    key: string,
    patch: FieldControlValue,
  ) =>
    setFormValuesMap((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));

  const kategoriProyekValue = formValuesMap["kategoriProyek"]?.value as
    | string
    | undefined;

  // Nilai isian 1 field (bawaan dari react-hook-form, custom dari
  // formValuesMap) — dipakai cek "Tampil jika".
  const itemValue = (key: string): unknown =>
    BAKU_ITEM_KEYS.has(key)
      ? watch(key as keyof FormData)
      : formValuesMap[key]?.value;
  // Kanvas admin selalu menampilkan semua field (supaya bisa diatur).
  // Bagian bersyarat (panel "Atur bagian" → Tampil kalau): field di
  // dalamnya ikut tersembunyi & tidak dinilai/dikirim.
  const bagianDariField = new Map(
    (formTemplate?.tabs ?? []).flatMap((t) =>
      t.sections.flatMap((s) => s.items.map((i) => [i.id, s] as const)),
    ),
  );
  const isSectionVisible = (s?: {
    conditionItemId?: string | null;
    conditionValue?: string | null;
  }) =>
    adminMode ||
    !s?.conditionItemId ||
    kondisiTerpenuhi(s.conditionValue, itemValue(s.conditionItemId));
  const isItemVisible = (item: FormItemNode) =>
    adminMode ||
    ((!item.conditionItemId ||
      kondisiTerpenuhi(item.conditionValue, itemValue(item.conditionItemId))) &&
      isSectionVisible(bagianDariField.get(item.id)));

  const valuasiItems =
    formTemplate?.tabs
      .find((t) => t.key === "valuasi")
      ?.sections.flatMap((s) => s.items) ?? [];

  const kinerjaItems = (
    formTemplate?.tabs
      .find((t) => t.key === "kinerja")
      ?.sections.flatMap((s) => s.items) ?? []
  ).filter((i) => isItemVisible(i));

  // formTemplate di-fetch dengan activeOnly=true (lihat useEffect di atas) —
  // jadi tab/item yang MUNCUL di situ sudah pasti aktif, yang tidak muncul
  // berarti dinonaktifkan admin di kanvas Master Data. Belum ada template
  // (kegiatan belum dipilih/belum sempat fetch) -> anggap semua aktif,
  // jangan sampai form kosong sebelum sempat pilih kegiatan.
  const TAB_KEY_MAP: Record<(typeof TABS)[number]["value"], string> = {
    identitas: "identitas",
    dasar: "dasar",
    lokasi: "lokasi",
    kriteria: "kesiapan",
    pemaketan: "pemaketan",
    tagging: "tematik",
    valuasi: "valuasi",
    kinerja: "kinerja",
    dokumen: "dokumen",
    evaluasi: "evaluasi",
  };
  // Non-admin: template di-fetch dengan activeOnly=true, jadi tab yang
  // MUNCUL di situ sudah pasti aktif. Admin: fetch full tree, jadi cek
  // `isActive` eksplisit (tab tetap ada di tree walau nonaktif).
  const isTabActive = (value: (typeof TABS)[number]["value"]) => {
    if (!formTemplate) return true;
    const tab = formTemplate.tabs.find((t) => t.key === TAB_KEY_MAP[value]);
    if (!tab) return false;
    return adminMode ? tab.isActive !== false : true;
  };

  // Header tab (icon/judul/deskripsi) — icon & judul default dari config
  // statis (sama urutan/isi dengan kanvas Master Data), deskripsi ikut apa
  // yang diisi admin di sana (FormTab.description), fallback ke teks default
  // kalau admin belum pernah isi.
  const tabHeader = (value: (typeof TABS)[number]["value"]) => {
    const tabKey = TAB_KEY_MAP[value] as TabKey;
    const node = formTemplate?.tabs.find((t) => t.key === tabKey);
    return {
      icon: TAB_ICONS[tabKey],
      title: node?.label || TABS.find((t) => t.value === value)!.label,
      description: node?.description || TAB_DEFAULT_DESCRIPTIONS[tabKey],
    };
  };
  // Total skor isian 1 tab (tab ber-bobot yang semua skornya bisa dihitung
  // di layar — bukan rasio Valuasi yang dihitung server). null = tanpa label.
  const totalSkorTab = (value: (typeof TABS)[number]["value"]) => {
    const tabNode = formTemplate?.tabs.find((t) => t.key === TAB_KEY_MAP[value]);
    if (!tabNode || tabNode.bobot == null) return null;
    let dapat = 0;
    let maks = 0;
    for (const section of tabNode.sections)
      for (const item of section.items) {
        if (!isItemVisible(item)) continue;
        if (item.thresholdValue != null) return null;
        const sk = skorItem(section, item);
        dapat += sk.dapat;
        maks += sk.maks;
      }
    // Skor = bobot % langsung: batas tab = bobot tab (mis. 30).
    return maks > 0
      ? { dapat: Math.min(dapat, tabNode.bobot * 100), maks: tabNode.bobot * 100 }
      : null;
  };

  const renderTabHeader = (value: (typeof TABS)[number]["value"]) => {
    const tabKey = TAB_KEY_MAP[value] as TabKey;
    if (adminMode && adminHandlers)
      return adminHandlers.tabHeader(
        tabKey,
        formTemplate?.tabs.find((t) => t.key === tabKey),
      );
    const total = totalSkorTab(value);
    return (
      <SectionHeader
        {...tabHeader(value)}
        aside={
          total && (
            <span
              title="Jumlah skor dari isian di tab ini"
              className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
            >
              Total skor: {fmtSkor(total.dapat)} / {fmtSkor(total.maks)}
            </span>
          )
        }
      />
    );
  };

  // Section aktif (sudah urut `order`) milik 1 tab, langsung dari
  // formTemplate — dipakai renderTemplatedTab supaya urutan & pengelompokan
  // field 100% ikut apa yang diatur admin di kanvas Master Data (termasuk
  // utk field BAKU aplikasi, bukan cuma field custom).
  const templateSections = (value: (typeof TABS)[number]["value"]) =>
    formTemplate?.tabs.find((t) => t.key === TAB_KEY_MAP[value])?.sections ??
    [];

  // Render 1 tab dari section+item template: tiap item dicek dulu ke
  // `renderers` (field baku, JSX-nya sudah ada & spesifik per field) — kalau
  // key-nya tidak ada di situ, dianggap field custom & dirender generik
  // lewat FieldControl. Judul section cuma ditampilkan mulai section ke-2
  // (section pertama sudah terwakili oleh SectionHeader tab).
  // Baris master utk field custom ber-sumber master (field bawaan punya
  // daftar sendiri di renderer-nya).
  const sourceData = useSourceData(
    (formTemplate?.tabs ?? []).flatMap((t) =>
      t.sections.flatMap((s) =>
        s.items
          .filter((i) => !BAKU_ITEM_KEYS.has(i.key))
          .map((i) => i.optionSource),
      ),
    ),
    (adminRefreshToken ?? 0) + (masterRefreshToken ?? 0),
  );

  // ===== Skor di layar (badge per field & total tab) — aturan sama dengan
  // backend, lihat lib/form-score.ts. =====
  const templateItemByKey = new Map(
    (formTemplate?.tabs ?? [])
      .flatMap((t) => t.sections.flatMap((s) => s.items))
      .map((i) => [i.key, i] as const),
  );
  // Nilai mentah utk skor: upload = file benar-benar tersimpan/tertahan.
  const nilaiSkor = (key: string): unknown => {
    const it = templateItemByKey.get(key);
    if (key === "dokumenPendukung")
      return isEdit ? dokumenList.length > 0 : pendingFiles.length > 0;
    if (it?.fieldType === "UPLOAD" && !BAKU_ITEM_KEYS.has(key))
      return !!(pendingItemFiles[it.id] || itemDokumen[it.id]);
    return itemValue(key);
  };
  const kolomTambahanDari = (
    section: FormTabNode["sections"][number],
    item: FormItemNode,
  ) => section.items.filter((c) => c.conditionItemId === item.key);
  const skorItem = (
    section: FormTabNode["sections"][number],
    item: FormItemNode,
  ) => skorField(item, nilaiSkor, kolomTambahanDari(section, item));

  // Field yang selalu lebar penuh walau renderer-nya sendiri (lokasi).
  const SELALU_PENUH = new Set(["provinceId", "latitude"]);

  const renderTemplatedTab = (
    value: (typeof TABS)[number]["value"],
    renderers: Record<string, (item: FormItemNode) => React.ReactNode>,
    gridClass: string,
    // Saring bagian (mis. Pemaketan: cuma bagian sekali-per-proyek).
    pakaiBagian: (s: FormTabNode["sections"][number]) => boolean = () => true,
  ) => {
    const sections = templateSections(value).filter(pakaiBagian);
    const renderItem = (item: FormItemNode): React.ReactNode =>
      renderers[item.key] ? (
        renderers[item.key](item)
      ) : (
        <div key={item.id} className={cn(isItemWide(item) && "col-span-full")}>
          <FieldControl
            mode="fill"
            item={item}
            value={formValuesMap[item.key]}
            onChange={(patch) => setFormValue(item.key, patch)}
            sourceRows={rowsForItem(item, sourceData, itemValue, selectedKegiatanId)}
            // Kanvas admin: tanpa data paket -> kartu rasio menampilkan rumus.
            ringkasPaket={adminMode ? undefined : ringkasForm}
            uploadedFileName={
              pendingItemFiles[item.id]?.name ?? itemDokumen[item.id]?.fileName
            }
            uploading={uploadingItemKeys.has(item.id)}
            onUpload={(files) => uploadItemFile(item, files)}
            onRemoveUpload={() => hapusItemFile(item)}
          />
        </div>
      );

    if (adminMode && adminHandlers) {
      const tabKey = TAB_KEY_MAP[value] as TabKey;
      const tabId = formTemplate?.tabs.find((t) => t.key === tabKey)?.id ?? "";
      return adminHandlers.sectionsBody(tabKey, tabId, sections, renderItem, gridClass);
    }

    // Field + kolom tambahannya (menjorok di bawah induk, section yang sama).
    const renderPohon = (
      section: FormTabNode["sections"][number],
      item: FormItemNode,
      depth: number,
    ): React.ReactNode[] => {
      if (!isItemVisible(item)) return [];
      const sk = item.thresholdValue == null ? skorItem(section, item) : null;
      const penuh = depth > 0 || isItemWide(item) || SELALU_PENUH.has(item.key);
      return [
        <div
          key={item.id}
          className={cn(
            "relative grid",
            penuh && "col-span-full",
            depth > 0 && "border-l-2 border-primary/30 pl-4",
          )}
          style={depth > 0 ? { marginLeft: (depth - 1) * 16 } : undefined}
        >
          {/* Badge skor per field cuma utk admin ("Coba isi form" = previewMode);
              user biasa hanya melihat Total skor tab. */}
          {previewMode && sk && sk.maks > 0 && (
            <span
              className={cn(
                "absolute right-0 top-0 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                sk.dapat > 0
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {sk.dapat > 0 ? `+${fmtSkor(sk.dapat)}` : `0 / ${fmtSkor(sk.maks)}`} skor
            </span>
          )}
          {renderItem(item)}
        </div>,
        ...kolomTambahanDari(section, item).flatMap((c) =>
          renderPohon(section, c, depth + 1),
        ),
      ];
    };

    const isi = sections.map((section) => {
      const keys = new Set(section.items.map((i) => i.key));
      const akar = section.items.filter(
        (i) => !i.conditionItemId || !keys.has(i.conditionItemId),
      );
      return {
        section,
        nodes: akar.flatMap((i) => renderPohon(section, i, 0)),
      };
    }).filter((x) => x.nodes.length > 0);

    return (
      <div className="space-y-5">
        {isi.map(({ section, nodes }) => (
          <div key={section.id} className="space-y-3">
            {/* Judul bagian cuma perlu kalau tab punya >1 bagian (sama
                dengan kanvas admin) — kalau 1, sering kembar nama field. */}
            {isi.length > 1 && (
              <p className="text-xs font-semibold text-muted-foreground pl-12">
                {section.label}
              </p>
            )}
            <div className={cn(gridClass, "pl-12")}>{nodes}</div>
          </div>
        ))}
      </div>
    );
  };


  // ===== Renderer field baku per tab — JSX PERSIS sama seperti sebelumnya,
  // cuma dipindah jadi fungsi keyed-by-item.key & label dari item.label
  // (bukan string hardcode lagi) supaya ikut apa yang diedit admin. =====

  const identitasRenderers: Record<string, (item: FormItemNode) => React.ReactNode> = {
    balaiId: (item) => (
      <div key={item.id} className="space-y-2">
        <Label>
          {item.label} <span className="text-destructive">*</span>
        </Label>
        <Select
          value={watch("balaiId")?.toString()}
          onValueChange={(v) => setValue("balaiId", Number(v))}
          onOpenChange={(o) => o && setBalaiSearch("")}
          disabled={!!akunBalaiId && !adminMode}
        >
          <SelectTrigger className="w-full h-10">
            <SelectValue placeholder="Pilih balai pelaksana" />
          </SelectTrigger>
          <SelectContent>
            {balaiList.length > 20 && (
              <SelectSearchBox
                value={balaiSearch}
                onChange={setBalaiSearch}
                placeholder="Cari balai..."
              />
            )}
            {balaiList
              .filter(
                (b) =>
                  !balaiSearch ||
                  `${b.shortName ?? ""} ${b.name}`
                    .toLowerCase()
                    .includes(balaiSearch.toLowerCase()),
              )
              .map((b) => (
                <SelectItem key={b.id} value={b.id.toString()}>
                  {b.shortName && (
                    <span className="font-medium">{b.shortName}</span>
                  )}
                  <span
                    className={
                      b.shortName
                        ? "text-muted-foreground ml-2"
                        : "font-medium"
                    }
                  >
                    {b.shortName ? `— ${b.name}` : b.name}
                  </span>
                  {!b.isActive && (
                    <span className="text-destructive ml-2 text-xs">
                      (nonaktif)
                    </span>
                  )}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {errors.balaiId && (
          <p className="text-destructive text-xs">{errors.balaiId.message}</p>
        )}
      </div>
    ),
    periodeId: (item) => (
      <div key={item.id} className="space-y-2">
        <Label>
          {item.label} <span className="text-destructive">*</span>
        </Label>
        <Select
          value={watch("periodeId")?.toString()}
          onValueChange={(v) => setValue("periodeId", Number(v))}
        >
          <SelectTrigger className="w-full h-10">
            <SelectValue placeholder="Pilih periode anggaran" />
          </SelectTrigger>
          <SelectContent>
            {periodeList.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>
                <span className="font-medium">{p.label}</span>
                {p.isActive && (
                  <Badge variant="default" className="ml-2 text-xs py-0">
                    Aktif
                  </Badge>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.periodeId && (
          <p className="text-destructive text-xs">
            {errors.periodeId.message}
          </p>
        )}
      </div>
    ),
    projectName: (item) => (
      <div key={item.id} className={cn("space-y-2", isItemWide(item) && "col-span-full")}>
        <Label>
          {item.label} <span className="text-destructive">*</span>
        </Label>
        <Input
          className="h-10"
          placeholder="Contoh: Pembangunan Sumur Air Tanah di Kota Palangkaraya"
          {...register("projectName")}
        />
        {errors.projectName && (
          <p className="text-destructive text-xs">
            {errors.projectName.message}
          </p>
        )}
      </div>
    ),
    wilayahSungaiId: (item) => (
      <div key={item.id} className="space-y-2">
        <Label>
          {item.label}
          {item.required && <span className="text-destructive"> *</span>}
        </Label>
        <Select
          value={watch("wilayahSungaiId") || NONE}
          onValueChange={(v) =>
            setValue("wilayahSungaiId", v === NONE ? "" : v)
          }
          onOpenChange={(o) => o && setWsSearch("")}
        >
          <SelectTrigger className="w-full h-10">
            <SelectValue placeholder="Pilih wilayah sungai" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— Tidak ada —</SelectItem>
            {wilayahSungaiList.length > 20 && (
              <SelectSearchBox
                value={wsSearch}
                onChange={setWsSearch}
                placeholder="Cari wilayah sungai..."
              />
            )}
            {wilayahSungaiList
              .filter((w) =>
                !wsSearch
                  ? true
                  : w.name.toLowerCase().includes(wsSearch.toLowerCase()),
              )
              .map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    ),
  };

  // Wilayah administratif (provinsi s/d desa) & peta (titik/garis/poligon)
  // — komponen yang SAMA dengan dialog lokasi alokasi.
  const WILAYAH_KEYS = [
    "provinceId",
    "provinceName",
    "cityId",
    "cityName",
    "districtId",
    "districtName",
    "villageId",
    "villageName",
  ] as const;
  const setWilayah = (w: Partial<Record<(typeof WILAYAH_KEYS)[number], string>>) => {
    for (const k of WILAYAH_KEYS) setValue(k, w[k], { shouldDirty: true });
  };

  const lokasiRenderers: Record<string, (item: FormItemNode) => React.ReactNode> = {
    provinceId: (item) => (
      <div key={item.id} className="space-y-2 col-span-full">
        <Label>
          {item.label}
          {item.required && <span className="text-destructive"> *</span>}
        </Label>
        <CascadingWilayah
          value={Object.fromEntries(WILAYAH_KEYS.map((k) => [k, watch(k)]))}
          onChange={setWilayah}
          labels={{
            province: subLabel(item, "province"),
            city: subLabel(item, "city"),
            district: subLabel(item, "district"),
            village: subLabel(item, "village"),
          }}
        />
      </div>
    ),
    // Sudah tercakup "Wilayah Administratif" — dihapus dari template oleh
    // migrasi 20261005000000, ini cuma jaga-jaga template lama.
    cityId: () => null,
    latitude: (item) => (
      <div key={item.id} className="space-y-2 col-span-full">
        <Label>
          {item.label}
          {item.required && <span className="text-destructive"> *</span>}
        </Label>
        <LokasiPeta
          value={{
            tipeKoordinat: watch("tipeKoordinat"),
            latitude: watch("latitude"),
            longitude: watch("longitude"),
            coordinates: watch("coordinates") ?? [],
          }}
          onChange={(p) => {
            for (const [k, v] of Object.entries(p))
              setValue(k as "latitude", v as never, { shouldDirty: true });
          }}
          onWilayahDetected={setWilayah}
          readOnly={previewMode}
        />
      </div>
    ),
  };

  const dasarRenderers: Record<string, (item: FormItemNode) => React.ReactNode> = {
    sumberUsulanProyek: (item) => (
      <div key={item.id} className={cn("space-y-2", isItemWide(item) && "col-span-full")}>
        <Label>
          {item.label}
          {item.required && <span className="text-destructive"> *</span>}
        </Label>
        <Select
          value={watch("sumberUsulanProyek") || NONE}
          onValueChange={(v) =>
            setValue("sumberUsulanProyek", v === NONE ? undefined : v, {
              shouldDirty: true,
            })
          }
        >
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder="Pilih sumber usulan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— Tidak ada —</SelectItem>
            {sumberUsulanList.map((s) => (
              <SelectItem key={s.id} value={s.name}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ),
    // Kapan field ini muncul diatur lewat "Tampil jika" di kanvas (kondisi
    // template), bukan aturan di sini.
    sumberUsulanLainnya: (item) => (
      <div key={item.id} className={cn("space-y-2", isItemWide(item) && "col-span-full")}>
        <Label>
          {item.label}
          {item.required && <span className="text-destructive"> *</span>}
        </Label>
        <Input className="h-10" {...register("sumberUsulanLainnya")} />
      </div>
    ),
    justifikasiProyek: (item) => (
      <div key={item.id} className={cn("space-y-2", isItemWide(item) && "col-span-full")}>
        <Label>
          {item.label}
          {item.required && <span className="text-destructive"> *</span>}
        </Label>
        <Textarea
          placeholder="Jelaskan alasan/latar belakang pelaksanaan proyek ini"
          {...register("justifikasiProyek")}
        />
      </div>
    ),
  };

  const kriteriaStatusMeta: Record<
    string,
    { tahunField: keyof FormData }
  > = {
    statusStudiLayak: { tahunField: "tahunStudiLayak" },
    statusDed: { tahunField: "tahunDed" },
    statusDokumenLingkungan: { tahunField: "tahunDokumenLingkungan" },
    statusLarap: { tahunField: "tahunLarap" },
  };
  // Pilihan field enum bawaan (status kriteria, kewenangan, kebutuhan tanah):
  // label ikut opsi template (bisa diedit admin), value tetap. Opsi yang
  // belum ada di template pakai label default.
  const enumOptions = (item: FormItemNode, defaults: [string, string][]) =>
    defaults.map(([value, label]) => (
      <SelectItem key={value} value={value}>
        {item.options.find((o) => o.value === value)?.label || label}
      </SelectItem>
    ));

  const renderKriteriaStatus = (item: FormItemNode) => {
    const statusField = item.key as
      | "statusStudiLayak"
      | "statusDed"
      | "statusDokumenLingkungan"
      | "statusLarap";
    const tahunField = kriteriaStatusMeta[statusField].tahunField;
    const status = watch(statusField);
    return (
      <div key={item.id} className="space-y-2">
        <Label className="text-xs">{item.label}</Label>
        <Select value={status} onValueChange={(v) => setValue(statusField, v as any)}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {enumOptions(item, [
              ["RENCANA", "Rencana"],
              ["SUDAH_ADA", "Sudah Ada"],
              ["TIDAK_PERLU", "Tidak Perlu"],
            ])}
          </SelectContent>
        </Select>
        <Input
          type="number"
          placeholder={subLabel(item, "tahun")}
          className="h-9 text-xs"
          disabled={status === "TIDAK_PERLU"}
          {...register(tahunField, { setValueAs: toOptionalNumber })}
        />
      </div>
    );
  };
  const kriteriaRenderers: Record<string, (item: FormItemNode) => React.ReactNode> = {
    statusStudiLayak: renderKriteriaStatus,
    statusDed: renderKriteriaStatus,
    statusDokumenLingkungan: renderKriteriaStatus,
    statusLarap: renderKriteriaStatus,
    kebutuhanTanah: (item) => (
      <div key={item.id} className="space-y-2">
        <Label className="text-xs">{item.label}</Label>
        <Select
          value={String(!!watch("kebutuhanTanah"))}
          onValueChange={(v) => setValue("kebutuhanTanah", v === "true")}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {enumOptions(item, [
              ["false", "Tidak Ada"],
              ["true", "Ada"],
            ])}
          </SelectContent>
        </Select>
      </div>
    ),
    kewenangan: (item) => (
      <div key={item.id} className="space-y-2">
        <Label className="text-xs">{item.label}</Label>
        <Select value={watch("kewenangan")} onValueChange={(v) => setValue("kewenangan", v as any)}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {enumOptions(item, [
              ["PUSAT", "Pusat"],
              ["DAERAH", "Daerah"],
            ])}
          </SelectContent>
        </Select>
      </div>
    ),
  };

  const taggingRenderers: Record<string, (item: FormItemNode) => React.ReactNode> = {
    kegiatanPrioritasId: (item) => (
      <div key={item.id} className={cn("space-y-2", isItemWide(item) && "col-span-full")}>
        <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{subLabel(item, "pn")}</Label>
            <Select
              value={selectedPnId || NONE}
              onValueChange={(v) => {
                const id = v === NONE ? "" : v;
                setSelectedPnId(id);
                setSelectedPpId("");
                setValue("kegiatanPrioritasId", "");
              }}
            >
              <SelectTrigger className="h-10 w-full min-w-0 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1">
                <SelectValue placeholder="Pilih PN" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Tidak ada —</SelectItem>
                {pnList.map((pn) => (
                  <SelectItem key={pn.id} value={pn.id}>
                    <span className="font-mono text-[10px] mr-1 shrink-0">
                      {pn.code}
                    </span>
                    <span className="min-w-0 truncate">{pn.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{subLabel(item, "pp")}</Label>
            <Select
              value={selectedPpId || NONE}
              onValueChange={(v) => {
                const id = v === NONE ? "" : v;
                setSelectedPpId(id);
                setValue("kegiatanPrioritasId", "");
              }}
              disabled={!selectedPnId}
            >
              <SelectTrigger className="h-10 w-full min-w-0 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1">
                <SelectValue placeholder="Pilih PN dulu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Tidak ada —</SelectItem>
                {(
                  pnList.find((pn) => pn.id === selectedPnId)
                    ?.programPrioritas ?? []
                ).map((pp) => (
                  <SelectItem key={pp.id} value={pp.id}>
                    <span className="font-mono text-[10px] mr-1 shrink-0">
                      {pp.code}
                    </span>
                    <span className="min-w-0 truncate">{pp.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{subLabel(item, "kp")}</Label>
            <Select
              value={watch("kegiatanPrioritasId") || NONE}
              onValueChange={(v) =>
                setValue("kegiatanPrioritasId", v === NONE ? "" : v)
              }
              disabled={!selectedPpId}
            >
              <SelectTrigger className="h-10 w-full min-w-0 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1">
                <SelectValue placeholder="Pilih PP dulu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Tidak ada —</SelectItem>
                {(
                  pnList
                    .find((pn) => pn.id === selectedPnId)
                    ?.programPrioritas.find((pp) => pp.id === selectedPpId)
                    ?.kegiatanPrioritas ?? []
                ).map((kp) => (
                  <SelectItem key={kp.id} value={kp.id}>
                    <span className="font-mono text-[10px] mr-1 shrink-0">
                      {kp.code}
                    </span>
                    <span className="min-w-0 truncate">{kp.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    ),
    indikatorSasaranProgramId: (item) => (
      <React.Fragment key={item.id}>
        <div className="space-y-2">
          <Label>{subLabel(item, "sp")}</Label>
          <Select
            value={selectedSpId || NONE}
            onValueChange={(v) => {
              const id = v === NONE ? "" : v;
              setSelectedSpId(id);
              setValue("indikatorSasaranProgramId", "");
            }}
          >
            <SelectTrigger className="w-full h-9 text-xs min-w-0 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1">
              <SelectValue placeholder="Pilih (opsional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— Tidak ada —</SelectItem>
              {spOptionsFiltered.map((sp) => (
                <SelectItem key={sp.id} value={sp.id}>
                  <span className="min-w-0 truncate">{sp.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>
          {item.label}
          {item.required && <span className="text-destructive"> *</span>}
        </Label>
          <Select
            value={watch("indikatorSasaranProgramId") || NONE}
            onValueChange={(v) =>
              setValue("indikatorSasaranProgramId", v === NONE ? "" : v)
            }
            disabled={!selectedSpId}
            onOpenChange={(o) => o && setIspSearch("")}
          >
            <SelectTrigger className="w-full h-9 text-xs">
              <SelectValue
                placeholder={selectedSpId ? "Pilih (opsional)" : "Pilih SP dulu"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— Tidak ada —</SelectItem>
              {ispOptions.length > 20 && (
                <SelectSearchBox
                  value={ispSearch}
                  onChange={setIspSearch}
                  placeholder="Cari ISP..."
                />
              )}
              {ispOptions
                .filter(
                  (i) =>
                    !ispSearch ||
                    i.name.toLowerCase().includes(ispSearch.toLowerCase()),
                )
                .map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </React.Fragment>
    ),
    indikatorSasaranKegiatanId: (item) => (
      <React.Fragment key={item.id}>
        <div className="space-y-2">
          <Label>{subLabel(item, "sk")}</Label>
          <Select
            value={selectedSkId || NONE}
            onValueChange={(v) => {
              const id = v === NONE ? "" : v;
              setSelectedSkId(id);
              setValue("indikatorSasaranKegiatanId", "");
            }}
          >
            <SelectTrigger className="w-full h-9 text-xs min-w-0 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1">
              <SelectValue placeholder="Pilih (opsional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— Tidak ada —</SelectItem>
              {skOptionsFiltered.map((sk) => (
                <SelectItem key={sk.id} value={sk.id}>
                  <span className="min-w-0 truncate">{sk.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>
          {item.label}
          {item.required && <span className="text-destructive"> *</span>}
        </Label>
          <Select
            value={watch("indikatorSasaranKegiatanId") || NONE}
            onValueChange={(v) =>
              setValue("indikatorSasaranKegiatanId", v === NONE ? "" : v)
            }
            disabled={!selectedSkId}
            onOpenChange={(o) => o && setIskSearch("")}
          >
            <SelectTrigger className="w-full h-9 text-xs">
              <SelectValue
                placeholder={selectedSkId ? "Pilih (opsional)" : "Pilih SK dulu"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— Tidak ada —</SelectItem>
              {iskOptions.length > 20 && (
                <SelectSearchBox
                  value={iskSearch}
                  onChange={setIskSearch}
                  placeholder="Cari ISK..."
                />
              )}
              {iskOptions
                .filter(
                  (i) =>
                    !iskSearch ||
                    i.name.toLowerCase().includes(iskSearch.toLowerCase()),
                )
                .map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </React.Fragment>
    ),
    tematikRenjaId: (item) => (
      <div key={item.id} className="space-y-2">
        <Label>
          {item.label}
          {item.required && <span className="text-destructive"> *</span>}
        </Label>
        <Select
          value={watch("tematikRenjaId") || NONE}
          onValueChange={(v) => setValue("tematikRenjaId", v === NONE ? "" : v)}
        >
          <SelectTrigger className="w-full h-9 text-xs">
            <SelectValue placeholder="Pilih (opsional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— Tidak ada —</SelectItem>
            {tematikList.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ),
    pkpnId: (item) => (
      <div key={item.id} className="space-y-2">
        <Label>
          {item.label}
          {item.required && <span className="text-destructive"> *</span>}
        </Label>
        <Select
          value={watch("pkpnId") || NONE}
          onValueChange={(v) => setValue("pkpnId", v === NONE ? "" : v)}
        >
          <SelectTrigger className="w-full h-9 text-xs">
            <SelectValue placeholder="Pilih (opsional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— Tidak ada —</SelectItem>
            {pkpnList.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ),
    fkb: (item) => (
      <label
        key={item.id}
        className="flex items-center gap-2 text-xs font-medium self-end pb-2 cursor-pointer"
      >
        <input
          type="checkbox"
          className="h-3.5 w-3.5 rounded border-input"
          checked={watch("fkb")}
          onChange={(e) => setValue("fkb", e.target.checked)}
        />
        {item.label}
      </label>
    ),
    fkw: (item) => (
      <label
        key={item.id}
        className="flex items-center gap-2 text-xs font-medium self-end pb-2 cursor-pointer"
      >
        <input
          type="checkbox"
          className="h-3.5 w-3.5 rounded border-input"
          checked={watch("fkw")}
          onChange={(e) => setValue("fkw", e.target.checked)}
        />
        {item.label}
      </label>
    ),
    mpa: (item) => (
      <label
        key={item.id}
        className="flex items-center gap-2 text-xs font-medium self-end pb-2 cursor-pointer"
      >
        <input
          type="checkbox"
          className="h-3.5 w-3.5 rounded border-input"
          checked={watch("mpa")}
          onChange={(e) => setValue("mpa", e.target.checked)}
        />
        {item.label}
      </label>
    ),
    taggingDinamis: (item) => (
      <div key={item.id} className={cn("space-y-2", isItemWide(item) && "col-span-full")}>
        <Label>
          {item.label}
          {item.required && <span className="text-destructive"> *</span>}
        </Label>
        <Select
          value={NONE}
          onValueChange={(v) => {
            if (v !== NONE) tambahTaggingDinamis(v);
          }}
        >
          <SelectTrigger className="h-9 text-xs w-full">
            <SelectValue placeholder="Tambah tag..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE} disabled>
              Tambah tag...
            </SelectItem>
            {taggingDinamisMaster
              .filter((t) => !taggingDinamis.includes(t.name))
              .map((t) => (
                <SelectItem key={t.id} value={t.name}>
                  {t.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2">
          {taggingDinamis.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1">
              {t}
              <button
                type="button"
                onClick={() => hapusTaggingDinamis(t)}
                className="ml-1 hover:text-destructive"
              >
                <X size={11} />
              </button>
            </Badge>
          ))}
        </div>
      </div>
    ),
  };

  const dokumenRenderers: Record<string, (item: FormItemNode) => React.ReactNode> = {
    dokumenPendukung: (item) => (
      <div key={item.id} className="space-y-2">
        <Label>
          {item.label}
          {item.required && <span className="text-destructive"> *</span>}
        </Label>
        <input
          type="file"
          multiple
          className="block w-full text-xs text-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (!files.length) return;
            if (isEdit) {
              uploadDokumen(editData!.id, files);
            } else {
              setPendingFiles((prev) => [...prev, ...files]);
            }
            e.target.value = "";
          }}
        />
        {uploadingDokumen && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" /> Mengupload...
          </p>
        )}
        {!isEdit && pendingFiles.length > 0 && (
          <div className="space-y-1.5">
            {pendingFiles.map((f, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
              >
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setPendingFiles((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              File di atas akan diupload setelah proyek disimpan.
            </p>
          </div>
        )}
        {isEdit && dokumenList.length > 0 && (
          <div className="space-y-1.5">
            {dokumenList.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
              >
                <a
                  href={`${api.defaults.baseURL}/uploads/${d.filePath}`}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate hover:underline"
                >
                  {d.fileName}
                </a>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => hapusDokumen(d.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    catatanPembina: (item) => (
      <div key={item.id} className="space-y-2">
        <Label className="text-xs">
          {item.label}
          {item.required && <span className="text-destructive"> *</span>}
        </Label>
        <Textarea {...register("catatanPembina")} />
      </div>
    ),
    catatanSspsda: (item) => (
      <div key={item.id} className="space-y-2">
        <Label className="text-xs">
          {item.label}
          {item.required && <span className="text-destructive"> *</span>}
        </Label>
        <Textarea {...register("catatanSspsda")} />
      </div>
    ),
  };

  const hasEvaluasi =
    !selectedKegiatanId ||
    !!kegiatanList.find((k) => k.id === selectedKegiatanId)?.formTemplate;
  // Mode admin selalu lihat SEMUA tab (termasuk nonaktif, supaya bisa
  // ditoggle balik) — mode lain cuma tab yang aktif, persis form asli.
  const visibleTabs = adminMode
    ? TABS
    : hasEvaluasi
      ? TABS.filter((t) => isTabActive(t.value))
      : TABS.filter((t) => t.value === "identitas" || t.value === "pemaketan");

  useEffect(() => {
    if (!visibleTabs.some((t) => t.value === activeTab)) {
      setActiveTab("identitas");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasEvaluasi, formTemplate]);

  const allTabsVisited = visibleTabs.every((t) => visitedTabs.has(t.value));
  const jumlahTabDibuka = visibleTabs.filter((t) => visitedTabs.has(t.value)).length;
  // Buat proyek baru: kegiatan dulu, baru tab-tab form (isinya ikut kegiatan).
  const perluPilihKegiatan = !adminMode && !isEdit && !previewMode && !selectedKegiatanId;

  useEffect(() => {
    onActiveTabChange?.(TAB_KEY_MAP[activeTab as (typeof TABS)[number]["value"]]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ===== Tab Pemaketan — bagian "per paket" jadi kartu di PaketDialog;
  // bagian sekali-per-proyek (saldo, kategori, izin, daftar paket) dirender
  // di tab ini. Buat proyek: paket di form (`paket`); edit: langsung /paket.
  const paketTemplateSections = paketSections(formTemplate?.tabs);
  const daftarPaket: PaketIsian[] = isEdit ? paketServer : (watch("paket") ?? []);
  const ringkasDaftar = daftarPaket.map((pk) => ringkasIsianPaket(pk, roList, komponenList));
  const saldoForm = {
    anggaran: watch("saldoAnggaran"),
    volumeRo: watch("saldoVolumeRo"),
    volumeIro: watch("saldoVolumeIro"),
  };
  // Akun Satker cuma boleh ubah paket kalau diizinkan & paketnya sendiri.
  const bolehUbahPaket = !akunSatkerId || watch("satkerBolehUbahPaket") !== false;
  const bisaUbahPaketIni = (pk: PaketIsian) =>
    bolehUbahPaket && (!akunSatkerId || pk.satkerId === akunSatkerId);
  const [paketEdit, setPaketEdit] = useState<{ idx: number | null } | null>(null);
  const [satkerNama, setSatkerNama] = useState<Record<string, string>>({});
  const balaiForm = watch("balaiId");
  useEffect(() => {
    if (!open || !balaiForm) return;
    api
      .get(`/master/satker?balaiId=${balaiForm}`)
      .then((r) =>
        setSatkerNama(Object.fromEntries(r.data.map((x: { id: string; name: string }) => [x.id, x.name]))),
      )
      .catch(() => setSatkerNama({}));
  }, [open, balaiForm]);
  const periodeForm = periodeList.find((pr) => pr.id === watch("periodeId"));

  const simpanPaket = async (pk: PaketIsian) => {
    const idx = paketEdit?.idx ?? null;
    if (isEdit) {
      const body = paketKePayload(pk);
      const res = pk.id
        ? await api.patch(`/paket/${pk.id}`, body)
        : await api.post("/paket", { ...body, proyekId: editData!.id });
      const baru = paketDariServer(res.data);
      setPaketServer((cur) =>
        idx == null ? [...cur, baru] : cur.map((x, i) => (i === idx ? baru : x)),
      );
      toast.success(pk.id ? "Paket diperbarui" : "Paket ditambahkan");
    } else {
      const cur = watch("paket") ?? [];
      setValue(
        "paket",
        idx == null ? [...cur, pk] : cur.map((x, i) => (i === idx ? pk : x)),
        { shouldDirty: true },
      );
    }
    setPaketEdit(null);
  };
  const hapusPaket = async (idx: number) => {
    const pk = daftarPaket[idx];
    if (!window.confirm(`Hapus paket "${pk.name}"?`)) return;
    if (isEdit) {
      try {
        await api.delete(`/paket/${pk.id}`);
        setPaketServer((cur) => cur.filter((_, i) => i !== idx));
        toast.success("Paket dihapus");
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Gagal menghapus paket");
      }
    } else {
      setValue(
        "paket",
        (watch("paket") ?? []).filter((_, i) => i !== idx),
        { shouldDirty: true },
      );
    }
  };

  // Saldo: input angka + "Dipakai … · sisa …" (anggaran semua paket, volume
  // paket berkomponen utama).
  const saldoRenderer =
    (field: "saldoAnggaran" | "saldoVolumeRo" | "saldoVolumeIro", rp: boolean, huruf: "A" | "B" | "C") =>
    (item: FormItemNode) => {
      const dipakai = ringkasPaket(ringkasDaftar)[huruf];
      const batas = watch(field);
      const pct = batas ? Math.min(100, (dipakai / batas) * 100) : 0;
      const lebih = batas != null && dipakai > batas + 1e-9;
      return (
        <div key={item.id} className="space-y-1.5">
          <Label htmlFor={`saldo-${field}`}>
            {item.label}
            {item.required && <span className="text-destructive"> *</span>}
          </Label>
          <div className="relative">
            {rp && (
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                Rp
              </span>
            )}
            <AngkaInput
              id={`saldo-${field}`}
              desimal={!rp}
              className={cn("h-10", rp && "pl-9")}
              placeholder="0"
              disabled={previewMode}
              value={batas}
              onChange={(v) => setValue(field, v ?? null, { shouldDirty: true })}
            />
          </div>
          {batas != null && (
            <>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", lebih ? "bg-destructive" : "bg-primary")}
                  style={{ width: `${lebih ? 100 : pct}%` }}
                />
              </div>
              <p className={cn("text-[11px]", lebih ? "text-destructive" : "text-muted-foreground")}>
                Dipakai {teksAngka(dipakai, rp)} · {lebih ? "lebih" : "sisa"}{" "}
                {teksAngka(Math.abs(batas - dipakai), rp)}
              </p>
            </>
          )}
        </div>
      );
    };

  const pemaketanRenderers: Record<string, (item: FormItemNode) => React.ReactNode> = {
    saldoAnggaran: saldoRenderer("saldoAnggaran", true, "A"),
    saldoVolumeRo: saldoRenderer("saldoVolumeRo", false, "B"),
    saldoVolumeIro: saldoRenderer("saldoVolumeIro", false, "C"),
    satkerBolehUbahPaket: (item) => (
      <label key={item.id} className="flex items-center gap-3 self-end rounded-lg border px-3 py-2.5 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={watch("satkerBolehUbahPaket") !== false}
          disabled={!!akunSatkerId || previewMode}
          onChange={(e) => setValue("satkerBolehUbahPaket", e.target.checked, { shouldDirty: true })}
        />
        <span className="flex-1">{item.label}</span>
      </label>
    ),
    daftarPaket: (item) => {
      const total = daftarPaket.reduce((sum, pk) => sum + totalPaket(pk), 0);
      return (
        <div key={item.id} className="col-span-full space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {item.label}
                {item.required && <span className="text-destructive"> *</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {daftarPaket.length} paket · total {formatRupiah(total)}
              </p>
            </div>
            {bolehUbahPaket && !previewMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!selectedKegiatanId}
                onClick={() => setPaketEdit({ idx: null })}
              >
                <Plus size={14} className="mr-1.5" /> Tambah paket
              </Button>
            )}
          </div>
          {daftarPaket.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
              Belum ada paket.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Satker</th>
                    <th className="px-3 py-2 font-medium">Nama paket</th>
                    <th className="px-3 py-2 font-medium">Tahun</th>
                    <th className="px-3 py-2 text-right font-medium">Alokasi</th>
                    <th className="w-20 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {daftarPaket.map((pk, i) => (
                    <tr key={pk.id ?? i} className="border-t">
                      <td className="px-3 py-2">{(pk.satkerId && satkerNama[pk.satkerId]) || "—"}</td>
                      <td className="px-3 py-2 font-medium">{pk.name}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {pk.tahunMulai
                          ? pk.tahunMulai === pk.tahunSelesai
                            ? pk.tahunMulai
                            : `${pk.tahunMulai}–${pk.tahunSelesai}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(totalPaket(pk))}</td>
                      <td className="px-2 py-1 text-right whitespace-nowrap">
                        {bisaUbahPaketIni(pk) && !previewMode && (
                          <>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              aria-label={`Edit paket ${pk.name}`}
                              onClick={() => setPaketEdit({ idx: i })}
                            >
                              <Pencil size={13} />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              aria-label={`Hapus paket ${pk.name}`}
                              onClick={() => hapusPaket(i)}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    },
  };

  const spOptionsFiltered = (() => {
    const kegiatan = kegiatanList.find((k) => k.id === selectedKegiatanId);
    if (!kegiatan) return sasaranProgramList;
    return sasaranProgramList.filter(
      (sp) => sp.programId === kegiatan.program.id,
    );
  })();
  const skOptionsFiltered = selectedKegiatanId
    ? sasaranKegiatanList.filter((sk) => sk.kegiatanId === selectedKegiatanId)
    : sasaranKegiatanList;

  const ispOptions =
    spOptionsFiltered.find((sp) => sp.id === selectedSpId)?.indikator ?? [];
  const iskOptions =
    skOptionsFiltered.find((sk) => sk.id === selectedSkId)?.indikator ?? [];

  const taggingDinamis = watch("taggingDinamis") ?? [];
  const tambahTaggingDinamis = (v: string) => {
    if (!v || taggingDinamis.includes(v)) return;
    setValue("taggingDinamis", [...taggingDinamis, v], { shouldDirty: true });
  };
  const hapusTaggingDinamis = (v: string) => {
    setValue(
      "taggingDinamis",
      taggingDinamis.filter((t) => t !== v),
      { shouldDirty: true },
    );
  };

  const uploadDokumen = async (proyekId: string, files: File[]) => {
    if (!files.length) return;
    setUploadingDokumen(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const res = await api.post(`/proyek/${proyekId}/dokumen`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDokumenList((prev) => [...prev, ...res.data]);
      setPendingFiles([]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal upload dokumen");
    } finally {
      setUploadingDokumen(false);
    }
  };

  const hapusDokumen = async (docId: string) => {
    try {
      await api.delete(`/proyek/dokumen/${docId}`);
      setDokumenList((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal hapus dokumen");
    }
  };

  const postItemFile = async (proyekId: string, itemId: string, file: File) => {
    const formData = new FormData();
    formData.append("files", file);
    formData.append("formItemId", itemId);
    const res = await api.post(`/proyek/${proyekId}/dokumen`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data[0] as { id: string; fileName: string };
  };

  // Upload file utk field bertipe UPLOAD di form dinamis, per FormItem.
  // Proyek belum ada (create) -> file ditahan dulu (pendingItemFiles),
  // diupload sekaligus setelah "Buat Proyek" sukses (lihat onSubmit).
  // Proyek sudah ada (edit) -> upload langsung, ditag formItemId.
  const uploadItemFile = async (item: FormItemNode, files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!isEdit) {
      setPendingItemFiles((prev) => ({ ...prev, [item.id]: file }));
      return;
    }
    setUploadingItemKeys((prev) => new Set(prev).add(item.id));
    try {
      const doc = await postItemFile(editData!.id, item.id, file);
      setItemDokumen((prev) => ({ ...prev, [item.id]: doc }));
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal upload file");
    } finally {
      setUploadingItemKeys((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const hapusItemFile = async (item: FormItemNode) => {
    if (pendingItemFiles[item.id]) {
      setPendingItemFiles((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      return;
    }
    const doc = itemDokumen[item.id];
    if (!doc) return;
    try {
      await api.delete(`/proyek/dokumen/${doc.id}`);
      setItemDokumen((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal hapus file");
    }
  };

  // Skor evaluasi live: dihitung ulang tiap field yang mempengaruhi deteksi
  // berubah (lihat form-skor.ts di backend), bukan menunggu submit.
  // Debounce 500ms — cukup lama untuk tidak spam API tiap ketikan, cukup
  // pendek supaya tetap terasa "langsung".
  // formValuesMap -> payload backend (FormValueDto[]) — cuma kirim yang
  // benar-benar terisi (dropdown kepilih atau checkbox tercentang).
  // Field custom yang sedang tersembunyi ("Tampil jika" tidak terpenuhi)
  // tidak ikut dikirim — isian lamanya tidak tersimpan/dinilai.
  const buildFormValues = () => {
    const hidden = new Set(
      (formTemplate?.tabs ?? [])
        .flatMap((t) => t.sections.flatMap((s) => s.items))
        .filter((i) => !isItemVisible(i))
        .map((i) => i.key),
    );
    return toFormValueList(
      Object.fromEntries(
        Object.entries(formValuesMap).filter(([k]) => !hidden.has(k)),
      ),
    );
  };

  const watchedForPreview = watch();
  // A/B/C rasio Valuasi: anggaran semua paket, volume paket utama — sama
  // dgn backend ringkasPaket().
  const ringkasForm = ringkasPaket(ringkasDaftar);
  const roIdPreview = daftarPaket[0]?.roId;
  const previewKey = JSON.stringify({
    roIdPreview,
    formValuesMap,
    sumberUsulanProyek: watchedForPreview.sumberUsulanProyek,
    sumberUsulanLainnya: watchedForPreview.sumberUsulanLainnya,
    justifikasiProyek: watchedForPreview.justifikasiProyek,
    kegiatanPrioritasId: watchedForPreview.kegiatanPrioritasId,
    statusStudiLayak: watchedForPreview.statusStudiLayak,
    statusDed: watchedForPreview.statusDed,
    statusLarap: watchedForPreview.statusLarap,
    statusDokumenLingkungan: watchedForPreview.statusDokumenLingkungan,
    kebutuhanTanah: watchedForPreview.kebutuhanTanah,
    kewenangan: watchedForPreview.kewenangan,
    pkpnId: watchedForPreview.pkpnId,
    indikatorSasaranProgramId: watchedForPreview.indikatorSasaranProgramId,
    indikatorSasaranKegiatanId: watchedForPreview.indikatorSasaranKegiatanId,
    tematikRenjaId: watchedForPreview.tematikRenjaId,
    fkb: watchedForPreview.fkb,
    fkw: watchedForPreview.fkw,
    mpa: watchedForPreview.mpa,
    taggingDinamis: watchedForPreview.taggingDinamis,
    ringkasForm,
  });

  useEffect(() => {
    if (!open || !roIdPreview) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      setPreviewLoading(true);
      api
        .post("/proyek/preview-skor", {
          roId: roIdPreview,
          sumberUsulanProyek: watchedForPreview.sumberUsulanProyek,
          sumberUsulanLainnya: watchedForPreview.sumberUsulanLainnya || undefined,
          justifikasiProyek: watchedForPreview.justifikasiProyek || undefined,
          kegiatanPrioritasId: watchedForPreview.kegiatanPrioritasId,
          statusStudiLayak: watchedForPreview.statusStudiLayak,
          statusDed: watchedForPreview.statusDed,
          statusLarap: watchedForPreview.statusLarap,
          statusDokumenLingkungan: watchedForPreview.statusDokumenLingkungan,
          kebutuhanTanah: watchedForPreview.kebutuhanTanah,
          kewenangan: watchedForPreview.kewenangan,
          pkpnId: watchedForPreview.pkpnId,
          indikatorSasaranProgramId:
            watchedForPreview.indikatorSasaranProgramId,
          indikatorSasaranKegiatanId:
            watchedForPreview.indikatorSasaranKegiatanId,
          tematikRenjaId: watchedForPreview.tematikRenjaId,
          fkb: watchedForPreview.fkb,
          fkw: watchedForPreview.fkw,
          mpa: watchedForPreview.mpa,
          taggingDinamis: watchedForPreview.taggingDinamis,
          totalDana: ringkasForm.A,
          outputTarget: ringkasForm.B,
          outcomeTarget: ringkasForm.C,
          outputUnits: ringkasForm.satuanB,
          outcomeUnits: ringkasForm.satuanC,
          formValues: buildFormValues(),
          proyekId: editData?.id,
        })
        .then((res) => setPreview(res.data))
        .catch(() => setPreview(null))
        .finally(() => setPreviewLoading(false));
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, previewKey]);

  // Select opsional pakai sentinel NONE -> "" saat "tidak dipilih" (Radix
  // Select tidak boleh value=""), tapi field-field ini FK di backend — kirim
  // string kosong = Prisma coba cari baris ber-id "" dan gagal foreign key
  // constraint. Konversi ke undefined dulu sebelum dikirim.
  const bersihkanFkKosong = <T extends Record<string, any>>(obj: T): T => {
    const fkKeys = [
      "wilayahSungaiId",
      "kegiatanPrioritasId",
      "pkpnId",
      "indikatorSasaranProgramId",
      "indikatorSasaranKegiatanId",
      "tematikRenjaId",
    ] as const;
    const cleaned: Record<string, any> = { ...obj };
    for (const key of fkKeys) {
      if (cleaned[key] === "") cleaned[key] = undefined;
    }
    return cleaned as T;
  };

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit) {
        const { paket, ...rest } = data;
        await api.patch(`/proyek/${editData!.id}`, {
          ...bersihkanFkKosong(rest),
          formValues: buildFormValues(),
        });
        toast.success("Proyek berhasil diperbarui");
      } else {
        const { paket, ...rest } = data;
        const payload = {
          ...bersihkanFkKosong(rest),
          formValues: buildFormValues(),
          paket: paket.map(paketKePayload),
        };
        const res = await api.post("/proyek", payload);
        if (pendingFiles.length) {
          await uploadDokumen(res.data.id, pendingFiles);
        }
        const stagedItemFiles = Object.entries(pendingItemFiles);
        if (stagedItemFiles.length) {
          await Promise.all(
            stagedItemFiles.map(([itemId, file]) =>
              postItemFile(res.data.id, itemId, file),
            ),
          );
          setPendingItemFiles({});
        }
        toast.success("Proyek berhasil dibuat");
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };

  // Nilai kosong generik (string/number/boolean/array) — dipakai baik utk
  // item generik (lewat formValuesMap) maupun field baku non-wajib-baku
  // (lewat watch(), react-hook-form).
  const isEmptyValue = (v: unknown) =>
    v == null || v === "" || (Array.isArray(v) && v.length === 0);

  // Validasi gagal (mis. Nama Proyek kosong) tapi field itu ada di tab yang
  // sedang tidak aktif — tanpa ini tombol submit terkesan "tidak ngaruh"
  // karena error-nya tidak kelihatan sama sekali.
  // Validasi "wajib diisi" utk item generik DAN field baku yang boleh
  // dibuat opsional (item.required cuma data kosong tanpa ini — supaya
  // beneran ngefek, dicek manual di sini sebelum submit, sama seperti
  // onInvalid: loncat ke tab yang error + toast). `balaiId`/`periodeId`/
  // `projectName` DIKECUALIKAN — kolomnya NOT NULL di database (lihat
  // model Proyek), jadi wajib-nya dikunci lewat zod `schema` di atas, tidak
  // bisa dibikin opsional dari kanvas admin.
  const findMissingRequiredItem = () => {
    if (!formTemplate) return null;
    for (const tabNode of formTemplate.tabs) {
      if (tabNode.isActive === false) continue;
      const tabValue = TABS.find(
        (t) => TAB_KEY_MAP[t.value] === tabNode.key,
      )?.value;
      if (!tabValue) continue;
      for (const section of tabNode.sections) {
        // Bagian per paket dicek di dialog paket.
        if (section.isActive === false || section.perPaket) continue;
        for (const item of section.items) {
          if (item.key === "daftarPaket") {
            if (item.isActive !== false && item.required && !daftarPaket.length)
              return { tabValue, label: item.label };
            continue;
          }
          if (
            item.isActive === false ||
            !isItemVisible(item) ||
            !item.required ||
            ALWAYS_REQUIRED_BAKU_KEYS.has(item.key)
          )
            continue;
          const isBaku = BAKU_ITEM_KEYS.has(item.key);
          const isEmpty = isBaku
            ? item.key === "dokumenPendukung"
              ? isEdit
                ? dokumenList.length === 0
                : pendingFiles.length === 0
              : item.key === "latitude"
                ? watch("tipeKoordinat") === "TITIK"
                  ? watch("latitude") == null
                  : (watch("coordinates") ?? []).length < 2
                : isEmptyValue(watch(item.key as keyof FormData))
            : item.fieldType === "UPLOAD"
              ? !pendingItemFiles[item.id] && !itemDokumen[item.id]
              : item.fieldType === "CHECKBOX" && !item.optionSource
                ? !formValuesMap[item.key]?.value
                : isEmptyValue(formValuesMap[item.key]?.value);
          if (isEmpty) return { tabValue, label: item.label };
        }
      }
    }
    return null;
  };

  const onInvalid = (errs: FieldErrors<FormData>) => {
    const firstField = Object.keys(errs)[0];
    const tab = firstField ? FIELD_TO_TAB[firstField] : undefined;
    if (tab) setActiveTab(tab);
    const tabLabel = TABS.find((t) => t.value === tab)?.label;
    toast.error(
      tabLabel
        ? `Lengkapi field yang wajib diisi di tab "${tabLabel}"`
        : "Lengkapi field yang wajib diisi",
    );
  };

  // Body tab (spinner saat loading, atau Tabs lengkap) dihitung SEKALI di
  // sini, dipakai baik dibungkus Sheet (modal, mode fill/preview) maupun
  // ditanam langsung inline di halaman (mode admin embedded) — supaya
  // markup-nya selalu identik di kedua tempat.
  const tabsBody = loadingMaster ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-muted-foreground" size={28} />
            <span className="ml-3 text-sm text-muted-foreground">
              Memuat data referensi...
            </span>
          </div>
        ) : perluPilihKegiatan ? (
          <div className="px-6 py-10">
            <div className="mx-auto max-w-lg space-y-4 rounded-[14px] border border-[#d0d7de] bg-white p-6">
              <div className="space-y-1">
                <p className="text-base font-bold">Pilih kegiatan untuk memulai</p>
                <p className="text-sm text-muted-foreground">
                  Isian form menyesuaikan kegiatan yang dipilih.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pilih-kegiatan-awal">Kegiatan</Label>
                <Select
                  value={selectedKegiatanId || undefined}
                  onValueChange={(v) => setSelectedKegiatanId(v)}
                >
                  <SelectTrigger
                    id="pilih-kegiatan-awal"
                    className="h-10 w-full min-w-0 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1"
                  >
                    <SelectValue placeholder="Pilih kegiatan" />
                  </SelectTrigger>
                  <SelectContent>
                    {kegiatanList.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        <span className="font-mono text-[10px] mr-1 shrink-0">
                          {k.code}
                        </span>
                        <span className="min-w-0 truncate">{k.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v);
              setVisitedTabs((prev) => new Set(prev).add(v));
            }}
            className={cn("flex-1 min-h-0", embedded && "flex-none")}
          >
            <div className={cn("pt-2", adminMode ? "px-0" : "px-6")}>
              <TabsList className="h-auto w-full flex-wrap justify-start gap-0 rounded-[12px] border border-[#d0d7de] bg-white p-0 px-2">
                {visibleTabs.map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className={cn(
                      "h-11 flex-none gap-1.5 rounded-none border-0 border-b-[3px] border-transparent px-3.5 text-sm font-medium text-[#3d4752] shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:text-primary data-[state=active]:shadow-none",
                      adminMode && !isTabActive(t.value) && "opacity-50",
                    )}
                  >
                    {!adminMode && !isEdit && !previewMode && visitedTabs.has(t.value) && (
                      <span aria-label="sudah dibuka" className="text-emerald-600">✓</span>
                    )}
                    {tabHeader(t.value).title}
                    {adminMode && !isTabActive(t.value) && (
                      <span className="text-[10px] font-normal">(disembunyikan)</span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <SheetBody
              className={cn(
                adminMode ? "px-0 py-6" : "px-6 py-6",
                embedded && "flex-none overflow-visible",
              )}
            >
              {/* === TAB 1: IDENTITAS PROYEK === */}
              <TabsContent value="identitas" className="space-y-5">
                {renderTabHeader("identitas")}
                {/* Kegiatan bukan FormItem (dipakai menentukan template-nya
                    sendiri, jadi tidak bisa ikut diatur di kanvas) — tetap
                    field tersendiri di luar loop template, selalu tampil. */}
                <div
                  className={cn(KEGIATAN_GRID_CLASS, "pl-12 mb-5", adminMode && "hidden")}
                >
                  <div className="space-y-2">
                    <Label>Kegiatan</Label>
                    <Select
                      value={selectedKegiatanId || NONE}
                      onValueChange={(v) =>
                        setSelectedKegiatanId(v === NONE ? "" : v)
                      }
                      disabled={isEdit || previewMode || !!akunKegiatanId}
                    >
                      <SelectTrigger className="h-10 w-full min-w-0 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1">
                        <SelectValue placeholder="Pilih kegiatan" />
                      </SelectTrigger>
                      <SelectContent>
                        {kegiatanList.map((k) => (
                          <SelectItem key={k.id} value={k.id}>
                            <span className="font-mono text-[10px] mr-1 shrink-0">
                              {k.code}
                            </span>
                            <span className="min-w-0 truncate">{k.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {renderTemplatedTab(
                  "identitas",
                  identitasRenderers,
                  TAB_GRID_CLASS.identitas!,
                )}
              </TabsContent>

              {/* === TAB 2: DASAR PELAKSANAAN === */}
              <TabsContent value="dasar" className="space-y-5">
                {renderTabHeader("dasar")}
                {renderTemplatedTab(
                  "dasar",
                  dasarRenderers,
                  TAB_GRID_CLASS.dasar!,
                )}
              </TabsContent>

              {/* === TAB: LOKASI PROYEK === */}
              <TabsContent value="lokasi" className="space-y-5">
                {renderTabHeader("lokasi")}
                {renderTemplatedTab(
                  "lokasi",
                  lokasiRenderers,
                  TAB_GRID_CLASS.lokasi!,
                )}
              </TabsContent>

              {/* === TAB 3: KRITERIA TEKNIS === */}
              <TabsContent value="kriteria" className="space-y-5">
                {renderTabHeader("kriteria")}
                {renderTemplatedTab(
                  "kriteria",
                  kriteriaRenderers,
                  TAB_GRID_CLASS.kesiapan!,
                )}
              </TabsContent>

              {/* === TAB 4: PEMAKETAN === */}
              <TabsContent value="pemaketan" className="space-y-5">
                {renderTabHeader("pemaketan")}
                {adminMode && adminHandlers ? (
                  <>
                    {adminHandlers.note("pemaketan")}
                    {renderTemplatedTab(
                      "pemaketan",
                      Object.fromEntries(
                        [...PAKET_BAKU_KEYS, ...PEMAKETAN_PROYEK_KEYS].map((k) => [
                          k,
                          (item: FormItemNode) => <PemaketanBakuPreview key={item.id} item={item} />,
                        ]),
                      ),
                      "grid grid-cols-1 sm:grid-cols-2 gap-3",
                    )}
                  </>
                ) : (
                  renderTemplatedTab(
                    "pemaketan",
                    pemaketanRenderers,
                    "grid grid-cols-1 sm:grid-cols-2 gap-4",
                    (sec) => !sec.perPaket,
                  )
                )}
                {!adminMode && (
                  <PaketDialog
                    open={!!paketEdit}
                    onClose={() => setPaketEdit(null)}
                    onSave={simpanPaket}
                    sections={paketTemplateSections}
                    value={paketEdit?.idx != null ? daftarPaket[paketEdit.idx] : null}
                    kegiatanId={selectedKegiatanId}
                    balaiId={balaiForm}
                    satkerTerkunci={akunSatkerId}
                    tahunMin={periodeForm?.startYear}
                    tahunMax={periodeForm?.endYear}
                    saldo={saldoForm}
                    paketLain={ringkasDaftar.filter((_, i) => i !== paketEdit?.idx)}
                    breadcrumb={[
                      { label: watch("projectName") || "Proyek baru", onClick: () => setPaketEdit(null) },
                      { label: paketEdit?.idx != null ? "Edit paket" : "Tambah paket" },
                    ]}
                  />
                )}
              </TabsContent>

              {/* === TAB 5: TAGGING === */}
              <TabsContent value="tagging" className="space-y-6">
                {renderTabHeader("tagging")}
                {renderTemplatedTab(
                  "tagging",
                  taggingRenderers,
                  TAB_GRID_CLASS.tematik!,
                )}
              </TabsContent>

              {/* === TAB: VALUASI PROYEK === generik dari template; kriteria
                  rasio dihitung OTOMATIS server-side dari alokasi paket vs
                  ambang batas Master Data (lihat form-skor.ts). */}
              <TabsContent value="valuasi" className="space-y-5">
                {renderTabHeader("valuasi")}
                {!adminMode &&
                  (() => {
                    // Kategori dipilih di tab Pemaketan — di sini cuma dibaca.
                    const item = templateItemByKey.get("kategoriProyek");
                    if (!item) return null;
                    const label =
                      rowsForItem(item, sourceData, itemValue, selectedKegiatanId)?.find(
                        (r) => r.value === kategoriProyekValue,
                      )?.label ?? kategoriProyekValue;
                    return (
                      <p className="pl-12 text-xs text-muted-foreground">
                        {item.label}:{" "}
                        <span className="font-semibold text-foreground">{label || "belum dipilih"}</span>
                      </p>
                    );
                  })()}
                {renderTemplatedTab("valuasi", {}, TAB_GRID_CLASS.valuasi!)}
              </TabsContent>

              {/* === TAB: KINERJA PROYEK === daftar kriteria mengikuti
                  Kategori Proyek di tab Valuasi (syarat per field); field &
                  kolom tambahannya dirender generik seperti tab lain. */}
              <TabsContent value="kinerja" className="space-y-5">
                {renderTabHeader("kinerja")}
                {adminMode && adminHandlers ? (
                  renderTemplatedTab("kinerja", {}, TAB_GRID_CLASS.kinerja!)
                ) : (
                <div className="pl-12 space-y-3">
                  {!kategoriProyekValue ? (
                    <div className="rounded-xl border-2 border-dashed p-6 text-center text-muted-foreground text-xs">
                      Pilih Kategori Proyek di tab Pemaketan dulu.
                    </div>
                  ) : kinerjaItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Belum ada kriteria kinerja untuk kategori ini.
                    </p>
                  ) : (
                    // Tampilan umum (sama dgn kanvas admin): centang + kolom
                    // tambahan yang diatur admin, bobot lewat skor tab.
                    <div className="-ml-12">
                      {renderTemplatedTab("kinerja", {}, TAB_GRID_CLASS.kinerja!)}
                    </div>
                  )}
                </div>
                )}
              </TabsContent>

              {/* === TAB 6: DOKUMEN & CATATAN === */}
              <TabsContent value="dokumen" className="space-y-6">
                {renderTabHeader("dokumen")}
                {renderTemplatedTab(
                  "dokumen",
                  dokumenRenderers,
                  TAB_GRID_CLASS.dokumen!,
                )}
              </TabsContent>

              {/* === TAB 10: EVALUASI PROYEK === read-only, dihitung otomatis
                  & LIVE dari isian tab Dasar Pelaksanaan/Kesiapan Teknis/
                  Tematik/Valuasi/Kinerja sesuai template Form Proyek
                  (Master Data) kegiatan yang dipilih — lihat form-skor.ts
                  di backend. */}
              <TabsContent value="evaluasi" className="space-y-5">
                {renderTabHeader("evaluasi")}
                {adminMode && adminHandlers ? (
                  adminHandlers.note("evaluasi")
                ) : (
                <div className="pl-12 space-y-4">
                  {!roIdPreview ? (
                    <div className="rounded-xl border-2 border-dashed p-6 text-center text-muted-foreground text-xs">
                      Pilih RO di tab Pemaketan dulu — skor evaluasi mengikuti
                      kegiatan dari RO paket pertama.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(preview?.rincian?.length ?? 0) > 0 && (
                        <div className="rounded-lg border bg-white">
                          <div className="flex justify-between border-b px-4 py-2 text-[11px] font-semibold text-muted-foreground">
                            <span>Tab</span>
                            <span>Skor / bobot</span>
                          </div>
                          {preview!.rincian!.map((r) => (
                            <div
                              key={r.key ?? r.label}
                              className="flex justify-between border-b px-4 py-2 text-sm last:border-b-0"
                            >
                              <span>{r.label}</span>
                              <span className="tabular-nums">
                                {fmtSkor(r.dapat)} / {fmtSkor(r.bobot)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Skor Evaluasi
                        </span>
                        <span className="text-2xl font-bold text-primary flex items-center gap-2">
                          {previewLoading && (
                            <Loader2 size={16} className="animate-spin" />
                          )}
                          {fmtSkor((preview?.skorEvaluasi ?? 0) * 100)} / 100
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                )}
              </TabsContent>
            </SheetBody>
          </Tabs>
  );

  if (embedded) {
    return (
      <div
        className={cn(
          // Kanvas admin: kartu field langsung di atas latar (seperti
          // prototipe), tanpa bingkai putih pembungkus.
          !adminMode && "rounded-xl border bg-white shadow-sm overflow-hidden",
        )}
      >
        {tabsBody}
      </div>
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <SheetContent
        layer="1"
        className="!p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="gap-2 pb-4">
          <SheetTitle className="text-lg leading-snug">
            {previewMode
              ? "Pratinjau Form Proyek"
              : adminMode
                ? "Kelola Form Proyek"
                : isEdit
                  ? "Edit Proyek"
                  : "Buat Proyek"}
          </SheetTitle>
        </SheetHeader>

        {tabsBody}

        <SheetFooter className="flex-col items-end gap-1.5 sm:flex-row sm:items-center">
          {previewMode || adminMode ? (
            <>
              <p className="text-xs text-muted-foreground mr-auto">
                {adminMode
                  ? "Mode kelola form — perubahan tersimpan otomatis"
                  : "Mode pratinjau — perubahan tidak disimpan"}
              </p>
              <Button type="button" variant="outline" onClick={onClose}>
                Tutup
              </Button>
            </>
          ) : (
            <>
              {!isEdit && (perluPilihKegiatan || !allTabsVisited) && (
                <p className="text-xs text-muted-foreground mr-auto">
                  {perluPilihKegiatan
                    ? "Pilih kegiatan dulu untuk mulai mengisi form"
                    : `Buka semua tab dulu sebelum menyimpan (${jumlahTabDibuka} dari ${visibleTabs.length} sudah dibuka)`}
                </p>
              )}
              <Button type="button" variant="outline" onClick={onClose}>
                Batal
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const missing = findMissingRequiredItem();
                  if (missing) {
                    setActiveTab(missing.tabValue);
                    toast.error(`Lengkapi field wajib "${missing.label}"`);
                    return;
                  }
                  const lebih = statusSaldo(saldoForm, ringkasDaftar).find((x) => x.lebih);
                  if (lebih) {
                    setActiveTab("pemaketan");
                    toast.error(`${lebih.nama} paket melebihi saldo`);
                    return;
                  }
                  handleSubmit(onSubmit, onInvalid)();
                }}
                disabled={
                  isSubmitting || loadingMaster || (!isEdit && !allTabsVisited)
                }
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEdit ? "Simpan Perubahan" : "Buat Proyek"}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
