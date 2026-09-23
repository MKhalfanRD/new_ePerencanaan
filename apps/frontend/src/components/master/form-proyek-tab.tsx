"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Trash2,
  Copy,
  Loader2,
  Eye,
  EyeOff,
  Pencil,
  GripVertical,
  ExternalLink,
} from "lucide-react";
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
  TAB_ICONS,
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
    "Bagian pemaketan (tambah & kelola paket pekerjaan) selalu tampil utuh saat tab ini aktif — belum ada sub-bagian yang bisa diatur terpisah.",
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
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-emerald-500" : "bg-muted-foreground/25",
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

/** Bungkus 1 elemen sortable (section atau item) — pakai render-prop supaya
 * grip handle bisa disisipkan pas di tempat yang pas di JSX masing-masing. */
function Sortable({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: (p: {
    setNodeRef: (el: HTMLElement | null) => void;
    style: React.CSSProperties;
    dragHandleProps: Record<string, unknown>;
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <>
      {children({
        setNodeRef,
        style,
        dragHandleProps: { ...attributes, ...listeners },
        isDragging,
      })}
    </>
  );
}

type DeleteTarget = { type: "section" | "item" | "option"; id: string; label: string };

export function FormProyekTab() {
  const [kegiatanList, setKegiatanList] = useState<Kegiatan[]>([]);
  const [kegiatanId, setKegiatanId] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
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
  const [addItemSectionId, setAddItemSectionId] = useState<string | null>(null);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemType, setNewItemType] =
    useState<(typeof FIELD_TYPE_OPTIONS)[number]>("CHECKBOX");
  const [newItemRequired, setNewItemRequired] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState<Record<string, string>>(
    {},
  );
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [saving, setSaving] = useState(false);
  // Item yang lagi diseret — dirender terpisah lewat DragOverlay (portal di
  // luar grid) supaya tidak ikut merusak ukuran grid CSS di sekitarnya
  // selagi diseret.
  const [draggingItem, setDraggingItem] = useState<FormItemNode | null>(null);
  // Lebar asli elemen yang diseret (px) — dipakai DragOverlay supaya ukurannya
  // PERSIS sama dengan field aslinya, bukan tebakan lebar tetap. Tanpa ini
  // overlay bisa beda ukuran dari elemen asli & kelihatan "tidak presisi" di
  // bawah kursor (dnd-kit posisikan overlay dari rect awal elemen asli).
  const [draggingItemWidth, setDraggingItemWidth] = useState<number | null>(
    null,
  );

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useEffect(() => {
    api.get("/master/kegiatan").then((res) => {
      setKegiatanList(res.data);
      if (res.data.length) setKegiatanId((prev) => prev || res.data[0].id);
    });
  }, []);

  const patchTab = async (tabId: string, data: Record<string, unknown>) => {
    try {
      await api.patch(`/master/form-tab/${tabId}`, data);
      bump();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyimpan");
    }
  };

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
  const patchSection = async (sectionId: string, data: Record<string, unknown>) => {
    try {
      await api.patch(`/master/form-section/${sectionId}`, data);
      bump();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyimpan");
    }
  };

  const submitAddItem = async () => {
    if (!addItemSectionId || !newItemLabel.trim()) return;
    setSaving(true);
    try {
      await api.post("/master/form-item", {
        sectionId: addItemSectionId,
        key: newItemLabel.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-"),
        label: newItemLabel.trim(),
        fieldType: newItemType,
        required: newItemRequired,
      });
      setAddItemSectionId(null);
      setNewItemLabel("");
      setNewItemType("CHECKBOX");
      setNewItemRequired(false);
      bump();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menambah item");
    } finally {
      setSaving(false);
    }
  };
  const patchItem = async (itemId: string, data: Record<string, unknown>) => {
    try {
      await api.patch(`/master/form-item/${itemId}`, data);
      bump();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyimpan");
    }
  };

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
  const patchOption = async (optionId: string, data: Record<string, unknown>) => {
    try {
      await api.patch(`/master/form-item-option/${optionId}`, data);
      bump();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyimpan");
    }
  };

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

  const handleSectionDragEnd = async (
    sections: FormTabNode["sections"],
    event: DragEndEvent,
  ) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sections, oldIndex, newIndex);
    try {
      await Promise.all(
        reordered.map((s, idx) =>
          api.patch(`/master/form-section/${s.id}`, { order: idx }),
        ),
      );
    } catch {
      toast.error("Gagal menyimpan urutan bagian");
    } finally {
      bump();
    }
  };

  const handleItemDragEnd = async (
    items: FormItemNode[],
    event: DragEndEvent,
  ) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    try {
      await Promise.all(
        reordered.map((it, idx) =>
          api.patch(`/master/form-item/${it.id}`, { order: idx }),
        ),
      );
    } catch {
      toast.error("Gagal menyimpan urutan item");
    } finally {
      bump();
    }
  };

  const renderAdminTabHeader: ProyekFormAdminHandlers["tabHeader"] = (
    tabKey,
    tab,
  ) => {
    if (!tab) return null;
    const Icon = TAB_ICONS[tabKey];
    return (
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border-2 border-foreground/15 bg-white px-4 py-3.5 mb-5">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon size={16} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-base font-bold">{tab.label}</p>
            <p className="text-xs text-muted-foreground">
              {tab.isActive !== false
                ? "✓ Tab ini tampil di form Buat Proyek"
                : "✕ Tab ini disembunyikan dari form Buat Proyek"}
            </p>
            <Textarea
              key={tab.id}
              className="text-xs text-muted-foreground min-h-[32px] h-8 max-w-md resize-none py-1"
              placeholder={TAB_DEFAULT_DESCRIPTIONS[tabKey]}
              defaultValue={tab.description ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (tab.description ?? ""))
                  patchTab(tab.id, { description: v || null });
              }}
            />
            <p className="text-[10px] text-muted-foreground/70">
              Deskripsi ini tampil di bawah judul tab pada form Buat Proyek.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {tab.bobot != null && (
            <div className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1">
              <span className="text-xs text-muted-foreground">Bobot skor</span>
              <Input
                type="number"
                min={0}
                max={100}
                className="h-7 w-14 text-xs text-right"
                defaultValue={Math.round(tab.bobot * 100)}
                onBlur={(e) => {
                  const pct = Number(e.target.value);
                  const v = Math.max(0, Math.min(100, pct)) / 100;
                  if (v !== tab.bobot) patchTab(tab.id, { bobot: v });
                }}
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          )}
          <Switch
            checked={tab.isActive !== false}
            onChange={(v) => patchTab(tab.id, { isActive: v })}
            label="Aktifkan/nonaktifkan tab ini"
          />
        </div>
      </div>
    );
  };

  const renderAdminNote: ProyekFormAdminHandlers["note"] = (tabKey) => (
    <p className="pl-12 text-xs text-muted-foreground italic px-1 border-l-2 border-slate-300 py-1">
      {TAB_NOTES[tabKey] ?? "Tidak ada pengaturan tambahan untuk bagian ini."}
    </p>
  );

  // Panel "Pengaturan" 1 field — expand INLINE di bawah field itu sendiri,
  // TETAP di kolom grid aslinya (bukan col-span-full, bukan dialog terpisah)
  // supaya field lain di grid tidak ikut kegeser/pindah posisi. Card field
  // yang lagi diedit jadi lebih tinggi dari tetangganya — itu wajar karena
  // tiap field sudah punya card/border sendiri, bukan lagi satu blok rata
  // yang bikin ruang kosong membingungkan.
  const renderItemSettingsFields = (item: FormItemNode) => {
    const isBaku = BAKU_ITEM_KEYS.has(item.key);
    const isAlwaysRequiredBaku = ALWAYS_REQUIRED_BAKU_KEYS.has(item.key);
    return (
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Nama field
            </Label>
            <Input
              className="h-8 text-xs"
              defaultValue={item.label}
              onBlur={(e) =>
                e.target.value !== item.label &&
                patchItem(item.id, { label: e.target.value })
              }
            />
          </div>
          {!isAlwaysRequiredBaku && (
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Wajib diisi
              </Label>
              <div className="h-8 flex items-center">
                <Switch
                  checked={item.required === true}
                  onChange={(v) => patchItem(item.id, { required: v })}
                />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Lebar</Label>
            <Select
              value={item.width ?? "AUTO"}
              onValueChange={(v) =>
                patchItem(item.id, {
                  width: v === "AUTO" ? null : (v as "HALF" | "FULL"),
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
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
          {!isBaku && !item.options.length && item.thresholdValue == null && (
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Skor
              </Label>
              <Input
                type="number"
                className="h-8 text-xs"
                defaultValue={item.score ?? ""}
                onBlur={(e) => {
                  const v = e.target.value ? Number(e.target.value) : null;
                  if (v !== item.score) patchItem(item.id, { score: v });
                }}
              />
            </div>
          )}
          {item.thresholdValue != null && (
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Skor jika terpenuhi
              </Label>
              <Input
                type="number"
                className="h-8 text-xs"
                defaultValue={item.score ?? ""}
                onBlur={(e) => {
                  const v = e.target.value ? Number(e.target.value) : null;
                  if (v !== item.score) patchItem(item.id, { score: v });
                }}
              />
            </div>
          )}
        </div>
        {item.thresholdValue != null && (
          <div className="space-y-1 max-w-[200px]">
            <Label className="text-[10px] text-muted-foreground">
              Ambang batas (standar)
            </Label>
            <Input
              type="number"
              step="0.01"
              className="h-8 text-xs"
              defaultValue={item.thresholdValue ?? ""}
              onBlur={(e) => {
                const v = e.target.value ? Number(e.target.value) : null;
                if (v !== item.thresholdValue)
                  patchItem(item.id, { thresholdValue: v });
              }}
            />
          </div>
        )}

        {!isBaku && item.fieldType === "DROPDOWN" && (
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">
              Pilihan dropdown
            </Label>
            {item.options.map((opt) => (
              <div key={opt.id} className="flex items-center gap-2">
                <Switch
                  checked={opt.isActive !== false}
                  onChange={(v) => patchOption(opt.id, { isActive: v })}
                />
                <Input
                  className="h-7 flex-1 text-[11px]"
                  defaultValue={opt.label}
                  onBlur={(e) =>
                    e.target.value !== opt.label &&
                    patchOption(opt.id, { label: e.target.value })
                  }
                />
                <Input
                  type="number"
                  placeholder="skor"
                  className="h-7 w-16 text-[11px] shrink-0"
                  defaultValue={opt.score ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    if (v !== opt.score) patchOption(opt.id, { score: v });
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground/60 hover:text-destructive shrink-0"
                  onClick={() =>
                    setDeleteTarget({
                      type: "option",
                      id: opt.id,
                      label: opt.label,
                    })
                  }
                >
                  <Trash2 size={11} />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-0.5">
              <Input
                className="h-7 flex-1 text-[11px]"
                placeholder="Tambah pilihan baru..."
                value={newOptionLabel[item.id] ?? ""}
                onChange={(e) =>
                  setNewOptionLabel((prev) => ({
                    ...prev,
                    [item.id]: e.target.value,
                  }))
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
                className="h-7 text-[11px] shrink-0"
                onClick={() => submitAddOption(item.id)}
              >
                <Plus size={11} className="mr-1" />
                Tambah
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAdminSectionsBody: ProyekFormAdminHandlers["sectionsBody"] = (
    _tabKey,
    tabId,
    sections,
    renderItem,
    gridClass,
  ) => {
    if (!tabId) {
      return (
        <p className="pl-12 text-xs text-muted-foreground italic">
          Tab ini belum ada di template — coba &quot;Salin dari kegiatan
          lain&quot;.
        </p>
      );
    }
    return (
      <>
        <DndContext
          sensors={dndSensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => handleSectionDragEnd(sections, e)}
        >
          <SortableContext
            items={sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3 pl-12">
              {sections.map((section) => (
                <Sortable key={section.id} id={section.id}>
                  {({ setNodeRef, style, dragHandleProps, isDragging }) => (
                    <div
                      ref={setNodeRef}
                      style={style}
                      className={cn(
                        "group/section space-y-3",
                        isDragging && "opacity-50",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          title="Seret untuk ubah urutan bagian"
                          className="shrink-0 touch-none cursor-grab text-muted-foreground hover:text-foreground"
                          {...dragHandleProps}
                        >
                          <GripVertical size={14} />
                        </button>
                        <Input
                          className="h-6 max-w-xs flex-1 border-none bg-transparent px-1 text-xs font-semibold text-muted-foreground shadow-none focus-visible:border focus-visible:bg-white focus-visible:ring-0"
                          defaultValue={section.label}
                          onBlur={(e) =>
                            e.target.value !== section.label &&
                            patchSection(section.id, { label: e.target.value })
                          }
                        />
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/section:opacity-100">
                          {section.isActive === false && (
                            <Badge
                              variant="outline"
                              className="text-[9px] border-slate-300 text-muted-foreground"
                            >
                              Nonaktif
                            </Badge>
                          )}
                          <Switch
                            checked={section.isActive !== false}
                            onChange={(v) =>
                              patchSection(section.id, { isActive: v })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground/60 hover:text-destructive"
                            onClick={() =>
                              setDeleteTarget({
                                type: "section",
                                id: section.id,
                                label: section.label,
                              })
                            }
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>

                      {section.items.length === 0 && (
                        <p className="py-2 text-xs text-muted-foreground italic">
                          Belum ada item di bagian ini.
                        </p>
                      )}
                      <DndContext
                        sensors={dndSensors}
                        collisionDetection={closestCenter}
                        onDragStart={(e: DragStartEvent) => {
                          setDraggingItem(
                            section.items.find((i) => i.id === e.active.id) ??
                              null,
                          );
                          setDraggingItemWidth(
                            e.active.rect.current.initial?.width ?? null,
                          );
                        }}
                        onDragEnd={(e) => {
                          setDraggingItem(null);
                          setDraggingItemWidth(null);
                          handleItemDragEnd(section.items, e);
                        }}
                        onDragCancel={() => {
                          setDraggingItem(null);
                          setDraggingItemWidth(null);
                        }}
                      >
                        <SortableContext
                          items={section.items.map((i) => i.id)}
                          strategy={rectSortingStrategy}
                        >
                          <div className={gridClass}>
                            {section.items.map((item) => {
                              const isWide = isItemWide(item);
                              const isEditing = editItemId === item.id;
                              return (
                                <Sortable key={item.id} id={item.id}>
                                  {({
                                    setNodeRef,
                                    style,
                                    dragHandleProps,
                                    isDragging,
                                  }) => (
                                    <div
                                      ref={setNodeRef}
                                      style={style}
                                      className={cn(
                                        "group/item relative rounded-lg border bg-white p-2.5 pl-6",
                                        isWide && "sm:col-span-full",
                                        isDragging && "opacity-0",
                                        item.isActive === false && "opacity-40",
                                        isEditing
                                          ? "border-primary/40 ring-1 ring-primary/20"
                                          : "border-border/70",
                                      )}
                                    >
                                      <button
                                        type="button"
                                        title="Seret untuk ubah urutan field"
                                        className="absolute top-2.5 left-2 z-10 cursor-grab rounded text-muted-foreground hover:text-foreground touch-none shrink-0"
                                        {...dragHandleProps}
                                      >
                                        <GripVertical size={14} />
                                      </button>
                                      <div
                                        className={cn(
                                          "absolute -top-2.5 right-0 z-10 flex items-center gap-0.5 rounded-md border bg-white px-1 py-0.5 shadow-sm transition-opacity",
                                          isEditing
                                            ? "opacity-100"
                                            : "opacity-0 group-hover/item:opacity-100 focus-within:opacity-100",
                                        )}
                                      >
                                        {item.isActive === false && (
                                          <Badge
                                            variant="outline"
                                            className="text-[9px] mx-0.5 border-slate-300 text-muted-foreground"
                                          >
                                            Nonaktif
                                          </Badge>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-muted-foreground/70 hover:text-foreground"
                                          title={
                                            item.isActive === false
                                              ? "Tampilkan di form Proyek"
                                              : "Sembunyikan dari form Proyek"
                                          }
                                          onClick={() =>
                                            patchItem(item.id, {
                                              isActive: item.isActive === false,
                                            })
                                          }
                                        >
                                          {item.isActive === false ? (
                                            <EyeOff size={13} />
                                          ) : (
                                            <Eye size={13} />
                                          )}
                                        </Button>
                                        <Button
                                          variant={isEditing ? "default" : "ghost"}
                                          size="icon"
                                          className="h-6 w-6"
                                          title="Atur field ini"
                                          onClick={() =>
                                            setEditItemId(isEditing ? null : item.id)
                                          }
                                        >
                                          <Pencil size={12} />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-muted-foreground/70 hover:text-destructive"
                                          title="Hapus field ini"
                                          onClick={() =>
                                            setDeleteTarget({
                                              type: "item",
                                              id: item.id,
                                              label: item.label,
                                            })
                                          }
                                        >
                                          <Trash2 size={12} />
                                        </Button>
                                      </div>

                                      {renderItem(item)}

                                      {isEditing && (
                                        <div className="mt-2.5 pt-2.5 border-t">
                                          {renderItemSettingsFields(item)}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </Sortable>
                              );
                            })}
                            {/* Form "tambah item" ikut jadi anak grid (bukan
                                elemen di luar grid) — CSS grid auto-flow
                                otomatis taruh ini di slot kosong sisa baris
                                kalau ada, atau baris baru kalau penuh. Tombol
                                pemicunya sendiri tetap di posisi lama (full
                                width di bawah grid) — pas diklik, form-nya
                                "pindah" muncul di dalam grid, bukan di tombol. */}
                            {addItemSectionId === section.id && (
                              <div className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-2.5 space-y-2">
                                <Input
                                  autoFocus
                                  className="h-8 text-xs bg-white"
                                  placeholder="Nama field baru"
                                  value={newItemLabel}
                                  onChange={(e) => setNewItemLabel(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      submitAddItem();
                                    }
                                    if (e.key === "Escape") {
                                      setAddItemSectionId(null);
                                      setNewItemLabel("");
                                    }
                                  }}
                                />
                                <Select
                                  value={newItemType}
                                  onValueChange={(v) => setNewItemType(v as any)}
                                >
                                  <SelectTrigger className="h-8 text-xs bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FIELD_TYPE_OPTIONS.map((ft) => (
                                      <SelectItem key={ft} value={ft}>
                                        {FIELD_TYPE_LABEL[ft]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <div className="flex items-center justify-between">
                                  <Label className="text-[10px] text-muted-foreground">
                                    Wajib diisi
                                  </Label>
                                  <Switch
                                    checked={newItemRequired}
                                    onChange={setNewItemRequired}
                                  />
                                </div>
                                <div className="flex justify-end gap-1.5 pt-0.5">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-[11px]"
                                    onClick={() => {
                                      setAddItemSectionId(null);
                                      setNewItemLabel("");
                                    }}
                                  >
                                    Batal
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7 text-[11px]"
                                    disabled={!newItemLabel.trim() || saving}
                                    onClick={submitAddItem}
                                  >
                                    {saving && (
                                      <Loader2
                                        size={12}
                                        className="mr-1 animate-spin"
                                      />
                                    )}
                                    Tambah
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </SortableContext>
                        <DragOverlay>
                          {draggingItem && (
                            <div
                              style={
                                draggingItemWidth
                                  ? { width: draggingItemWidth }
                                  : undefined
                              }
                              className={cn(
                                "rounded-lg border-2 border-primary bg-white p-2.5 shadow-2xl",
                                !draggingItemWidth &&
                                  (isItemWide(draggingItem)
                                    ? "w-[520px]"
                                    : "w-[250px]"),
                              )}
                            >
                              <div className="flex items-center gap-1.5 mb-1.5 text-muted-foreground/40">
                                <GripVertical size={13} className="shrink-0" />
                                <span className="text-[10px]">Memindahkan...</span>
                              </div>
                              {renderItem(draggingItem)}
                            </div>
                          )}
                        </DragOverlay>
                      </DndContext>
                      {addItemSectionId !== section.id && (
                        <button
                          type="button"
                          onClick={() => setAddItemSectionId(section.id)}
                          className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-slate-300 py-2 text-xs font-medium text-muted-foreground hover:border-slate-400 hover:text-foreground hover:bg-accent/40 transition-colors"
                        >
                          <Plus size={12} /> Tambah item
                        </button>
                      )}
                    </div>
                  )}
                </Sortable>
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <button
          type="button"
          onClick={() => setAddSectionTabId(tabId)}
          className="mt-3 ml-12 flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-slate-300 py-2.5 text-sm font-medium text-muted-foreground hover:border-slate-400 hover:text-foreground hover:bg-accent/30 transition-colors bg-white"
          style={{ width: "calc(100% - 3rem)" }}
        >
          <Plus size={13} /> Tambah bagian baru
        </button>
      </>
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
        <Button
          size="sm"
          variant="outline"
          className="h-10"
          disabled={!kegiatanId}
          onClick={() => setPreviewOpen(true)}
        >
          <ExternalLink size={13} className="mr-1.5" /> Lihat sebagai Form User
        </Button>
      </div>

      {previewOpen && (
        <ProyekFormDialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          onSuccess={() => setPreviewOpen(false)}
          previewMode
          initialKegiatanId={kegiatanId}
        />
      )}

      {kegiatanId && (
        <ProyekFormDialog
          key={kegiatanId}
          open
          embedded
          onClose={() => {}}
          onSuccess={() => {}}
          adminMode
          adminHandlers={adminHandlers}
          adminRefreshToken={refreshToken}
          initialKegiatanId={kegiatanId}
        />
      )}

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
            <Label>Nama bagian</Label>
            <Input
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
