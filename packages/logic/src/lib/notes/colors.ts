import type { BoardColumn } from "@wryte/backend/cms/notes/_lib/model";

export type ColumnTone = {
  icon: string;
  tint: string;
  over: string;
};

export const COLUMN_TONES: Record<BoardColumn, ColumnTone> = {
  notes: {
    icon: "text-muted-foreground",
    tint: "bg-white/[0.02]",
    over: "bg-white/[0.045]",
  },
  todo: {
    icon: "text-blue-400",
    tint: "bg-blue-500/[0.04]",
    over: "bg-blue-500/[0.08]",
  },
  doing: {
    icon: "text-amber-400",
    tint: "bg-amber-500/[0.05]",
    over: "bg-amber-500/[0.09]",
  },
  done: {
    icon: "text-emerald-400",
    tint: "bg-emerald-500/[0.04]",
    over: "bg-emerald-500/[0.08]",
  },
};

export const DUE_TONES = {
  overdue: "text-red-400",
  today: "text-amber-400",
  later: "text-muted-foreground",
} as const;

export type DueTone = keyof typeof DUE_TONES;
