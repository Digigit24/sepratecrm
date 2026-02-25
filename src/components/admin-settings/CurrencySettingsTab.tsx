// src/components/admin-settings/CurrencySettingsTab.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { IndianRupee, Eye } from 'lucide-react';

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
  const handleCurrencySelect = (code: string) => {
    const currency = CURRENCY_OPTIONS.find(c => c.code === code);
    if (currency) {
      onCurrencyCodeChange(currency.code);
      onCurrencySymbolChange(currency.symbol);
      onCurrencyNameChange(currency.name);
      if (currency.code === 'INR') {
        onCurrencyUseIndianNumberingChange(true);
      }
    }
  };

  const formatPreview = () => {
    const amount = 123456.78;
    let formatted = amount.toFixed(currencyDecimals);
    const [integerPart, decimalPart] = formatted.split('.');

    let formattedInteger = '';

    if (currencyUseIndianNumbering && currencyCode === 'INR') {
      const length = integerPart.length;
      if (length <= 3) {
        formattedInteger = integerPart;
      } else {
        const lastThree = integerPart.substring(length - 3);
        const remaining = integerPart.substring(0, length - 3);
        formattedInteger = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, currencyThousandSeparator) + currencyThousandSeparator + lastThree;
      }
    } else {
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
    <div className="space-y-3">
      {/* Currency Configuration */}
      <Card className="border-border/60">
        <CardHeader className="p-3 pb-0">
          <div className="flex items-center gap-1.5">
            <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Currency Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          {/* Quick Selection */}
          <div className="space-y-1 mb-3">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Quick Select</Label>
            <Select value={currencyCode} onValueChange={handleCurrencySelect}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select a currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code} className="text-xs">
                    {currency.symbol} {currency.code} - {currency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Currency Details - 4 col grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Code</Label>
              <Input
                placeholder="INR"
                value={currencyCode}
                onChange={(e) => onCurrencyCodeChange(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Symbol</Label>
              <Input
                placeholder="₹"
                value={currencySymbol}
                onChange={(e) => onCurrencySymbolChange(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Name</Label>
              <Input
                placeholder="Indian Rupee"
                value={currencyName}
                onChange={(e) => onCurrencyNameChange(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Decimals</Label>
              <Select
                value={currencyDecimals.toString()}
                onValueChange={(value) => onCurrencyDecimalsChange(parseInt(value))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0" className="text-xs">0</SelectItem>
                  <SelectItem value="2" className="text-xs">2</SelectItem>
                  <SelectItem value="3" className="text-xs">3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Formatting Options - 4 col grid */}
          <div className="border-t border-border/40 mt-3 pt-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Formatting</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Thousand Sep.</Label>
                <Select
                  value={currencyThousandSeparator || "none"}
                  onValueChange={(value) => onCurrencyThousandSeparatorChange(value === "none" ? "" : value)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="," className="text-xs">Comma (,)</SelectItem>
                    <SelectItem value="." className="text-xs">Period (.)</SelectItem>
                    <SelectItem value=" " className="text-xs">Space ( )</SelectItem>
                    <SelectItem value="none" className="text-xs">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Decimal Sep.</Label>
                <Select
                  value={currencyDecimalSeparator}
                  onValueChange={onCurrencyDecimalSeparatorChange}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="." className="text-xs">Period (.)</SelectItem>
                    <SelectItem value="," className="text-xs">Comma (,)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Symbol Position</Label>
                <Select
                  value={currencySymbolPosition}
                  onValueChange={(value) => onCurrencySymbolPositionChange(value as 'before' | 'after')}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before" className="text-xs">Before ({currencySymbol}100)</SelectItem>
                    <SelectItem value="after" className="text-xs">After (100{currencySymbol})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pt-4">
                <div>
                  <Label className="text-[10px] text-muted-foreground leading-none">Indian Numbering</Label>
                  <p className="text-[9px] text-muted-foreground/70 mt-0.5">1,00,000</p>
                </div>
                <Switch
                  checked={currencyUseIndianNumbering}
                  onCheckedChange={onCurrencyUseIndianNumberingChange}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Card */}
      <Card className="border-border/60">
        <CardHeader className="p-3 pb-0">
          <div className="flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
            <span className="text-[10px] text-muted-foreground">Sample (123456.78):</span>
            <span className="text-lg font-bold">{formatPreview()}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
            <div>
              <p className="text-[10px] text-muted-foreground">Currency</p>
              <p className="font-medium">{currencySymbol} {currencyCode}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Format</p>
              <p className="font-medium">
                {currencyUseIndianNumbering ? 'Indian Numbering' : 'Standard'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
