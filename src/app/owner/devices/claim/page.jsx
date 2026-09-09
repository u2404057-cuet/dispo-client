"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scanner } from "@yudiel/react-qr-scanner";
import { QrCode } from "@gravity-ui/icons";

export default function ClaimScannerPage() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);

  // The QR now encodes just the raw device token (not a full URL) — the
  // claim page itself will report "device not found" if it's wrong, so no
  // extra validation is needed here.
  const handleScan = (result) => {
    const value = result?.[0]?.rawValue?.trim();
    if (!value) return;
    router.push(`/owner/devices/claim/${value}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm rounded-[2rem] bg-surface-container-low p-6 shadow-[12px_12px_28px_rgba(184,196,214,0.65),-12px_-12px_28px_rgba(255,255,255,0.95)]">
        <h1 className="font-headline-lg text-headline-lg text-on-surface text-center mb-1">
          Claim a device
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant text-center mb-6">
          Scan the QR code that came with your machine.
        </p>

        {isScanning ? (
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-2xl">
              <Scanner onScan={handleScan} />
            </div>
            <button
              onClick={() => setIsScanning(false)}
              className="rounded-full bg-surface-container px-5 py-2.5 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsScanning(true)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-container px-5 py-4 font-label-lg text-label-lg text-on-primary shadow-[4px_6px_14px_rgba(255,93,0,0.38)] transition-transform hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <QrCode className="h-5 w-5" />
            Scan code
          </button>
        )}
      </div>
    </main>
  );
}
