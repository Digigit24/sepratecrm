// src/lib/currencyConfig.ts

/**
 * Currency Configuration for the Application
 * Centralized currency settings to be used across the entire app
 *
 * NOTE: This is the default/fallback configuration.
 * For dynamic tenant-based currency, use the useCurrency hook instead.
 */

export interface CurrencyConfigType {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
  thousandSeparator: string;
  decimalSeparator: string;
  symbolPosition: 'before' | 'after';
  useIndianNumbering?: boolean;
}

export const CURRENCY_CONFIG: CurrencyConfigType = {
  // Currency code (ISO 4217)
  code: 'INR',

  // Currency symbol
  symbol: '₹',

  // Currency name
  name: 'Indian Rupee',

  // Decimal places
  decimals: 2,

  // Thousand separator
  thousandSeparator: ',',

  // Decimal separator
  decimalSeparator: '.',

  // Symbol position: 'before' or 'after'
  symbolPosition: 'before',

  // Use Indian numbering system
  useIndianNumbering: true,
};

/**
 * Get currency configuration from tenant settings or use default
 * This function can be used to get dynamic currency config from tenant
 */
export const getCurrencyConfig = (tenantSettings?: any): CurrencyConfigType => {
  if (!tenantSettings) {
    return CURRENCY_CONFIG;
  }

  return {
    code: tenantSettings.currency_code || CURRENCY_CONFIG.code,
    symbol: tenantSettings.currency_symbol || CURRENCY_CONFIG.symbol,
    name: tenantSettings.currency_name || CURRENCY_CONFIG.name,
    decimals: tenantSettings.currency_decimals ?? CURRENCY_CONFIG.decimals,
    thousandSeparator: tenantSettings.currency_thousand_separator || CURRENCY_CONFIG.thousandSeparator,
    decimalSeparator: tenantSettings.currency_decimal_separator || CURRENCY_CONFIG.decimalSeparator,
    symbolPosition: tenantSettings.currency_symbol_position || CURRENCY_CONFIG.symbolPosition,
    useIndianNumbering: tenantSettings.currency_use_indian_numbering ?? CURRENCY_CONFIG.useIndianNumbering,
  };
};

/**
 * Format a number as currency
 * @param amount - The amount to format
 * @param showSymbol - Whether to show the currency symbol (default: true)
 * @param decimals - Number of decimal places (default: from config)
 * @param config - Optional custom currency configuration
 * @returns Formatted currency string
 */
export const formatCurrency = (
  amount: number | string,
  showSymbol: boolean = true,
  decimals?: number,
  config: CurrencyConfigType = CURRENCY_CONFIG
): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  const decimalPlaces = decimals ?? config.decimals;

  if (isNaN(numAmount)) {
    return showSymbol ? `${config.symbol}0.00` : '0.00';
  }

  // Format number with decimals
  const formatted = numAmount.toFixed(decimalPlaces);

  // Split into integer and decimal parts
  const [integerPart, decimalPart] = formatted.split('.');

  // Add thousand separators (standard numbering system)
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandSeparator);

  // Combine parts
  const finalAmount = decimalPart ? `${formattedInteger}${config.decimalSeparator}${decimalPart}` : formattedInteger;

  // Add symbol based on position
  if (!showSymbol) {
    return finalAmount;
  }

  return config.symbolPosition === 'before'
    ? `${config.symbol}${finalAmount}`
    : `${finalAmount}${config.symbol}`;
};

/**
 * Format a number as currency with Indian numbering system
 * @param amount - The amount to format
 * @param showSymbol - Whether to show the currency symbol (default: true)
 * @param config - Optional custom currency configuration
 * @returns Formatted currency string with Indian numbering
 */
export const formatIndianCurrency = (
  amount: number | string,
  showSymbol: boolean = true,
  config: CurrencyConfigType = CURRENCY_CONFIG
): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return showSymbol ? `${config.symbol}0.00` : '0.00';
  }

  const formatted = numAmount.toFixed(config.decimals);
  const [integerPart, decimalPart] = formatted.split('.');

  let formattedInteger = '';
  const length = integerPart.length;

  if (config.useIndianNumbering) {
    // Indian numbering system: last 3 digits, then groups of 2
    if (length <= 3) {
      formattedInteger = integerPart;
    } else {
      const lastThree = integerPart.substring(length - 3);
      const remaining = integerPart.substring(0, length - 3);

      formattedInteger = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, config.thousandSeparator) + config.thousandSeparator + lastThree;
    }
  } else {
    // Standard numbering: groups of 3
    formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandSeparator);
  }

  const finalAmount = `${formattedInteger}${config.decimalSeparator}${decimalPart}`;

  return showSymbol
    ? `${config.symbol}${finalAmount}`
    : finalAmount;
};

/**
 * Get currency symbol
 * @param config - Optional custom currency configuration
 * @returns Currency symbol
 */
export const getCurrencySymbol = (config: CurrencyConfigType = CURRENCY_CONFIG): string => {
  return config.symbol;
};

/**
 * Get currency code
 * @param config - Optional custom currency configuration
 * @returns Currency code
 */
export const getCurrencyCode = (config: CurrencyConfigType = CURRENCY_CONFIG): string => {
  return config.code;
};

/**
 * Parse currency string to number
 * @param currencyString - String with currency symbol and separators
 * @param config - Optional custom currency configuration
 * @returns Parsed number
 */
export const parseCurrency = (currencyString: string, config: CurrencyConfigType = CURRENCY_CONFIG): number => {
  if (!currencyString) return 0;

  // Remove currency symbol and separators
  const cleaned = currencyString
    .replace(config.symbol, '')
    .replace(new RegExp(`\\${config.thousandSeparator}`, 'g'), '')
    .replace(config.decimalSeparator, '.')
    .trim();

  return parseFloat(cleaned) || 0;
};
