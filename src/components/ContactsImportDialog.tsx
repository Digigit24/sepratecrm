// src/components/ContactsImportDialog.tsx
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { contactsService } from '@/services/whatsapp/contactsService';
import { toast } from 'sonner';

interface ContactsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function ContactsImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: ContactsImportDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = (file: File) => {
    // Validate file type
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Please select a valid Excel or CSV file');
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to import');
      return;
    }

    setIsImporting(true);
    try {
      const result = await contactsService.importContacts(selectedFile);
      toast.success(result || 'Contacts imported successfully');
      onSuccess();
      onOpenChange(false);
      setSelectedFile(null);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to import contacts');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      setSelectedFile(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Contacts
          </DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file to import contacts into your WhatsApp account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Column Requirements */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Column Requirements
            </h4>

            <div className="space-y-2 text-sm">
              {/* Required Columns */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-destructive font-medium">
                  <AlertCircle className="h-4 w-4" />
                  Required Columns
                </div>
                <ul className="ml-6 space-y-1 text-muted-foreground">
                  <li className="list-disc"><span className="font-medium">phone</span> - Contact phone number (with country code)</li>
                  <li className="list-disc"><span className="font-medium">name</span> - Contact name</li>
                </ul>
              </div>

              {/* Optional Columns */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-500 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Optional Columns
                </div>
                <ul className="ml-6 space-y-1 text-muted-foreground">
                  <li className="list-disc"><span className="font-medium">notes</span> - Additional notes</li>
                  <li className="list-disc"><span className="font-medium">labels</span> - Comma-separated labels</li>
                  <li className="list-disc"><span className="font-medium">groups</span> - Comma-separated groups</li>
                  <li className="list-disc"><span className="font-medium">is_business</span> - true/false for business contact</li>
                  <li className="list-disc"><span className="font-medium">business_description</span> - Business description</li>
                  <li className="list-disc"><span className="font-medium">assigned_to</span> - Assigned user</li>
                  <li className="list-disc"><span className="font-medium">status</span> - Contact status</li>
                </ul>
              </div>
            </div>
          </div>

          {/* File Upload Area */}
          <div
            className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div className="space-y-2">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-primary" />
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                  disabled={isImporting}
                >
                  Choose Different File
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="font-medium">Drop your file here or click to browse</p>
                  <p className="text-sm text-muted-foreground">
                    Supports .xlsx, .xls, and .csv files
                  </p>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isImporting}
                />
              </div>
            )}
          </div>

          {/* Example Format */}
          <div className="rounded-lg bg-muted/30 p-3 text-xs">
            <p className="font-medium mb-2">Example Format:</p>
            <div className="bg-background rounded border p-2 font-mono overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-1 text-left">phone</th>
                    <th className="px-2 py-1 text-left">name</th>
                    <th className="px-2 py-1 text-left">labels</th>
                    <th className="px-2 py-1 text-left">notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-2 py-1">+919876543210</td>
                    <td className="px-2 py-1">John Doe</td>
                    <td className="px-2 py-1">VIP,Customer</td>
                    <td className="px-2 py-1">Regular client</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1">+919876543211</td>
                    <td className="px-2 py-1">Jane Smith</td>
                    <td className="px-2 py-1">Lead</td>
                    <td className="px-2 py-1">New prospect</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!selectedFile || isImporting}>
            {isImporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import Contacts
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
