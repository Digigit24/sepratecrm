// src/components/ui/date-picker.tsx
"use client";

import * as React from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DatePickerProps {
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  mode?: "default" | "birth-date"; // New mode for birth date selection
  fromYear?: number; // For birth date mode
  toYear?: number; // For birth date mode
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  mode = "default",
  fromYear = 1920,
  toYear = new Date().getFullYear(),
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentMonth, setCurrentMonth] = React.useState<Date>(
    date || new Date()
  );

  React.useEffect(() => {
    if (date) {
      setCurrentMonth(date);
    }
  }, [date]);

  const handleSelect = (selectedDate: Date | undefined) => {
    onDateChange(selectedDate);
    if (mode === "default") {
      setIsOpen(false);
    }
  };

  const handleToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    onDateChange(today);
    setCurrentMonth(today);
    setIsOpen(false);
  };

  const handleMonthChange = (month: string) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(parseInt(month));
    setCurrentMonth(newDate);
  };

  const handleYearChange = (year: string) => {
    const newDate = new Date(currentMonth);
    newDate.setFullYear(parseInt(year));
    setCurrentMonth(newDate);
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const years = Array.from(
    { length: toYear - fromYear + 1 },
    (_, i) => toYear - i
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="border-b p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleToday}
          >
            Today
          </Button>
        </div>

        {mode === "birth-date" && (
          <div className="flex gap-2 p-3 border-b">
            <Select
              value={currentMonth.getMonth().toString()}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month, index) => (
                  <SelectItem key={month} value={index.toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={currentMonth.getFullYear().toString()}
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          initialFocus
          fromYear={fromYear}
          toYear={toYear}
        />
      </PopoverContent>
    </Popover>
  );
}
