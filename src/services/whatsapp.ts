import { whatsappClient } from "@/lib/whatsappClient";
import { API_CONFIG, buildUrl } from "@/lib/apiConfig";
import { getWhatsappVendorUid } from "@/services/externalWhatsappService";
import { externalWhatsappClient } from "@/lib/externalWhatsappClient";

export type MediaMessagePayload = {
  to: string;
  media_type: 'image' | 'video' | 'audio' | 'document';
  media_id: string;
  caption?: string;
};

export const uploadMedia = async (file: File) => {
  const vendorUid = getWhatsappVendorUid();
  if (!vendorUid) {
    throw new Error('WhatsApp vendor not configured');
  }

  const formData = new FormData();
  formData.append('file', file);

  // Use external API endpoint with vendorUid
  const endpoint = `/${vendorUid}/media/upload`;
  const response = await externalWhatsappClient.post(endpoint, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  // Return response with media_url for sending
  return {
    media_id: response.data?.data?.media_url || response.data?.media_url,
    url: response.data?.data?.media_url || response.data?.media_url,
    file_name: response.data?.data?.file_name || file.name,
  };
};

export const sendMediaMessage = async (payload: MediaMessagePayload) => {
  const response = await whatsappClient.post(API_CONFIG.WHATSAPP.SEND_MEDIA, payload);
  return response.data;
};

export const getMediaUrl = (media_id: string) => {
  return buildUrl(API_CONFIG.WHATSAPP.GET_MEDIA, { media_id }, 'whatsapp');
};
