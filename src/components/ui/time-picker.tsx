// src/components/ui/time-picker.tsx
"use client";

import * as React from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface TimePickerProps {
  time?: string; // Format: "HH:mm" (24-hour format)
  onTimeChange: (time: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function TimePicker({
  time,
  onTimeChange,
  placeholder = "Pick a time",
  disabled = false,
  className,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Parse time string to get hours and minutes
  const parseTime = (timeStr: string) => {
    if (!timeStr) return { hours: 12, minutes: 0, period: 'AM' };

    const [hoursStr, minutesStr] = timeStr.split(':');
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; // Convert to 12-hour format

    return { hours, minutes, period };
  };

  // Format time to HH:mm (24-hour format)
  const formatTime = (hours: number, minutes: number, period: string) => {
    let hours24 = hours;
    if (period === 'PM' && hours !== 12) {
      hours24 = hours + 12;
    } else if (period === 'AM' && hours === 12) {
      hours24 = 0;
    }
    return `${String(hours24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const { hours, minutes, period } = parseTime(time || '');

  const handleTimeChange = (
    type: "hour" | "minute" | "period",
    value: number | string
  ) => {
    let newHours = hours;
    let newMinutes = minutes;
    let newPeriod = period;

    if (type === "hour") {
      newHours = value as number;
    } else if (type === "minute") {
      newMinutes = value as number;
    } else if (type === "period") {
      newPeriod = value as string;
    }

    const formattedTime = formatTime(newHours, newMinutes, newPeriod);
    onTimeChange(formattedTime);
  };

  const handleNow = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    onTimeChange(formattedTime);
    setIsOpen(false);
  };

  // Format time for display (12-hour format)
  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return null;
    const { hours, minutes, period } = parseTime(timeStr);
    return `${hours}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  const hoursArray = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutesArray = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !time && "text-muted-foreground",
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          {time ? formatDisplayTime(time) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="border-b p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleNow}
          >
            Now
          </Button>
        </div>
        <div className="flex divide-x">
          {/* Hours */}
          <ScrollArea className="h-[200px]">
            <div className="flex flex-col p-2">
              {hoursArray.map((hour) => (
                <Button
                  key={hour}
                  size="sm"
                  variant={hours === hour ? "default" : "ghost"}
                  className="shrink-0 w-16"
                  onClick={() => handleTimeChange("hour", hour)}
                >
                  {hour}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>

          {/* Minutes */}
          <ScrollArea className="h-[200px]">
            <div className="flex flex-col p-2">
              {minutesArray.map((minute) => (
                <Button
                  key={minute}
                  size="sm"
                  variant={minutes === minute ? "default" : "ghost"}
                  className="shrink-0 w-16"
                  onClick={() => handleTimeChange("minute", minute)}
                >
                  {String(minute).padStart(2, '0')}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>

          {/* AM/PM */}
          <div className="flex flex-col p-2 gap-2">
            {["AM", "PM"].map((ampm) => (
              <Button
                key={ampm}
                size="sm"
                variant={period === ampm ? "default" : "ghost"}
                className="shrink-0 w-16"
                onClick={() => handleTimeChange("period", ampm)}
              >
                {ampm}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
