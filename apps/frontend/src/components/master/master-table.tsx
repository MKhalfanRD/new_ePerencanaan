"use client";

import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface Props<T extends { id: string | number }> {
  title: string;
  data: T[];
  columns: Column<T>[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (item: T) => void;
  onDelete: (id: string | number) => Promise<void>;
  onBulkDelete?: (ids: (string | number)[]) => Promise<void>;
  searchable?: boolean;
  searchKeys?: (keyof T)[];
}

export function MasterTable<T extends { id: string | number }>({
  title,
  data,
  columns,
  loading,
  onAdd,
  onEdit,
  onDelete,
  onBulkDelete,
  searchable = true,
  searchKeys = [],
}: Props<T>) {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const filtered =
    search && searchKeys.length > 0
      ? data.filter((item) =>
          searchKeys.some((key) =>
            String(item[key]).toLowerCase().includes(search.toLowerCase()),
          ),
        )
      : data;

  // Reset seleksi kalau data/filter berubah (mis. setelah hapus/pindah tab)
  useEffect(() => {
    setSelected(new Set());
  }, [data, search]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((item) => selected.has(item.id));

  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (allFilteredSelected) return new Set();
      const next = new Set(prev);
      filtered.forEach((item) => next.add(item.id));
      return next;
    });
  };

  const [lastClicked, setLastClicked] = useState<number | null>(null);

  const toggleSelectOne = (
    id: string | number,
    index: number,
    shiftKey: boolean,
  ) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastClicked !== null) {
        const [start, end] = [lastClicked, index].sort((a, b) => a - b);
        for (let i = start; i <= end; i++) next.add(filtered[i].id);
      } else {
        next.has(id) ? next.delete(id) : next.add(id);
      }
      return next;
    });
    setLastClicked(index);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await onDelete(deleteId);
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!onBulkDelete || selected.size === 0) return;
    setBulkDeleting(true);
    try {
      await onBulkDelete(Array.from(selected));
      setSelected(new Set());
      setBulkDeleteOpen(false);
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.length} data
          {selected.size > 0 && ` · ${selected.size} dipilih`}
        </p>
        <div className="flex items-center gap-2">
          {searchable && (
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Cari..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 w-48 text-sm"
              />
            </div>
          )}
          {onBulkDelete && selected.size > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 size={14} className="mr-1.5" />
              Hapus ({selected.size})
            </Button>
          )}
          <Button size="sm" onClick={onAdd}>
            <Plus size={14} className="mr-1.5" /> Tambah
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Tidak ada data</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {onBulkDelete && (
                      <th className="px-4 py-2.5 w-10">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-muted-foreground/40"
                        />
                      </th>
                    )}
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((item, i) => (
                    <tr
                      key={item.id}
                      className="hover:bg-accent/30 transition-colors"
                    >
                      {onBulkDelete && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(item.id)}
                            onClick={(e) =>
                              toggleSelectOne(item.id, i, e.shiftKey)
                            }
                            className="h-4 w-4 rounded border-muted-foreground/40"
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td key={col.key} className="px-4 py-3 text-sm">
                          {col.render
                            ? col.render(item)
                            : String((item as any)[col.key] ?? "—")}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <TooltipProvider delayDuration={300}>
                          <div className="flex items-center gap-1 justify-end">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => onEdit(item)}
                                >
                                  <Pencil size={13} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteId(item.id)}
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Hapus</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Data yang dihapus tidak dapat dikembalikan.
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

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Hapus {selected.size} data {title}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selected.size} data yang dipilih akan dihapus permanen dan tidak
              dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {bulkDeleting ? "Menghapus..." : `Hapus ${selected.size} data`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
