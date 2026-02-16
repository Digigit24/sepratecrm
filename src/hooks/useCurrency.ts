// src/hooks/useCurrency.ts
import { useMemo } from 'react';
import { useAuth } from './useAuth';

interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
  thousandSeparator: string;
  decimalSeparator: string;
  symbolPosition: 'before' | 'after';
  useIndianNumbering: boolean;
}

interface CurrencyUtils {
  config: CurrencyConfig;
  formatCurrency: (amount: number | string, showSymbol?: boolean, decimals?: number) => string;
  formatIndianCurrency: (amount: number | string, showSymbol?: boolean) => string;
  getCurrencySymbol: () => string;
  getCurrencyCode: () => string;
  parseCurrency: (currencyString: string) => number;
}

/**
 * Custom hook to get currency configuration from tenant settings
 * and utility functions for currency formatting
 */
export const useCurrency = (): CurrencyUtils => {
  const { getTenant } = useAuth();
  const tenant = getTenant();

  // Get currency config from tenant settings with fallback to defaults
  const config = useMemo<CurrencyConfig>(() => {
    const settings = tenant?.settings || {};

    return {
      code: settings.currency_code || 'INR',
      symbol: settings.currency_symbol || '₹',
      name: settings.currency_name || 'Indian Rupee',
      decimals: settings.currency_decimals ?? 2,
      thousandSeparator: settings.currency_thousand_separator || ',',
      decimalSeparator: settings.currency_decimal_separator || '.',
      symbolPosition: settings.currency_symbol_position || 'before',
      useIndianNumbering: settings.currency_use_indian_numbering ?? true,
    };
  }, [tenant?.settings]);

  /**
   * Format a number as currency
   */
  const formatCurrency = (
    amount: number | string,
    showSymbol: boolean = true,
    decimals: number = config.decimals
  ): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

    if (isNaN(numAmount)) {
      return showSymbol ? `${config.symbol}0.00` : '0.00';
    }

    // Format number with decimals
    const formatted = numAmount.toFixed(decimals);

    // Split into integer and decimal parts
    const [integerPart, decimalPart] = formatted.split('.');

    // Add thousand separators (standard numbering system)
    const formattedInteger = integerPart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      config.thousandSeparator
    );

    // Combine parts
    const finalAmount = decimalPart
      ? `${formattedInteger}${config.decimalSeparator}${decimalPart}`
      : formattedInteger;

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
   */
  const formatIndianCurrency = (
    amount: number | string,
    showSymbol: boolean = true
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

        formattedInteger =
          remaining.replace(/\B(?=(\d{2})+(?!\d))/g, config.thousandSeparator) +
          config.thousandSeparator +
          lastThree;
      }
    } else {
      // Standard numbering: groups of 3
      formattedInteger = integerPart.replace(
        /\B(?=(\d{3})+(?!\d))/g,
        config.thousandSeparator
      );
    }

    const finalAmount = `${formattedInteger}${config.decimalSeparator}${decimalPart}`;

    return showSymbol ? `${config.symbol}${finalAmount}` : finalAmount;
  };

  /**
   * Get currency symbol
   */
  const getCurrencySymbol = (): string => {
    return config.symbol;
  };

  /**
   * Get currency code
   */
  const getCurrencyCode = (): string => {
    return config.code;
  };

  /**
   * Parse currency string to number
   */
  const parseCurrency = (currencyString: string): number => {
    if (!currencyString) return 0;

    // Remove currency symbol and separators
    const cleaned = currencyString
      .replace(config.symbol, '')
      .replace(new RegExp(`\\${config.thousandSeparator}`, 'g'), '')
      .replace(config.decimalSeparator, '.')
      .trim();

    return parseFloat(cleaned) || 0;
  };

  return {
    config,
    formatCurrency,
    formatIndianCurrency,
    getCurrencySymbol,
    getCurrencyCode,
    parseCurrency,
  };
};
