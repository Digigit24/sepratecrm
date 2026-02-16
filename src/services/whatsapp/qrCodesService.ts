// src/services/whatsapp/qrCodesService.ts
import { whatsappClient } from '@/lib/whatsappClient';
import { API_CONFIG, buildUrl, buildQueryString } from '@/lib/apiConfig';
import {
  QRCode,
  QRCodeCreate,
  QRCodeUpdate,
  QRCodeListResponse,
  QRCodeDeleteResponse,
  ImageType,
} from '@/types/whatsappTypes';

class QRCodesService {
  /**
   * Get all QR codes with pagination
   */
  async getQRCodes(skip = 0, limit = 50): Promise<QRCodeListResponse> {
    try {
      console.log('📋 Fetching QR codes:', { skip, limit });

      const queryString = buildQueryString({ skip, limit });
      const url = `${API_CONFIG.WHATSAPP.QR_CODES}${queryString}`;

      const response = await whatsappClient.get<QRCodeListResponse>(url);

      console.log('✅ QR codes fetched:', {
        total: response.data.total,
        count: response.data.items.length,
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to fetch QR codes:', error);
      const message = error.response?.data?.detail || error.message || 'Failed to fetch QR codes';
      throw new Error(message);
    }
  }

  /**
   * Fetch QR codes from WhatsApp API and sync with database
   */
  async fetchQRCodesFromWhatsApp(imageType?: ImageType): Promise<QRCodeListResponse> {
    try {
      console.log('🔄 Fetching QR codes from WhatsApp:', { imageType });

      const queryString = imageType ? buildQueryString({ image_type: imageType }) : '';
      const url = `${API_CONFIG.WHATSAPP.QR_CODE_FETCH}${queryString}`;

      const response = await whatsappClient.get<QRCodeListResponse>(url);

      console.log('✅ QR codes synced from WhatsApp:', {
        total: response.data.total,
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to fetch QR codes from WhatsApp:', error);
      const message = error.response?.data?.detail || error.message || 'Failed to fetch QR codes from WhatsApp';
      throw new Error(message);
    }
  }

  /**
   * Get single QR code by code
   */
  async getQRCode(code: string, imageType?: ImageType): Promise<QRCode> {
    try {
      console.log('📱 Fetching QR code:', code);

      const url = buildUrl(
        API_CONFIG.WHATSAPP.QR_CODE_DETAIL,
        { code },
        'whatsapp'
      );

      const queryString = imageType ? buildQueryString({ image_type: imageType }) : '';
      const fullUrl = `${url}${queryString}`;

      const response = await whatsappClient.get<QRCode>(fullUrl);

      console.log('✅ QR code fetched:', response.data.code);

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to fetch QR code:', error);
      const message = error.response?.data?.detail || error.message || 'Failed to fetch QR code';
      throw new Error(message);
    }
  }

  /**
   * Create a new QR code
   */
  async createQRCode(payload: QRCodeCreate): Promise<QRCode> {
    try {
      console.log('➕ Creating QR code:', payload);

      const url = API_CONFIG.WHATSAPP.QR_CODE_CREATE;

      const response = await whatsappClient.post<QRCode>(url, payload);

      console.log('✅ QR code created:', response.data.code);

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to create QR code:', error);
      const message = error.response?.data?.detail || error.message || 'Failed to create QR code';
      throw new Error(message);
    }
  }

  /**
   * Update QR code prefilled message
   */
  async updateQRCode(code: string, payload: QRCodeUpdate): Promise<QRCode> {
    try {
      console.log('📝 Updating QR code:', code, payload);

      const url = buildUrl(
        API_CONFIG.WHATSAPP.QR_CODE_UPDATE,
        { code },
        'whatsapp'
      );

      const response = await whatsappClient.put<QRCode>(url, payload);

      console.log('✅ QR code updated:', response.data.code);

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to update QR code:', error);
      const message = error.response?.data?.detail || error.message || 'Failed to update QR code';
      throw new Error(message);
    }
  }

  /**
   * Delete a QR code
   */
  async deleteQRCode(code: string): Promise<QRCodeDeleteResponse> {
    try {
      console.log('🗑️ Deleting QR code:', code);

      const url = buildUrl(
        API_CONFIG.WHATSAPP.QR_CODE_DELETE,
        { code },
        'whatsapp'
      );

      const response = await whatsappClient.delete<QRCodeDeleteResponse>(url);

      console.log('✅ QR code deleted:', response.data.code);

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to delete QR code:', error);
      const message = error.response?.data?.detail || error.message || 'Failed to delete QR code';
      throw new Error(message);
    }
  }
}

export const qrCodesService = new QRCodesService();
