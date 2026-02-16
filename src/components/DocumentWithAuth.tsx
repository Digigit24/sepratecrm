import React, { useState, useEffect } from 'react';
import { whatsappClient } from '@/lib/whatsappClient';
import { FileText } from 'lucide-react';

interface DocumentWithAuthProps {
  src: string;
  filename: string;
  className?: string;
}

const DocumentWithAuth: React.FC<DocumentWithAuthProps> = ({ src, filename, className }) => {
  const [docSrc, setDocSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocument = async () => {
      if (!src) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await whatsappClient.get(src, {
          responseType: 'blob',
        });
        
        const mimeType = response.headers['content-type'] || 'application/octet-stream';
        const blob = new Blob([response.data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        setDocSrc(url);
      } catch (err) {
        console.error('Failed to fetch document:', err);
        setError('Failed to load document');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();

    // Cleanup function
    return () => {
      if (docSrc) {
        URL.revokeObjectURL(docSrc);
      }
    };
  }, [src]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-md p-4 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-destructive/10 text-destructive text-xs rounded-md p-4 ${className}`}>
        {error}
      </div>
    );
  }

  if (!docSrc) {
    return null;
  }

  return (
    <a href={docSrc} download={filename} className={`flex items-center gap-2 p-4 bg-muted rounded-md ${className}`}>
      <FileText className="h-6 w-6" />
      <span>{filename}</span>
    </a>
  );
};

export default DocumentWithAuth;
