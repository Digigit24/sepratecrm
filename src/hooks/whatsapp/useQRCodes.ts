// src/hooks/whatsapp/useQRCodes.ts
import useSWR, { mutate } from 'swr';
import { qrCodesService } from '@/services/whatsapp/qrCodesService';
import {
  QRCode,
  QRCodeCreate,
  QRCodeUpdate,
  ImageType,
} from '@/types/whatsappTypes';

// SWR key generators
const getQRCodesKey = (skip?: number, limit?: number) =>
  ['qr-codes', skip, limit];

const getQRCodeKey = (code: string) => ['qr-code', code];

/**
 * Hook to fetch all QR codes
 */
export const useQRCodes = (skip = 0, limit = 50) => {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    getQRCodesKey(skip, limit),
    () => qrCodesService.getQRCodes(skip, limit),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  return {
    qrCodes: data?.items || [],
    total: data?.total || 0,
    page: data?.page || 1,
    pageSize: data?.page_size || 50,
    isLoading,
    error,
    revalidate,
  };
};

/**
 * Hook to fetch a single QR code
 */
export const useQRCode = (code: string | null, imageType?: ImageType) => {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    code ? getQRCodeKey(code) : null,
    () => (code ? qrCodesService.getQRCode(code, imageType) : null),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  return {
    qrCode: data || null,
    isLoading,
    error,
    revalidate,
  };
};

/**
 * Hook for QR code mutations (create, update, delete)
 */
export const useQRCodeMutations = () => {
  const createQRCode = async (payload: QRCodeCreate): Promise<QRCode> => {
    try {
      const newQRCode = await qrCodesService.createQRCode(payload);

      // Revalidate all QR codes lists
      mutate(
        (key) => Array.isArray(key) && key[0] === 'qr-codes',
        undefined,
        { revalidate: true }
      );

      return newQRCode;
    } catch (error: any) {
      throw error;
    }
  };

  const updateQRCode = async (code: string, payload: QRCodeUpdate): Promise<QRCode> => {
    try {
      const updatedQRCode = await qrCodesService.updateQRCode(code, payload);

      // Revalidate specific QR code
      mutate(getQRCodeKey(code), updatedQRCode, false);

      // Revalidate all QR codes lists
      mutate(
        (key) => Array.isArray(key) && key[0] === 'qr-codes',
        undefined,
        { revalidate: true }
      );

      return updatedQRCode;
    } catch (error: any) {
      throw error;
    }
  };

  const deleteQRCode = async (code: string): Promise<void> => {
    try {
      await qrCodesService.deleteQRCode(code);

      // Remove from cache
      mutate(getQRCodeKey(code), undefined, false);

      // Revalidate all QR codes lists
      mutate(
        (key) => Array.isArray(key) && key[0] === 'qr-codes',
        undefined,
        { revalidate: true }
      );
    } catch (error: any) {
      throw error;
    }
  };

  const fetchFromWhatsApp = async (imageType?: ImageType): Promise<void> => {
    try {
      await qrCodesService.fetchQRCodesFromWhatsApp(imageType);

      // Revalidate all QR codes lists
      mutate(
        (key) => Array.isArray(key) && key[0] === 'qr-codes',
        undefined,
        { revalidate: true }
      );
    } catch (error: any) {
      throw error;
    }
  };

  return {
    createQRCode,
    updateQRCode,
    deleteQRCode,
    fetchFromWhatsApp,
  };
};
