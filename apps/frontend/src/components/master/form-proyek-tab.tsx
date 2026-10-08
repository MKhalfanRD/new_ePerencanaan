"use client";

import { useEffect, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { Plus, Trash2, Copy, Loader2, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import {
  isItemWide,
  WIDTH_LABEL,
  TAB_DEFAULT_DESCRIPTIONS,
} from "@/lib/form-item-width";
import type { TabKey } from "@/lib/form-item-width";
import {
  ProyekFormDialog,
  BAKU_ITEM_KEYS,
  ALWAYS_REQUIRED_BAKU_KEYS,
  type ProyekFormAdminHandlers,
  type FormItemNode,
  type FormTabNode,
} from "@/components/proyek/proyek-form-dialog";
import {
  OPTION_SOURCES,
  SUB_LABEL_DEFAULTS,
  sourceRowsFor,
  useSourceData,
} from "@/lib/option-sources";
import { SOURCE_EDITORS } from "@/lib/option-source-editors";
import { nilaiKondisi } from "@/lib/form-condition";

const MANUAL = "__MANUAL__";
// Field paket bawaan yang pilihannya bertingkat dari Nomenklatur (bukan
// daftar polos OPTION_SOURCES) — panel cuma menunjukkan sumbernya.
const NOMENKLATUR_SOURCE: Record<string, { label: string; info: string }> = {
  paketRo: {
    label: "RO",
    info: "Pilihan mengikuti kegiatan proyek; KRO ikut dari RO yang dipilih.",
  },
  paketKomponen: { label: "Komponen", info: "Pilihan mengikuti RO yang dipilih." },
  paketIndikatorRo: { label: "Indikator RO", info: "Pilihan mengikuti RO yang dipilih." },
};
// Field bawaan berpilihan tetap sistem (enum) — value tidak bisa diubah,
// label & skor bisa.
const ENUM_ITEM_KEYS = new Set([
  "statusStudiLayak",
  "statusDed",
  "statusDokumenLingkungan",
  "statusLarap",
  "kewenangan",
  "kebutuhanTanah",
]);

/**
 * Kanvas "Form Proyek" — admin aktif/nonaktifkan bagian form pembuatan
 * Proyek per Kegiatan. TIDAK render tab/field-nya sendiri lagi — kanvas ini
 * cuma nyuplai handler CRUD (toggle/drag/edit/hapus/tambah) ke
 * `ProyekFormDialog` (adminMode), yang JUGA dipakai form "Buat Proyek"
 * asli. Jadi tampilan kanvas admin & form user dijamin 100% identik
 * (satu komponen, satu markup) tanpa 2 file JSX terpisah yang bisa desync.
 */

const TAB_NOTES: Partial<Record<TabKey, string>> = {
  pemaketan:
    "Field di sini diisi per paket (form Buat Proyek & dialog Tambah/Edit Paket). Nama Paket, RO, Jenis & Masa Pelaksanaan selalu tampil. Blok alokasi tahun berjalan selalu tampil di bawah field paket. Field upload tidak tersedia untuk paket.",
  evaluasi:
    "Tab ini menampilkan hasil hitung skor otomatis dari tab Dasar Pelaksanaan, Kriteria Teknis, Tagging, Valuasi, dan Kinerja — tidak ada yang perlu diatur di sini.",
};

const FIELD_TYPE_LABEL: Record<string, string> = {
  TEXT: "Teks",
  NUMBER: "Angka",
  DATE: "Tanggal",
  DROPDOWN: "Dropdown",
  CHECKBOX: "Centang",
  FIELDBOX: "Teks Panjang",
  UPLOAD: "Upload File",
};
const FIELD_TYPE_OPTIONS = Object.keys(FIELD_TYPE_LABEL) as Array<
  keyof typeof FIELD_TYPE_LABEL
>;

interface Kegiatan {
  id: string;
  name: string;
  code: string;
}

/** Saklar bergaya switch — dipakai di header tab & section. */
function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-emerald-500" : "bg-muted-foreground/25",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[19px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}


type DeleteTarget = {
  type: "section" | "item" | "option";
  id: string;
  label: string;
  // Jumlah kolom tambahan yang ikut terhapus (item/pilihan).
  turunan?: number;
};

export function FormProyekTab({
  initialKegiatanId,
}: {
  initialKegiatanId?: string;
} = {}) {
  const [kegiatanList, setKegiatanList] = useState<Kegiatan[]>([]);
  const [kegiatanId, setKegiatanId] = useState("");
  // "atur" = kanvas pengaturan; "isi" = coba isi form seperti user.
  const [mode, setMode] = useState<"atur" | "isi">("atur");
  // Tab yang sedang dibuka di kanvas (kunci template) & bagian terpilih —
  // dipakai panel kanan saat belum ada field dipilih.
  const [activeTabKey, setActiveTabKey] = useState("identitas");
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  // Mode admin tidak simpan salinan template sendiri — ProyekFormDialog
  // satu-satunya sumber datanya. Naikkan ini tiap kali mutasi berhasil
  // supaya dialog fetch ulang.
  const [refreshToken, setRefreshToken] = useState(0);
  const bump = () => setRefreshToken((t) => t + 1);

  // Pengaturan field dibuka lewat dialog terpisah (bukan expand inline) —
  // expand inline bikin grid reflow & field lain kelihatan "kegeser"/ambil
  // alih ruang tiap kali satu field diedit.
  const [editItemId, setEditItemId] = useState<string | null>(null);

  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneSource, setCloneSource] = useState("");
  const [cloning, setCloning] = useState(false);

  const [addSectionTabId, setAddSectionTabId] = useState<string | null>(null);
  const [newSectionLabel, setNewSectionLabel] = useState("");
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemType, setNewItemType] =
    useState<(typeof FIELD_TYPE_OPTIONS)[number]>("CHECKBOX");
  const [newItemRequired, setNewItemRequired] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState<Record<string, string>>(
    {},
  );
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [saving, setSaving] = useState(false);

  // Baris semua tabel master (utk skor per baris di "Sumber pilihan") &
  // dialog "Kelola data …" yang membuka editor master-nya. masterToken naik
  // tiap dialog ditutup supaya daftar di kanvas & preview form ikut baru.
  const [masterToken, setMasterToken] = useState(0);
  const sourceData = useSourceData(Object.keys(OPTION_SOURCES), masterToken);
  const [masterDialog, setMasterDialog] = useState<string | null>(null);
  // Seluruh tab template kegiatan ini — daftar field pemicu "Tampil jika".
  const [templateTabs, setTemplateTabs] = useState<FormTabNode[]>([]);
  const [templateKegiatanId, setTemplateKegiatanId] = useState("");
  useEffect(() => {
    if (!kegiatanId) return;
    api
      .get(`/master/form-template/${kegiatanId}`)
      .then((res) => setTemplateTabs(res.data.tabs))
      .catch(() => setTemplateTabs([]))
      .finally(() => setTemplateKegiatanId(kegiatanId));
  }, [kegiatanId, refreshToken]);
  // Template kegiatan terpilih sudah termuat & benar-benar kosong.
  const templateKosong =
    templateKegiatanId === kegiatanId &&
    templateTabs.every((t) => t.sections.length === 0);
  const [newItemSource, setNewItemSource] = useState<string | null>(null);
  // Dialog "Tambah field" — juga dipakai "+ Kolom tambahan" (parent terisi).
  const [fieldDialog, setFieldDialog] = useState<{
    sectionId: string;
    tabKey: string;
    parent?: { item: FormItemNode; value: string; label: string };
  } | null>(null);
  const [lanjutanOpen, setLanjutanOpen] = useState(false);
  // Status simpan otomatis di kepala kanvas.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const simpan = async (kerja: () => Promise<unknown>, gagal = "Gagal menyimpan") => {
    setSaveState("saving");
    try {
      await kerja();
      setSaveState("saved");
      bump();
    } catch (err: any) {
      setSaveState("error");
      toast.error(err.response?.data?.message || gagal);
    }
  };

  useEffect(() => {
    api.get("/master/kegiatan").then((res) => {
      setKegiatanList(res.data);
      if (res.data.length)
        setKegiatanId((prev) => prev || initialKegiatanId || res.data[0].id);
    });
  }, []);

  const patchTab = (tabId: string, data: Record<string, unknown>) =>
    simpan(() => api.patch(`/master/form-tab/${tabId}`, data));

  const submitAddSection = async () => {
    if (!addSectionTabId || !newSectionLabel.trim()) return;
    setSaving(true);
    try {
      await api.post("/master/form-section", {
        tabId: addSectionTabId,
        key: newSectionLabel.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-"),
        label: newSectionLabel.trim(),
      });
      setAddSectionTabId(null);
      setNewSectionLabel("");
      bump();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menambah bagian");
    } finally {
      setSaving(false);
    }
  };
  const patchSection = (sectionId: string, data: Record<string, unknown>) =>
    simpan(() => api.patch(`/master/form-section/${sectionId}`, data));

  const submitAddItem = async () => {
    if (!fieldDialog || !newItemLabel.trim()) return;
    const { sectionId, parent } = fieldDialog;
    const pilihan = newItemType === "DROPDOWN" || newItemType === "CHECKBOX";
    setSaving(true);
    setSaveState("saving");
    try {
      const res = await api.post("/master/form-item", {
        sectionId,
        key:
          newItemLabel.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
          "field",
        label: newItemLabel.trim(),
        fieldType: newItemType,
        optionSource: pilihan ? newItemSource : null,
        required: newItemRequired,
        // Kolom tambahan: muncul hanya saat pilihan induknya dipilih.
        conditionItemId: parent?.item.key,
        conditionValue: parent ? JSON.stringify([parent.value]) : undefined,
      });
      setFieldDialog(null);
      setEditItemId(res.data.id);
      setSaveState("saved");
      bump();
    } catch (err: any) {
      setSaveState("error");
      toast.error(err.response?.data?.message || "Gagal menambah field");
    } finally {
      setSaving(false);
    }
  };
  const patchItem = (itemId: string, data: Record<string, unknown>) =>
    simpan(() => api.patch(`/master/form-item/${itemId}`, data));

  const submitAddOption = async (itemId: string) => {
    const label = (newOptionLabel[itemId] || "").trim();
    if (!label) return;
    try {
      await api.post("/master/form-item-option", {
        itemId,
        value: label,
        label,
      });
      setNewOptionLabel((prev) => ({ ...prev, [itemId]: "" }));
      bump();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menambah opsi");
    }
  };
  const patchOption = (optionId: string, data: Record<string, unknown>) =>
    simpan(() => api.patch(`/master/form-item-option/${optionId}`, data));

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const path =
        deleteTarget.type === "section"
          ? "form-section"
          : deleteTarget.type === "item"
            ? "form-item"
            : "form-item-option";
      await api.delete(`/master/${path}/${deleteTarget.id}`);
      if (deleteTarget.type === "item" && deleteTarget.id === editItemId)
        setEditItemId(null);
      toast.success("Berhasil dihapus");
      setDeleteTarget(null);
      bump();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus");
    } finally {
      setSaving(false);
    }
  };

  const doClone = async () => {
    if (!cloneSource) return;
    setCloning(true);
    try {
      await api.post(
        `/master/form-template/${kegiatanId}/clone-from/${cloneSource}`,
      );
      toast.success("Template berhasil disalin");
      setCloneOpen(false);
      bump();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyalin template");
    } finally {
      setCloning(false);
    }
  };


  // Nama tab sudah tampil di strip tab; pengaturan tab ada di panel kanan
  // (tampil saat tidak ada field dipilih). Di sini cuma tanda tab tersembunyi.
  const renderAdminTabHeader: ProyekFormAdminHandlers["tabHeader"] = (
    _tabKey,
    tab,
  ) =>
    tab?.isActive === false ? (
      <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
        Tab ini sedang disembunyikan dari form.
      </p>
    ) : null;

  const renderAdminNote: ProyekFormAdminHandlers["note"] = (tabKey) => (
    <p className="text-xs text-muted-foreground italic px-1 border-l-2 border-slate-300 py-1">
      {TAB_NOTES[tabKey] ?? "Tidak ada pengaturan tambahan untuk bagian ini."}
    </p>
  );

  // ===== Sumber pilihan (manual / tabel master) — lihat lib/option-sources =====
  // Simpan skor 1 pilihan. Opsi utk baris master dibuat saat skornya pertama
  // kali diisi (value = nilai yang disimpan field).
  const saveOptionScore = async (
    item: FormItemNode,
    row: { value: string; label: string },
    opt: FormItemNode["options"][number] | undefined,
    v: number | null,
  ) => {
    if (opt) {
      if (v !== opt.score) patchOption(opt.id, { score: v });
      return;
    }
    if (v == null) return;
    try {
      await api.post("/master/form-item-option", {
        itemId: item.id,
        value: row.value,
        label: row.label,
        score: v,
      });
      bump();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyimpan skor");
    }
  };

  const scoreInput = (
    defaultValue: number | null | undefined,
    onSave: (v: number | null) => void,
  ) => (
    <Input
      type="number"
      placeholder="skor"
      className="h-7 w-16 text-[11px] shrink-0"
      defaultValue={defaultValue ?? ""}
      onBlur={(e) => onSave(e.target.value ? Number(e.target.value) : null)}
    />
  );

  // Select "Sumber pilihan": field bawaan terkunci ke master aslinya (kolom
  // FK di tabel Proyek); field custom bebas Manual / master mana pun.
  const sourceSelect = (
    value: string | null | undefined,
    onChange: (v: string | null) => void,
    locked: boolean,
  ) => (
    <Select
      value={value ?? MANUAL}
      onValueChange={(v) => onChange(v === MANUAL ? null : v)}
      disabled={locked}
    >
      <SelectTrigger className="h-8 text-xs bg-white">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={MANUAL}>Manual (ketik pilihan sendiri)</SelectItem>
        {Object.entries(OPTION_SOURCES).map(([k, d]) => (
          <SelectItem key={k} value={k}>
            Master: {d.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // Label bagian dalam field gabungan (mis. PN/PP/KP) — kosong = default.
  const renderSubLabels = (item: FormItemNode) => {
    const defaults = SUB_LABEL_DEFAULTS[item.key];
    if (!defaults) return null;
    return (
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">
          Label bagian di dalam field
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(defaults).map(([part, def]) => (
            <Input
              key={part}
              className="h-8 text-xs"
              placeholder={def}
              defaultValue={item.subLabels?.[part] ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === (item.subLabels?.[part] ?? "")) return;
                const next = { ...(item.subLabels ?? {}) };
                if (v) next[part] = v;
                else delete next[part];
                patchItem(item.id, { subLabels: next });
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  // ===== "Tampil jika" — field muncul hanya kalau field pemicu bernilai
  // salah satu pilihan yang dicentang (lihat lib/form-condition.ts). =====
  const pilihanItem = (it: FormItemNode): { value: string; label: string }[] => {
    if (it.optionSource)
      return sourceRowsFor(it.key, it.optionSource, sourceData[it.optionSource] ?? []);
    if (it.options.length)
      return it.options
        .filter((o) => o.isActive !== false)
        .map((o) => ({ value: o.value, label: o.label }));
    if (it.fieldType === "CHECKBOX") return [{ value: "true", label: "Dicentang" }];
    return [];
  };


  // ===== Panel kanan: pengaturan 1 field terpilih (klik kartu di kiri) =====
  const lokasiItem = (id: string | null) => {
    if (!id) return null;
    for (const tab of templateTabs)
      for (const section of tab.sections) {
        const item = section.items.find((i) => i.id === id);
        if (item) return { tab, section, item };
      }
    return null;
  };
  // Kolom tambahan = field di section yang sama yang muncul dari pilihan
  // field ini (conditionItemId = key field ini).
  const kolomTambahanDari = (
    section: FormTabNode["sections"][number],
    item: FormItemNode,
  ) => section.items.filter((c) => c.conditionItemId === item.key);
  const indukDari = (
    section: FormTabNode["sections"][number],
    item: FormItemNode,
  ) =>
    item.conditionItemId
      ? (section.items.find((p) => p.key === item.conditionItemId) ?? null)
      : null;
  const jumlahTurunan = (
    section: FormTabNode["sections"][number],
    item: FormItemNode,
  ): number =>
    kolomTambahanDari(section, item).reduce(
      (n, c) => n + 1 + jumlahTurunan(section, c),
      0,
    );


  const labelSkor = (item: FormItemNode) =>
    item.fieldType === "UPLOAD"
      ? "Skor kalau file diunggah"
      : item.fieldType === "CHECKBOX"
        ? "Skor kalau dicentang"
        : "Skor kalau diisi";

  const bukaTambahField = (
    sectionId: string,
    tabKey: string,
    parent?: { item: FormItemNode; value: string; label: string },
  ) => {
    setNewItemLabel("");
    setNewItemType("TEXT");
    setNewItemSource(null);
    setNewItemRequired(false);
    setFieldDialog({ sectionId, tabKey, parent });
  };

  // ===== Panel kanan saat belum ada field dipilih: atur tab / bagian =====
  const pilihField = (id: string) => {
    setSelectedSectionId(null);
    setEditItemId(id);
  };

  const pindahUrutan = (
    list: { id: string }[],
    id: string,
    arah: -1 | 1,
    endpoint: "form-section" | "form-item",
  ) => {
    const i = list.findIndex((x) => x.id === id);
    const j = i + arah;
    if (i < 0 || j < 0 || j >= list.length) return;
    const baru = arrayMove(list, i, j);
    simpan(
      () =>
        Promise.all(
          baru.map((x, idx) => api.patch(`/master/${endpoint}/${x.id}`, { order: idx })),
        ),
      "Gagal menyimpan urutan",
    );
  };

  const tombolUrutan = (onNaik: (() => void) | null, onTurun: (() => void) | null) => (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm font-normal">Urutan</Label>
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!onNaik} onClick={onNaik ?? undefined}>
          ↑ Naik
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!onTurun} onClick={onTurun ?? undefined}>
          ↓ Turun
        </Button>
      </div>
    </div>
  );

  const renderTabPanel = () => {
    const tab = templateTabs.find((t) => t.key === activeTabKey);
    if (!tab)
      return <p className="text-sm text-muted-foreground">Pilih tab di kiri.</p>;
    const tk = tab.key as TabKey;
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <p className="text-base font-bold">Atur tab</p>
          <p className="text-xs text-muted-foreground">
            Klik field di kiri untuk mengatur field-nya.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="panel-nama-tab" className="text-xs">Nama tab</Label>
          <Input
            id="panel-nama-tab"
            key={`${tab.id}-label`}
            className="h-9 text-sm"
            defaultValue={tab.label}
            onBlur={(e) =>
              e.target.value.trim() &&
              e.target.value !== tab.label &&
              patchTab(tab.id, { label: e.target.value.trim() })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="panel-desk-tab" className="text-xs">Keterangan di bawah judul tab</Label>
          <Textarea
            id="panel-desk-tab"
            key={`${tab.id}-desc`}
            className="min-h-[64px] text-sm"
            placeholder={TAB_DEFAULT_DESCRIPTIONS[tk]}
            defaultValue={tab.description ?? ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (tab.description ?? ""))
                patchTab(tab.id, { description: v || null });
            }}
          />
        </div>
        {tab.bobot != null && (
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="panel-bobot-tab" className="text-sm font-normal">
              Bobot tab ini di skor evaluasi
            </Label>
            <div className="flex items-center gap-1.5">
              <Input
                id="panel-bobot-tab"
                key={`${tab.id}-bobot`}
                type="number"
                min={0}
                max={100}
                className="h-8 w-16 text-right text-sm"
                defaultValue={Math.round(tab.bobot * 100)}
                onBlur={(e) => {
                  const pct = Number(e.target.value);
                  const v = Math.max(0, Math.min(100, pct)) / 100;
                  if (v !== tab.bobot) patchTab(tab.id, { bobot: v });
                }}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm font-normal">Tampil di form</Label>
          <Switch
            checked={tab.isActive !== false}
            onChange={(v) => patchTab(tab.id, { isActive: v })}
            label="Tampilkan/sembunyikan tab ini"
          />
        </div>
        {TAB_NOTES[tk] && (
          <p className="rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground">
            {TAB_NOTES[tk]}
          </p>
        )}
        {tab.key !== "evaluasi" && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setAddSectionTabId(tab.id)}
          >
            <Plus size={14} className="mr-1.5" /> Tambah bagian
          </Button>
        )}
      </div>
    );
  };

  const renderSectionPanel = (sectionId: string) => {
    const tab = templateTabs.find((t) => t.sections.some((s) => s.id === sectionId));
    const section = tab?.sections.find((s) => s.id === sectionId);
    if (!tab || !section) return renderTabPanel();
    const idx = tab.sections.findIndex((s) => s.id === sectionId);
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-bold">Atur bagian</p>
            <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-[#59636e]"
            title="Tutup"
            aria-label="Tutup pengaturan"
            onClick={() => {
              setEditItemId(null);
              setSelectedSectionId(null);
            }}
          >
            <X size={16} />
          </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Bagian = kelompok field dengan judul kecil di dalam satu tab.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="panel-nama-bagian" className="text-xs">Nama bagian</Label>
          <Input
            id="panel-nama-bagian"
            key={`${section.id}-label`}
            className="h-9 text-sm"
            defaultValue={section.label}
            onBlur={(e) =>
              e.target.value.trim() &&
              e.target.value !== section.label &&
              patchSection(section.id, { label: e.target.value.trim() })
            }
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm font-normal">Tampil di form</Label>
          <Switch
            checked={section.isActive !== false}
            onChange={(v) => patchSection(section.id, { isActive: v })}
          />
        </div>
        {tombolUrutan(
          idx > 0 ? () => pindahUrutan(tab.sections, section.id, -1, "form-section") : null,
          idx < tab.sections.length - 1
            ? () => pindahUrutan(tab.sections, section.id, 1, "form-section")
            : null,
        )}
        <Button
          variant="outline"
          className="w-full border-destructive/40 text-destructive hover:bg-destructive/5"
          onClick={() =>
            setDeleteTarget({ type: "section", id: section.id, label: section.label })
          }
        >
          <Trash2 size={14} className="mr-1.5" /> Hapus bagian
        </Button>
      </div>
    );
  };

  const labelTipe = (item: FormItemNode) =>
    [
      FIELD_TYPE_LABEL[item.fieldType] ?? item.fieldType,
      item.optionSource ? "dari master" : null,
      BAKU_ITEM_KEYS.has(item.key) ? "bawaan" : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const renderPanel = () => {
    const loc = lokasiItem(editItemId);
    if (!loc)
      return selectedSectionId ? renderSectionPanel(selectedSectionId) : renderTabPanel();
    const { tab, section, item } = loc;
    const isBaku = BAKU_ITEM_KEYS.has(item.key);
    const wajibTetap = ALWAYS_REQUIRED_BAKU_KEYS.has(item.key);
    const induk = indukDari(section, item);
    const berskor = tab.bobot != null;
    const isEnum = ENUM_ITEM_KEYS.has(item.key);
    const tipePilihan = item.fieldType === "DROPDOWN" || item.fieldType === "CHECKBOX";
    const punyaPilihan = isEnum || !!item.optionSource || (!isBaku && tipePilihan);
    const k = item.id; // reset input saat ganti field

    const masterRows = item.optionSource
      ? sourceRowsFor(item.key, item.optionSource, sourceData[item.optionSource] ?? [])
      : [];
    const masterValues = new Set(masterRows.map((r) => r.value));
    const rows = item.optionSource
      ? [
          ...masterRows.map((r) => ({
            ...r,
            opt: item.options.find((o) => o.value === r.value),
            stale: false,
          })),
          ...item.options
            .filter((o) => !masterValues.has(o.value))
            .map((o) => ({ value: o.value, label: o.label, opt: o, stale: true })),
        ]
      : item.options.map((o) => ({ value: o.value, label: o.label, opt: o, stale: false }));
    const labelBisaDiubah = !item.optionSource;
    const manual = !item.optionSource && !isEnum;
    const Editor = item.optionSource ? SOURCE_EDITORS[item.optionSource] : undefined;
    const anak = kolomTambahanDari(section, item);

    return (
      <div className="space-y-5">
        <div className="space-y-1">
          {induk && (
            <button
              type="button"
              onClick={() => pilihField(induk.id)}
              className="text-xs font-medium text-primary hover:underline"
            >
              ← Kembali ke &quot;{induk.label}&quot;
            </button>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-bold">Atur field</p>
            <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-[#59636e]"
            title="Tutup"
            aria-label="Tutup pengaturan"
            onClick={() => {
              setEditItemId(null);
              setSelectedSectionId(null);
            }}
          >
            <X size={16} />
          </Button>
          </div>
        </div>

        {/* Dasar */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="panel-nama-field" className="text-xs">Nama field</Label>
            <Input
              id="panel-nama-field"
              key={`${k}-label`}
              className="h-9 text-sm"
              defaultValue={item.label}
              onBlur={(e) =>
                e.target.value.trim() &&
                e.target.value !== item.label &&
                patchItem(item.id, { label: e.target.value.trim() })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipe</Label>
            <Select
              value={item.fieldType}
              disabled={isBaku}
              onValueChange={(v) =>
                patchItem(item.id, {
                  fieldType: v,
                  ...(v !== "DROPDOWN" && v !== "CHECKBOX" ? { optionSource: null } : {}),
                })
              }
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPE_OPTIONS.filter(
                  (ft) => tab.key !== "pemaketan" || ft !== "UPLOAD",
                ).map((ft) => (
                  <SelectItem key={ft} value={ft}>
                    {FIELD_TYPE_LABEL[ft]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label className="flex-col items-start gap-0.5 text-sm font-normal">
              Wajib diisi
              <span className="block text-[11px] text-muted-foreground">
                Proyek tidak bisa disimpan kalau kosong
              </span>
            </Label>
            {wajibTetap ? (
              <span className="text-xs text-muted-foreground">Selalu wajib</span>
            ) : (
              <Switch
                checked={item.required === true}
                onChange={(v) => patchItem(item.id, { required: v })}
              />
            )}
          </div>
          {!wajibTetap &&
            (() => {
              // Bagian/tab disembunyikan -> field ikut tersembunyi; saklarnya
              // dikunci supaya tidak tampak "menyala tapi tidak tampil".
              const induKTersembunyi =
                tab.isActive === false
                  ? `tab "${tab.label}"`
                  : section.isActive === false
                    ? `bagian "${section.label}"`
                    : null;
              return (
                <div className="flex items-center justify-between gap-3">
                  <Label className="flex-col items-start gap-0.5 text-sm font-normal">
                    Tampil di form
                    {induKTersembunyi && (
                      <span className="block text-[11px] text-muted-foreground">
                        Ikut tersembunyi karena {induKTersembunyi} disembunyikan
                      </span>
                    )}
                  </Label>
                  <Switch
                    checked={!induKTersembunyi && item.isActive !== false}
                    disabled={!!induKTersembunyi}
                    onChange={(v) => patchItem(item.id, { isActive: v })}
                  />
                </div>
              );
            })()}
          {!induk &&
            (() => {
              const akar = akarDari(section);
              const i = akar.findIndex((x) => x.id === item.id);
              return tombolUrutan(
                i > 0 ? () => pindahUrutan(akar, item.id, -1, "form-item") : null,
                i < akar.length - 1 ? () => pindahUrutan(akar, item.id, 1, "form-item") : null,
              );
            })()}
        </div>

        {induk && nilaiKondisi(item.conditionValue).length === 0 && (
          <div className="space-y-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-900">
            <p>
              Field ini terhubung ke &quot;{induk.label}&quot; tapi belum ke
              pilihan mana pun, jadi tidak pernah muncul di form.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-8 bg-white text-xs"
              onClick={() =>
                patchItem(item.id, { conditionItemId: null, conditionValue: null })
              }
            >
              Jadikan field biasa (selalu tampil)
            </Button>
          </div>
        )}

        {/* Skor field tanpa pilihan */}
        {berskor &&
          !induk &&
          !punyaPilihan &&
          !wajibTetap &&
          item.thresholdValue == null && (
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm font-normal">{labelSkor(item)}</Label>
              {scoreInput(item.score, (v) => {
                if (v !== item.score) patchItem(item.id, { score: v });
              })}
            </div>
          )}
        {item.thresholdValue != null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm font-normal">Skor kalau terpenuhi</Label>
              {scoreInput(item.score, (v) => {
                if (v !== item.score) patchItem(item.id, { score: v });
              })}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm font-normal">Ambang batas (standar)</Label>
              <Input
                key={`${k}-threshold`}
                type="number"
                step="0.01"
                className="h-7 w-20 text-[11px]"
                defaultValue={item.thresholdValue ?? ""}
                onBlur={(e) => {
                  const v = e.target.value ? Number(e.target.value) : null;
                  if (v !== item.thresholdValue) patchItem(item.id, { thresholdValue: v });
                }}
              />
            </div>
          </div>
        )}

        {NOMENKLATUR_SOURCE[item.key] && (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-bold">Pilihan</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Isi pilihan dari</Label>
              <Select value="nomenklatur" disabled>
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nomenklatur">
                    Nomenklatur: {NOMENKLATUR_SOURCE[item.key].label}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-2.5 py-2 text-[11px] text-muted-foreground">
              <span>{NOMENKLATUR_SOURCE[item.key].info}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 shrink-0 text-[11px] text-foreground"
                onClick={() => setMasterDialog("nomenklatur")}
              >
                Kelola data
              </Button>
            </div>
          </div>
        )}

        {/* Pilihan */}
        {punyaPilihan && (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-bold">Pilihan</p>
            {!isEnum && (
              <div className="space-y-1.5">
                <Label className="text-xs">Isi pilihan dari</Label>
                {sourceSelect(
                  item.optionSource,
                  (v) => patchItem(item.id, { optionSource: v }),
                  isBaku,
                )}
                {item.fieldType === "CHECKBOX" && (
                  <p className="text-[11px] text-muted-foreground">
                    Centang: user bisa memilih lebih dari satu; skor pilihan
                    yang dicentang dijumlahkan.
                  </p>
                )}
              </div>
            )}
            {item.optionSource && (
              <div className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-2.5 py-2 text-[11px] text-muted-foreground">
                <span>
                  {Editor
                    ? "Daftar mengikuti data master, berlaku untuk semua kegiatan."
                    : "Data referensi resmi, tidak dikelola di aplikasi ini."}
                </span>
                {Editor && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 text-[11px] text-foreground"
                    onClick={() => setMasterDialog(item.optionSource!)}
                  >
                    Kelola data
                  </Button>
                )}
              </div>
            )}

            {rows.length > 0 && (
              <div className="space-y-2">
                {rows.map((row) => {
                  const kolom = anak.filter((c) =>
                    nilaiKondisi(c.conditionValue).includes(row.value),
                  );
                  return (
                    <div key={row.value} className="space-y-1.5 rounded-md border p-2">
                      <div className="flex items-center gap-2">
                        {labelBisaDiubah && row.opt ? (
                          <Input
                            key={`${k}-${row.opt.id}-${row.opt.label}`}
                            className="h-8 min-w-0 flex-1 text-xs"
                            defaultValue={row.label}
                            onBlur={(e) =>
                              e.target.value.trim() &&
                              e.target.value !== row.label &&
                              patchOption(row.opt!.id, { label: e.target.value.trim() })
                            }
                          />
                        ) : (
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-xs",
                              row.stale && "text-muted-foreground line-through",
                            )}
                            title={row.stale ? "Tidak ada lagi di data master" : row.label}
                          >
                            {row.label}
                          </span>
                        )}
                        {berskor &&
                          !row.stale &&
                          scoreInput(row.opt?.score, (v) =>
                            saveOptionScore(item, row, row.opt, v),
                          )}
                        {(manual || row.stale) && row.opt && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground/70 hover:text-destructive"
                            title="Hapus pilihan"
                            onClick={() =>
                              setDeleteTarget({
                                type: "option",
                                id: row.opt!.id,
                                label: row.label,
                                turunan: kolom.length,
                              })
                            }
                          >
                            <Trash2 size={12} />
                          </Button>
                        )}
                      </div>
                      {kolom.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => pilihField(c.id)}
                          className="block w-full rounded-md bg-primary/10 px-2.5 py-1.5 text-left text-xs text-primary hover:bg-primary/15"
                        >
                          ↳ {c.label} · {FIELD_TYPE_LABEL[c.fieldType] ?? c.fieldType}
                        </button>
                      ))}
                      {!row.stale && (
                        <button
                          type="button"
                          onClick={() =>
                            bukaTambahField(section.id, tab.key, {
                              item,
                              value: row.value,
                              label: row.label,
                            })
                          }
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          + Kolom tambahan
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {rows.length === 0 && !item.optionSource && (
              <p className="text-[11px] text-muted-foreground">
                {item.fieldType === "CHECKBOX"
                  ? "Belum ada pilihan — tanpa pilihan, field ini tampil sebagai satu kotak centang ya/tidak."
                  : "Belum ada pilihan."}
              </p>
            )}
            {manual && (
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 flex-1 text-xs"
                  placeholder="Tambah pilihan baru..."
                  value={newOptionLabel[item.id] ?? ""}
                  onChange={(e) =>
                    setNewOptionLabel((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitAddOption(item.id);
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 text-xs"
                  onClick={() => submitAddOption(item.id)}
                >
                  <Plus size={12} className="mr-1" /> Tambah
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Lanjutan */}
        <div className="border-t pt-3">
          <button
            type="button"
            onClick={() => setLanjutanOpen((v) => !v)}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            {lanjutanOpen ? "▾" : "▸"} Pengaturan lanjutan
          </button>
          {lanjutanOpen && (
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Lebar di form</Label>
                <Select
                  value={item.width ?? "AUTO"}
                  onValueChange={(v) =>
                    patchItem(item.id, {
                      width: v === "AUTO" ? null : (v as "HALF" | "FULL"),
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(WIDTH_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {renderSubLabels(item)}
            </div>
          )}
        </div>

        {!wajibTetap && (
          <Button
            variant="outline"
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/5"
            onClick={() =>
              setDeleteTarget({
                type: "item",
                id: item.id,
                label: item.label,
                turunan: jumlahTurunan(section, item),
              })
            }
          >
            <Trash2 size={14} className="mr-1.5" /> Hapus field
          </Button>
        )}
      </div>
    );
  };

  // Kolom tambahan di kanvas kiri: menjorok di dalam kartu induknya.
  const renderAnakKanvas = (
    section: FormTabNode["sections"][number],
    item: FormItemNode,
    renderItem: (item: FormItemNode) => React.ReactNode,
  ): React.ReactNode => {
    const anak = kolomTambahanDari(section, item);
    if (!anak.length) return null;
    return (
      <div className="mt-3 space-y-2 border-l-2 border-primary/30 pl-3">
        {anak.map((c) => (
          <div
            key={c.id}
            onClick={(e) => {
              e.stopPropagation();
              pilihField(c.id);
            }}
            className={cn(
              "cursor-pointer rounded-lg border bg-white p-2.5",
              c.isActive === false && "opacity-40",
              editItemId === c.id
                ? "border-primary ring-1 ring-primary/30"
                : "border-[#d0d7de] hover:border-primary/60",
            )}
          >
            {nilaiKondisi(c.conditionValue).length > 0 ? (
              <p className="mb-1.5 text-[11px] font-semibold text-primary">
                ↳ Muncul jika &quot;
                {nilaiKondisi(c.conditionValue)
                  .map((v) => pilihanItem(item).find((o) => o.value === v)?.label ?? v)
                  .join(", ")}
                &quot; {item.fieldType === "CHECKBOX" ? "dicentang" : "dipilih"}
              </p>
            ) : (
              <p className="mb-1.5 text-[11px] font-semibold text-amber-800">
                ↳ Belum terhubung ke pilihan mana pun — field ini tidak muncul di form
              </p>
            )}
            <div inert className="pointer-events-none select-none">
              {renderItem(c)}
            </div>
            {renderAnakKanvas(section, c, renderItem)}
          </div>
        ))}
      </div>
    );
  };

  // Field akar section (bukan kolom tambahan field lain di section ini).
  const akarDari = (section: FormTabNode["sections"][number]) => {
    const keys = new Set(section.items.map((i) => i.key));
    return section.items.filter(
      (i) => !i.conditionItemId || !keys.has(i.conditionItemId),
    );
  };

  const renderAdminSectionsBody: ProyekFormAdminHandlers["sectionsBody"] = (
    tabKey,
    tabId,
    sections,
    renderItem,
    gridClass,
  ) => {
    if (!tabId) {
      return (
        <p className="text-xs text-muted-foreground italic">
          Tab ini belum ada di template — coba &quot;Salin dari kegiatan
          lain&quot;.
        </p>
      );
    }
    return (
      <div className="space-y-5">
        {sections.map((section) => {
          const akar = akarDari(section);
          const terpilih = selectedSectionId === section.id;
          return (
            <section
              key={section.id}
              aria-label={`Bagian ${section.label}`}
              className={cn(
                "space-y-3 rounded-[14px] bg-[#f6f8fa] p-4",
                terpilih ? "border-2 border-primary" : "border border-[#d0d7de]",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-bold">{section.label}</span>
                  {section.isActive === false && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Disembunyikan
                    </Badge>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-[#59636e] hover:bg-white hover:text-foreground"
                  title="Atur bagian"
                  aria-label={`Atur bagian ${section.label}`}
                  onClick={() => {
                    setEditItemId(null);
                    setSelectedSectionId(section.id);
                  }}
                >
                  <Settings2 size={16} />
                </Button>
              </div>
              <div className={cn("space-y-3", section.isActive === false && "opacity-60")}>
              {akar.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Belum ada field di bagian ini.
                </p>
              )}
              <div className={gridClass}>
                {akar.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => pilihField(item.id)}
                    className={cn(
                      "relative cursor-pointer rounded-xl bg-white p-4 transition-colors",
                      (isItemWide(item) || kolomTambahanDari(section, item).length > 0) &&
                        "sm:col-span-full",
                      item.isActive === false && "opacity-50",
                      editItemId === item.id
                        ? "border-2 border-primary"
                        : "border border-[#d0d7de] shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-primary/60",
                    )}
                  >
                    {/* Label tipe sebaris dengan judul field (pojok kanan
                        atas), bukan baris sendiri. */}
                    <div className="pointer-events-none absolute right-4 top-4 z-10 flex items-center gap-1.5 bg-white pl-2 text-[11px] leading-5 text-[#59636e]">
                      {item.isActive === false && (
                        <Badge variant="outline" className="text-[9px]">
                          Disembunyikan
                        </Badge>
                      )}
                      <span>{labelTipe(item)}</span>
                    </div>
                    <div inert className="pointer-events-none select-none">
                      {renderItem(item)}
                    </div>
                    {renderAnakKanvas(section, item, renderItem)}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => bukaTambahField(section.id, tabKey)}
                className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#b6bec8] text-sm font-semibold text-[#3d4752] transition-colors hover:border-primary/60 hover:bg-white hover:text-primary"
              >
                <Plus size={14} /> Tambah field
              </button>
              </div>
            </section>
          );
        })}
        <button
          type="button"
          onClick={() => setAddSectionTabId(tabId)}
          className="flex h-14 w-full items-center justify-center gap-1.5 rounded-[14px] border-2 border-dashed border-[#b6bec8] text-sm font-semibold text-[#3d4752] transition-colors hover:border-primary/60 hover:bg-white hover:text-primary"
        >
          <Plus size={15} /> Tambah bagian
        </button>
      </div>
    );
  };

  const adminHandlers: ProyekFormAdminHandlers = {
    tabHeader: renderAdminTabHeader,
    sectionsBody: renderAdminSectionsBody,
    note: renderAdminNote,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="max-w-md flex-1 min-w-[240px]">
          <Select value={kegiatanId} onValueChange={setKegiatanId}>
            <SelectTrigger className="h-10 w-full min-w-0 bg-card shadow-sm *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1">
              <SelectValue placeholder="Pilih kegiatan" />
            </SelectTrigger>
            <SelectContent>
              {kegiatanList.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  <span className="font-mono text-[10px] mr-1 shrink-0">
                    {k.code}
                  </span>
                  <span className="truncate">{k.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-10"
          onClick={() => setCloneOpen(true)}
        >
          <Copy size={13} className="mr-1.5" /> Salin dari kegiatan lain
        </Button>
        <div
          role="group"
          aria-label="Mode kanvas"
          className="flex rounded-lg border border-[#d0d7de] bg-[#eef0f3] p-1"
        >
          {(
            [
              ["atur", "Atur form"],
              ["isi", "Coba isi form"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "h-8 rounded-md px-3 text-sm",
                mode === m
                  ? "bg-white font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <span
          className={cn(
            "ml-auto text-xs font-medium",
            saveState === "error" ? "text-destructive" : saveState === "saved" ? "text-primary" : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {saveState === "saving"
            ? "Menyimpan…"
            : saveState === "saved"
              ? "✓ Tersimpan"
              : saveState === "error"
                ? "Gagal menyimpan — coba lagi"
                : ""}
        </span>
      </div>

      {kegiatanId && templateKosong && (
        <div className="mx-auto max-w-xl rounded-[14px] border border-[#d0d7de] bg-white px-8 py-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-lg font-bold">Kegiatan ini belum punya Form Proyek</p>
          <p className="mt-2 text-sm text-[#59636e]">
            Cara tercepat: salin form dari kegiatan lain yang sudah lengkap,
            lalu sesuaikan field, pilihan, dan skornya di sini.
          </p>
          <Button className="mt-6" onClick={() => setCloneOpen(true)}>
            <Copy size={14} className="mr-1.5" /> Salin dari kegiatan lain
          </Button>
        </div>
      )}

      {kegiatanId && !templateKosong && mode === "isi" && (
        <div className="space-y-2">
          <p className="rounded-lg bg-primary/10 px-4 py-2.5 text-sm text-primary">
            Mode coba: ini tampilan yang dilihat user saat membuat proyek.
            Isian di sini tidak tersimpan.
          </p>
          <ProyekFormDialog
            key={`${kegiatanId}-isi-${refreshToken}-${masterToken}`}
            open
            embedded
            previewMode
            onClose={() => {}}
            onSuccess={() => {}}
            initialKegiatanId={kegiatanId}
          />
        </div>
      )}

      {kegiatanId && !templateKosong && mode === "atur" && (
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1">
            <ProyekFormDialog
              key={kegiatanId}
              open
              embedded
              onClose={() => {}}
              onSuccess={() => {}}
              adminMode
              adminHandlers={adminHandlers}
              adminRefreshToken={refreshToken}
              masterRefreshToken={masterToken}
              onActiveTabChange={(k) => {
                setActiveTabKey(k);
                setEditItemId(null);
                setSelectedSectionId(null);
              }}
              initialKegiatanId={kegiatanId}
            />
          </div>
          <aside
            aria-label="Pengaturan field"
            className="w-full rounded-[14px] border border-[#d0d7de] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:w-[400px] xl:shrink-0 xl:overflow-y-auto">
            {renderPanel()}
          </aside>
        </div>
      )}

      {/* Dialog: tambah field / kolom tambahan */}
      <Dialog open={!!fieldDialog} onOpenChange={(o) => !o && setFieldDialog(null)}>
        <DialogContent
          className="sm:max-w-lg"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {fieldDialog?.parent
                ? `Kolom tambahan untuk "${fieldDialog.parent.label}"`
                : "Tambah field"}
            </DialogTitle>
          </DialogHeader>
          {fieldDialog?.parent && (
            <p className="rounded-md bg-primary/10 p-2.5 text-xs text-primary">
              Kolom ini hanya muncul di form kalau &quot;{fieldDialog.parent.label}&quot;{" "}
              {fieldDialog.parent.item.fieldType === "CHECKBOX" ? "dicentang" : "dipilih"}.
              Kolom tambahan tidak punya skor sendiri: skor pilihan itu baru masuk
              setelah kolom ini diisi.
            </p>
          )}
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="field-dialog-nama">Nama field</Label>
              <Input
                id="field-dialog-nama"
                autoFocus
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                placeholder="Contoh: Sebutkan sumber lainnya"
                onKeyDown={(e) => e.key === "Enter" && submitAddItem()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipe</Label>
              <div className="flex flex-wrap gap-2">
                {FIELD_TYPE_OPTIONS.filter(
                  (ft) => fieldDialog?.tabKey !== "pemaketan" || ft !== "UPLOAD",
                ).map((ft) => (
                  <button
                    key={ft}
                    type="button"
                    onClick={() => setNewItemType(ft)}
                    className={cn(
                      "h-9 rounded-full border px-3.5 text-sm",
                      newItemType === ft
                        ? "border-primary bg-primary font-semibold text-primary-foreground"
                        : "border-input bg-white hover:border-primary/50",
                    )}
                  >
                    {FIELD_TYPE_LABEL[ft]}
                  </button>
                ))}
              </div>
            </div>
            {(newItemType === "DROPDOWN" || newItemType === "CHECKBOX") && (
              <div className="space-y-1.5">
                <Label>Isi pilihan dari</Label>
                {sourceSelect(newItemSource, setNewItemSource, false)}
                <p className="text-xs text-muted-foreground">
                  Pilihan & skornya diatur setelah field dibuat, di panel kanan.
                </p>
              </div>
            )}
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={newItemRequired}
                onChange={(e) => setNewItemRequired(e.target.checked)}
              />
              <span className="text-sm">
                Wajib diisi
                <span className="block text-xs text-muted-foreground">
                  User tidak bisa menyimpan proyek kalau field ini kosong.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldDialog(null)}>
              Batal
            </Button>
            <Button disabled={!newItemLabel.trim() || saving} onClick={submitAddItem}>
              {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: kelola isi tabel master langsung dari kanvas — editor yang
          SAMA dengan tab master-nya (berlaku utk semua kegiatan). */}
      <Dialog
        open={!!masterDialog}
        onOpenChange={(o) => {
          if (o) return;
          setMasterDialog(null);
          setMasterToken((t) => t + 1);
        }}
      >
        <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Kelola data{" "}
              {masterDialog &&
                (OPTION_SOURCES[masterDialog]?.label ?? "Nomenklatur")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Perubahan di sini langsung tersimpan ke Master Data dan berlaku
            untuk semua kegiatan.
          </p>
          {masterDialog &&
            (() => {
              const Editor = SOURCE_EDITORS[masterDialog];
              return Editor ? <Editor /> : null;
            })()}
        </DialogContent>
      </Dialog>

      {/* Dialog: tambah section */}
      <Dialog
        open={!!addSectionTabId}
        onOpenChange={(v) => !v && setAddSectionTabId(null)}
      >
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Tambah Bagian Baru</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label htmlFor="section-dialog-nama">Nama bagian</Label>
            <Input
              id="section-dialog-nama"
              autoFocus
              value={newSectionLabel}
              onChange={(e) => setNewSectionLabel(e.target.value)}
              placeholder="Contoh: Kelengkapan Proyek"
              onKeyDown={(e) => e.key === "Enter" && submitAddSection()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSectionTabId(null)}>
              Batal
            </Button>
            <Button
              disabled={!newSectionLabel.trim() || saving}
              onClick={submitAddSection}
            >
              {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
              Tambah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: salin dari kegiatan lain */}
      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Salin Template dari Kegiatan Lain</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-xs text-muted-foreground">
              Seluruh pengaturan kegiatan sumber akan disalin ke kegiatan yang
              sedang dipilih, MENIMPA pengaturan yang ada sekarang.
            </p>
            <Select value={cloneSource} onValueChange={setCloneSource}>
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="Pilih kegiatan sumber" />
              </SelectTrigger>
              <SelectContent>
                {kegiatanList
                  .filter((k) => k.id !== kegiatanId)
                  .map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.code} — {k.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneOpen(false)}>
              Batal
            </Button>
            <Button disabled={!cloneSource || cloning} onClick={doClone}>
              {cloning && <Loader2 size={14} className="mr-2 animate-spin" />}
              Salin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus &quot;{deleteTarget?.label}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "section"
                ? "Seluruh item di dalam bagian ini akan ikut terhapus. Tindakan ini tidak bisa dibatalkan."
                : deleteTarget?.turunan
                  ? `${deleteTarget.turunan} kolom tambahannya ikut terhapus. Tindakan ini tidak bisa dibatalkan.`
                  : "Tindakan ini tidak bisa dibatalkan."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
