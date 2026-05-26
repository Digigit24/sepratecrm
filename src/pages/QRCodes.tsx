// src/pages/QRCodes.tsx
import { useState } from 'react';
import { useQRCodes } from '@/hooks/whatsapp/useQRCodes';
import type { QRCode } from '@/types/whatsappTypes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  RefreshCw,
  Download,
  QrCode as QrCodeIcon,
  Copy,
  ExternalLink,
  CheckCheck,
  MessageSquare,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── QR Card ─────────────────────────────────────────────────────────────────
function QRCard({ qr, onView }: { qr: QRCode; onView: (q: QRCode) => void }) {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(qr.wa_link);
      setCopied(true);
      toast.success('WhatsApp link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const downloadQR = () => {
    const a = document.createElement('a');
    a.href = qr.qr_image_url;
    a.download = `qr-${qr.phone_number}.png`;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="group relative bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
      {/* Top: QR image */}
      <div
        className="flex items-center justify-center bg-white cursor-pointer p-6"
        onClick={() => onView(qr)}
        title="Click to enlarge"
      >
        {!imgError ? (
          <img
            src={qr.qr_image_url}
            alt={`WhatsApp QR for ${qr.display_number}`}
            className="w-40 h-40 object-contain select-none"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-40 h-40 flex flex-col items-center justify-center bg-muted rounded-xl gap-2">
            <QrCodeIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-xs text-muted-foreground text-center">Image unavailable</p>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Bottom: info + actions */}
      <div className="p-4 space-y-3">
        {/* Name + badge */}
        <div className="space-y-0.5">
          {qr.verified_name && (
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-foreground truncate">{qr.verified_name}</p>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Verified
              </Badge>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span className="text-sm font-mono">{qr.display_number}</span>
          </div>
        </div>

        {/* wa.me link */}
        <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2.5 py-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-[#25d366] shrink-0" />
          <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{qr.wa_link}</span>
          <button
            type="button"
            onClick={copyLink}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            title="Copy link"
          >
            {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs gap-1.5"
            onClick={() => onView(qr)}
          >
            <QrCodeIcon className="h-3.5 w-3.5" />
            Enlarge
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs gap-1.5"
            onClick={downloadQR}
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
          <Button
            size="sm"
            className="h-8 w-8 p-0 bg-[#25d366] hover:bg-[#1ebe5d] text-white shrink-0"
            onClick={() => window.open(qr.wa_link, '_blank')}
            title="Open in WhatsApp"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Enlarged QR Dialog ───────────────────────────────────────────────────────
function QRViewDialog({ qr, open, onClose }: { qr: QRCode | null; open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  if (!qr) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(qr.wa_link);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCodeIcon className="h-5 w-5 text-[#25d366]" />
            {qr.verified_name || qr.display_number}
          </DialogTitle>
        </DialogHeader>

        {/* Large QR */}
        <div className="flex items-center justify-center bg-white rounded-xl p-6 border border-border">
          <img
            src={qr.qr_image_url}
            alt={`QR for ${qr.display_number}`}
            className="w-64 h-64 object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        {/* Scan instruction */}
        <p className="text-center text-xs text-muted-foreground">
          Scan with your phone camera to open WhatsApp
        </p>

        {/* Phone + copy */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-mono flex-1">{qr.display_number}</span>
          </div>
          <div className="flex items-center gap-2">
            <Input value={qr.wa_link} readOnly className="text-xs font-mono h-9" />
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={copyLink}>
              {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 bg-[#25d366] hover:bg-[#1ebe5d] text-white"
              onClick={() => window.open(qr.wa_link, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Download */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => {
            const a = document.createElement('a');
            a.href = qr.qr_image_url;
            a.download = `qr-${qr.phone_number}.png`;
            a.target = '_blank';
            a.click();
          }}
        >
          <Download className="h-4 w-4" />
          Download QR Image
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function QRCodes() {
  const { qrCodes, total, isLoading, error, revalidate } = useQRCodes();
  const [viewQR, setViewQR] = useState<QRCode | null>(null);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {/* Skeleton header */}
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 rounded bg-muted animate-pulse" />
          <div className="h-8 w-8 rounded bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl border bg-card overflow-hidden">
              <div className="h-52 bg-muted animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                <div className="h-8 rounded bg-muted animate-pulse mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh] p-6">
        <div className="text-center max-w-sm space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <QrCodeIcon className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-destructive">Failed to load QR codes</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {error.message || 'Something went wrong. Please try again.'}
            </p>
          </div>
          <Button onClick={() => revalidate()} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">QR Codes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Share these QR codes so customers can start a WhatsApp chat instantly
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => revalidate()}
          title="Refresh"
          className="h-9 w-9"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Count badge */}
      {total > 0 && (
        <p className="text-xs text-muted-foreground">
          {total} phone number{total !== 1 ? 's' : ''} registered
        </p>
      )}

      {/* Grid */}
      {qrCodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <QrCodeIcon className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-base mb-1">No phone numbers found</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            No WhatsApp phone numbers are registered on your account yet. Add a phone number in your WhatsApp settings to generate a QR code.
          </p>
          <Button
            variant="outline"
            className="mt-4 gap-2"
            onClick={() => revalidate()}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {qrCodes.map((qr) => (
            <QRCard
              key={qr.phone_number}
              qr={qr}
              onView={setViewQR}
            />
          ))}
        </div>
      )}

      {/* Enlarged view dialog */}
      <QRViewDialog
        qr={viewQR}
        open={!!viewQR}
        onClose={() => setViewQR(null)}
      />
    </div>
  );
}
