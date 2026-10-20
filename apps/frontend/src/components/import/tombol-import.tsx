"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TemplateExcel, unduhTemplate } from "@/lib/template-excel";

/**
 * Tombol "Import Excel" + dialog: download template, pilih file, lalu
 * serahkan file ke `onFile` (proses import tetap milik pemanggil).
 */
export function TombolImport({
  judul,
  templates,
  onFile,
  label = "Import Excel",
  size = "sm",
  className,
}: {
  judul: string;
  templates: TemplateExcel[];
  onFile: (file: File) => Promise<void>;
  label?: string;
  size?: "sm" | "default";
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [buka, setBuka] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [proses, setProses] = useState(false);

  const tutup = () => {
    setBuka(false);
    setFile(null);
  };

  const jalankan = async () => {
    if (!file) return;
    setProses(true);
    try {
      await onFile(file);
      tutup();
    } finally {
      setProses(false);
    }
  };

  return (
    <>
      <Button
        size={size}
        variant="outline"
        className={className}
        disabled={proses}
        onClick={() => setBuka(true)}
      >
        {proses ? (
          <Loader2 size={14} className="mr-1.5 animate-spin" />
        ) : (
          <Upload size={14} className="mr-1.5" />
        )}
        {label}
      </Button>
      <Dialog open={buka} onOpenChange={(v) => !v && !proses && tutup()}>
        <DialogContent className="!max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-primary" />
              Import {judul}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Belum punya file? Unduh template, isi sheet pertama, lalu upload
                di bawah. Penjelasan tiap kolom ada di sheet &quot;Petunjuk&quot;.
              </p>
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <Button
                    key={t.nama}
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => unduhTemplate(t)}
                  >
                    <Download size={12} className="mr-1.5" />
                    {t.judul ?? "Download template"}
                  </Button>
                ))}
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) setFile(f);
              }}
            />
            {file ? (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                <FileSpreadsheet size={18} className="shrink-0 text-ok" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {file.name}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={proses}
                  onClick={() => setFile(null)}
                >
                  <X size={14} />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground hover:border-primary hover:bg-primary/5"
              >
                <Upload size={22} className="mx-auto mb-2" />
                Klik untuk memilih file Excel (.xlsx)
              </button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={tutup} disabled={proses}>
              Batal
            </Button>
            <Button onClick={jalankan} disabled={!file || proses}>
              {proses && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
