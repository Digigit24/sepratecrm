// src/components/workflow-editor/steps/AddStepButton.tsx
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AddStepButtonProps {
  onClick: () => void;
  label?: string;
}

export const AddStepButton = ({ onClick, label = 'Add Step' }: AddStepButtonProps) => {
  return (
    <div className="relative h-12 flex items-center justify-center my-2">
      {/* Connecting line */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-border" />

      {/* Button */}
      <Button
        variant="outline"
        size="sm"
        className="relative z-10 bg-background hover:bg-accent"
        onClick={onClick}
      >
        <Plus className="h-4 w-4 mr-2" />
        {label}
      </Button>
    </div>
  );
};
