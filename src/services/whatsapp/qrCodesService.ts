// src/services/whatsapp/qrCodesService.ts
import { externalWhatsappClient, getVendorUid } from '@/lib/externalWhatsappClient';
import type { QRCode, QRCodeListResponse } from '@/types/whatsappTypes';

class QRCodesService {
  async getQRCodes(): Promise<QRCodeListResponse> {
    try {
      const vendorUid = getVendorUid();
      if (!vendorUid) throw new Error('Vendor UID not found. Please ensure you are logged in.');
      const response = await externalWhatsappClient.get<{ result: string; data: QRCodeListResponse }>(
        `/${vendorUid}/qr-codes`
      );
      const data = response.data?.data;
      return {
        qr_codes: data?.qr_codes ?? [],
        total: data?.total ?? 0,
      };
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch QR codes';
      throw new Error(message);
    }
  }
}

export const qrCodesService = new QRCodesService();
