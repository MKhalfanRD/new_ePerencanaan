"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MasterTable } from "./master-table";
import api from "@/lib/api";

/**
 * Master Kategori Proyek per kegiatan (mis. Pembangunan jaringan). Dipilih
 * sekali per proyek dan menentukan bagian Valuasi/Kinerja yang berlaku.
 */
interface Kategori {
  id: string;
  kegiatanId: string;
  kode: string;
  name: string;
  kegiatan: { id: string; code: string; name: string };
}
interface Kegiatan {
  id: string;
  code: string;
  name: string;
}
const SEMUA = "__semua__";

export function KategoriProyekTab() {
  const [data, setData] = useState<Kategori[]>([]);
  const [kegiatan, setKegiatan] = useState<Kegiatan[]>([]);
  const [filter, setFilter] = useState(SEMUA);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ id?: string; kegiatanId: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    try {
      setData((await api.get("/master/kategori-proyek")).data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memuat kategori");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchAll();
    api.get("/master/kegiatan").then((r) => setKegiatan(r.data)).catch(() => {});
  }, []);

  const simpan = async () => {
    if (!form) return;
    if (!form.kegiatanId) return setError("Pilih kegiatan");
    if (!form.name.trim()) return setError("Isi nama kategori");
    setSaving(true);
    try {
      if (form.id) await api.patch(`/master/kategori-proyek/${form.id}`, { name: form.name.trim() });
      else await api.post("/master/kategori-proyek", { kegiatanId: form.kegiatanId, name: form.name.trim() });
      toast.success(form.id ? "Kategori diperbarui" : "Kategori ditambahkan");
      setForm(null);
      fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const onImport = async (rows: Record<string, string>[]) => {
    let created = 0;
    let dilewati = 0;
    for (const row of rows) {
      const kunci = row.kegiatanKode?.trim();
      const k = kegiatan.find((x) => x.code === kunci || x.id === kunci);
      const name = row.name?.trim();
      if (!k || !name || data.some((d) => d.kegiatanId === k.id && d.name.toLowerCase() === name.toLowerCase())) {
        dilewati++;
        continue;
      }
      try {
        await api.post("/master/kategori-proyek", { kegiatanId: k.id, name });
        created++;
      } catch {
        dilewati++;
      }
    }
    toast.success(`Import selesai: ${created} ditambah` + (dilewati ? `, ${dilewati} dilewati` : ""));
    fetchAll();
  };

  const tampil = filter === SEMUA ? data : data.filter((d) => d.kegiatanId === filter);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Kegiatan</span>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-9 w-[360px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEMUA}>Semua kegiatan</SelectItem>
            {kegiatan.map((k) => (
              <SelectItem key={k.id} value={k.id}>
                {k.code} · {k.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <MasterTable
        title="Kategori Proyek"
        data={tampil}
        loading={loading}
        columns={[
          {
            key: "kegiatanKode",
            label: "Kegiatan",
            render: (k) => `${k.kegiatan.code} · ${k.kegiatan.name}`,
            exportValue: (k) => k.kegiatan.code,
            importInfo: { wajib: true, contoh: 7691, keterangan: "Kode kegiatan" },
          },
          {
            key: "name",
            label: "Nama Kategori",
            importInfo: { wajib: true, keterangan: "Kategori yang sudah ada di kegiatan itu dilewati." },
          },
        ]}
        onAdd={() => {
          setError("");
          setForm({ kegiatanId: filter === SEMUA ? "" : filter, name: "" });
        }}
        onEdit={(k) => {
          setError("");
          setForm({ id: k.id, kegiatanId: k.kegiatanId, name: k.name });
        }}
        onDelete={async (id) => {
          try {
            await api.delete(`/master/kategori-proyek/${id}`);
            toast.success("Kategori dihapus");
            fetchAll();
          } catch (err: any) {
            toast.error(err.response?.data?.message || "Gagal menghapus");
          }
        }}
        onImport={onImport}
        exportable
        searchKeys={["name"]}
      />

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="kategori-kegiatan">
                  Kegiatan <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.kegiatanId}
                  disabled={!!form.id}
                  onValueChange={(v) => {
                    setError("");
                    setForm({ ...form, kegiatanId: v });
                  }}
                >
                  <SelectTrigger id="kategori-kegiatan" className="h-10 w-full">
                    <SelectValue placeholder="Pilih kegiatan" />
                  </SelectTrigger>
                  <SelectContent>
                    {kegiatan.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.code} · {k.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kategori-nama">
                  Nama kategori <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="kategori-nama"
                  className="h-10"
                  placeholder="Pembangunan bendung"
                  value={form.name}
                  onChange={(e) => {
                    setError("");
                    setForm({ ...form, name: e.target.value });
                  }}
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Batal
            </Button>
            <Button onClick={simpan} disabled={saving}>
              {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
