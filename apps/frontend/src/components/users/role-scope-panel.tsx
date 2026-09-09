"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { useRowSelection } from "@/lib/use-row-selection";

interface Kegiatan {
  id: string;
  code: string;
  name: string;
}

interface Role {
  id: string;
  code: string;
  name: string;
  kegiatanId?: string | null;
  kegiatan?: Kegiatan | null;
  baseRole?: string | null;
}

/**
 * Template izin yang bisa dipinjam role turunan — cerminan BASE_ROLES di
 * `apps/backend/src/auth/role.ts`. Wajib dipilih saat membuat role baru:
 * tanpa template, role itu ditolak semua endpoint karena kodenya tidak ada
 * di dekorator @Roles() mana pun.
 */
const BASE_ROLES = [
  { code: "ADMINISTRATOR", label: "Administrator — kelola semua, setujui proyek" },
  { code: "VERIFICATOR", label: "Verifikator — lihat semua proyek dalam cakupannya" },
  { code: "SATKER", label: "Satuan Kerja — buat & edit proyek sendiri" },
  { code: "OPERATOR", label: "Operator" },
  { code: "MONITORING", label: "Monitoring" },
  { code: "READONLY", label: "Read Only" },
];

/**
 * Role bawaan sistem — kodenya dipakai langsung di kode (RolesGuard, filter
 * kegiatan, halaman log aktivitas), jadi tidak bisa dihapus atau diikat ke
 * satu kegiatan. Backend menolaknya juga; ini supaya UI-nya jelas.
 */
const ROLE_SISTEM = ["SUPER_ADMIN", "ADMINISTRATOR"];

/** Sentinel "tidak dibatasi" — Radix Select tidak menerima value string kosong. */
const ALL = "__ALL__";

/**
 * Kelola role: tambah, ubah nama, atur cakupan kegiatan, hapus. Cakupan
 * kegiatan dipakai backend untuk menyaring proyek — role yang terikat satu
 * kegiatan tidak bisa melihat/mengubah proyek kegiatan lain.
 */
export function RoleScopePanel() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [kegiatan, setKegiatan] = useState<Kegiatan[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [hapus, setHapus] = useState<Role | null>(null);
  const [menghapus, setMenghapus] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMenghapus, setBulkMenghapus] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [baru, setBaru] = useState({
    code: "",
    name: "",
    kegiatanId: "",
    baseRole: "SATKER",
  });
  const [menyimpan, setMenyimpan] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [r, k] = await Promise.all([
        api.get<Role[]>("/master/roles"),
        api.get<Kegiatan[]>("/master/kegiatan"),
      ]);
      setRoles(r.data);
      setKegiatan(k.data);
    } catch {
      toast.error("Gagal memuat daftar role");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Role sistem tidak bisa dihapus — dikeluarkan dari seleksi.
  const selectableIds = roles
    .filter((r) => !ROLE_SISTEM.includes(r.code))
    .map((r) => r.id);
  const sel = useRowSelection(selectableIds);

  useEffect(() => {
    sel.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles]);

  const hapusBatch = async () => {
    setBulkMenghapus(true);
    try {
      const res = await api.post("/master/roles/bulk-delete", {
        ids: Array.from(sel.selected),
      });
      toast.success(res.data?.message || "Role terpilih berhasil dihapus");
      sel.clear();
      setBulkOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus role");
      sel.clear();
      setBulkOpen(false);
      fetchAll();
    } finally {
      setBulkMenghapus(false);
    }
  };

  const simpanCakupan = async (role: Role, kegiatanId: string) => {
    setSaving(role.id);
    try {
      await api.patch(`/master/roles/${role.id}`, {
        kegiatanId: kegiatanId || null,
      });
      toast.success(`Cakupan ${role.name} diperbarui`);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyimpan cakupan");
    } finally {
      setSaving(null);
    }
  };

  const simpanNama = async (role: Role, name: string) => {
    if (!name.trim() || name === role.name) return;
    try {
      await api.patch(`/master/roles/${role.id}`, { name: name.trim() });
      toast.success("Nama role diperbarui");
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengubah nama");
    }
  };

  const tambahRole = async () => {
    setMenyimpan(true);
    try {
      await api.post("/master/roles", {
        code: baru.code,
        name: baru.name,
        kegiatanId: baru.kegiatanId || undefined,
        baseRole: baru.baseRole,
      });
      toast.success("Role berhasil ditambahkan");
      setFormOpen(false);
      setBaru({ code: "", name: "", kegiatanId: "", baseRole: "SATKER" });
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menambah role");
    } finally {
      setMenyimpan(false);
    }
  };

  const hapusRole = async () => {
    if (!hapus) return;
    setMenghapus(true);
    try {
      await api.delete(`/master/roles/${hapus.id}`);
      toast.success("Role berhasil dihapus");
      setHapus(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menghapus role");
    } finally {
      setMenghapus(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 bg-muted/50 px-4 py-3 text-left hover:bg-muted"
      >
        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform",
            !open && "-rotate-90",
          )}
        />
        <span className="text-sm font-semibold">Role &amp; Cakupan Kegiatan</span>
        <span className="text-xs text-muted-foreground">
          Batasi role agar hanya menangani satu kegiatan
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {roles.length} role
        </span>
      </button>

      {open && (
        <>
          <div className="flex items-center gap-2 border-b px-4 py-2">
            {selectableIds.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={sel.allSelected}
                  onChange={sel.toggleAll}
                  className="h-4 w-4 rounded border-muted-foreground/40"
                />
                Pilih semua
              </label>
            )}
            {sel.selected.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkOpen(true)}
              >
                <Trash2 size={13} className="mr-1.5" /> Hapus ({sel.selected.size}
                )
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => setFormOpen(true)}
            >
              <Plus size={13} className="mr-1.5" /> Tambah Role
            </Button>
          </div>

          <div className="divide-y">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2
                  className="animate-spin text-muted-foreground"
                  size={18}
                />
              </div>
            ) : (
              roles.map((role) => {
                const sistem = ROLE_SISTEM.includes(role.code);
                const idx = selectableIds.indexOf(role.id);
                return (
                  <div
                    key={role.id}
                    className="group flex flex-wrap items-center gap-3 px-4 py-2.5"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-muted-foreground/40 disabled:opacity-0"
                      checked={sel.selected.has(role.id)}
                      disabled={sistem}
                      onMouseDown={(e) => {
                        sel.shiftRef.current = e.shiftKey;
                      }}
                      onChange={() =>
                        sel.toggleOne(role.id, idx, sel.shiftRef.current)
                      }
                    />
                    <div className="min-w-[200px] flex-1">
                      {/* Nama role bisa diubah langsung di tempat; kode
                          sengaja permanen karena dipakai di @Roles(). */}
                      <input
                        defaultValue={role.name}
                        onBlur={(e) => simpanNama(role, e.target.value)}
                        className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium hover:border-input focus:border-input focus:outline-none"
                      />
                      <p className="px-1 font-mono text-[10px] text-muted-foreground">
                        {role.code}
                        {role.baseRole && (
                          <span className="ml-1.5 font-sans text-muted-foreground">
                            · izin: {role.baseRole}
                          </span>
                        )}
                      </p>
                    </div>

                    {sistem ? (
                      <Badge variant="outline" className="text-[10px]">
                        Lintas kegiatan
                      </Badge>
                    ) : (
                      <Select
                        value={role.kegiatanId ?? role.kegiatan?.id ?? ALL}
                        disabled={saving === role.id}
                        onValueChange={(v) =>
                          simpanCakupan(role, v === ALL ? "" : v)
                        }
                      >
                        <SelectTrigger className="h-8 w-[260px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>
                            — Semua kegiatan (tidak dibatasi) —
                          </SelectItem>
                          {kegiatan.map((k) => (
                            <SelectItem key={k.id} value={k.id}>
                              {k.code} — {k.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:opacity-0"
                      disabled={sistem}
                      onClick={() => setHapus(role)}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Tambah Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>
                Kode <span className="text-destructive">*</span>
              </Label>
              <Input
                className="h-10 font-mono"
                placeholder="OPERATOR_7691"
                value={baru.code}
                onChange={(e) => setBaru({ ...baru, code: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Otomatis jadi HURUF_BESAR. Permanen setelah dibuat.
              </p>
            </div>
            <div className="space-y-2">
              <Label>
                Nama <span className="text-destructive">*</span>
              </Label>
              <Input
                className="h-10"
                placeholder="Operator 7691"
                value={baru.name}
                onChange={(e) => setBaru({ ...baru, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Template Izin <span className="text-destructive">*</span>
              </Label>
              <Select
                value={baru.baseRole}
                onValueChange={(v) => setBaru({ ...baru, baseRole: v })}
              >
                <SelectTrigger className="h-10 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BASE_ROLES.map((b) => (
                    <SelectItem key={b.code} value={b.code}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Role baru meminjam izin dari template ini, lalu dibatasi ke
                kegiatan yang dipilih di bawah.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Cakupan Kegiatan</Label>
              <Select
                value={baru.kegiatanId || ALL}
                onValueChange={(v) =>
                  setBaru({ ...baru, kegiatanId: v === ALL ? "" : v })
                }
              >
                <SelectTrigger className="h-10 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>
                    — Semua kegiatan (tidak dibatasi) —
                  </SelectItem>
                  {kegiatan.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.code} — {k.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={tambahRole}
              disabled={menyimpan || !baru.code.trim() || !baru.name.trim()}
            >
              {menyimpan && <Loader2 size={14} className="mr-2 animate-spin" />}
              Tambah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!hapus} onOpenChange={() => setHapus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus role {hapus?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Role yang masih dipakai pengguna tidak bisa dihapus — pindahkan
              dulu penggunanya ke role lain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={hapusRole}
              disabled={menghapus}
              className="bg-destructive hover:bg-destructive/90"
            >
              {menghapus ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Hapus {sel.selected.size} role?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Role yang masih dipakai pengguna akan gagal dihapus — pindahkan
              dulu penggunanya ke role lain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={hapusBatch}
              disabled={bulkMenghapus}
              className="bg-destructive hover:bg-destructive/90"
            >
              {bulkMenghapus ? "Menghapus..." : `Hapus ${sel.selected.size} role`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
