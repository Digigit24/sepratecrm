// src/components/admin-settings/CurrencySettingsTab.tsx
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { IndianRupee } from 'lucide-react';

interface CurrencySettings {
  currency_code: string;
  currency_symbol: string;
  currency_name: string;
  currency_decimals: number;
  currency_thousand_separator: string;
  currency_decimal_separator: string;
  currency_symbol_position: 'before' | 'after';
  currency_use_indian_numbering: boolean;
}

interface CurrencySettingsTabProps {
  currencyCode: string;
  currencySymbol: string;
  currencyName: string;
  currencyDecimals: number;
  currencyThousandSeparator: string;
  currencyDecimalSeparator: string;
  currencySymbolPosition: 'before' | 'after';
  currencyUseIndianNumbering: boolean;
  onCurrencyCodeChange: (value: string) => void;
  onCurrencySymbolChange: (value: string) => void;
  onCurrencyNameChange: (value: string) => void;
  onCurrencyDecimalsChange: (value: number) => void;
  onCurrencyThousandSeparatorChange: (value: string) => void;
  onCurrencyDecimalSeparatorChange: (value: string) => void;
  onCurrencySymbolPositionChange: (value: 'before' | 'after') => void;
  onCurrencyUseIndianNumberingChange: (value: boolean) => void;
}

// Predefined currency options
const CURRENCY_OPTIONS = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
];

export const CurrencySettingsTab: React.FC<CurrencySettingsTabProps> = ({
  currencyCode,
  currencySymbol,
  currencyName,
  currencyDecimals,
  currencyThousandSeparator,
  currencyDecimalSeparator,
  currencySymbolPosition,
  currencyUseIndianNumbering,
  onCurrencyCodeChange,
  onCurrencySymbolChange,
  onCurrencyNameChange,
  onCurrencyDecimalsChange,
  onCurrencyThousandSeparatorChange,
  onCurrencyDecimalSeparatorChange,
  onCurrencySymbolPositionChange,
  onCurrencyUseIndianNumberingChange,
}) => {
  // Handle predefined currency selection
  const handleCurrencySelect = (code: string) => {
    const currency = CURRENCY_OPTIONS.find(c => c.code === code);
    if (currency) {
      onCurrencyCodeChange(currency.code);
      onCurrencySymbolChange(currency.symbol);
      onCurrencyNameChange(currency.name);

      // Set default formatting for Indian Rupee
      if (currency.code === 'INR') {
        onCurrencyUseIndianNumberingChange(true);
      }
    }
  };

  // Format preview amount
  const formatPreview = () => {
    const amount = 123456.78;
    let formatted = amount.toFixed(currencyDecimals);
    const [integerPart, decimalPart] = formatted.split('.');

    let formattedInteger = '';

    if (currencyUseIndianNumbering && currencyCode === 'INR') {
      // Indian numbering system: last 3 digits, then groups of 2
      const length = integerPart.length;
      if (length <= 3) {
        formattedInteger = integerPart;
      } else {
        const lastThree = integerPart.substring(length - 3);
        const remaining = integerPart.substring(0, length - 3);
        formattedInteger = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, currencyThousandSeparator) + currencyThousandSeparator + lastThree;
      }
    } else {
      // Standard numbering: groups of 3
      formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, currencyThousandSeparator);
    }

    const finalAmount = decimalPart
      ? `${formattedInteger}${currencyDecimalSeparator}${decimalPart}`
      : formattedInteger;

    return currencySymbolPosition === 'before'
      ? `${currencySymbol}${finalAmount}`
      : `${finalAmount}${currencySymbol}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            <CardTitle>Currency Configuration</CardTitle>
          </div>
          <CardDescription>
            Configure the currency used throughout your application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quick Currency Selection */}
          <div className="space-y-2">
            <Label htmlFor="currency-select">Select Currency</Label>
            <Select value={currencyCode} onValueChange={handleCurrencySelect}>
              <SelectTrigger id="currency-select">
                <SelectValue placeholder="Select a currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.symbol} {currency.code} - {currency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Currency Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency-code">Currency Code</Label>
              <Input
                id="currency-code"
                placeholder="INR"
                value={currencyCode}
                onChange={(e) => onCurrencyCodeChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">ISO 4217 currency code</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency-symbol">Currency Symbol</Label>
              <Input
                id="currency-symbol"
                placeholder="₹"
                value={currencySymbol}
                onChange={(e) => onCurrencySymbolChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Symbol displayed with amounts</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency-name">Currency Name</Label>
              <Input
                id="currency-name"
                placeholder="Indian Rupee"
                value={currencyName}
                onChange={(e) => onCurrencyNameChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency-decimals">Decimal Places</Label>
              <Select
                value={currencyDecimals.toString()}
                onValueChange={(value) => onCurrencyDecimalsChange(parseInt(value))}
              >
                <SelectTrigger id="currency-decimals">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Formatting Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="thousand-separator">Thousand Separator</Label>
              <Select
                value={currencyThousandSeparator || "none"}
                onValueChange={(value) => onCurrencyThousandSeparatorChange(value === "none" ? "" : value)}
              >
                <SelectTrigger id="thousand-separator">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=",">Comma (,)</SelectItem>
                  <SelectItem value=".">Period (.)</SelectItem>
                  <SelectItem value=" ">Space ( )</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="decimal-separator">Decimal Separator</Label>
              <Select
                value={currencyDecimalSeparator}
                onValueChange={onCurrencyDecimalSeparatorChange}
              >
                <SelectTrigger id="decimal-separator">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=".">Period (.)</SelectItem>
                  <SelectItem value=",">Comma (,)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="symbol-position">Symbol Position</Label>
              <Select
                value={currencySymbolPosition}
                onValueChange={(value) => onCurrencySymbolPositionChange(value as 'before' | 'after')}
              >
                <SelectTrigger id="symbol-position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Before amount ({currencySymbol}100)</SelectItem>
                  <SelectItem value="after">After amount (100{currencySymbol})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between space-y-2 pt-6">
              <div className="space-y-0.5">
                <Label htmlFor="indian-numbering">Indian Numbering</Label>
                <p className="text-xs text-muted-foreground">
                  Use Indian numbering system (1,00,000 instead of 100,000)
                </p>
              </div>
              <Switch
                id="indian-numbering"
                checked={currencyUseIndianNumbering}
                onCheckedChange={onCurrencyUseIndianNumberingChange}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preview</CardTitle>
          <CardDescription>
            See how amounts will be displayed with your current settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Sample Amount (123456.78):</span>
              <span className="text-2xl font-bold">{formatPreview()}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Currency:</p>
                <p className="font-medium">{currencySymbol} {currencyCode}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Format:</p>
                <p className="font-medium">
                  {currencyUseIndianNumbering ? 'Indian Numbering' : 'Standard Numbering'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
