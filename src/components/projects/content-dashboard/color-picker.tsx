"use client";

import { Check } from "lucide-react";
import type { BoardColor } from "@/lib/board-colors";
import { BOARD_COLORS, COLOR_MAP } from "@/lib/board-colors";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: BoardColor;
  onChange: (color: BoardColor) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-2 p-1">
      {BOARD_COLORS.map((color) => {
        const isSelected = value === color;
        return (
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={isSelected}
            onClick={() => onChange(color)}
            className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center transition-shadow",
              COLOR_MAP[color].dot,
              isSelected && cn("ring-2 ring-offset-2", COLOR_MAP[color].ring),
            )}
          >
            {isSelected && (
              <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
            )}
          </button>
        );
      })}
    </div>
  );
}
