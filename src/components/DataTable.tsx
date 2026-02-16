// src/components/DataTable.tsx

import React, { useState } from 'react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { MoreHorizontal, Eye, Edit, Trash2, Stethoscope, IndianRupee, ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

// --------------------------------------
// Types
// --------------------------------------

export type SortDirection = 'asc' | 'desc' | null;

export interface ColumnSort {
  key: string;
  direction: SortDirection;
}

export interface ColumnFilter {
  key: string;
  value: string;
}

export interface DataTableColumn<T> {
  /** column label in <th> */
  header: string | React.ReactNode;
  /** unique key for this column */
  key: string;
  /** render cell content for desktop table */
  cell: (row: T) => React.ReactNode;
  /** optional className for <TableHead> & <TableCell> */
  className?: string;
  /** enable sorting for this column */
  sortable?: boolean;
  /** enable filtering for this column */
  filterable?: boolean;
  /** custom sort function (if not provided, uses default comparison) */
  sortFn?: (a: T, b: T, direction: SortDirection) => number;
  /** accessor function to get the value for filtering/sorting */
  accessor?: (row: T) => any;
}

export interface DataTableProps<T> {
  /** array of row objects (patients, notes, etc.) */
  rows: T[];
  /** is API loading? */
  isLoading: boolean;
  /** columns configuration for desktop table */
  columns: DataTableColumn<T>[];
  /** render function for mobile card layout (1 row -> card) */
  renderMobileCard: (row: T, actions: RowActions<T>) => React.ReactNode;

  /** unique id accessor for keys / deletes */
  getRowId: (row: T) => string | number;
  /** label to show in delete dialog, ex. row.full_name */
  getRowLabel: (row: T) => string;

  /** row click action (separate from view details) - called when clicking the row */
  onRowClick?: (row: T) => void;
  /** selected row ID for highlighting */
  selectedRowId?: string | number | null;
  /** view action - only called from Actions menu */
  onView?: (row: T) => void;
  /** edit action */
  onEdit?: (row: T) => void;
  /** delete action (async allowed). if not provided, Delete is hidden */
  onDelete?: (row: T) => Promise<void> | void;

  /** consultation action - shown as button */
  onConsultation?: (row: T) => void;
  /** billing action - shown as button */
  onBilling?: (row: T) => void;

  /** optional: extra action items you want in dropdown */
  extraActions?: (row: T) => React.ReactNode;

  /** empty state text */
  emptyTitle?: string;
  emptySubtitle?: string;
}

// This is just to pass bound handlers down to mobile card
export interface RowActions<T> {
  view?: () => void;
  edit?: () => void;
  askDelete?: () => void;
  consultation?: () => void;
  billing?: () => void;
  dropdown?: React.ReactNode;
}

// --------------------------------------
// Component
// --------------------------------------

export function DataTable<T>({
  rows,
  isLoading,
  columns,
  renderMobileCard,
  getRowId,
  getRowLabel,
  onRowClick,
  selectedRowId,
  onView,
  onEdit,
  onDelete,
  onConsultation,
  onBilling,
  extraActions,
  emptyTitle = 'No records found',
  emptySubtitle = 'Try adjusting your filters or search criteria',
}: DataTableProps<T>) {
  const isMobile = useIsMobile();

  // delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<T | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // sorting state
  const [sortConfig, setSortConfig] = useState<ColumnSort | null>(null);

  // filtering state
  const [filters, setFilters] = useState<ColumnFilter[]>([]);
  const [filterMenuOpen, setFilterMenuOpen] = useState<string | null>(null);

  // pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);

  // Handle column sort
  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable) return;

    setSortConfig((prev) => {
      if (prev?.key === column.key) {
        // Cycle through: asc -> desc -> null
        if (prev.direction === 'asc') {
          return { key: column.key, direction: 'desc' };
        } else if (prev.direction === 'desc') {
          return null;
        }
      }
      return { key: column.key, direction: 'asc' };
    });
  };

  // Handle filter change
  const handleFilterChange = (columnKey: string, value: string) => {
    setFilters((prev) => {
      const existing = prev.find((f) => f.key === columnKey);
      if (value === '') {
        return prev.filter((f) => f.key !== columnKey);
      }
      if (existing) {
        return prev.map((f) => (f.key === columnKey ? { ...f, value } : f));
      }
      return [...prev, { key: columnKey, value }];
    });
  };

  // Clear specific filter
  const clearFilter = (columnKey: string) => {
    setFilters((prev) => prev.filter((f) => f.key !== columnKey));
  };

  // Apply sorting and filtering
  const filteredAndSortedRows = React.useMemo(() => {
    let result = [...rows];

    // Apply filters
    if (filters.length > 0) {
      result = result.filter((row) => {
        return filters.every((filter) => {
          const column = columns.find((col) => col.key === filter.key);
          if (!column) return true;

          const value = column.accessor ? column.accessor(row) : '';
          const searchValue = String(value).toLowerCase();
          const filterValue = filter.value.toLowerCase();

          return searchValue.includes(filterValue);
        });
      });
    }

    // Apply sorting
    if (sortConfig) {
      const column = columns.find((col) => col.key === sortConfig.key);
      if (column) {
        result.sort((a, b) => {
          if (column.sortFn) {
            return column.sortFn(a, b, sortConfig.direction);
          }

          // Default sorting using accessor
          const aValue = column.accessor ? column.accessor(a) : '';
          const bValue = column.accessor ? column.accessor(b) : '';

          if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
          }
          if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
        });
      }
    }

    return result;
  }, [rows, filters, sortConfig, columns]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredAndSortedRows.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const processedRows = filteredAndSortedRows.slice(startIndex, endIndex);

  // Reset to page 1 when filters or entries per page changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters, entriesPerPage]);

  const handleAskDelete = (row: T) => {
    if (!onDelete) return; // if no delete handler, no dialog
    setRowToDelete(row);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!rowToDelete || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(rowToDelete);
      setDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // Get active filter value for a column
  const getFilterValue = (columnKey: string) => {
    return filters.find((f) => f.key === columnKey)?.value || '';
  };

  // Get sort icon for a column
  const getSortIcon = (column: DataTableColumn<T>) => {
    if (!column.sortable) return null;

    if (sortConfig?.key === column.key) {
      if (sortConfig.direction === 'asc') {
        return <ArrowUp className="ml-1 h-3.5 w-3.5" />;
      }
      if (sortConfig.direction === 'desc') {
        return <ArrowDown className="ml-1 h-3.5 w-3.5" />;
      }
    }
    return <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />;
  };

  // ---------------------------
  // LOADING STATE
  // ---------------------------
  if (isLoading && filteredAndSortedRows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-12 w-full">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 mb-4">
            <svg
              className="animate-spin h-8 w-8 text-primary"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // ---------------------------
  // EMPTY STATE (no rows, not loading)
  // ---------------------------
  if (!isLoading && filteredAndSortedRows.length === 0) {
    return (
      <>
        <div className="flex items-center justify-center h-full p-8 w-full">
          <div className="text-center max-w-xs">
            <div className="mx-auto h-12 w-12 text-muted-foreground mb-4">
              <svg
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                className="w-full h-full"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">
              {emptyTitle}
            </h3>
            <p className="text-sm text-muted-foreground">
              {emptySubtitle}
            </p>
          </div>
        </div>

        {/* delete dialog still mounted so you can delete last row and see dialog etc */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete{' '}
                {rowToDelete ? getRowLabel(rowToDelete) : ''}? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // ---------------------------
  // MOBILE CARD LIST
  // ---------------------------
  if (isMobile) {
    return (
      <>
        <div className="flex flex-col h-full">
          <div className="flex-1 p-4 space-y-3 overflow-auto">
            {processedRows.map((row) => {
              const rowActions: RowActions<T> = {
                view: onView ? () => onView(row) : undefined,
                edit: onEdit ? () => onEdit(row) : undefined,
                askDelete: onDelete ? () => handleAskDelete(row) : undefined,
                consultation: onConsultation ? () => onConsultation(row) : undefined,
                billing: onBilling ? () => onBilling(row) : undefined,
              };

              return (
                <div key={getRowId(row)} className="bg-card border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow">
                  {renderMobileCard(row, rowActions)}
                </div>
              );
            })}
          </div>

          {/* Pagination controls for mobile */}
          {filteredAndSortedRows.length > 0 && (
            <div className="border-t bg-background p-4 space-y-3">
              {/* Entries per page selector */}
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-muted-foreground">Show</span>
                <Select
                  value={entriesPerPage.toString()}
                  onValueChange={(value) => setEntriesPerPage(Number(value))}
                >
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">entries</span>
              </div>

              {/* Page info */}
              <div className="text-center text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredAndSortedRows.length)} of {filteredAndSortedRows.length}
              </div>

              {/* Page navigation */}
              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>

                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let page: number;
                      if (totalPages <= 5) {
                        page = i + 1;
                      } else if (currentPage <= 3) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i;
                      } else {
                        page = currentPage - 2 + i;
                      }

                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}
        </div>

        {/* Delete dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete{' '}
                {rowToDelete ? getRowLabel(rowToDelete) : ''}? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // ---------------------------
  // DESKTOP TABLE
  // ---------------------------

  return (
    <>
      <div className="w-full">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow className="hover:bg-transparent border-b">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={`${col.className || ''} p-0`}
                >
                  <div className="flex flex-col">
                    {/* Header row with sort and filter */}
                    <div className="flex items-center gap-1 px-4 py-3 h-10">
                      {/* Header content */}
                      {typeof col.header === 'string' ? (
                        <button
                          onClick={() => handleSort(col)}
                          className={`
                            group flex items-center gap-1 text-xs font-medium text-muted-foreground
                            hover:text-foreground transition-colors select-none
                            ${col.sortable ? 'cursor-pointer' : 'cursor-default'}
                            ${sortConfig?.key === col.key ? 'text-foreground' : ''}
                          `}
                          disabled={!col.sortable}
                        >
                          {col.header}
                          {getSortIcon(col)}
                        </button>
                      ) : (
                        <div className="flex items-center">
                          {col.header}
                        </div>
                      )}

                      {/* Filter button */}
                      {col.filterable && (
                        <DropdownMenu
                          open={filterMenuOpen === col.key}
                          onOpenChange={(open) =>
                            setFilterMenuOpen(open ? col.key : null)
                          }
                        >
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-6 w-6 ml-auto ${
                                getFilterValue(col.key)
                                  ? 'text-primary'
                                  : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                              }`}
                            >
                              <Filter className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56">
                            <div className="p-2 space-y-2">
                              <div className="flex items-center gap-2">
                                <Input
                                  placeholder={`Filter ${typeof col.header === 'string' ? col.header.toLowerCase() : ''}...`}
                                  value={getFilterValue(col.key)}
                                  onChange={(e) =>
                                    handleFilterChange(col.key, e.target.value)
                                  }
                                  className="h-8 text-xs"
                                  autoFocus
                                />
                                {getFilterValue(col.key) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 flex-shrink-0"
                                    onClick={() => clearFilter(col.key)}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </TableHead>
              ))}

              {/* Actions header */}
              {(onView || onEdit || onDelete || onConsultation || onBilling || extraActions) && (
                <TableHead className="text-right p-0">
                  <div className="px-4 py-3 h-10 flex items-center justify-end">
                    <span className="text-xs font-medium text-muted-foreground">Actions</span>
                  </div>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {processedRows.map((row) => {
              const id = getRowId(row);

              // table row click triggers onRowClick if provided, otherwise onView (for backward compatibility)
              const handleRowClick = () => {
                if (onRowClick) {
                  onRowClick(row);
                } else if (onView) {
                  onView(row);
                }
              };

              const rowActions: RowActions<T> = {
                view: onView ? () => onView(row) : undefined,
                edit: onEdit ? () => onEdit(row) : undefined,
                askDelete: onDelete ? () => handleAskDelete(row) : undefined,
                consultation: onConsultation ? () => onConsultation(row) : undefined,
                billing: onBilling ? () => onBilling(row) : undefined,
              };

              // Only make row clickable if onRowClick or onView is provided
              const isRowClickable = !!(onRowClick || onView);
              const isSelected = selectedRowId !== undefined && selectedRowId !== null && id === selectedRowId;

              return (
                <TableRow
                  key={id}
                  className={`group hover:bg-muted/50 transition-colors align-top border-b border-border/50 ${isRowClickable ? 'cursor-pointer' : ''} ${isSelected ? 'bg-muted/70 border-l-4 border-l-primary' : ''}`}
                  onClick={isRowClickable ? handleRowClick : undefined}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={`py-2.5 px-4 text-sm ${col.className || ''}`}>
                      {col.cell(row)}
                    </TableCell>
                  ))}

                  {(onView || onEdit || onDelete || onConsultation || onBilling || extraActions) && (
                    <TableCell
                      className="text-right py-2.5 px-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-2">
                        {/* Consultation Button */}
                        {onConsultation && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onConsultation(row)}
                          >
                            <Stethoscope className="h-4 w-4 mr-1" />
                            Consult
                          </Button>
                        )}

                        {/* Billing Button */}
                        {onBilling && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onBilling(row)}
                          >
                            <IndianRupee className="h-4 w-4 mr-1" />
                            Billing
                          </Button>
                        )}

                        {/* Dropdown Menu */}
                        <RowDropdown
                          row={row}
                          rowActions={rowActions}
                          extraActions={extraActions}
                        />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Pagination controls */}
        {filteredAndSortedRows.length > 0 && (
          <div className="flex items-center justify-between px-4 py-4 border-t">
            {/* Entries per page selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show</span>
              <Select
                value={entriesPerPage.toString()}
                onValueChange={(value) => setEntriesPerPage(Number(value))}
              >
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                entries
              </span>
            </div>

            {/* Page info and navigation */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredAndSortedRows.length)} of {filteredAndSortedRows.length} entries
              </span>

              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      // Show first page, last page, current page, and pages around current
                      const showPage =
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1);

                      if (!showPage) {
                        // Show ellipsis for skipped pages
                        if (page === currentPage - 2 || page === currentPage + 2) {
                          return (
                            <PaginationItem key={page}>
                              <span className="px-2 text-muted-foreground">...</span>
                            </PaginationItem>
                          );
                        }
                        return null;
                      }

                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              {rowToDelete ? getRowLabel(rowToDelete) : ''}? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// --------------------------------------
// Row dropdown (3 dots menu)
// --------------------------------------

function RowDropdown<T>({
  row,
  rowActions,
  extraActions,
}: {
  row: T;
  rowActions: RowActions<T>;
  extraActions?: (row: T) => React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {rowActions.view && (
          <DropdownMenuItem onClick={rowActions.view}>
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </DropdownMenuItem>
        )}

        {rowActions.edit && (
          <DropdownMenuItem onClick={rowActions.edit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
        )}

        {extraActions && (
          <>
            <DropdownMenuSeparator />
            {extraActions(row)}
          </>
        )}

        {rowActions.askDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={rowActions.askDelete}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}