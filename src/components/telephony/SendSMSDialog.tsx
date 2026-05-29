// src/components/telephony/SendSMSDialog.tsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Send, Phone } from 'lucide-react';
import { useTelephony } from '@/hooks/useTelephony';

/** ~160 chars per SMS segment. */
const SEGMENT_LEN = 160;

export interface SmsTarget {
  /** CRM Lead id (optional — when present, backend logs a LeadActivity). */
  leadId?: number;
  /** Recipient phone number. */
  phone: string;
  /** Display name for the dialog header (optional). */
  name?: string;
}

interface SendSMSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: SmsTarget | null;
}

export const SendSMSDialog: React.FC<SendSMSDialogProps> = ({ open, onOpenChange, target }) => {
  const { sendSMS } = useTelephony();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  // Recipient is editable only when no number was pre-filled (e.g. global SMS page).
  const presetPhone = (target?.phone || '').trim();
  const phoneEditable = presetPhone === '';
  const [toNumber, setToNumber] = useState('');

  // Reset the form whenever a fresh dialog is opened.
  useEffect(() => {
    if (open) {
      setMessage('');
      setToNumber('');
    }
  }, [open, target?.phone]);

  const effectivePhone = phoneEditable ? toNumber.trim() : presetPhone;
  const segments = message.length === 0 ? 0 : Math.ceil(message.length / SEGMENT_LEN);

  const handleSend = async () => {
    if (!effectivePhone) return;
    if (!message.trim()) return;

    setIsSending(true);
    try {
      await sendSMS({
        to_number: effectivePhone,
        message: message.trim(),
        lead_id: target?.leadId,
      });
      // Success → close and clear. (Toast shown by the hook.)
      setMessage('');
      onOpenChange(false);
    } catch {
      // 502 etc → hook already toasted the backend error.
      // Keep the dialog open with the text intact so the user can retry.
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send SMS{target?.name ? ` to ${target.name}` : ''}</DialogTitle>
          <DialogDescription>
            Delivered via TeleCMI. {target?.leadId ? 'Logged to the lead timeline.' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {phoneEditable ? (
            <div className="space-y-1.5">
              <Label htmlFor="sms-to">To</Label>
              <Input
                id="sms-to"
                placeholder="Recipient number with country code, e.g. 919000000000"
                inputMode="tel"
                value={toNumber}
                onChange={(e) => setToNumber(e.target.value)}
                autoFocus
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">To:</span>
              <span className="font-medium font-mono">{presetPhone}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="sms-message">Message</Label>
            <Textarea
              id="sms-message"
              placeholder="Type your message…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              autoFocus={!phoneEditable}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{message.length} characters</span>
              <span>
                {segments} segment{segments === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !message.trim() || !effectivePhone}>
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send SMS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SendSMSDialog;
