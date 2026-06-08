// src/components/crm/LeadAttachments.tsx
import React, { useState, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { 
  Paperclip, Loader2, Music, FileText, Image, FileSpreadsheet, 
  Trash2, Download, AlertCircle, CheckCircle2, UploadCloud
} from 'lucide-react';
import { toast } from 'sonner';

import { crmClient } from '@/lib/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

interface LeadAttachmentsProps {
  leadId: number;
}

interface Attachment {
  id: number;
  tenant_id: string;
  lead: number;
  file_name: string;
  file_size: number;
  mime_type: string;
  zata_video_id: string | null;
  download_url: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export const LeadAttachments: React.FC<LeadAttachmentsProps> = ({ leadId }) => {
  const { user } = useAuth();
  const { useTenantDetail } = useTenant();
  const { data: tenant } = useTenantDetail(user?.tenant?.id || null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Extract Zata mapping configuration from Tenant Settings JSON
  const zataConfig = tenant?.settings?.zata_config || {};
  const workspaceBucket = zataConfig.workspace_bucket || '';
  const zataFolderId = zataConfig.folder_id || '';

  // SWR for fetching attachments
  const { 
    data: attachments = [], 
    error, 
    isLoading: isListLoading, 
    mutate 
  } = useSWR<Attachment[]>(
    leadId ? `/crm/leads/${leadId}/attachments/` : null,
    async () => {
      const response = await crmClient.get(`/crm/leads/${leadId}/attachments/`);
      return response.data;
    }
  );

  // Format file size helper
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get matching icon for file type
  const getFileIcon = (mimeType: string) => {
    const mime = mimeType.toLowerCase();
    if (mime.startsWith('image/')) return <Image className="h-5 w-5 text-blue-500" />;
    if (mime.startsWith('audio/')) return <Music className="h-5 w-5 text-emerald-500" />;
    if (mime.startsWith('video/')) return <FileText className="h-5 w-5 text-indigo-500" />;
    if (mime === 'application/pdf') return <FileText className="h-5 w-5 text-red-500" />;
    if (
      mime.includes('excel') || 
      mime.includes('spreadsheet') || 
      mime.includes('sheet') || 
      mime === 'text/csv'
    ) {
      return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    }
    return <Paperclip className="h-5 w-5 text-muted-foreground" />;
  };

  // Upload trigger
  const handleUpload = useCallback(async (file: File) => {
    if (!leadId) return;

    if (!workspaceBucket || !zataFolderId) {
      toast.error(
        'Tenant preferences mapping missing in SuperAdmin settings. Please configure zata_config inside preferences.',
        { duration: 6000 }
      );
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(10);
      
      const formData = new FormData();
      formData.append('file', file);

      // Trigger the proxied API request injecting preferences mapping headers
      const response = await crmClient.post(`/crm/leads/${leadId}/attachments/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Zata-Bucket': workspaceBucket,
          'X-Zata-Folder-ID': zataFolderId,
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || progressEvent.loaded));
          setUploadProgress(Math.min(percentCompleted, 95));
        }
      });

      setUploadProgress(100);
      toast.success(`"${file.name}" uploaded successfully`);
      
      // Update local SWR state
      await mutate([...attachments, response.data], false);
    } catch (err: any) {
      console.error('[Upload Error]', err);
      const msg = err.response?.data?.error || err.message || 'Failed to upload file';
      toast.error(msg);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [leadId, workspaceBucket, zataFolderId, attachments, mutate]);

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  // Delete attachment
  const handleDelete = async (attachment: Attachment) => {
    if (!window.confirm(`Are you sure you want to delete "${attachment.file_name}"?`)) return;

    try {
      toast.loading(`Deleting ${attachment.file_name}...`);
      await crmClient.delete(`/crm/leads/${leadId}/attachments/${attachment.id}/`);
      
      // Update local state
      await mutate(attachments.filter(a => a.id !== attachment.id), false);
      toast.dismiss();
      toast.success('Attachment deleted');
    } catch (err: any) {
      toast.dismiss();
      const msg = err.response?.data?.error || err.message || 'Failed to delete attachment';
      toast.error(msg);
    }
  };

  // Check if configuration is missing
  const isConfigMissing = !workspaceBucket || !zataFolderId;

  return (
    <div className="space-y-4">
      {/* Configuration Missing Alert Banner */}
      {isConfigMissing && !isListLoading && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-semibold text-amber-800">Storage Settings Missing</h4>
            <p className="text-xs text-amber-700 mt-0.5">
              Zata storage workspace and folder configuration is not yet set in your tenant preference settings. 
              Configure `zata_config` in your Admin Preferences module to enable attachments.
            </p>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer text-center bg-card
          ${isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-muted-foreground/20 hover:border-primary/50'}
          ${isUploading ? 'opacity-70 pointer-events-none' : ''}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />
        
        {isUploading ? (
          <div className="flex flex-col items-center space-y-2">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-xs font-medium text-foreground">Uploading and proxying file to Zata...</p>
            <div className="w-48 bg-muted rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-350" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <UploadCloud className={`h-10 w-10 text-muted-foreground/60 transition-transform ${isDragging ? 'animate-bounce' : ''}`} />
            <div>
              <p className="text-xs font-medium text-foreground">Drag & Drop files here, or click to browse</p>
              <p className="text-[10px] text-muted-foreground mt-1">Supports Audio, PDFs, Spreadsheets, images & documents</p>
            </div>
          </div>
        )}
      </div>

      {/* Attachments list */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Lead Attachments ({attachments.length})
        </h3>

        {isListLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-6 border rounded-lg bg-card text-xs text-destructive">
            Failed to load attachments.
          </div>
        ) : attachments.length === 0 ? (
          <div className="text-center py-8 border rounded-lg bg-card text-muted-foreground text-xs flex flex-col items-center justify-center">
            <Paperclip className="h-6 w-6 text-muted-foreground/30 mb-1" />
            No files attached to this lead
          </div>
        ) : (
          <div className="border rounded-lg bg-card divide-y divide-border/50">
            {attachments.map(attachment => (
              <div key={attachment.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                    {getFileIcon(attachment.mime_type)}
                  </div>
                  <div className="min-w-0">
                    <p 
                      onClick={() => window.open(attachment.download_url, '_blank')}
                      className="text-xs font-medium text-foreground hover:text-primary hover:underline cursor-pointer truncate max-w-[280px]"
                    >
                      {attachment.file_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatFileSize(attachment.file_size)} · {attachment.created_at ? new Date(attachment.created_at).toLocaleDateString() : 'Today'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button 
                    onClick={() => window.open(attachment.download_url, '_blank')}
                    className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                    title="Download attachment"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(attachment)}
                    className="p-1.5 hover:bg-red-50 rounded text-muted-foreground hover:text-red-600 transition-colors"
                    title="Delete attachment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
