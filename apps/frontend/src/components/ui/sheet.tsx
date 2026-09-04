"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

function Sheet({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * SheetContent — modal terpusat (bekas panel geser, sekarang tampil seperti
 * Dialog biasa). layer="1" cuma menentukan lebar maksimal (~660px, dipakai
 * untuk Detail Proyek), layer="2" lebih sempit (~440px, form Alokasi/Lokasi).
 * Menumpuk seperti dialog-di-atas-dialog biasa — tidak ada lagi efek
 * "terdorong" (lihat `sheetPushedProps`).
 */
function SheetContent({
  className,
  children,
  layer = "1",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  side?: "right" | "left"; // dipertahankan supaya call site lama tidak perlu diubah; tidak lagi berpengaruh ke tampilan
  layer?: "1" | "2";
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        data-layer={layer}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-full -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-xl bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          layer === "1" && "max-w-[660px]",
          layer === "2" && "max-w-[440px]",
          "max-sm:max-w-[calc(100%-2rem)]",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="sheet-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-3 right-3"
              size="icon-sm"
            >
              <XIcon />
              <span className="sr-only">Tutup</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "flex shrink-0 flex-col gap-1.5 border-b bg-background px-5 py-4 pr-12",
        className,
      )}
      {...props}
    />
  );
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("flex-1 overflow-y-auto", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "sticky bottom-0 flex shrink-0 flex-col-reverse gap-2 border-t bg-background/95 px-5 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-base leading-none font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * SheetBreadcrumb — breadcrumb navigasi di header tiap drawer.
 * Segmen terakhir non-clickable (halaman saat ini), segmen lain clickable.
 *
 * items: array segmen. Segmen dengan `onClick` akan dirender sebagai tombol.
 *
 * Sengaja SATU BARIS (tidak wrap) — di Sheet lapis-2 yang sempit (440px),
 * breadcrumb 3 segmen + nama proyek panjang dulu pernah bikin "›" nyangkut
 * sendirian di baris terpisah. Sekarang segmen tengah/terakhir yang panjang
 * di-truncate (ellipsis), segmen pertama ("Daftar Planning") selalu utuh
 * karena itu jangkarnya.
 */
function SheetBreadcrumb({
  items,
  className,
}: {
  items: { label: string; onClick?: () => void }[];
  className?: string;
}) {
  return (
    <nav
      data-slot="sheet-breadcrumb"
      aria-label="breadcrumb"
      className={cn(
        "flex items-center gap-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {items.map((item, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <span className="text-muted-foreground/50 shrink-0">›</span>
            )}
            {item.onClick && !isLast ? (
              <button
                type="button"
                title={item.label}
                onClick={item.onClick}
                className={cn(
                  "truncate rounded-sm text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50",
                  isFirst ? "shrink-0" : "min-w-0",
                )}
              >
                {item.label}
              </button>
            ) : (
              <span
                title={item.label}
                className={cn(
                  "truncate",
                  isLast ? "min-w-0 font-medium text-foreground" : "shrink-0",
                )}
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/**
 * Bekas util efek "terdorong" dari mode drawer. Sheet sekarang tampil sebagai
 * modal biasa (lihat SheetContent) yang menumpuk seperti dialog-di-atas-dialog,
 * jadi tidak butuh efek dorong lagi — dibiarkan sebagai no-op supaya call site
 * lama (`{...sheetPushedProps(pushed)}`) tidak perlu ikut diubah satu-satu.
 * ponytail: no-op shim, hapus pemanggilannya di call site kalau sempat beres-beres.
 */
function sheetPushedProps(_pushed: boolean) {
  return {} as const;
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetBreadcrumb,
  SheetPortal,
  SheetOverlay,
  sheetPushedProps,
};
