// src/components/ContactsImportDialog.tsx
import { useState } from 'react';
import * as XLSX from 'xlsx';
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
import { contactsService, type ImportContactItem } from '@/services/whatsapp/contactsService';
import { toast } from 'sonner';

interface ContactsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function parseFileToContacts(file: File): Promise<ImportContactItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

        const contacts: ImportContactItem[] = rows
          .map((row) => {
            const rawPhone = String(
              row.phone ?? row.Phone ?? row.phone_number ?? row['Phone Number'] ?? ''
            ).replace(/\s+/g, '');
            if (!rawPhone) return null;

            const fullName = String(row.name ?? row.Name ?? '').trim();
            const firstName = String(row.first_name ?? row['First Name'] ?? (fullName ? fullName.split(' ')[0] : '')).trim();
            const lastName = String(row.last_name ?? row['Last Name'] ?? (fullName ? fullName.split(' ').slice(1).join(' ') : '')).trim() || undefined;

            return {
              phone_number: rawPhone,
              first_name: firstName || undefined,
              last_name: lastName,
              email: String(row.email ?? row.Email ?? '').trim() || undefined,
              country: String(row.country ?? row.Country ?? '').trim() || undefined,
              language_code: String(row.language_code ?? row.language ?? '').trim() || undefined,
            } satisfies ImportContactItem;
          })
          .filter((c): c is ImportContactItem => c !== null);

        resolve(contacts);
      } catch (err) {
        reject(new Error('Failed to parse file. Make sure it is a valid CSV or Excel file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export default function ContactsImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: ContactsImportDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = (file: File) => {
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
    setImportStatus(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to import');
      return;
    }

    setIsImporting(true);
    setImportStatus('Parsing file…');

    try {
      const contacts = await parseFileToContacts(selectedFile);

      if (contacts.length === 0) {
        toast.error('No valid contacts found. Ensure the file has a "phone" column with values.');
        return;
      }

      setImportStatus(`Uploading ${contacts.length} contacts…`);
      const result = await contactsService.importContacts({ contacts });

      const importId: string | undefined =
        result?.import_id ?? result?.id ?? result?.job_id ?? result?.data?.import_id;

      if (importId) {
        setImportStatus('Processing import…');

        // Poll import status — max 60 seconds (30 × 2 s)
        let done = false;
        for (let i = 0; i < 30 && !done; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const status = await contactsService.getImportStatus(importId);
            const state: string = status?.status ?? status?.state ?? '';

            if (state === 'completed' || state === 'done' || state === 'success') {
              const imported = status?.imported ?? status?.total ?? contacts.length;
              toast.success(`Import complete — ${imported} contacts imported`);
              done = true;
            } else if (state === 'failed' || state === 'error') {
              throw new Error(status?.message ?? 'Import failed on the server');
            } else {
              setImportStatus(`Processing… (${state || 'queued'})`);
            }
          } catch (pollErr: any) {
            // Ignore transient poll errors; the loop will keep trying
            if (pollErr?.message?.startsWith('Import failed')) throw pollErr;
          }
        }

        if (!done) {
          toast.success(`${contacts.length} contacts queued for import — they will appear shortly`);
        }
      } else {
        // Backend didn't return a job ID — treat as synchronous success
        toast.success(`${contacts.length} contacts imported successfully`);
      }

      onSuccess();
      onOpenChange(false);
      setSelectedFile(null);
      setImportStatus(null);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to import contacts');
    } finally {
      setIsImporting(false);
      setImportStatus(null);
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      setSelectedFile(null);
      setImportStatus(null);
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
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-destructive font-medium">
                  <AlertCircle className="h-4 w-4" />
                  Required Columns
                </div>
                <ul className="ml-6 space-y-1 text-muted-foreground">
                  <li className="list-disc"><span className="font-medium">phone</span> - Contact phone number (with country code)</li>
                  <li className="list-disc"><span className="font-medium">name</span> - Contact name (or use first_name + last_name)</li>
                </ul>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-500 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Optional Columns
                </div>
                <ul className="ml-6 space-y-1 text-muted-foreground">
                  <li className="list-disc"><span className="font-medium">first_name</span>, <span className="font-medium">last_name</span> - Split name</li>
                  <li className="list-disc"><span className="font-medium">email</span> - Email address</li>
                  <li className="list-disc"><span className="font-medium">country</span> - Country code (e.g. IN, US)</li>
                  <li className="list-disc"><span className="font-medium">language_code</span> - e.g. en, hi</li>
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

          {/* Import status */}
          {importStatus && (
            <p className="text-sm text-muted-foreground text-center animate-pulse">
              {importStatus}
            </p>
          )}

          {/* Example Format */}
          <div className="rounded-lg bg-muted/30 p-3 text-xs">
            <p className="font-medium mb-2">Example Format:</p>
            <div className="bg-background rounded border p-2 font-mono overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-1 text-left">phone</th>
                    <th className="px-2 py-1 text-left">name</th>
                    <th className="px-2 py-1 text-left">email</th>
                    <th className="px-2 py-1 text-left">country</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-2 py-1">+919876543210</td>
                    <td className="px-2 py-1">John Doe</td>
                    <td className="px-2 py-1">john@example.com</td>
                    <td className="px-2 py-1">IN</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1">+919876543211</td>
                    <td className="px-2 py-1">Jane Smith</td>
                    <td className="px-2 py-1">jane@example.com</td>
                    <td className="px-2 py-1">IN</td>
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
                {importStatus ?? 'Importing…'}
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
