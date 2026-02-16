// Excel Import/Export Utilities for CRM Leads
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import type { Lead, CreateLeadPayload, PriorityEnum } from '@/types/crmTypes';

// Format date/datetime to standard Excel format
const formatDateForExcel = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    const date = parseISO(dateString);
    return format(date, 'yyyy-MM-dd HH:mm:ss');
  } catch {
    return dateString;
  }
};

// Format date only (no time)
const formatDateOnlyForExcel = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    const date = parseISO(dateString);
    return format(date, 'yyyy-MM-dd');
  } catch {
    return dateString;
  }
};

// Parse Excel date to ISO string
const parseExcelDate = (value: any): string | undefined => {
  if (!value) return undefined;

  // If it's already a string
  if (typeof value === 'string') {
    try {
      // Try to parse it
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch {
      return undefined;
    }
  }

  // If it's an Excel serial date number
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date.toISOString();
  }

  return undefined;
};

/**
 * Export leads to Excel file
 */
export const exportLeadsToExcel = (
  leads: Lead[],
  filename: string = `leads_export_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`
) => {
  // Prepare data for Excel
  const excelData = leads.map((lead) => ({
    'ID': lead.id,
    'Name': lead.name || '',
    'Phone': lead.phone || '',
    'Email': lead.email || '',
    'Company': lead.company || '',
    'Title': lead.title || '',
    'Priority': lead.priority || '',
    'Status ID': typeof lead.status === 'number' ? lead.status : lead.status?.id || '',
    'Status Name': lead.status_name || '',
    'Value Amount': lead.value_amount || '',
    'Value Currency': lead.value_currency || '',
    'Source': lead.source || '',
    'Owner User ID': lead.owner_user_id || '',
    'Assigned To': lead.assigned_to || '',
    'Notes': lead.notes || '',
    'Address Line 1': lead.address_line1 || '',
    'Address Line 2': lead.address_line2 || '',
    'City': lead.city || '',
    'State': lead.state || '',
    'Country': lead.country || '',
    'Postal Code': lead.postal_code || '',
    'Last Contacted At': formatDateForExcel(lead.last_contacted_at),
    'Next Follow Up At': formatDateForExcel(lead.next_follow_up_at),
    'Created At': formatDateForExcel(lead.created_at),
    'Updated At': formatDateForExcel(lead.updated_at),
  }));

  // Create workbook and worksheet
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

  // Set column widths for better readability
  const columnWidths = [
    { wch: 8 },  // ID
    { wch: 20 }, // Name
    { wch: 15 }, // Phone
    { wch: 25 }, // Email
    { wch: 20 }, // Company
    { wch: 20 }, // Title
    { wch: 10 }, // Priority
    { wch: 10 }, // Status ID
    { wch: 15 }, // Status Name
    { wch: 12 }, // Value Amount
    { wch: 10 }, // Value Currency
    { wch: 15 }, // Source
    { wch: 30 }, // Owner User ID
    { wch: 30 }, // Assigned To
    { wch: 30 }, // Notes
    { wch: 20 }, // Address Line 1
    { wch: 20 }, // Address Line 2
    { wch: 15 }, // City
    { wch: 15 }, // State
    { wch: 15 }, // Country
    { wch: 12 }, // Postal Code
    { wch: 20 }, // Last Contacted At
    { wch: 20 }, // Next Follow Up At
    { wch: 20 }, // Created At
    { wch: 20 }, // Updated At
  ];
  worksheet['!cols'] = columnWidths;

  // Generate and download file
  XLSX.writeFile(workbook, filename);
};

/**
 * Download a template Excel file for importing leads
 */
export const downloadLeadsTemplate = () => {
  const templateData = [
    {
      'Name': 'John Doe',
      'Phone': '+1234567890',
      'Email': 'john@example.com',
      'Company': 'Example Corp',
      'Title': 'CEO',
      'Priority': 'MEDIUM',
      'Value Amount': '10000.00',
      'Value Currency': 'USD',
      'Source': 'Website',
      'Notes': 'Interested in our services',
      'Address Line 1': '123 Main St',
      'Address Line 2': 'Suite 100',
      'City': 'New York',
      'State': 'NY',
      'Country': 'USA',
      'Postal Code': '10001',
      'Next Follow Up At': '2025-01-15 10:00:00',
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads Template');

  // Set column widths
  const columnWidths = [
    { wch: 20 }, // Name
    { wch: 15 }, // Phone
    { wch: 25 }, // Email
    { wch: 20 }, // Company
    { wch: 20 }, // Title
    { wch: 10 }, // Priority
    { wch: 12 }, // Value Amount
    { wch: 10 }, // Value Currency
    { wch: 15 }, // Source
    { wch: 30 }, // Notes
    { wch: 20 }, // Address Line 1
    { wch: 20 }, // Address Line 2
    { wch: 15 }, // City
    { wch: 15 }, // State
    { wch: 15 }, // Country
    { wch: 12 }, // Postal Code
    { wch: 20 }, // Next Follow Up At
  ];
  worksheet['!cols'] = columnWidths;

  const filename = `leads_import_template_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

/**
 * Parse Excel file and convert to CreateLeadPayload array
 */
export const importLeadsFromExcel = async (
  file: File,
  defaultOwnerId?: string
): Promise<{ leads: CreateLeadPayload[]; errors: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const leads: CreateLeadPayload[] = [];
        const errors: string[] = [];

        jsonData.forEach((row: any, index: number) => {
          const rowNumber = index + 2; // +2 because Excel is 1-indexed and has header row

          // Validate required fields
          if (!row['Name'] || !row['Phone']) {
            errors.push(`Row ${rowNumber}: Name and Phone are required fields`);
            return;
          }

          // Trim and clean data
          const name = String(row['Name']).trim();
          const phone = String(row['Phone']).trim();

          if (!name || !phone) {
            errors.push(`Row ${rowNumber}: Name and Phone cannot be empty`);
            return;
          }

          // Validate priority if provided
          let priority: PriorityEnum = 'MEDIUM';
          if (row['Priority']) {
            const priorityValue = String(row['Priority']).toUpperCase();
            if (['LOW', 'MEDIUM', 'HIGH'].includes(priorityValue)) {
              priority = priorityValue as PriorityEnum;
            } else {
              errors.push(`Row ${rowNumber}: Invalid priority "${row['Priority']}". Using default "MEDIUM"`);
            }
          }

          // Build lead payload
          const lead: CreateLeadPayload = {
            name,
            phone,
            email: row['Email'] ? String(row['Email']).trim() : undefined,
            company: row['Company'] ? String(row['Company']).trim() : undefined,
            title: row['Title'] ? String(row['Title']).trim() : undefined,
            priority,
            value_amount: row['Value Amount'] ? String(row['Value Amount']).trim() : undefined,
            value_currency: row['Value Currency'] ? String(row['Value Currency']).trim() : undefined,
            source: row['Source'] ? String(row['Source']).trim() : undefined,
            notes: row['Notes'] ? String(row['Notes']).trim() : undefined,
            address_line1: row['Address Line 1'] ? String(row['Address Line 1']).trim() : undefined,
            address_line2: row['Address Line 2'] ? String(row['Address Line 2']).trim() : undefined,
            city: row['City'] ? String(row['City']).trim() : undefined,
            state: row['State'] ? String(row['State']).trim() : undefined,
            country: row['Country'] ? String(row['Country']).trim() : undefined,
            postal_code: row['Postal Code'] ? String(row['Postal Code']).trim() : undefined,
            next_follow_up_at: parseExcelDate(row['Next Follow Up At']),
            last_contacted_at: parseExcelDate(row['Last Contacted At']),
            owner_user_id: defaultOwnerId, // Set owner to current user
          };

          leads.push(lead);
        });

        resolve({ leads, errors });
      } catch (error: any) {
        reject(new Error(`Failed to parse Excel file: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsBinaryString(file);
  });
};
