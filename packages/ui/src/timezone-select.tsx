"use client";

import {
  getBrowserTimezone,
  getTimezoneCityLabel,
  getTimezoneOffsetLabel,
  listTimezones,
} from "@wryte/logic/lib/timezone";
import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import { Input } from "@wryte/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@wryte/ui/popover";
import { Check, ChevronsUpDown, Globe2, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type TimezoneSelectProps = {
  value: string | null | undefined;
  onChange: (value: string) => void;
  /** Placeholder shown when no value is set. Defaults to browser TZ hint. */
  placeholder?: string;
  /** Disable the picker (e.g. while saving). */
  disabled?: boolean;
  id?: string;
};

type TimezoneOption = {
  id: string;
  city: string;
  offset: string;
  /** Pre-lowercased searchable haystack to keep filtering cheap. */
  searchHaystack: string;
};

/**
 * Searchable timezone picker. Lists all IANA zones reported by the runtime
 * (`Intl.supportedValuesOf("timeZone")` — typically ~400 entries) so the
 * user can find their zone by city name or UTC offset.
 */
export function TimezoneSelect({
  value,
  onChange,
  placeholder,
  disabled,
  id,
}: TimezoneSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const browserTz = useMemo(() => getBrowserTimezone(), []);
  const effective = value && value.length > 0 ? value : null;

  const options = useMemo<TimezoneOption[]>(() => {
    return listTimezones().map((id) => {
      const city = getTimezoneCityLabel(id);
      const offset = getTimezoneOffsetLabel(id);
      return {
        id,
        city,
        offset,
        searchHaystack: `${id} ${city} ${offset}`.toLowerCase(),
      };
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.searchHaystack.includes(q));
  }, [options, query]);

  // Reset and focus the search when the popover opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    return;
  }, [open]);

  const triggerLabel = effective
    ? `${getTimezoneCityLabel(effective)} · ${getTimezoneOffsetLabel(effective)}`
    : (placeholder ??
      `Browser default · ${getTimezoneCityLabel(browserTz)} (${getTimezoneOffsetLabel(browserTz)})`);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className="w-full justify-between font-normal"
          />
        }
      >
        <span className="flex items-center gap-2 truncate text-left">
          <Globe2 className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{triggerLabel}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[min(360px,calc(100vw-2rem))] p-0"
      >
        <div className="border-b border-border/50 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city or offset…"
              className="h-8 pl-7"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No matching timezone
            </p>
          ) : (
            filtered.map((opt) => {
              const isSelected = opt.id === effective;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-muted",
                    isSelected && "bg-muted/60",
                  )}
                >
                  <Check
                    className={cn(
                      "size-3.5 shrink-0",
                      isSelected ? "text-primary" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 truncate">{opt.city}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {opt.offset}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
