"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Package, MapPinned, Target, Tags, ScrollText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetBreadcrumb,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSearchBox,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import api from "@/lib/api";
import { RO, Komponen, Paket } from "@/types";

interface WilayahSungaiOpt {
  id: string;
  name: string;
}
interface PkpnOpt {
  id: string;
  name: string;
}
interface TematikOpt {
  id: string;
  name: string;
}
interface KegiatanPrioritasOpt {
  id: string;
  code: string;
  name: string;
  programPrioritas: {
    code: string;
    prioritasNasional: { code: string };
  };
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

const NONE = "__NONE__"; // Radix Select tidak boleh punya SelectItem value=""

const schema = z.object({
  // kodePaket sengaja tidak ada di sini — digenerate otomatis backend.
  name: z.string().min(1, "Nama paket wajib diisi"),
  roId: z.string().min(1, "RO wajib dipilih"),
  komponenId: z.string().optional(),
  jenis: z.enum(["FISIK", "NON_FISIK"]),
  masaPelaksanaan: z.enum(["SINGLE_YEAR", "MULTI_YEAR"]),
  dokLingStatus: z.string().optional(),
  catatanPembina: z.string().optional(),
  catatanSspsda: z.string().optional(),
  pkpnId: z.string().optional(),
  indikatorSasaranProgramId: z.string().optional(),
  indikatorSasaranKegiatanId: z.string().optional(),
  indikatorRoId: z.string().optional(),
  tematikRenjaId: z.string().optional(),
  fkb: z.boolean(),
  fkw: z.boolean(),
  mpa: z.boolean(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  planningId: string;
  editData?: Paket | null;
  projectName?: string;
  onNavigateToList?: () => void;
}

export function PaketFormDialog({
  open,
  onClose,
  onSuccess,
  planningId,
  editData,
  projectName,
  onNavigateToList,
}: Props) {
  const isEdit = !!editData;
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [roList, setROList] = useState<RO[]>([]);
  const [komponenList, setKomponenList] = useState<Komponen[]>([]);

  // Teks pencarian per dropdown yang berpotensi > 20 opsi.
  const [roSearch, setRoSearch] = useState("");
  const [komponenSearch, setKomponenSearch] = useState("");
  const [ispSearch, setIspSearch] = useState("");
  const [iskSearch, setIskSearch] = useState("");
  const [indikatorRoSearch, setIndikatorRoSearch] = useState("");
  const [pkpnList, setPkpnList] = useState<PkpnOpt[]>([]);
  const [tematikList, setTematikList] = useState<TematikOpt[]>([]);
  const [sasaranProgramList, setSasaranProgramList] = useState<
    SasaranProgramOpt[]
  >([]);
  const [sasaranKegiatanList, setSasaranKegiatanList] = useState<
    SasaranKegiatanOpt[]
  >([]);

  // Filter cascade nomenklatur (Program > Kegiatan > KRO). State lokal, bukan
  // field form — cuma mempersempit daftar RO.
  const [filterProgramId, setFilterProgramId] = useState("");
  const [filterKegiatanId, setFilterKegiatanId] = useState("");
  const [filterKroId, setFilterKroId] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      jenis: "FISIK",
      masaPelaksanaan: "SINGLE_YEAR",
      fkb: false,
      fkw: false,
      mpa: false,
    },
  });

  useEffect(() => {
    if (!open) return;
    setLoadingMaster(true);
    Promise.all([
      api.get("/master/ro"),
      api.get("/master/komponen"),
      api.get("/master/pkpn"),
      api.get("/master/tematik-renja"),
      api.get("/master/sasaran-program"),
      api.get("/master/sasaran-kegiatan"),
    ])
      .then(([ro, komponen, pkpn, tematik, sp, sk]) => {
        setROList(ro.data);
        setKomponenList(komponen.data);
        setPkpnList(pkpn.data);
        setTematikList(tematik.data);
        setSasaranProgramList(sp.data);
        setSasaranKegiatanList(sk.data);
      })
      .finally(() => setLoadingMaster(false));
  }, [open]);

  useEffect(() => {
    if (editData) {
      reset({
        name: editData.name,
        roId: editData.roId,
        komponenId: editData.komponenId || "",
        jenis: editData.jenis,
        masaPelaksanaan: editData.masaPelaksanaan,
        dokLingStatus: editData.dokLingStatus || "",
        catatanPembina: editData.catatanPembina || "",
        catatanSspsda: editData.catatanSspsda || "",
        pkpnId: editData.pkpnId || "",
        indikatorSasaranProgramId: editData.indikatorSasaranProgramId || "",
        indikatorSasaranKegiatanId: editData.indikatorSasaranKegiatanId || "",
        indikatorRoId: editData.indikatorRoId || "",
        tematikRenjaId: editData.tematikRenjaId || "",
        fkb: editData.fkb,
        fkw: editData.fkw,
        mpa: editData.mpa,
      });
      // Pra-isi cascade dari RO paket yang diedit.
      setFilterProgramId(editData.ro.kro.kegiatan.program.id);
      setFilterKegiatanId(editData.ro.kro.kegiatan.id);
      setFilterKroId(editData.ro.kro.id);
    } else {
      reset({
        jenis: "FISIK",
        masaPelaksanaan: "SINGLE_YEAR",
        fkb: false,
        fkw: false,
        mpa: false,
      });
      setFilterProgramId("");
      setFilterKegiatanId("");
      setFilterKroId("");
    }
  }, [editData, open]);

  const selectedRoId = watch("roId");
  const selectedRO = useMemo(
    () => roList.find((r) => r.id === selectedRoId),
    [roList, selectedRoId],
  );

  // Reset field turunan RO kalau RO diganti ke RO lain (bukan saat load awal edit)
  const handleRoChange = (roId: string) => {
    setValue("roId", roId);
    setValue("komponenId", "");
    setValue("indikatorRoId", "");
    setValue("indikatorSasaranProgramId", "");
    setValue("indikatorSasaranKegiatanId", "");
  };

  // Cascade nomenklatur: Program > Kegiatan > KRO > RO. Opsi diturunkan dari
  // roList (yang sudah bawa r.kro.kegiatan.program lengkap); field yang
  // disimpan tetap roId. State filter-nya di-declare di atas.
  const byCode = <T extends { code: string }>(a: T, b: T) =>
    a.code.localeCompare(b.code);

  const programOptions = useMemo(() => {
    const m = new Map<string, RO["kro"]["kegiatan"]["program"]>();
    for (const r of roList) m.set(r.kro.kegiatan.program.id, r.kro.kegiatan.program);
    return [...m.values()].sort(byCode);
  }, [roList]);

  const kegiatanOptions = useMemo(() => {
    const m = new Map<string, RO["kro"]["kegiatan"]>();
    for (const r of roList) {
      if (filterProgramId && r.kro.kegiatan.program.id !== filterProgramId) continue;
      m.set(r.kro.kegiatan.id, r.kro.kegiatan);
    }
    return [...m.values()].sort(byCode);
  }, [roList, filterProgramId]);

  const kroOptions = useMemo(() => {
    const m = new Map<string, RO["kro"]>();
    for (const r of roList) {
      if (filterProgramId && r.kro.kegiatan.program.id !== filterProgramId) continue;
      if (filterKegiatanId && r.kro.kegiatan.id !== filterKegiatanId) continue;
      m.set(r.kro.id, r.kro);
    }
    return [...m.values()].sort(byCode);
  }, [roList, filterProgramId, filterKegiatanId]);

  const roOptions = useMemo(
    () =>
      roList.filter(
        (r) =>
          (!filterProgramId || r.kro.kegiatan.program.id === filterProgramId) &&
          (!filterKegiatanId || r.kro.kegiatan.id === filterKegiatanId) &&
          (!filterKroId || r.kro.id === filterKroId),
      ),
    [roList, filterProgramId, filterKegiatanId, filterKroId],
  );

  const pickProgram = (id: string) => {
    setFilterProgramId(id);
    setFilterKegiatanId("");
    setFilterKroId("");
    handleRoChange("");
  };
  const pickKegiatan = (id: string) => {
    setFilterKegiatanId(id);
    setFilterKroId("");
    handleRoChange("");
  };
  const pickKro = (id: string) => {
    setFilterKroId(id);
    handleRoChange("");
  };

  const komponenOptions = useMemo(
    () => komponenList.filter((k) => k.roId === selectedRoId),
    [komponenList, selectedRoId],
  );
  const indikatorRoOptions = selectedRO?.indikatorRO ?? [];
  const ispOptions = useMemo(() => {
    const programId = selectedRO?.kro.kegiatan.program.id;
    if (!programId) return [];
    return sasaranProgramList
      .filter((sp) => sp.programId === programId)
      .flatMap((sp) =>
        sp.indikator.map((i) => ({ ...i, spName: sp.name })),
      );
  }, [sasaranProgramList, selectedRO]);
  const iskOptions = useMemo(() => {
    const kegiatanId = selectedRO?.kro.kegiatan.id;
    if (!kegiatanId) return [];
    return sasaranKegiatanList
      .filter((sk) => sk.kegiatanId === kegiatanId)
      .flatMap((sk) => sk.indikator.map((i) => ({ ...i, skName: sk.name })));
  }, [sasaranKegiatanList, selectedRO]);

  const onSubmit = async (data: FormData) => {
    const payload = {
      ...data,
      komponenId: data.komponenId || undefined,
      dokLingStatus: data.dokLingStatus || undefined,
      catatanPembina: data.catatanPembina || undefined,
      catatanSspsda: data.catatanSspsda || undefined,
      pkpnId: data.pkpnId || undefined,
      indikatorSasaranProgramId: data.indikatorSasaranProgramId || undefined,
      indikatorSasaranKegiatanId: data.indikatorSasaranKegiatanId || undefined,
      indikatorRoId: data.indikatorRoId || undefined,
      tematikRenjaId: data.tematikRenjaId || undefined,
    };
    try {
      if (isEdit) {
        await api.patch(`/paket/${editData!.id}`, payload);
        toast.success("Paket berhasil diperbarui");
      } else {
        await api.post("/paket", { ...payload, planningId });
        toast.success("Paket berhasil ditambahkan");
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Terjadi kesalahan");
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent
        layer="2"
        className="!p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="gap-1.5">
          <SheetBreadcrumb
            items={[
              { label: "Daftar Proyek", onClick: onNavigateToList },
              { label: projectName || "Proyek", onClick: onClose },
              { label: isEdit ? "Edit Paket" : "Tambah Paket" },
            ]}
          />
          <SheetTitle className="text-base leading-snug">
            {isEdit ? "Edit Paket" : "Tambah Paket Baru"}
          </SheetTitle>
        </SheetHeader>

        <SheetBody className="px-5 py-5 space-y-6">
          {loadingMaster ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* === IDENTITAS === */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <Package size={13} /> Identitas Paket
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">
                    Nama Paket <span className="text-destructive">*</span>
                  </Label>
                  <Input className="h-9 text-xs" {...register("name")} />
                  {errors.name && (
                    <p className="text-destructive text-xs">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                {/* Kode Paket digenerate otomatis saat paket dibuat — cuma
                    ditampilkan (read-only) di mode edit, tidak bisa diisi
                    manual. */}
                {isEdit && editData?.kodePaket && (
                  <div className="space-y-2">
                    <Label className="text-xs">Kode Paket</Label>
                    <Input
                      className="h-9 text-xs bg-muted"
                      value={editData.kodePaket}
                      readOnly
                    />
                  </div>
                )}

                {/* Cascade nomenklatur: Program > Kegiatan > KRO mempersempit
                    daftar RO. Opsional — boleh langsung pilih RO. */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Program</Label>
                    <Select
                      value={filterProgramId || NONE}
                      onValueChange={(v) => pickProgram(v === NONE ? "" : v)}
                    >
                      <SelectTrigger className="w-full h-9 text-xs">
                        <SelectValue placeholder="Semua program" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Semua program</SelectItem>
                        {programOptions.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.code} — {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Kegiatan</Label>
                    <Select
                      value={filterKegiatanId || NONE}
                      onValueChange={(v) => pickKegiatan(v === NONE ? "" : v)}
                    >
                      <SelectTrigger className="w-full h-9 text-xs">
                        <SelectValue placeholder="Semua kegiatan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Semua kegiatan</SelectItem>
                        {kegiatanOptions.map((k) => (
                          <SelectItem key={k.id} value={k.id}>
                            {k.code} — {k.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">KRO</Label>
                    <Select
                      value={filterKroId || NONE}
                      onValueChange={(v) => pickKro(v === NONE ? "" : v)}
                    >
                      <SelectTrigger className="w-full h-9 text-xs">
                        <SelectValue placeholder="Semua KRO" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Semua KRO</SelectItem>
                        {kroOptions.map((k) => (
                          <SelectItem key={k.id} value={k.id}>
                            {k.code} — {k.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">
                    RO (Rincian Output){" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedRoId}
                    onValueChange={handleRoChange}
                    onOpenChange={(o) => o && setRoSearch("")}
                  >
                    <SelectTrigger className="w-full h-9 text-xs">
                      <SelectValue placeholder="Pilih RO" />
                    </SelectTrigger>
                    <SelectContent>
                      {roOptions.length > 20 && (
                        <SelectSearchBox
                          value={roSearch}
                          onChange={setRoSearch}
                          placeholder="Cari RO..."
                        />
                      )}
                      {roOptions
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
                              {r.kro.kegiatan.code} · {r.kro.code} · {r.code}
                            </span>
                            <span className="text-muted-foreground ml-2 text-xs">
                              — {r.name}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {errors.roId && (
                    <p className="text-destructive text-xs">
                      {errors.roId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Komponen</Label>
                  <Select
                    value={watch("komponenId") || NONE}
                    onValueChange={(v) =>
                      setValue("komponenId", v === NONE ? "" : v)
                    }
                    disabled={!selectedRoId}
                    onOpenChange={(o) => o && setKomponenSearch("")}
                  >
                    <SelectTrigger className="w-full h-9 text-xs">
                      <SelectValue
                        placeholder={
                          selectedRoId
                            ? "Pilih komponen (opsional)"
                            : "Pilih RO dulu"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— Tidak ada —</SelectItem>
                      {komponenOptions.length > 20 && (
                        <SelectSearchBox
                          value={komponenSearch}
                          onChange={setKomponenSearch}
                          placeholder="Cari komponen..."
                        />
                      )}
                      {komponenOptions
                        .filter(
                          (k) =>
                            !komponenSearch ||
                            `${k.code} ${k.name}`
                              .toLowerCase()
                              .includes(komponenSearch.toLowerCase()),
                        )
                        .map((k) => (
                          <SelectItem key={k.id} value={k.id}>
                            {k.code} — {k.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Jenis Paket</Label>
                    <Select
                      value={watch("jenis")}
                      onValueChange={(v) => setValue("jenis", v as any)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FISIK">Fisik</SelectItem>
                        <SelectItem value="NON_FISIK">Non-Fisik</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Masa Pelaksanaan</Label>
                    <Select
                      value={watch("masaPelaksanaan")}
                      onValueChange={(v) =>
                        setValue("masaPelaksanaan", v as any)
                      }
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SINGLE_YEAR">
                          Single Year
                        </SelectItem>
                        <SelectItem value="MULTI_YEAR">Multi Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* === DOKUMEN LINGKUNGAN ===
                  Wilayah Sungai pindah ke form Proyek (bagian "Kesesuaian
                  Proyek") — 1 proyek 1 wilayah sungai, bukan per paket. */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <MapPinned size={13} /> Dokumen Lingkungan
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Dokumen Lingkungan</Label>
                  <Input
                    className="h-9 text-xs"
                    placeholder="Contoh: Sesuai / Belum Ada"
                    {...register("dokLingStatus")}
                  />
                </div>
              </div>

              {/* === INDIKATOR RENJA — default terbuka & label eksplisit
                  supaya tidak tersembunyi; sebelumnya tertutup dengan label
                  generik dan pengguna tidak sadar ini bisa diklik untuk
                  mengisi PN/PP/KP/PKPN/SP/ISP/SK/ISK/IRO. === */}
              <Accordion type="single" collapsible defaultValue="indikator">
                <AccordionItem value="indikator">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      <Target size={13} /> Indikator RENJA — PKPN, SP/ISP,
                      SK/ISK, IRO (opsional)
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      {/* PN/PP/KP pindah ke form Proyek — 1 proyek = 1
                          Kegiatan Prioritas, bukan per paket. */}
                      <div className="space-y-2">
                        <Label className="text-xs">PKPN</Label>
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

                      <div className="space-y-2">
                        <Label className="text-xs">
                          Indikator Sasaran Program (ISP)
                        </Label>
                        <Select
                          value={watch("indikatorSasaranProgramId") || NONE}
                          onValueChange={(v) =>
                            setValue(
                              "indikatorSasaranProgramId",
                              v === NONE ? "" : v,
                            )
                          }
                          disabled={!selectedRoId}
                          onOpenChange={(o) => o && setIspSearch("")}
                        >
                          <SelectTrigger className="w-full h-9 text-xs">
                            <SelectValue
                              placeholder={
                                selectedRoId
                                  ? "Pilih (opsional)"
                                  : "Pilih RO dulu"
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
                        <Label className="text-xs">
                          Indikator Sasaran Kegiatan (ISK)
                        </Label>
                        <Select
                          value={watch("indikatorSasaranKegiatanId") || NONE}
                          onValueChange={(v) =>
                            setValue(
                              "indikatorSasaranKegiatanId",
                              v === NONE ? "" : v,
                            )
                          }
                          disabled={!selectedRoId}
                          onOpenChange={(o) => o && setIskSearch("")}
                        >
                          <SelectTrigger className="w-full h-9 text-xs">
                            <SelectValue
                              placeholder={
                                selectedRoId
                                  ? "Pilih (opsional)"
                                  : "Pilih RO dulu"
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

                      <div className="space-y-2">
                        <Label className="text-xs">Indikator RO (IRO)</Label>
                        <Select
                          value={watch("indikatorRoId") || NONE}
                          onValueChange={(v) =>
                            setValue("indikatorRoId", v === NONE ? "" : v)
                          }
                          disabled={!selectedRoId}
                          onOpenChange={(o) => o && setIndikatorRoSearch("")}
                        >
                          <SelectTrigger className="w-full h-9 text-xs">
                            <SelectValue
                              placeholder={
                                selectedRoId
                                  ? "Pilih (opsional)"
                                  : "Pilih RO dulu"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>— Tidak ada —</SelectItem>
                            {indikatorRoOptions.length > 20 && (
                              <SelectSearchBox
                                value={indikatorRoSearch}
                                onChange={setIndikatorRoSearch}
                                placeholder="Cari indikator RO..."
                              />
                            )}
                            {indikatorRoOptions
                              .filter(
                                (i) =>
                                  !indikatorRoSearch ||
                                  i.nama
                                    .toLowerCase()
                                    .includes(indikatorRoSearch.toLowerCase()),
                              )
                              .map((i) => (
                                <SelectItem key={i.id} value={i.id}>
                                  {i.nama} ({i.satuan})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Tematik RENJA</Label>
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
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* === TAGGING === */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <Tags size={13} /> Tagging
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

              {/* === CATATAN === */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <ScrollText size={13} /> Catatan
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Catatan Pembina</Label>
                  <Input
                    className="h-9 text-xs"
                    {...register("catatanPembina")}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Catatan SSPSDA</Label>
                  <Input
                    className="h-9 text-xs"
                    {...register("catatanSspsda")}
                  />
                </div>
              </div>

              {/* === SKOR (read-only, diisi sistem nanti) === */}
              {isEdit && (
                <div className="rounded-lg border p-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Skor Prioritas
                  </span>
                  <span className="text-sm font-semibold">
                    {editData?.score ?? "Belum dinilai"}
                  </span>
                </div>
              )}
            </>
          )}
        </SheetBody>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting || loadingMaster}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Simpan Perubahan" : "Tambah Paket"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
