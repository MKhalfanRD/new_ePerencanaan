"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray, FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  Plus,
  Trash2,
  X,
  MapPin,
  ScrollText,
  Target,
  Tags,
  FileText,
  ClipboardCheck,
} from "lucide-react";
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
import api from "@/lib/api";
import {
  Balai,
  Periode,
  RO,
  Komponen,
  Proyek,
  PrioritasNasional,
} from "@/types";

const toOptionalNumber = (v: string) => (v === "" ? undefined : Number(v));

// Sentinel untuk opsi "tidak dipilih" pada Select opsional — Radix Select
// tidak mengizinkan value="".
const NONE = "__NONE__";

interface KegiatanOpt {
  id: string;
  name: string;
  code: string;
  program: { id: string; name: string; code: string };
  _count: { evaluasiItem: number };
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

  // Tab 4: Pemaketan — hanya dipakai saat buat proyek baru; sesudahnya
  // paket dikelola dari drawer detail (tambah/edit paket per-item).
  paket: z.array(
    z.object({
      name: z.string().min(1, "Nama paket wajib diisi"),
      roId: z.string().min(1, "RO wajib dipilih"),
      komponenId: z.string().optional(),
      jenis: z.enum(["FISIK", "NON_FISIK"]),
      masaPelaksanaan: z.enum(["SINGLE_YEAR", "MULTI_YEAR"]),
      dokLingStatus: z.string().optional(),
      indikatorRoId: z.string().optional(),
      tahun: z.number(),
      status: z.enum(["RENCANA", "REALISASI"]),
      rm: z.number(),
      rmp: z.number(),
      pln: z.number(),
      sbsn: z.number(),
      kpbu: z.number(),
      outputTarget: z.number().optional(),
      outputUnit: z.string().optional(),
      outcomeTarget: z.number().optional(),
      outcomeUnit: z.string().optional(),
      catatan: z.string().optional(),
    }),
  ),

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

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: Proyek | null;
}

const TABS = [
  { value: "identitas", label: "Identitas Proyek" },
  { value: "dasar", label: "Dasar Pelaksanaan" },
  { value: "kriteria", label: "Kriteria Teknis" },
  { value: "pemaketan", label: "Pemaketan" },
  { value: "tagging", label: "Tagging" },
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

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-3 pb-1">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

export function ProyekFormDialog({
  open,
  onClose,
  onSuccess,
  editData,
}: Props) {
  const [activeTab, setActiveTab] = useState<string>(TABS[0].value);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(
    new Set([TABS[0].value]),
  );
  const [loadingMaster, setLoadingMaster] = useState(false);
  const isEdit = !!editData;

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

  const [preview, setPreview] = useState<{
    skorEvaluasi: number | null;
    items: {
      id: string;
      name: string;
      metodeName: string;
      keterangan?: string;
    }[];
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
      statusStudiLayak: "RENCANA",
      statusDed: "RENCANA",
      statusLarap: "RENCANA",
      statusDokumenLingkungan: "RENCANA",
      fkb: false,
      fkw: false,
      mpa: false,
      taggingDinamis: [],
      paket: [],
    },
  });

  const {
    fields: paketFields,
    append: appendPaket,
    remove: removePaket,
  } = useFieldArray({ control, name: "paket" });

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
  }, [open]);

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
      setSelectedKegiatanId(editData.paket?.[0]?.ro?.kro?.kegiatan?.id ?? "");
      setSelectedSpId(
        editData.indikatorSasaranProgram?.sasaranProgram.id ?? "",
      );
      setSelectedSkId(
        editData.indikatorSasaranKegiatan?.sasaranKegiatan.id ?? "",
      );
      setDokumenList(editData.dokumenPendukung ?? []);
    } else {
      setSelectedPnId("");
      setSelectedPpId("");
      setSelectedKegiatanId("");
      setSelectedSpId("");
      setSelectedSkId("");
      setDokumenList([]);
      reset({
        kewenangan: "PUSAT",
        kebutuhanTanah: false,
        statusStudiLayak: "RENCANA",
        statusDed: "RENCANA",
        statusLarap: "RENCANA",
        statusDokumenLingkungan: "RENCANA",
        fkb: false,
        fkw: false,
        mpa: false,
        taggingDinamis: [],
        paket: [],
      });
    }
  }, [editData, open]);

  // Cuma 4 kegiatan (Irwa/Supan/Bendungan/Air Tanah) yang punya EvaluasiItem
  // di master data — itu yang menentukan tab lengkap vs tab minimal, bukan
  // daftar kegiatan hardcode. Belum pilih kegiatan -> anggap true (tampilkan
  // semua tab dulu, jangan bikin tab tiba-tiba hilang sebelum sempat pilih).
  const hasEvaluasi =
    !selectedKegiatanId ||
    (kegiatanList.find((k) => k.id === selectedKegiatanId)?._count
      .evaluasiItem ?? 0) > 0;
  const visibleTabs = hasEvaluasi
    ? TABS
    : TABS.filter((t) => t.value === "identitas" || t.value === "pemaketan");

  useEffect(() => {
    if (!visibleTabs.some((t) => t.value === activeTab)) {
      setActiveTab("identitas");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasEvaluasi]);

  const allTabsVisited = visibleTabs.every((t) => visitedTabs.has(t.value));

  const roOptionsFiltered = selectedKegiatanId
    ? roList.filter((r) => r.kro.kegiatan.id === selectedKegiatanId)
    : roList;

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

  // Skor evaluasi live: dihitung ulang tiap field yang mempengaruhi deteksi
  // berubah (lihat evaluasi-deteksi.ts di backend), bukan menunggu submit.
  // Debounce 500ms — cukup lama untuk tidak spam API tiap ketikan, cukup
  // pendek supaya tetap terasa "langsung".
  const watchedForPreview = watch();
  const paket0Form = watchedForPreview.paket?.[0];
  const roIdPreview = isEdit ? editData?.paket?.[0]?.roId : paket0Form?.roId;
  const previewKey = JSON.stringify({
    roIdPreview,
    sumberUsulanProyek: watchedForPreview.sumberUsulanProyek,
    kegiatanPrioritasId: watchedForPreview.kegiatanPrioritasId,
    tahunDed: watchedForPreview.tahunDed,
    tahunDokumenLingkungan: watchedForPreview.tahunDokumenLingkungan,
    kebutuhanTanah: watchedForPreview.kebutuhanTanah,
    kewenangan: watchedForPreview.kewenangan,
    pkpnId: watchedForPreview.pkpnId,
    tematikRenjaId: watchedForPreview.tematikRenjaId,
    taggingDinamis: watchedForPreview.taggingDinamis,
    dana: isEdit
      ? undefined
      : [
          paket0Form?.rm,
          paket0Form?.rmp,
          paket0Form?.pln,
          paket0Form?.sbsn,
          paket0Form?.kpbu,
          paket0Form?.outputTarget,
          paket0Form?.outcomeTarget,
        ],
  });

  useEffect(() => {
    if (!open || !roIdPreview) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      const editPaket0 = editData?.paket?.[0];
      const totalDana = isEdit
        ? editPaket0?.alokasi.reduce((s, a) => s + Number(a.total), 0)
        : (paket0Form?.rm ?? 0) +
          (paket0Form?.rmp ?? 0) +
          (paket0Form?.pln ?? 0) +
          (paket0Form?.sbsn ?? 0) +
          (paket0Form?.kpbu ?? 0);
      const outputTarget = isEdit
        ? editPaket0?.alokasi.reduce(
            (s, a) => s + Number(a.outputTarget ?? 0),
            0,
          )
        : paket0Form?.outputTarget;
      const outcomeTarget = isEdit
        ? editPaket0?.alokasi.reduce(
            (s, a) => s + Number(a.outcomeTarget ?? 0),
            0,
          )
        : paket0Form?.outcomeTarget;

      setPreviewLoading(true);
      api
        .post("/proyek/preview-skor", {
          roId: roIdPreview,
          sumberUsulanProyek: watchedForPreview.sumberUsulanProyek,
          kegiatanPrioritasId: watchedForPreview.kegiatanPrioritasId,
          tahunDed: watchedForPreview.tahunDed,
          tahunDokumenLingkungan: watchedForPreview.tahunDokumenLingkungan,
          kebutuhanTanah: watchedForPreview.kebutuhanTanah,
          kewenangan: watchedForPreview.kewenangan,
          pkpnId: watchedForPreview.pkpnId,
          tematikRenjaId: watchedForPreview.tematikRenjaId,
          taggingDinamis: watchedForPreview.taggingDinamis,
          totalDana,
          outputTarget,
          outcomeTarget,
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
        await api.patch(`/proyek/${editData!.id}`, bersihkanFkKosong(rest));
        toast.success("Proyek berhasil diperbarui");
      } else {
        const { paket, ...rest } = data;
        const payload = {
          ...bersihkanFkKosong(rest),
          paket: paket.map((p) => ({
            name: p.name,
            roId: p.roId,
            komponenId: p.komponenId || undefined,
            jenis: p.jenis,
            masaPelaksanaan: p.masaPelaksanaan,
            dokLingStatus: p.dokLingStatus || undefined,
            indikatorRoId: p.indikatorRoId || undefined,
            alokasi: [
              {
                tahun: p.tahun,
                status: p.status,
                rm: p.rm,
                rmp: p.rmp,
                pln: p.pln,
                sbsn: p.sbsn,
                kpbu: p.kpbu,
                outputTarget: p.outputTarget,
                outputUnit: p.outputUnit,
                outcomeTarget: p.outcomeTarget,
                outcomeUnit: p.outcomeUnit,
                catatan: p.catatan,
              },
            ],
          })),
        };
        const res = await api.post("/proyek", payload);
        if (pendingFiles.length) {
          await uploadDokumen(res.data.id, pendingFiles);
        }
        toast.success("Proyek berhasil dibuat");
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };

  // Validasi gagal (mis. Nama Proyek kosong) tapi field itu ada di tab yang
  // sedang tidak aktif — tanpa ini tombol submit terkesan "tidak ngaruh"
  // karena error-nya tidak kelihatan sama sekali.
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
            {isEdit ? "Edit Proyek" : "Buat Proyek"}
          </SheetTitle>
        </SheetHeader>

        {loadingMaster ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-muted-foreground" size={28} />
            <span className="ml-3 text-sm text-muted-foreground">
              Memuat data referensi...
            </span>
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v);
              setVisitedTabs((prev) => new Set(prev).add(v));
            }}
            className="flex-1 min-h-0"
          >
            <div className="px-6 pt-2">
              <TabsList className="w-full flex-nowrap">
                {visibleTabs.map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="text-xs"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <SheetBody className="px-6 py-6">
              {/* === TAB 1: IDENTITAS PROYEK === */}
              <TabsContent value="identitas" className="space-y-5">
                <SectionHeader
                  icon={MapPin}
                  title="Identitas Proyek"
                  description="Informasi dasar mengenai proyek dan unit pelaksana"
                />
                <div className="grid grid-cols-2 gap-5 pl-12">
                  <div className="space-y-2">
                    <Label>
                      Balai <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={watch("balaiId")?.toString()}
                      onValueChange={(v) => setValue("balaiId", Number(v))}
                      onOpenChange={(o) => o && setBalaiSearch("")}
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
                                <span className="font-medium">
                                  {b.shortName}
                                </span>
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
                      <p className="text-destructive text-xs">
                        {errors.balaiId.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Periode <span className="text-destructive">*</span>
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
                              <Badge
                                variant="default"
                                className="ml-2 text-xs py-0"
                              >
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

                  <div className="col-span-2 space-y-2">
                    <Label>
                      Nama Proyek <span className="text-destructive">*</span>
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

                  <div className="space-y-2">
                    <Label>Wilayah Sungai</Label>
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
                              : w.name
                                  .toLowerCase()
                                  .includes(wsSearch.toLowerCase()),
                          )
                          .map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Kegiatan</Label>
                    <Select
                      value={selectedKegiatanId || NONE}
                      onValueChange={(v) =>
                        setSelectedKegiatanId(v === NONE ? "" : v)
                      }
                      disabled={isEdit}
                    >
                      <SelectTrigger className="h-10 w-full min-w-0 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1">
                        <SelectValue placeholder="Pilih kegiatan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— Tidak ada —</SelectItem>
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
              </TabsContent>

              {/* === TAB 2: DASAR PELAKSANAAN === */}
              <TabsContent value="dasar" className="space-y-5">
                <SectionHeader
                  icon={ScrollText}
                  title="Dasar Pelaksanaan"
                  description="Sumber usulan dan justifikasi proyek — dipakai untuk deteksi skor evaluasi otomatis"
                />
                <div className="grid grid-cols-2 gap-5 pl-12">
                  <div className="col-span-2 space-y-2">
                    <Label>Sumber Usulan Proyek</Label>
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

                  {(watch("sumberUsulanProyek") === "Pemerintah Daerah" ||
                    watch("sumberUsulanProyek") === "Kementerian/Lembaga" ||
                    watch("sumberUsulanProyek") === "Lainnya") && (
                    <div className="col-span-2 space-y-2">
                      <Label>
                        {watch("sumberUsulanProyek") === "Pemerintah Daerah"
                          ? "Pemerintah Daerah yang Mengusulkan"
                          : watch("sumberUsulanProyek") ===
                              "Kementerian/Lembaga"
                            ? "Kementerian/Lembaga yang Mengusulkan"
                            : "Sumber Usulan Lainnya"}
                      </Label>
                      <Input
                        className="h-10"
                        {...register("sumberUsulanLainnya")}
                      />
                    </div>
                  )}

                  <div className="col-span-2 space-y-2">
                    <Label>Justifikasi Proyek</Label>
                    <Textarea
                      placeholder="Jelaskan alasan/latar belakang pelaksanaan proyek ini"
                      {...register("justifikasiProyek")}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* === TAB 3: KRITERIA TEKNIS === */}
              <TabsContent value="kriteria" className="space-y-5">
                <SectionHeader
                  icon={FileText}
                  title="Kriteria Teknis"
                  description="Kesiapan dokumen teknis — dipakai untuk deteksi skor evaluasi otomatis"
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5 pl-12">
                  {(
                    [
                      ["Studi Kelayakan", "statusStudiLayak", "tahunStudiLayak"],
                      ["DED", "statusDed", "tahunDed"],
                      [
                        "Dokumen Lingkungan",
                        "statusDokumenLingkungan",
                        "tahunDokumenLingkungan",
                      ],
                      ["LARAP", "statusLarap", "tahunLarap"],
                    ] as const
                  ).map(([label, statusField, tahunField]) => {
                    const status = watch(statusField);
                    return (
                      <div key={tahunField} className="space-y-2">
                        <Label className="text-xs">{label}</Label>
                        <Select
                          value={status}
                          onValueChange={(v) => setValue(statusField, v as any)}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="RENCANA">Rencana</SelectItem>
                            <SelectItem value="SUDAH_ADA">
                              Sudah Ada
                            </SelectItem>
                            <SelectItem value="TIDAK_PERLU">
                              Tidak Perlu
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          placeholder="Tahun"
                          className="h-9 text-xs"
                          disabled={status === "TIDAK_PERLU"}
                          {...register(tahunField, {
                            setValueAs: toOptionalNumber,
                          })}
                        />
                      </div>
                    );
                  })}
                  <div className="space-y-2">
                    <Label className="text-xs">Kebutuhan Tanah</Label>
                    <Select
                      value={watch("kebutuhanTanah") ? "ya" : "tidak"}
                      onValueChange={(v) =>
                        setValue("kebutuhanTanah", v === "ya")
                      }
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tidak">Tidak Ada</SelectItem>
                        <SelectItem value="ya">Ada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Kewenangan</Label>
                    <Select
                      value={watch("kewenangan")}
                      onValueChange={(v) => setValue("kewenangan", v as any)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PUSAT">Pusat</SelectItem>
                        <SelectItem value="DAERAH">Daerah</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* === TAB 4: PEMAKETAN === */}
              <TabsContent value="pemaketan" className="space-y-5">
                {isEdit ? (
                  <div className="pl-12 space-y-3">
                    <SectionHeader
                      icon={Target}
                      title="Pemaketan"
                      description="Paket pekerjaan proyek ini"
                    />
                    {editData!.paket.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Belum ada paket. Tambah paket lewat halaman detail
                        proyek.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {editData!.paket.map((pk) => (
                          <div
                            key={pk.id}
                            className="rounded-lg border px-4 py-3 text-sm flex items-center justify-between"
                          >
                            <div>
                              <p className="font-medium">{pk.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {pk.ro.kro.kegiatan.code} · {pk.ro.kro.code} ·{" "}
                                {pk.ro.code} — {pk.jenis}
                              </p>
                            </div>
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground">
                          Tambah/edit/hapus paket individual lewat halaman
                          detail proyek.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <SectionHeader
                        icon={Target}
                        title="Pemaketan"
                        description="Tambah paket pekerjaan di bawah proyek ini beserta alokasi tahun berjalan"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          appendPaket({
                            name: "",
                            roId: "",
                            jenis: "FISIK",
                            masaPelaksanaan: "SINGLE_YEAR",
                            tahun: new Date().getFullYear(),
                            status: "RENCANA",
                            rm: 0,
                            rmp: 0,
                            pln: 0,
                            sbsn: 0,
                            kpbu: 0,
                          })
                        }
                      >
                        <Plus size={15} className="mr-1.5" /> Tambah Paket
                      </Button>
                    </div>

                    <div className="pl-12">
                      {paketFields.length === 0 ? (
                        <div className="rounded-xl border-2 border-dashed p-10 text-center text-muted-foreground text-sm">
                          Belum ada paket ditambahkan.
                          <br />
                          <span className="text-xs">
                            Klik &quot;Tambah Paket&quot; — bisa lebih dari
                            satu.
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {paketFields.map((field, i) => {
                            const selectedRO = roList.find(
                              (r) => r.id === watch(`paket.${i}.roId`),
                            );
                            const komponenOptions = komponenList.filter(
                              (k) => k.roId === selectedRO?.id,
                            );
                            const selectedIndikatorSatuan =
                              (selectedRO?.indikatorRO ?? []).find(
                                (ind) =>
                                  ind.id === watch(`paket.${i}.indikatorRoId`),
                              )?.satuanList ?? [];
                            return (
                              <div
                                key={field.id}
                                className="rounded-xl border bg-card p-5 space-y-4"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Paket #{i + 1}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => removePaket(i)}
                                  >
                                    <Trash2 size={13} className="mr-1.5" />{" "}
                                    Hapus
                                  </Button>
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-xs">
                                    Nama Paket{" "}
                                    <span className="text-destructive">*</span>
                                  </Label>
                                  <Input
                                    className="h-9 text-xs"
                                    placeholder="Contoh: Pembangunan Bendungan A Paket I"
                                    {...register(`paket.${i}.name`)}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-xs">
                                    RO (Rincian Output){" "}
                                    <span className="text-destructive">*</span>
                                  </Label>
                                  <Select
                                    value={watch(`paket.${i}.roId`)}
                                    onValueChange={(v) => {
                                      setValue(`paket.${i}.roId`, v);
                                      const ro = roList.find((r) => r.id === v);
                                      setValue(
                                        `paket.${i}.outputUnit`,
                                        ro?.satuan?.name || "",
                                      );
                                      setValue(`paket.${i}.outcomeUnit`, "");
                                      setValue(`paket.${i}.komponenId`, "");
                                      setValue(`paket.${i}.indikatorRoId`, "");
                                    }}
                                    onOpenChange={(o) => o && setRoSearch("")}
                                  >
                                    <SelectTrigger className="w-full h-9 text-xs">
                                      <SelectValue placeholder="Pilih RO" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {roOptionsFiltered.length > 20 && (
                                        <SelectSearchBox
                                          value={roSearch}
                                          onChange={setRoSearch}
                                          placeholder="Cari RO..."
                                        />
                                      )}
                                      {roOptionsFiltered
                                        .filter(
                                          (r) =>
                                            !roSearch ||
                                            `${r.code} ${r.name}`
                                              .toLowerCase()
                                              .includes(roSearch.toLowerCase()),
                                        )
                                        .map((r) => (
                                          <SelectItem key={r.id} value={r.id}>
                                            <span className="font-medium">
                                              {r.kro.kegiatan.code} ·{" "}
                                              {r.kro.code} · {r.code}
                                            </span>
                                            <span className="text-muted-foreground ml-2 text-xs">
                                              — {r.name}
                                            </span>
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-xs">Komponen</Label>
                                    <Select
                                      value={
                                        watch(`paket.${i}.komponenId`) || NONE
                                      }
                                      onValueChange={(v) =>
                                        setValue(
                                          `paket.${i}.komponenId`,
                                          v === NONE ? "" : v,
                                        )
                                      }
                                      disabled={!selectedRO}
                                    >
                                      <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Opsional" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value={NONE}>
                                          — Tidak ada —
                                        </SelectItem>
                                        {komponenOptions.map((k) => (
                                          <SelectItem key={k.id} value={k.id}>
                                            {k.code} — {k.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">
                                      Indikator RO
                                    </Label>
                                    <Select
                                      value={
                                        watch(`paket.${i}.indikatorRoId`) ||
                                        NONE
                                      }
                                      onValueChange={(v) => {
                                        setValue(
                                          `paket.${i}.indikatorRoId`,
                                          v === NONE ? "" : v,
                                        );
                                        const ind = (
                                          selectedRO?.indikatorRO ?? []
                                        ).find((x) => x.id === v);
                                        setValue(
                                          `paket.${i}.outcomeUnit`,
                                          ind?.satuanList?.[0]?.satuan.name ||
                                            "",
                                        );
                                      }}
                                      disabled={!selectedRO}
                                    >
                                      <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Opsional" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value={NONE}>
                                          — Tidak ada —
                                        </SelectItem>
                                        {(selectedRO?.indikatorRO ?? []).map(
                                          (ind) => (
                                            <SelectItem
                                              key={ind.id}
                                              value={ind.id}
                                            >
                                              {ind.nama}
                                              {(ind.satuanList?.length ?? 0) >
                                                0 &&
                                                ` (${ind
                                                  .satuanList!.map(
                                                    (s) => s.satuan.name,
                                                  )
                                                  .join(", ")})`}
                                            </SelectItem>
                                          ),
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-xs">
                                      Jenis Paket
                                    </Label>
                                    <Select
                                      value={watch(`paket.${i}.jenis`)}
                                      onValueChange={(v) =>
                                        setValue(`paket.${i}.jenis`, v as any)
                                      }
                                    >
                                      <SelectTrigger className="h-9 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="FISIK">
                                          Fisik
                                        </SelectItem>
                                        <SelectItem value="NON_FISIK">
                                          Non-Fisik
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">
                                      Masa Pelaksanaan
                                    </Label>
                                    <Select
                                      value={watch(
                                        `paket.${i}.masaPelaksanaan`,
                                      )}
                                      onValueChange={(v) =>
                                        setValue(
                                          `paket.${i}.masaPelaksanaan`,
                                          v as any,
                                        )
                                      }
                                    >
                                      <SelectTrigger className="h-9 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="SINGLE_YEAR">
                                          Single Year
                                        </SelectItem>
                                        <SelectItem value="MULTI_YEAR">
                                          Multi Year
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-xs">
                                    Dokumen Lingkungan (status)
                                  </Label>
                                  <Input
                                    className="h-9 text-xs"
                                    placeholder="Contoh: Sesuai / Belum Ada"
                                    {...register(`paket.${i}.dokLingStatus`)}
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-xs">Tahun</Label>
                                    <Input
                                      type="number"
                                      className="h-9 text-xs"
                                      {...register(`paket.${i}.tahun`, {
                                        valueAsNumber: true,
                                      })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Status</Label>
                                    <Select
                                      value={watch(`paket.${i}.status`)}
                                      onValueChange={(v) =>
                                        setValue(`paket.${i}.status`, v as any)
                                      }
                                    >
                                      <SelectTrigger className="h-9 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="RENCANA">
                                          Rencana
                                        </SelectItem>
                                        <SelectItem value="REALISASI">
                                          Realisasi
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-xs">
                                    Sumber Dana (Rp)
                                  </Label>
                                  <div className="grid grid-cols-5 gap-3">
                                    {(
                                      [
                                        "rm",
                                        "rmp",
                                        "pln",
                                        "sbsn",
                                        "kpbu",
                                      ] as const
                                    ).map((f) => (
                                      <div key={f} className="space-y-1.5">
                                        <p className="text-xs text-center text-muted-foreground uppercase font-medium">
                                          {f}
                                        </p>
                                        <Input
                                          type="number"
                                          className="text-xs text-center h-9 px-2"
                                          placeholder="0"
                                          {...register(`paket.${i}.${f}`, {
                                            valueAsNumber: true,
                                          })}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-xs">Volume RO</Label>
                                    <div className="flex gap-2">
                                      <Input
                                        type="number"
                                        className="h-9 text-xs"
                                        placeholder="0"
                                        {...register(
                                          `paket.${i}.outputTarget`,
                                          {
                                            setValueAs: toOptionalNumber,
                                          },
                                        )}
                                      />
                                      <Input
                                        className={`h-9 text-xs w-24 shrink-0 ${
                                          watch(`paket.${i}.outputUnit`)
                                            ? "bg-muted"
                                            : ""
                                        }`}
                                        placeholder="Satuan"
                                        readOnly={
                                          !!watch(`paket.${i}.outputUnit`)
                                        }
                                        {...register(`paket.${i}.outputUnit`)}
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">
                                      Indikator Outcome
                                    </Label>
                                    <div className="flex gap-2">
                                      <Input
                                        type="number"
                                        className="h-9 text-xs"
                                        placeholder="0"
                                        {...register(
                                          `paket.${i}.outcomeTarget`,
                                          {
                                            setValueAs: toOptionalNumber,
                                          },
                                        )}
                                      />
                                      {selectedIndikatorSatuan.length > 0 ? (
                                        <Select
                                          value={
                                            watch(`paket.${i}.outcomeUnit`) ||
                                            ""
                                          }
                                          onValueChange={(v) =>
                                            setValue(
                                              `paket.${i}.outcomeUnit`,
                                              v,
                                            )
                                          }
                                        >
                                          <SelectTrigger className="h-9 text-xs w-24 shrink-0">
                                            <SelectValue placeholder="Satuan" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {selectedIndikatorSatuan.map(
                                              (s) => (
                                                <SelectItem
                                                  key={s.satuan.id}
                                                  value={s.satuan.name}
                                                >
                                                  {s.satuan.name}
                                                </SelectItem>
                                              ),
                                            )}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <Input
                                          className="h-9 text-xs w-24 shrink-0"
                                          placeholder="Satuan"
                                          {...register(
                                            `paket.${i}.outcomeUnit`,
                                          )}
                                        />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* === TAB 5: TAGGING === */}
              <TabsContent value="tagging" className="space-y-6">
                <div className="space-y-5">
                  <SectionHeader
                    icon={Target}
                    title="RPJMN — PN / PP / KP"
                    description="Kegiatan Prioritas RPJMN yang didukung proyek ini"
                  />
                  <div className="pl-12 grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Prioritas Nasional (PN)</Label>
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
                              <span className="min-w-0 truncate">
                                {pn.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Program Prioritas (PP)</Label>
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
                              <span className="min-w-0 truncate">
                                {pp.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Kegiatan Prioritas (KP)</Label>
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
                              ?.programPrioritas.find(
                                (pp) => pp.id === selectedPpId,
                              )?.kegiatanPrioritas ?? []
                          ).map((kp) => (
                            <SelectItem key={kp.id} value={kp.id}>
                              <span className="font-mono text-[10px] mr-1 shrink-0">
                                {kp.code}
                              </span>
                              <span className="min-w-0 truncate">
                                {kp.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <SectionHeader
                    icon={Target}
                    title="RENSTRA — SP/ISP, SK/ISK"
                    description="Indikator Sasaran Program & Sasaran Kegiatan"
                  />
                  <div className="pl-12 grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Sasaran Program (SP)</Label>
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
                              <span className="min-w-0 truncate">
                                {sp.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Sasaran Kegiatan (SK)</Label>
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
                              <span className="min-w-0 truncate">
                                {sk.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Indikator Sasaran Program (ISP)</Label>
                      <Select
                        value={watch("indikatorSasaranProgramId") || NONE}
                        onValueChange={(v) =>
                          setValue(
                            "indikatorSasaranProgramId",
                            v === NONE ? "" : v,
                          )
                        }
                        disabled={!selectedSpId}
                        onOpenChange={(o) => o && setIspSearch("")}
                      >
                        <SelectTrigger className="w-full h-9 text-xs">
                          <SelectValue
                            placeholder={
                              selectedSpId
                                ? "Pilih (opsional)"
                                : "Pilih SP dulu"
                            }
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
                                i.name
                                  .toLowerCase()
                                  .includes(ispSearch.toLowerCase()),
                            )
                            .map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Indikator Sasaran Kegiatan (ISK)</Label>
                      <Select
                        value={watch("indikatorSasaranKegiatanId") || NONE}
                        onValueChange={(v) =>
                          setValue(
                            "indikatorSasaranKegiatanId",
                            v === NONE ? "" : v,
                          )
                        }
                        disabled={!selectedSkId}
                        onOpenChange={(o) => o && setIskSearch("")}
                      >
                        <SelectTrigger className="w-full h-9 text-xs">
                          <SelectValue
                            placeholder={
                              selectedSkId
                                ? "Pilih (opsional)"
                                : "Pilih SK dulu"
                            }
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
                                i.name
                                  .toLowerCase()
                                  .includes(iskSearch.toLowerCase()),
                            )
                            .map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <SectionHeader
                    icon={Tags}
                    title="RENJA — Tematik & PKPN"
                    description="Tematik Renja, PKPN, dan tagging FKB/FKW/MPA"
                  />
                  <div className="pl-12 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tematik RENJA</Label>
                        <Select
                          value={watch("tematikRenjaId") || NONE}
                          onValueChange={(v) =>
                            setValue("tematikRenjaId", v === NONE ? "" : v)
                          }
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
                      <div className="space-y-2">
                        <Label>PKPN</Label>
                        <Select
                          value={watch("pkpnId") || NONE}
                          onValueChange={(v) =>
                            setValue("pkpnId", v === NONE ? "" : v)
                          }
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
                    </div>
                    <div className="flex items-center gap-5">
                      {(["fkb", "fkw", "mpa"] as const).map((key) => (
                        <label
                          key={key}
                          className="flex items-center gap-2 text-xs font-medium uppercase cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-input"
                            checked={watch(key)}
                            onChange={(e) => setValue(key, e.target.checked)}
                          />
                          {key}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <SectionHeader
                    icon={Tags}
                    title="Tagging Dinamis"
                    description="Pilih dari master data — bisa lebih dari satu"
                  />
                  <div className="pl-12 space-y-3">
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
                </div>
              </TabsContent>

              {/* === TAB 6: DOKUMEN & CATATAN === */}
              <TabsContent value="dokumen" className="space-y-6">
                <div className="space-y-5">
                  <SectionHeader
                    icon={FileText}
                    title="Dokumen Pendukung"
                    description="Upload dokumen pendukung proyek (bisa lebih dari satu file)"
                  />
                  <div className="pl-12 space-y-3">
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
                        <Loader2 size={12} className="animate-spin" />{" "}
                        Mengupload...
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
                                setPendingFiles((prev) =>
                                  prev.filter((_, i) => i !== idx),
                                )
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
                </div>

                <div className="space-y-5">
                  <SectionHeader
                    icon={ScrollText}
                    title="Catatan"
                    description="Catatan pembina dan SSPSDA"
                  />
                  <div className="pl-12 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Catatan Pembina</Label>
                      <Textarea {...register("catatanPembina")} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Catatan SSPSDA</Label>
                      <Textarea {...register("catatanSspsda")} />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* === TAB 7: EVALUASI PROYEK === read-only, dihitung otomatis
                  & LIVE dari isian tab lain (lihat evaluasi-deteksi.ts) —
                  tidak ada checkbox manual, tidak perlu klik submit dulu. */}
              <TabsContent value="evaluasi" className="space-y-5">
                <SectionHeader
                  icon={ClipboardCheck}
                  title="Evaluasi Proyek"
                  description="Skor dihitung otomatis & langsung dari isian tab Dasar Pelaksanaan, Kriteria Teknis, dan Tagging"
                />
                <div className="pl-12 space-y-4">
                  {!roIdPreview ? (
                    <div className="rounded-xl border-2 border-dashed p-6 text-center text-muted-foreground text-xs">
                      Pilih RO di tab Pemaketan dulu — skor evaluasi mengikuti
                      kegiatan dari RO paket pertama.
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Skor Evaluasi
                        </span>
                        <span className="text-2xl font-bold text-primary flex items-center gap-2">
                          {previewLoading && (
                            <Loader2 size={16} className="animate-spin" />
                          )}
                          {preview?.skorEvaluasi
                            ? `${(preview.skorEvaluasi * 100).toFixed(1)}%`
                            : "Belum ada yang terdeteksi"}
                        </span>
                      </div>

                      {!preview || preview.items.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Belum ada kriteria yang terdeteksi terpenuhi.
                        </p>
                      ) : (
                        Object.entries(
                          preview.items.reduce<
                            Record<string, typeof preview.items>
                          >((acc, item) => {
                            (acc[item.metodeName] ??= []).push(item);
                            return acc;
                          }, {}),
                        ).map(([metode, items]) => (
                          <div key={metode} className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground">
                              {metode}
                            </p>
                            <div className="rounded-xl border divide-y">
                              {items.map((item) => (
                                <div key={item.id} className="px-3.5 py-2.5">
                                  <p className="text-xs leading-snug">
                                    {item.name}
                                  </p>
                                  {item.keterangan && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      {item.keterangan}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  )}
                </div>
              </TabsContent>
            </SheetBody>
          </Tabs>
        )}

        <SheetFooter className="flex-col items-end gap-1.5 sm:flex-row sm:items-center">
          {!isEdit && !allTabsVisited && (
            <p className="text-xs text-muted-foreground mr-auto">
              Kunjungi semua tab dulu sebelum menyimpan
            </p>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSubmit(onSubmit, onInvalid)}
            disabled={
              isSubmitting || loadingMaster || (!isEdit && !allTabsVisited)
            }
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Simpan Perubahan" : "Buat Proyek"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
