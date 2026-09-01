import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Renders a UPI payment URI as a scannable QR code (generated client-side —
// no third-party service call).
export function UpiQrCode({ uri, size = 180 }: { uri: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(uri, { width: size, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uri, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-md border border-cream-200 bg-cream-50 text-[11px] text-ink-400"
      >
        Generating…
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="UPI payment QR code"
      width={size}
      height={size}
      className="rounded-md border border-cream-200 bg-white"
    />
  );
}
