// src/utils/csvTemplateGenerator.ts

/**
 * Generate a CSV template file for lead imports
 */
export const generateLeadImportTemplate = (): void => {
  // Define template headers
  const headers = [
    'Full Name',
    'Phone Number',
    'Email',
    'Company',
    'Job Title',
    'Services',
    'Date',
    'Notes',
    'Source',
    'City',
    'State',
    'Country',
    'Postal Code'
  ];

  // Sample data rows
  const sampleRows = [
    [
      'John Doe',
      '+91-9876543210',
      'john.doe@example.com',
      'ABC Corporation',
      'Manager',
      'Consultation',
      '2024-01-15',
      'Interested in premium package',
      'Website',
      'Mumbai',
      'Maharashtra',
      'India',
      '400001'
    ],
    [
      'Jane Smith',
      '9876543211',
      'jane.smith@example.com',
      'XYZ Ltd',
      'Director',
      'Treatment',
      '2024-01-16',
      'Follow up required',
      'Referral',
      'Delhi',
      'Delhi',
      'India',
      '110001'
    ],
    [
      'Robert Johnson',
      '+1-555-0123',
      'robert.j@example.com',
      'Global Inc',
      'CEO',
      'Consultation, Treatment',
      '2024-01-17',
      'VIP client',
      'Direct',
      'New York',
      'NY',
      'USA',
      '10001'
    ]
  ];

  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...sampleRows.map(row => 
      row.map(cell => {
        // Escape cells containing commas or quotes
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', 'lead_import_template.csv');
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

/**
 * Generate an Excel template with multiple sheets (instructions + data)
 */
export const generateLeadImportTemplateExcel = async (): Promise<void> => {
  const XLSX = await import('xlsx');

  // Instructions sheet
  const instructions = [
    ['Lead Import Template - Instructions'],
    [''],
    ['Required Fields:'],
    ['1. Full Name - Complete name of the lead (will be used to create patient)'],
    ['2. Phone Number - Primary contact number (used as unique identifier)'],
    [''],
    ['Optional Fields:'],
    ['• Email - Email address for communication'],
    ['• Company - Company or organization name'],
    ['• Job Title - Job title or position'],
    ['• Services - Services interested in'],
    ['• Date - Inquiry or creation date'],
    ['• Notes - Additional notes or comments'],
    ['• Source - Where the lead came from (Website, Referral, etc.)'],
    ['• City, State, Country, Postal Code - Location information'],
    [''],
    ['Important Notes:'],
    ['• Phone numbers must be unique (duplicates will be skipped)'],
    ['• Both Name and Phone are required for each row'],
    ['• Empty rows will be skipped'],
    ['• Date format: YYYY-MM-DD (e.g., 2024-01-15)'],
    ['• Multiple services can be separated by commas'],
    [''],
    ['Tips:'],
    ['• You can use "First Name" and "Last Name" columns separately'],
    ['• Phone formats: +91-9876543210, 9876543210, +1-555-0123 all work'],
    ['• Delete the sample data rows before importing your own data'],
  ];

  // Data sheet with headers and sample data
  const dataHeaders = [
    'Full Name',
    'Phone Number',
    'Email',
    'Company',
    'Job Title',
    'Services',
    'Date',
    'Notes',
    'Source',
    'City',
    'State',
    'Country',
    'Postal Code'
  ];

  const sampleData = [
    [
      'John Doe',
      '+91-9876543210',
      'john.doe@example.com',
      'ABC Corporation',
      'Manager',
      'Consultation',
      '2024-01-15',
      'Interested in premium package',
      'Website',
      'Mumbai',
      'Maharashtra',
      'India',
      '400001'
    ],
    [
      'Jane Smith',
      '9876543211',
      'jane.smith@example.com',
      'XYZ Ltd',
      'Director',
      'Treatment',
      '2024-01-16',
      'Follow up required',
      'Referral',
      'Delhi',
      'Delhi',
      'India',
      '110001'
    ],
    [
      'Robert Johnson',
      '+1-555-0123',
      'robert.j@example.com',
      'Global Inc',
      'CEO',
      'Consultation, Treatment',
      '2024-01-17',
      'VIP client',
      'Direct',
      'New York',
      'NY',
      'USA',
      '10001'
    ]
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Add instructions sheet
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  
  // Set column widths for instructions
  wsInstructions['!cols'] = [{ wch: 80 }];
  
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  // Add data sheet
  const wsData = XLSX.utils.aoa_to_sheet([dataHeaders, ...sampleData]);
  
  // Set column widths for data
  wsData['!cols'] = [
    { wch: 20 }, // Full Name
    { wch: 18 }, // Phone Number
    { wch: 25 }, // Email
    { wch: 20 }, // Company
    { wch: 15 }, // Job Title
    { wch: 20 }, // Services
    { wch: 12 }, // Date
    { wch: 30 }, // Notes
    { wch: 15 }, // Source
    { wch: 15 }, // City
    { wch: 15 }, // State
    { wch: 12 }, // Country
    { wch: 12 }, // Postal Code
  ];

  XLSX.utils.book_append_sheet(wb, wsData, 'Lead Data');

  // Write file
  XLSX.writeFile(wb, 'lead_import_template.xlsx');
};

/**
 * Validate CSV data before import
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalRows: number;
    validRows: number;
    duplicates: number;
    missingName: number;
    missingPhone: number;
  };
}

export const validateLeadImportData = (data: any[]): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenPhones = new Set<string>();
  
  let validRows = 0;
  let duplicates = 0;
  let missingName = 0;
  let missingPhone = 0;

  data.forEach((row, index) => {
    const rowNum = index + 2; // +2 for 1-based index and header row
    
    // Check required fields
    const name = String(row.name || '').trim();
    const phone = String(row.phone || '').trim();

    if (!name) {
      missingName++;
      warnings.push(`Row ${rowNum}: Missing name`);
    }

    if (!phone) {
      missingPhone++;
      warnings.push(`Row ${rowNum}: Missing phone number`);
    }

    // Check for duplicates
    const normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone && seenPhones.has(normalizedPhone)) {
      duplicates++;
      warnings.push(`Row ${rowNum}: Duplicate phone number (${phone})`);
    } else if (normalizedPhone) {
      seenPhones.add(normalizedPhone);
    }

    // Count valid rows
    if (name && phone && !seenPhones.has(normalizedPhone)) {
      validRows++;
    }

    // Validate email format if provided
    if (row.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(row.email)) {
        warnings.push(`Row ${rowNum}: Invalid email format (${row.email})`);
      }
    }

    // Validate phone format
    if (phone) {
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        warnings.push(`Row ${rowNum}: Phone number too short (${phone})`);
      }
    }
  });

  // Generate errors if no valid data
  if (validRows === 0) {
    errors.push('No valid rows found. Please ensure each row has both name and phone number.');
  }

  return {
    valid: validRows > 0,
    errors,
    warnings,
    stats: {
      totalRows: data.length,
      validRows,
      duplicates,
      missingName,
      missingPhone
    }
  };
};