"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface TimePickerProps {
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
}

export function TimePicker({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
}: TimePickerProps) {
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const isPM = hour >= 12;

  const toggleAmPm = () => {
    if (isPM) {
      onHourChange(hour - 12);
    } else {
      onHourChange(hour + 12);
    }
  };

  const incrementHour = () => {
    onHourChange((hour + 1) % 24);
  };

  const decrementHour = () => {
    onHourChange((hour - 1 + 24) % 24);
  };

  const incrementMinute = () => {
    onMinuteChange((minute + 1) % 60);
  };

  const decrementMinute = () => {
    onMinuteChange((minute - 1 + 60) % 60);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Hour */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={incrementHour}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-3.5 rotate-90" />
        </button>
        <div className="flex h-10 w-12 items-center justify-center rounded-lg bg-muted/60 text-lg font-semibold tabular-nums">
          {String(displayHour).padStart(2, "0")}
        </div>
        <button
          type="button"
          onClick={decrementHour}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-3.5 rotate-90" />
        </button>
      </div>

      <span className="text-lg font-semibold text-muted-foreground/50">:</span>

      {/* Minute */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={incrementMinute}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-3.5 rotate-90" />
        </button>
        <div className="flex h-10 w-12 items-center justify-center rounded-lg bg-muted/60 text-lg font-semibold tabular-nums">
          {String(minute).padStart(2, "0")}
        </div>
        <button
          type="button"
          onClick={decrementMinute}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-3.5 rotate-90" />
        </button>
      </div>

      {/* AM/PM */}
      <button
        type="button"
        onClick={toggleAmPm}
        className="ml-1 flex h-10 w-12 items-center justify-center rounded-lg bg-muted/60 text-sm font-semibold transition-colors hover:bg-muted"
      >
        {isPM ? "PM" : "AM"}
      </button>
    </div>
  );
}
