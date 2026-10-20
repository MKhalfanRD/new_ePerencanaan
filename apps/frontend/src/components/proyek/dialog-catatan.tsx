"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Minta catatan sebelum mengembalikan proyek (wajib) atau aksi lain (opsional). */
export function DialogCatatan({
  open,
  judul,
  keterangan,
  label = "Catatan",
  tombol,
  wajib,
  bahaya,
  onClose,
  onKirim,
}: {
  open: boolean;
  judul: string;
  keterangan?: string;
  label?: string;
  tombol: string;
  wajib?: boolean;
  bahaya?: boolean;
  onClose: () => void;
  /** Lempar error = dialog tetap terbuka. */
  onKirim: (catatan: string) => Promise<void>;
}) {
  const [catatan, setCatatan] = useState("");
  const [kirim, setKirim] = useState(false);
  useEffect(() => {
    if (open) setCatatan("");
  }, [open]);
  const kurang = wajib && catatan.trim().length < 3;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !kirim && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          {keterangan && <DialogDescription>{keterangan}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="catatan-alur">
            {label} {wajib ? <span className="text-destructive">*</span> : <span className="text-muted-foreground">(opsional)</span>}
          </Label>
          <Textarea
            id="catatan-alur"
            autoFocus
            rows={4}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder={wajib ? "Tulis apa yang perlu diperbaiki…" : "Tulis catatan bila perlu…"}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={kirim}>
            Batal
          </Button>
          <Button
            variant={bahaya ? "destructive" : "default"}
            disabled={kirim || kurang}
            onClick={async () => {
              setKirim(true);
              try {
                await onKirim(catatan.trim());
              } finally {
                setKirim(false);
              }
            }}
          >
            {kirim && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tombol}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
