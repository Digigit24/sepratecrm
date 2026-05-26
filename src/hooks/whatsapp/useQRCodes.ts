// src/hooks/whatsapp/useQRCodes.ts
import useSWR from 'swr';
import { qrCodesService } from '@/services/whatsapp/qrCodesService';
import type { QRCode } from '@/types/whatsappTypes';

export const useQRCodes = () => {
  const { data, error, isLoading, mutate } = useSWR(
    'qr-codes',
    () => qrCodesService.getQRCodes(),
    { revalidateOnFocus: false }
  );

  return {
    qrCodes: (data?.qr_codes ?? []) as QRCode[],
    total: data?.total ?? 0,
    isLoading,
    error,
    revalidate: mutate,
  };
};
