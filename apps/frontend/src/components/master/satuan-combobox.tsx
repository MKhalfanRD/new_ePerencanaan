"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

export interface SatuanOption {
  id: string;
  name: string;
}

/** Cache module-level supaya tiap instance combobox di form yang sama
 * tidak fetch /master/satuan berkali-kali. */
let satuanCache: SatuanOption[] | null = null;
let satuanCachePromise: Promise<SatuanOption[]> | null = null;

export function loadSatuan(): Promise<SatuanOption[]> {
  if (satuanCache) return Promise.resolve(satuanCache);
  if (!satuanCachePromise) {
    satuanCachePromise = api
      .get("/master/satuan")
      .then((res) => {
        satuanCache = res.data;
        return satuanCache!;
      })
      .catch(() => []);
  }
  return satuanCachePromise;
}

/** Reset cache setelah menambah satuan baru dari combobox mana pun. */
function invalidateSatuanCache() {
  satuanCache = null;
  satuanCachePromise = null;
}

interface Props {
  value?: string | null;
  onChange: (satuanId: string, name: string) => void;
  placeholder?: string;
  className?: string;
}

/** Dropdown satuan yang bisa menambah opsi baru (creatable) — dipakai di
 * form RO/Komponen/Indikator RO supaya format satuan konsisten antar form. */
export function SatuanCombobox({
  value,
  onChange,
  placeholder = "Pilih atau ketik satuan...",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<SatuanOption[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSatuan().then(setOptions);
  }, []);

  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const exactMatch = options.some(
    (o) => o.name.toLowerCase() === query.trim().toLowerCase(),
  );

  const handleCreate = async () => {
    const name = query.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      const res = await api.post("/master/satuan", { name });
      const created: SatuanOption = res.data;
      invalidateSatuanCache();
      setOptions((prev) =>
        prev.some((o) => o.id === created.id) ? prev : [...prev, created],
      );
      onChange(created.id, created.name);
      setQuery("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-9 w-full justify-between font-normal text-sm",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          {selected ? selected.name : placeholder}
          <ChevronsUpDown className="size-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <Input
          autoFocus
          placeholder="Cari atau tambah satuan..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 text-xs mb-2"
        />
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onChange(o.id, o.name);
                setQuery("");
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
            >
              <Check
                size={12}
                className={cn(
                  "shrink-0",
                  o.id === value ? "opacity-100" : "opacity-0",
                )}
              />
              {o.name}
            </button>
          ))}
          {filtered.length === 0 && !query && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Belum ada satuan
            </p>
          )}
          {query.trim() && !exactMatch && (
            <button
              type="button"
              disabled={saving}
              onClick={handleCreate}
              className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-primary hover:bg-accent disabled:opacity-50"
            >
              <Plus size={12} className="shrink-0" />
              Tambah "{query.trim()}"
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
