// src/pages/QRCodes.tsx
import { useState } from 'react';
import { useQRCodes, useQRCodeMutations } from '@/hooks/whatsapp/useQRCodes';
import type { QRCode, QRCodeCreate, ImageType } from '@/types/whatsappTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, RefreshCw, Download, Trash2, Edit, QrCode as QrCodeIcon, ExternalLink } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { toast } from 'sonner';

export default function QRCodes() {
  const isMobile = useIsMobile();
  const [skip] = useState(0);
  const [limit] = useState(50);

  const { qrCodes, total, isLoading, error, revalidate } = useQRCodes(skip, limit);
  const { createQRCode, updateQRCode, deleteQRCode, fetchFromWhatsApp } = useQRCodeMutations();

  // Create/Edit Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQRCode, setEditingQRCode] = useState<QRCode | null>(null);
  const [formData, setFormData] = useState<QRCodeCreate>({
    prefilled_message: '',
    image_type: 'PNG' as ImageType,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [qrCodeToDelete, setQrCodeToDelete] = useState<QRCode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // View QR Code Dialog
  const [viewQRCode, setViewQRCode] = useState<QRCode | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const handleRefresh = async () => {
    try {
      revalidate();
      toast.success('QR codes refreshed');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to refresh QR codes');
    }
  };

  const handleFetchFromWhatsApp = async () => {
    try {
      await fetchFromWhatsApp('PNG' as ImageType);
      toast.success('QR codes synced from WhatsApp with images');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to fetch from WhatsApp');
    }
  };

  const handleCreateNew = () => {
    setEditingQRCode(null);
    setFormData({
      prefilled_message: '',
      image_type: 'PNG' as ImageType,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (qrCode: QRCode) => {
    setEditingQRCode(qrCode);
    setFormData({
      prefilled_message: qrCode.prefilled_message,
      image_type: qrCode.image_type as ImageType,
    });
    setIsDialogOpen(true);
  };

  const handleView = (qrCode: QRCode) => {
    setViewQRCode(qrCode);
    setIsViewDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.prefilled_message.trim()) {
      toast.error('Please enter a prefilled message');
      return;
    }

    setIsSaving(true);
    try {
      if (editingQRCode) {
        // Update existing
        await updateQRCode(editingQRCode.code, {
          prefilled_message: formData.prefilled_message,
        });
        toast.success('QR code updated successfully');
      } else {
        // Create new
        await createQRCode(formData);
        toast.success('QR code created successfully');
      }
      setIsDialogOpen(false);
      setFormData({
        prefilled_message: '',
        image_type: 'PNG' as ImageType,
      });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save QR code');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (qrCode: QRCode) => {
    setQrCodeToDelete(qrCode);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!qrCodeToDelete) return;

    setIsDeleting(true);
    try {
      await deleteQRCode(qrCodeToDelete.code);
      toast.success('QR code deleted successfully');
      setDeleteConfirmOpen(false);
      setQrCodeToDelete(null);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete QR code');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadQRCode = (qrCode: QRCode) => {
    if (qrCode.image_url) {
      window.open(qrCode.image_url, '_blank');
    } else {
      toast.error('No image URL available');
    }
  };

  if (isLoading && qrCodes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading QR codes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading QR Codes</h3>
          <p className="text-sm text-destructive/80">{error.message || 'Failed to fetch QR codes'}</p>
          <Button onClick={handleRefresh} variant="outline" className="mt-4 w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header Section */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">WhatsApp QR Codes</h1>
            <p className="text-xs md:text-sm text-muted-foreground">{total} total QR codes</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              size={isMobile ? 'sm' : 'default'}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''} ${!isMobile ? 'mr-2' : ''}`} />
              {!isMobile && 'Refresh'}
            </Button>
            <Button
              onClick={handleFetchFromWhatsApp}
              variant="outline"
              size={isMobile ? 'sm' : 'default'}
            >
              <Download className={`h-4 w-4 ${!isMobile ? 'mr-2' : ''}`} />
              {!isMobile && 'Sync from WhatsApp'}
            </Button>
            <Button onClick={handleCreateNew} size={isMobile ? 'sm' : 'default'}>
              <Plus className="h-4 w-4 mr-2" />
              {!isMobile && 'Create QR Code'}
            </Button>
          </div>
        </div>
      </div>

      {/* QR Codes Grid */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {qrCodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <QrCodeIcon className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No QR Codes Yet</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              Create your first QR code to allow customers to start WhatsApp conversations with prefilled messages.
            </p>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create First QR Code
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {qrCodes.map((qrCode) => (
              <Card key={qrCode.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-sm font-mono">{qrCode.code}</CardTitle>
                  <CardDescription className="text-xs">
                    {qrCode.image_type} • Created {new Date(qrCode.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {qrCode.image_url ? (
                      <div className="flex items-center justify-center p-4 bg-white rounded-lg border-2 border-muted">
                        <img
                          src={qrCode.image_url}
                          alt={`QR Code ${qrCode.code}`}
                          className="w-40 h-40 object-contain cursor-pointer hover:scale-105 transition-transform"
                          onClick={() => handleView(qrCode)}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center p-4 bg-muted rounded-lg h-48">
                        <div className="text-center text-muted-foreground">
                          <QrCodeIcon className="h-12 w-12 mx-auto mb-2" />
                          <p className="text-xs">No image available</p>
                          <p className="text-xs">Click "Sync from WhatsApp" to fetch</p>
                        </div>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs text-muted-foreground">Prefilled Message</Label>
                      <p className="text-sm mt-1 line-clamp-2">{qrCode.prefilled_message}</p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button
                    onClick={() => handleView(qrCode)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <QrCodeIcon className="h-4 w-4 mr-2" />
                    View
                  </Button>
                  <Button
                    onClick={() => handleEdit(qrCode)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleDeleteClick(qrCode)}
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingQRCode ? 'Edit QR Code' : 'Create New QR Code'}</DialogTitle>
            <DialogDescription>
              {editingQRCode
                ? 'Update the prefilled message for this QR code.'
                : 'Create a QR code with a prefilled message for WhatsApp.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="message">Prefilled Message *</Label>
              <Textarea
                id="message"
                placeholder="Enter the message that will be prefilled when users scan this QR code..."
                value={formData.prefilled_message}
                onChange={(e) => setFormData({ ...formData, prefilled_message: e.target.value })}
                rows={4}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">
                {formData.prefilled_message.length}/1000 characters
              </p>
            </div>
            {!editingQRCode && (
              <div className="space-y-2">
                <Label htmlFor="imageType">Image Type</Label>
                <Select
                  value={formData.image_type}
                  onValueChange={(value) => setFormData({ ...formData, image_type: value as ImageType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PNG">PNG (Raster)</SelectItem>
                    <SelectItem value="SVG">SVG (Vector)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingQRCode ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View QR Code Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Scan this QR Code</DialogTitle>
            <DialogDescription>Code: {viewQRCode?.code}</DialogDescription>
          </DialogHeader>
          {viewQRCode && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center p-8 bg-white rounded-lg border-2 border-muted">
                {viewQRCode.image_url ? (
                  <img
                    src={viewQRCode.image_url}
                    alt={`QR Code ${viewQRCode.code}`}
                    className="w-80 h-80 object-contain"
                    style={{ imageRendering: 'crisp-edges' }}
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <QrCodeIcon className="h-16 w-16 mx-auto mb-2" />
                    <p>No image available</p>
                    <Button
                      onClick={handleFetchFromWhatsApp}
                      variant="outline"
                      size="sm"
                      className="mt-4"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Fetch Image
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Prefilled Message</Label>
                <p className="text-sm bg-muted p-3 rounded-lg">{viewQRCode.prefilled_message}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Image Type</Label>
                  <p className="text-sm font-mono">{viewQRCode.image_type}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Created</Label>
                  <p className="text-sm">{new Date(viewQRCode.created_at).toLocaleString()}</p>
                </div>
              </div>
              {viewQRCode.deep_link_url && (
                <div className="space-y-2">
                  <Label>Deep Link</Label>
                  <div className="flex items-center gap-2">
                    <Input value={viewQRCode.deep_link_url} readOnly className="text-xs" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(viewQRCode.deep_link_url!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {viewQRCode?.image_url && (
              <Button onClick={() => handleDownloadQRCode(viewQRCode)} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Open Image
              </Button>
            )}
            <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete QR Code</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this QR code? This action cannot be undone and the QR code will stop
              working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
