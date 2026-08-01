import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CopyPhoneButtonProps {
  phone?: string | null;
  className?: string;
}

export function CopyPhoneButton({ phone, className }: CopyPhoneButtonProps) {
  if (!phone) return null;

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(phone);
      toast.success('Phone number copied', { description: phone, duration: 1600 });
    } catch {
      toast.error('Could not copy phone number');
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-6 w-6 text-muted-foreground hover:text-foreground', className)}
      onClick={handleCopy}
      title="Copy phone number"
      aria-label="Copy phone number"
    >
      <Copy className="h-3.5 w-3.5" />
    </Button>
  );
}

export default CopyPhoneButton;
