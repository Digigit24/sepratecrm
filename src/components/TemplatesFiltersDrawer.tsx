// src/components/TemplatesFiltersDrawer.tsx
import React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SideDrawer } from '@/components/SideDrawer';
import { 
  TemplateStatus, 
  TemplateCategory, 
  TemplateLanguage,
  TemplatesListQuery 
} from '@/types/whatsappTypes';

interface TemplatesFiltersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: TemplatesListQuery;
  onFiltersChange: (filters: TemplatesListQuery) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
}

export function TemplatesFiltersDrawer({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters
}: TemplatesFiltersDrawerProps) {
  
  const updateFilter = (key: keyof TemplatesListQuery, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value === 'all' ? undefined : value,
      skip: 0 // Reset pagination when filters change
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.status) count++;
    if (filters.category) count++;
    if (filters.language) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filter Templates"
      description="Filter templates by status, category, and language"
    >
      <div className="space-y-6">
        {/* Active Filters Summary */}
        {activeFiltersCount > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Active Filters</Label>
            <div className="flex flex-wrap gap-2">
              {filters.status && (
                <Badge variant="secondary" className="gap-1">
                  Status: {filters.status}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => updateFilter('status', undefined)}
                  />
                </Badge>
              )}
              {filters.category && (
                <Badge variant="secondary" className="gap-1">
                  Category: {filters.category}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => updateFilter('category', undefined)}
                  />
                </Badge>
              )}
              {filters.language && (
                <Badge variant="secondary" className="gap-1">
                  Language: {filters.language}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => updateFilter('language', undefined)}
                  />
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Status Filter */}
        <div className="space-y-2">
          <Label htmlFor="status-filter">Status</Label>
          <Select
            value={filters.status || 'all'}
            onValueChange={(value) => updateFilter('status', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value={TemplateStatus.APPROVED}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Approved
                </div>
              </SelectItem>
              <SelectItem value={TemplateStatus.PENDING}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  Pending
                </div>
              </SelectItem>
              <SelectItem value={TemplateStatus.REJECTED}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  Rejected
                </div>
              </SelectItem>
              <SelectItem value={TemplateStatus.PAUSED}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                  Paused
                </div>
              </SelectItem>
              <SelectItem value={TemplateStatus.DISABLED}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  Disabled
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category Filter */}
        <div className="space-y-2">
          <Label htmlFor="category-filter">Category</Label>
          <Select
            value={filters.category || 'all'}
            onValueChange={(value) => updateFilter('category', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value={TemplateCategory.MARKETING}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Marketing
                </div>
              </SelectItem>
              <SelectItem value={TemplateCategory.UTILITY}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Utility
                </div>
              </SelectItem>
              <SelectItem value={TemplateCategory.AUTHENTICATION}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  Authentication
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Language Filter */}
        <div className="space-y-2">
          <Label htmlFor="language-filter">Language</Label>
          <Select
            value={filters.language || 'all'}
            onValueChange={(value) => updateFilter('language', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All languages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Languages</SelectItem>
              <SelectItem value={TemplateLanguage.ENGLISH}>English</SelectItem>
              <SelectItem value={TemplateLanguage.ENGLISH_US}>English (US)</SelectItem>
              <SelectItem value={TemplateLanguage.ENGLISH_UK}>English (UK)</SelectItem>
              <SelectItem value={TemplateLanguage.HINDI}>Hindi</SelectItem>
              <SelectItem value={TemplateLanguage.SPANISH}>Spanish</SelectItem>
              <SelectItem value={TemplateLanguage.FRENCH}>French</SelectItem>
              <SelectItem value={TemplateLanguage.GERMAN}>German</SelectItem>
              <SelectItem value={TemplateLanguage.PORTUGUESE}>Portuguese</SelectItem>
              <SelectItem value={TemplateLanguage.ARABIC}>Arabic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quick Filter Buttons */}
        <div className="space-y-2">
          <Label>Quick Filters</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateFilter('status', TemplateStatus.APPROVED)}
              className={filters.status === TemplateStatus.APPROVED ? 'bg-green-50 border-green-200' : ''}
            >
              Approved Only
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateFilter('status', TemplateStatus.PENDING)}
              className={filters.status === TemplateStatus.PENDING ? 'bg-yellow-50 border-yellow-200' : ''}
            >
              Pending Only
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateFilter('category', TemplateCategory.MARKETING)}
              className={filters.category === TemplateCategory.MARKETING ? 'bg-blue-50 border-blue-200' : ''}
            >
              Marketing
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateFilter('category', TemplateCategory.UTILITY)}
              className={filters.category === TemplateCategory.UTILITY ? 'bg-purple-50 border-purple-200' : ''}
            >
              Utility
            </Button>
          </div>
        </div>

        {/* Filter Statistics */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="text-sm font-medium">Filter Summary</div>
          <div className="text-sm text-muted-foreground">
            {activeFiltersCount === 0 
              ? 'No filters applied - showing all templates'
              : `${activeFiltersCount} filter${activeFiltersCount > 1 ? 's' : ''} applied`
            }
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button 
            onClick={onApplyFilters}
            className="flex-1"
          >
            <Filter className="w-4 h-4 mr-2" />
            Apply Filters
          </Button>
          <Button 
            variant="outline" 
            onClick={onClearFilters}
            disabled={activeFiltersCount === 0}
          >
            Clear All
          </Button>
        </div>
      </div>
    </SideDrawer>
  );
}