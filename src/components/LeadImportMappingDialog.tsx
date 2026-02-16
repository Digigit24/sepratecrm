// src/components/LeadImportMappingDialog.tsx
import { useState, useEffect, useMemo } from 'react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface LeadImportMappingDialogProps {
  open: boolean;
  onClose: () => void;
  file: File | null;
  onConfirm: (mappedData: any[]) => void;
}

interface ColumnMapping {
  [systemField: string]: string; // systemField -> excelColumn
}

interface SystemField {
  key: string;
  label: string;
  required: boolean;
  description: string;
  examples: string[];
}

export const LeadImportMappingDialog = ({
  open,
  onClose,
  file,
  onConfirm,
}: LeadImportMappingDialogProps) => {
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [allData, setAllData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Define system fields with better descriptions
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmStats, setConfirmStats] = useState<{
    total: number;
    duplicates: number;
    skipped: number;
    valid: number;
  } | null>(null);

  const systemFields: SystemField[] = [
    {
      key: 'name',
      label: 'Full Name',
      required: true,
      description: 'Complete name of the lead (will be used to create patient record)',
      examples: ['Full Name', 'Name', 'Contact Name', 'Customer Name', 'Patient Name']
    },
    {
      key: 'phone',
      label: 'Phone Number',
      required: true,
      description: 'Primary contact number (will be used as unique identifier)',
      examples: ['Phone', 'Mobile', 'Contact Number', 'Phone Number', 'Cell Phone']
    },
    {
      key: 'email',
      label: 'Email Address',
      required: false,
      description: 'Email address for communication',
      examples: ['Email', 'Email Address', 'Contact Email', 'E-mail']
    },
    {
      key: 'company',
      label: 'Company',
      required: false,
      description: 'Company or organization name',
      examples: ['Company', 'Organization', 'Company Name', 'Business']
    },
    {
      key: 'title',
      label: 'Job Title',
      required: false,
      description: 'Job title or position',
      examples: ['Title', 'Job Title', 'Position', 'Designation']
    },
    {
      key: 'services',
      label: 'Services',
      required: false,
      description: 'Services interested in',
      examples: ['Services', 'Service', 'Interest', 'Service Type']
    },
    {
      key: 'date',
      label: 'Date',
      required: false,
      description: 'Inquiry or creation date',
      examples: ['Date', 'Created Date', 'Inquiry Date', 'Submission Date']
    },
    {
      key: 'notes',
      label: 'Notes',
      required: false,
      description: 'Additional notes or comments',
      examples: ['Notes', 'Comments', 'Remarks', 'Description', 'Details']
    },
    {
      key: 'source',
      label: 'Lead Source',
      required: false,
      description: 'Where the lead came from',
      examples: ['Source', 'Lead Source', 'Channel', 'Origin', 'Campaign']
    },
    {
      key: 'city',
      label: 'City',
      required: false,
      description: 'City name',
      examples: ['City', 'Town', 'Municipality']
    },
    {
      key: 'state',
      label: 'State/Province',
      required: false,
      description: 'State or province',
      examples: ['State', 'Province', 'Region']
    },
    {
      key: 'country',
      label: 'Country',
      required: false,
      description: 'Country name',
      examples: ['Country', 'Nation']
    },
    {
      key: 'postal_code',
      label: 'Postal Code',
      required: false,
      description: 'ZIP or postal code',
      examples: ['Postal Code', 'ZIP', 'PIN Code', 'Postcode']
    },
  ];

  useEffect(() => {
    if (file && open) {
      parseFile();
    }
  }, [file, open]);

  const parseFile = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      if (jsonData.length === 0) {
        setValidationErrors(['The file is empty or has no data rows.']);
        setLoading(false);
        return;
      }

      const columns = Object.keys(jsonData[0]);
      setExcelColumns(columns);
      setAllData(jsonData);
      setPreviewData(jsonData.slice(0, 5));

      // Auto-map columns with intelligent matching
      const autoMapping = performAutoMapping(columns);
      setMapping(autoMapping);

      // Validate auto-mapping
      validateMapping(autoMapping, jsonData);
    } catch (error) {
      console.error('Error parsing file:', error);
      setValidationErrors(['Failed to parse the file. Please ensure it is a valid CSV or Excel file.']);
    } finally {
      setLoading(false);
    }
  };

  // Intelligent auto-mapping with scoring
  const performAutoMapping = (columns: string[]): ColumnMapping => {
    const autoMapping: ColumnMapping = {};

    systemFields.forEach(({ key, examples }) => {
      const normalizedKey = key.toLowerCase().replace(/[_\s]/g, '');
      
      // Score each column based on similarity
      let bestMatch: { column: string; score: number } | null = null;

      columns.forEach((col) => {
        const normalizedCol = col.toLowerCase().replace(/[_\s]/g, '');
        let score = 0;

        // Exact match (highest priority)
        if (normalizedCol === normalizedKey) {
          score = 100;
        }
        // Partial match with key
        else if (normalizedCol.includes(normalizedKey) || normalizedKey.includes(normalizedCol)) {
          score = 80;
        }
        // Match with examples
        else {
          examples.forEach((example) => {
            const normalizedExample = example.toLowerCase().replace(/[_\s]/g, '');
            if (normalizedCol === normalizedExample) {
              score = Math.max(score, 90);
            } else if (normalizedCol.includes(normalizedExample) || normalizedExample.includes(normalizedCol)) {
              score = Math.max(score, 70);
            }
          });
        }

        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { column: col, score };
        }
      });

      if (bestMatch && bestMatch.score >= 70) {
        autoMapping[key] = bestMatch.column;
      }
    });

    // Special handling for name field - check for first_name + last_name combination
    if (!autoMapping.name) {
      const firstNameCol = columns.find((col) =>
        /first[_\s]?name/i.test(col) || /f[_\s]?name/i.test(col)
      );
      const lastNameCol = columns.find((col) =>
        /last[_\s]?name/i.test(col) || /l[_\s]?name/i.test(col) || /surname/i.test(col)
      );

      if (firstNameCol && lastNameCol) {
        autoMapping.name = `${firstNameCol}+${lastNameCol}`;
      } else if (firstNameCol) {
        autoMapping.name = firstNameCol;
      }
    }

    // Special handling for phone field - check various phone patterns
    if (!autoMapping.phone) {
      const phoneCol = columns.find((col) =>
        /phone/i.test(col) || /mobile/i.test(col) || /contact/i.test(col) || /cell/i.test(col) || /tel/i.test(col)
      );
      if (phoneCol) {
        autoMapping.phone = phoneCol;
      }
    }

    return autoMapping;
  };

  // Validate mapping and check for issues
  const validateMapping = (currentMapping: ColumnMapping, data: any[]) => {
    const errors: string[] = [];

    // Check required fields
    const requiredFields = systemFields.filter((f) => f.required);
    const missingRequired = requiredFields.filter((f) => !currentMapping[f.key]);

    if (missingRequired.length > 0) {
      errors.push(
        `Missing required fields: ${missingRequired.map((f) => f.label).join(', ')}`
      );
    }

    // Check for empty values in mapped required fields
    if (currentMapping.name) {
      const emptyNameCount = data.filter((row) => {
        const col = currentMapping.name;
        if (col.includes('+')) {
          const parts = col.split('+');
          return parts.every((p) => !row[p.trim()]);
        }
        return !row[col];
      }).length;

      if (emptyNameCount > 0) {
        errors.push(`${emptyNameCount} rows have empty name values`);
      }
    }

    if (currentMapping.phone) {
      const emptyPhoneCount = data.filter((row) => !row[currentMapping.phone]).length;
      if (emptyPhoneCount > 0) {
        errors.push(`${emptyPhoneCount} rows have empty phone values`);
      }
    }

    setValidationErrors(errors);
  };

  const handleMappingChange = (systemField: string, excelColumn: string) => {
    const newMapping = {
      ...mapping,
    };
    
    // Remove mapping if skip is selected
    if (!excelColumn || excelColumn === '__skip__') {
      delete newMapping[systemField];
    } else {
      newMapping[systemField] = excelColumn;
    }

    setMapping(newMapping);
    validateMapping(newMapping, allData);
  };

  // Get available columns that aren't already mapped
  const getAvailableColumns = (currentField: string): string[] => {
    const mappedColumns = Object.entries(mapping)
      .filter(([key]) => key !== currentField)
      .map(([, value]) => value)
      .filter((value) => !value.includes('+')); // Exclude combined columns from this check

    return excelColumns.filter((col) => !mappedColumns.includes(col));
  };

  // Check if can combine first and last name
  const canCombineNames = useMemo(() => {
    return excelColumns.some((c) => /first[_\s]?name/i.test(c)) &&
           excelColumns.some((c) => /last[_\s]?name/i.test(c));
  }, [excelColumns]);

  const handleConfirm = () => {
    // Final validation
    const requiredFields = systemFields.filter((f) => f.required);
    const missingFields = requiredFields.filter((f) => !mapping[f.key]);

    if (missingFields.length > 0) {
      setValidationErrors([
        `Please map the following required fields: ${missingFields.map((f) => f.label).join(', ')}`
      ]);
      return;
    }

    // Transform ALL data based on mapping
    const mappedData = allData.map((row, index) => {
      const newRow: any = {};
      
      Object.entries(mapping).forEach(([systemField, excelColumn]) => {
        if (excelColumn.includes('+')) {
          // Combined fields (e.g., first_name + last_name)
          const parts = excelColumn.split('+');
          newRow[systemField] = parts
            .map((p) => String(row[p.trim()] || '').trim())
            .filter(Boolean)
            .join(' ')
            .trim();
        } else {
          // Convert to string to handle numbers from Excel
          newRow[systemField] = String(row[excelColumn] || '').trim();
        }
      });

      // Add row number for error tracking
      newRow._sourceRow = index + 2; // +2 because: +1 for 0-index, +1 for header row
      
      return newRow;
    });

    // Filter out rows with missing required fields
    const validData: any[] = [];
    const invalidRows: number[] = [];

    mappedData.forEach((row) => {
      const hasName = row.name && String(row.name).trim();
      const hasPhone = row.phone && String(row.phone).trim();

      if (hasName && hasPhone) {
        validData.push(row);
      } else {
        invalidRows.push(row._sourceRow);
      }
    });

    if (validData.length === 0) {
      setValidationErrors(['No valid rows found. Please ensure your data has both name and phone values.']);
      return;
    }

    // Remove temporary _sourceRow field
    validData.forEach((row) => delete row._sourceRow);

    // Filter duplicates based on phone number
    const seenPhones = new Set<string>();
    const uniqueData = validData.filter((row) => {
      const phone = String(row.phone || '').replace(/\D/g, ''); // Keep only digits
      if (!phone || seenPhones.has(phone)) {
        return false;
      }
      seenPhones.add(phone);
      return true;
    });

    const duplicatesCount = validData.length - uniqueData.length;
    const skippedCount = allData.length - validData.length;

    // Show confirmation dialog with stats
    setConfirmStats({
      total: allData.length,
      valid: uniqueData.length,
      duplicates: duplicatesCount,
      skipped: skippedCount
    });
    setShowConfirmDialog(true);
  };

  const handleConfirmImport = () => {
    // Re-do the transformation to get unique data
    const mappedData = allData.map((row) => {
      const newRow: any = {};
      Object.entries(mapping).forEach(([systemField, excelColumn]) => {
        if (excelColumn.includes('+')) {
          const parts = excelColumn.split('+');
          newRow[systemField] = parts
            .map((p) => String(row[p.trim()] || '').trim())
            .filter(Boolean)
            .join(' ')
            .trim();
        } else {
          // Convert to string to handle numbers from Excel
          newRow[systemField] = String(row[excelColumn] || '').trim();
        }
      });
      return newRow;
    });

    const validData = mappedData.filter((row) => {
      const hasName = row.name && String(row.name).trim();
      const hasPhone = row.phone && String(row.phone).trim();
      return hasName && hasPhone;
    });

    const seenPhones = new Set<string>();
    const uniqueData = validData.filter((row) => {
      const phone = String(row.phone || '').replace(/\D/g, '');
      if (!phone || seenPhones.has(phone)) {
        return false;
      }
      seenPhones.add(phone);
      return true;
    });

    setShowConfirmDialog(false);
    onConfirm(uniqueData);
  };

  // Get mapping status for a field
  const getMappingStatus = (field: SystemField) => {
    if (mapping[field.key]) {
      return 'mapped';
    }
    if (field.required) {
      return 'required';
    }
    return 'optional';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Map Your CSV Columns</DialogTitle>
          <DialogDescription className="text-base">
            <span>Match the columns from your file to the system fields. Fields marked with </span>
            <Badge variant="destructive" className="text-xs inline-flex">Required</Badge>
            <span> must be mapped.</span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Analyzing your file...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Validation Errors/Warnings */}
            {validationErrors.length > 0 && (
              <Alert variant={validationErrors.some(e => e.includes('required')) ? 'destructive' : 'default'}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    {validationErrors.map((error, idx) => (
                      <div key={idx}>• {error}</div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* File Info */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>File:</strong> {file?.name} | <strong>Total Rows:</strong> {allData.length} | <strong>Columns Found:</strong> {excelColumns.length}
              </AlertDescription>
            </Alert>

            {/* Column Mapping */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Column Mapping</h3>
                <div className="flex gap-2 text-xs">
                  <Badge variant="destructive">Required</Badge>
                  <Badge variant="outline">Optional</Badge>
                  <Badge variant="default">Mapped</Badge>
                </div>
              </div>

              <div className="grid gap-4">
                {systemFields.map((field) => {
                  const status = getMappingStatus(field);
                  const availableColumns = getAvailableColumns(field.key);

                  return (
                    <div
                      key={field.key}
                      className={`border rounded-lg p-4 ${
                        status === 'required' && !mapping[field.key]
                          ? 'border-red-300 bg-red-50/50'
                          : status === 'mapped'
                          ? 'border-green-300 bg-green-50/50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={field.key} className="text-base font-medium">
                              {field.label}
                            </Label>
                            {field.required ? (
                              <Badge variant="destructive" className="text-xs">Required</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Optional</Badge>
                            )}
                            {mapping[field.key] && (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{field.description}</p>
                          <div className="text-xs text-muted-foreground">
                            <strong>Examples:</strong> {field.examples.join(', ')}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Select
                            value={mapping[field.key] || ''}
                            onValueChange={(value) => handleMappingChange(field.key, value)}
                          >
                            <SelectTrigger id={field.key} className={mapping[field.key] ? 'border-green-400' : ''}>
                              <SelectValue placeholder="Select a column from your file..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__skip__">-- Skip this field --</SelectItem>
                              {excelColumns.map((col) => (
                                <SelectItem
                                  key={col}
                                  value={col}
                                  disabled={!availableColumns.includes(col) && mapping[field.key] !== col}
                                >
                                  {col}
                                  {!availableColumns.includes(col) && mapping[field.key] !== col && ' (already mapped)'}
                                </SelectItem>
                              ))}
                              {/* Special option for combining name fields */}
                              {field.key === 'name' && canCombineNames && (
                                <SelectItem
                                  value={`${excelColumns.find(c => /first[_\s]?name/i.test(c))}+${excelColumns.find(c => /last[_\s]?name/i.test(c))}`}
                                >
                                  🔗 Combine First Name + Last Name
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          {mapping[field.key] && (
                            <div className="text-xs text-green-600 font-medium">
                              ✓ Mapped to: {mapping[field.key].includes('+') ? 'Combined fields' : mapping[field.key]}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Preview Table */}
            {previewData.length > 0 && Object.keys(mapping).length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Preview (first {previewData.length} rows)</h3>
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-xs uppercase">#</th>
                          {systemFields
                            .filter((f) => mapping[f.key])
                            .map((field) => (
                              <th key={field.key} className="px-4 py-3 text-left font-medium">
                                <div className="flex items-center gap-2">
                                  {field.label}
                                  {field.required && <span className="text-red-500">*</span>}
                                </div>
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {previewData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-muted/50">
                            <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                              {idx + 1}
                            </td>
                            {systemFields
                              .filter((f) => mapping[f.key])
                              .map((field) => {
                                const excelCol = mapping[field.key];
                                let value = '';
                                
                                if (excelCol.includes('+')) {
                                  const parts = excelCol.split('+');
                                  value = parts
                                    .map((p) => row[p.trim()])
                                    .filter(Boolean)
                                    .join(' ');
                                } else {
                                  value = row[excelCol];
                                }

                                const isEmpty = !value || String(value).trim() === '';

                                return (
                                  <td
                                    key={field.key}
                                    className={`px-4 py-3 ${isEmpty && field.required ? 'bg-red-50 text-red-600' : ''}`}
                                  >
                                    {isEmpty ? (
                                      <span className="text-muted-foreground italic">empty</span>
                                    ) : (
                                      <span className="line-clamp-2">{String(value)}</span>
                                    )}
                                  </td>
                                );
                              })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  * Rows with empty required fields (shown in red) will be skipped during import
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !mapping.name || !mapping.phone}
            className="min-w-[120px]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>Import {allData.length > 0 && `${allData.length} Rows`}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Import</DialogTitle>
            <DialogDescription>
              Review the import statistics before proceeding
            </DialogDescription>
          </DialogHeader>

          {confirmStats && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Ready to import:</span>
                  <span className="text-lg font-bold text-blue-600">{confirmStats.valid} leads</span>
                </div>
              </div>

              {(confirmStats.duplicates > 0 || confirmStats.skipped > 0) && (
                <div className="space-y-2">
                  {confirmStats.duplicates > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-yellow-700">Duplicate phone numbers:</span>
                      <span className="font-medium text-yellow-700">{confirmStats.duplicates} will be skipped</span>
                    </div>
                  )}
                  {confirmStats.skipped > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-red-700">Missing name or phone:</span>
                      <span className="font-medium text-red-700">{confirmStats.skipped} will be skipped</span>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 border-t">
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Total rows in file:</span>
                  <span>{confirmStats.total}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmImport} className="bg-blue-600 hover:bg-blue-700">
              Confirm Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};