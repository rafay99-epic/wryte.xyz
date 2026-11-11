"use client";

import type { ConfigEdit } from "@wryte/logic/lib/config/edit";
import {
  blankLike,
  type ConfigObject,
  type ConfigPath,
  type ConfigValue,
  inlineColumns,
  isConfigObject,
  isHexColor,
  itemLabel,
  itemSummary,
  OpaqueValue,
} from "@wryte/logic/lib/config/value";
import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import { Input } from "@wryte/ui/input";
import { Switch } from "@wryte/ui/switch";
import { Textarea } from "@wryte/ui/textarea";
import { ArrowDown, ArrowUp, ChevronRight, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";

type OnEdit = (edit: ConfigEdit) => void;

type NodeProps<Value> = {
  path: ConfigPath;
  value: Value;
  onEdit: OnEdit;
};

const DECIMAL_NUMBER = /^-?(?:\d+\.?\d*|\.\d+)$/;
const FIELD = "h-7 px-2 text-xs md:text-xs";

function fieldId(path: ConfigPath): string {
  return `config-${path.map((key) => encodeURIComponent(key)).join("/")}`;
}

function isNested(value: ConfigValue): value is ConfigValue[] | ConfigObject {
  return Array.isArray(value) || isConfigObject(value);
}

export function ConfigForm({
  value,
  onEdit,
}: {
  value: ConfigValue;
  onEdit: OnEdit;
}) {
  if (Array.isArray(value)) {
    return <ListSection name="items" path={[]} value={value} onEdit={onEdit} />;
  }
  if (!isConfigObject(value)) {
    return (
      <p className="p-4 text-xs text-muted-foreground">
        This file holds a single value. Edit it in the source.
      </p>
    );
  }
  const entries = Object.entries(value);
  const general = entries.filter(([, child]) => !isNested(child));
  return (
    <div>
      {general.length > 0 && (
        <Section title="General">
          <div className="space-y-1.5">
            {general.map(([key, child]) => (
              <FieldRow
                key={key}
                name={key}
                path={[key]}
                value={child}
                onEdit={onEdit}
              />
            ))}
          </div>
        </Section>
      )}
      {entries.map(([key, child]) => {
        if (Array.isArray(child)) {
          return (
            <ListSection
              key={key}
              name={key}
              path={[key]}
              value={child}
              onEdit={onEdit}
            />
          );
        }
        if (isConfigObject(child)) {
          return (
            <Section key={key} title={key}>
              <ObjectFields path={[key]} value={child} onEdit={onEdit} />
            </Section>
          );
        }
        return null;
      })}
    </div>
  );
}

function Section({
  title,
  count,
  action,
  nested = false,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  nested?: boolean;
  children: ReactNode;
}) {
  return (
    <section>
      <div
        className={cn(
          "flex h-8 items-center gap-2",
          nested
            ? "pt-1"
            : "sticky top-0 z-10 border-b border-border bg-background px-3",
        )}
      >
        <h3 className="font-mono text-xs font-medium">{title}</h3>
        {count !== undefined && (
          <span className="font-mono text-xs text-muted-foreground">
            {count}
          </span>
        )}
        <div className="ml-auto">{action}</div>
      </div>
      <div className={nested ? "border-l border-border pl-3" : "px-3 py-2"}>
        {children}
      </div>
    </section>
  );
}

function ObjectFields({ path, value, onEdit }: NodeProps<ConfigObject>) {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">Empty object</p>;
  }
  return (
    <div className="space-y-1.5">
      {entries.map(([key, child]) => {
        const childPath = [...path, key];
        if (Array.isArray(child)) {
          return (
            <ListSection
              key={key}
              name={key}
              path={childPath}
              value={child}
              onEdit={onEdit}
              nested
            />
          );
        }
        if (isConfigObject(child)) {
          return (
            <Section key={key} title={key} nested>
              <ObjectFields path={childPath} value={child} onEdit={onEdit} />
            </Section>
          );
        }
        return (
          <FieldRow
            key={key}
            name={key}
            path={childPath}
            value={child}
            onEdit={onEdit}
          />
        );
      })}
    </div>
  );
}

function FieldRow({
  name,
  path,
  value,
  onEdit,
}: NodeProps<ConfigValue> & { name: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-start gap-3">
      <label
        htmlFor={fieldId(path)}
        className="truncate pt-1.5 font-mono text-[11px] text-muted-foreground"
        title={name}
      >
        {name}
      </label>
      <ScalarControl path={path} value={value} onEdit={onEdit} />
    </div>
  );
}

function ScalarControl({
  path,
  value,
  onEdit,
  label,
}: NodeProps<ConfigValue> & { label?: string }) {
  const id = fieldId(path);
  if (typeof value === "string") {
    return (
      <StringControl
        id={id}
        label={label}
        value={value}
        onChange={(next) => onEdit({ kind: "set", path, value: next })}
      />
    );
  }
  if (typeof value === "number") {
    return (
      <NumberControl
        id={id}
        label={label}
        value={value}
        onChange={(next) => onEdit({ kind: "set", path, value: next })}
      />
    );
  }
  if (typeof value === "boolean") {
    return (
      <div className="flex h-7 items-center">
        <Switch
          id={id}
          size="sm"
          aria-label={label}
          checked={value}
          onCheckedChange={(next) => onEdit({ kind: "set", path, value: next })}
        />
      </div>
    );
  }
  return (
    <p
      id={id}
      className="flex h-7 items-center gap-2 truncate font-mono text-[11px] text-muted-foreground"
      title="Edit this value in the source"
    >
      {value instanceof OpaqueValue ? value.text : "null"}
    </p>
  );
}

function StringControl({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string | undefined;
  value: string;
  onChange: (value: string) => void;
}) {
  const [multiline] = useState(() => value.includes("\n") || value.length > 80);
  if (multiline || value.includes("\n")) {
    return (
      <Textarea
        id={id}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-7 px-2 py-1 text-xs md:text-xs"
      />
    );
  }
  return (
    <div className="relative min-w-0">
      {isHexColor(value) && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 border border-border"
          style={{ backgroundColor: value }}
        />
      )}
      <Input
        id={id}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(FIELD, isHexColor(value) && "pl-7 font-mono")}
      />
    </div>
  );
}

function NumberControl({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string | undefined;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      id={id}
      aria-label={label}
      inputMode="decimal"
      value={draft ?? String(value)}
      onFocus={() => setDraft(String(value))}
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (DECIMAL_NUMBER.test(next)) onChange(Number(next));
      }}
      className={cn(FIELD, "max-w-32 font-mono")}
    />
  );
}

function ListSection({
  name,
  path,
  value,
  onEdit,
  nested = false,
}: NodeProps<ConfigValue[]> & { name: string; nested?: boolean }) {
  const last = value[value.length - 1];
  const columns = inlineColumns(value);
  const [openItems, setOpenItems] = useState(() => value.map(() => false));
  const reshape = (change: (items: boolean[]) => void) =>
    setOpenItems((current) => {
      const next = value.map((_, index) => current[index] ?? false);
      change(next);
      return next;
    });

  const rowActions = (index: number) => (
    <ItemActions
      index={index}
      count={value.length}
      onMove={(to) => {
        reshape((items) => items.splice(to, 0, ...items.splice(index, 1)));
        onEdit({ kind: "move", path, from: index, to });
      }}
      onRemove={() => {
        reshape((items) => items.splice(index, 1));
        onEdit({ kind: "remove", path: [...path, index] });
      }}
    />
  );

  return (
    <Section
      title={name}
      count={value.length}
      nested={nested}
      action={
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            reshape((items) => items.push(columns === null));
            onEdit({
              kind: "insert",
              path,
              index: value.length,
              value: last === undefined ? "" : blankLike(last),
            });
          }}
        >
          <Plus />
          Add
        </Button>
      }
    >
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">Empty list</p>
      )}
      {columns !== null && (
        <InlineRows
          path={path}
          value={value}
          onEdit={onEdit}
          columns={columns}
          rowActions={rowActions}
        />
      )}
      {columns === null && (
        <div className="space-y-1">
          {value.map((item, index) => {
            const itemPath = [...path, index];
            if (!isNested(item)) {
              return (
                <Row key={fieldId(itemPath)} index={index}>
                  <div className="min-w-0 flex-1">
                    <ScalarControl
                      path={itemPath}
                      value={item}
                      onEdit={onEdit}
                      label={`${name} ${String(index + 1)}`}
                    />
                  </div>
                  {rowActions(index)}
                </Row>
              );
            }
            return (
              <ExpandableItem
                key={fieldId(itemPath)}
                path={itemPath}
                value={item}
                onEdit={onEdit}
                index={index}
                open={openItems[index] ?? false}
                onOpenChange={(open) =>
                  reshape((items) => {
                    items[index] = open;
                  })
                }
                actions={rowActions(index)}
              />
            );
          })}
        </div>
      )}
    </Section>
  );
}

function Row({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div className="group/row flex items-start gap-2">
      <span className="w-4 shrink-0 pt-1.5 text-right font-mono text-[11px] text-muted-foreground/60">
        {index + 1}
      </span>
      {children}
    </div>
  );
}

function InlineRows({
  path,
  value,
  onEdit,
  columns,
  rowActions,
}: NodeProps<ConfigValue[]> & {
  columns: string[];
  rowActions: (index: number) => ReactNode;
}) {
  const template = {
    gridTemplateColumns: `repeat(${String(columns.length)}, minmax(0, 1fr))`,
  };
  return (
    <div className="space-y-1">
      <div className="flex gap-2 pl-6 pr-20">
        <div className="grid min-w-0 flex-1 gap-1.5" style={template}>
          {columns.map((column) => (
            <span
              key={column}
              className="truncate font-mono text-[11px] text-muted-foreground"
            >
              {column}
            </span>
          ))}
        </div>
      </div>
      {value.map((item, index) => {
        const itemPath = [...path, index];
        const cells = isConfigObject(item) ? item : {};
        return (
          <Row key={fieldId(itemPath)} index={index}>
            <div className="grid min-w-0 flex-1 gap-1.5" style={template}>
              {columns.map((column) => {
                const cell = cells[column];
                return cell === undefined ? (
                  <span key={column} />
                ) : (
                  <ScalarControl
                    key={column}
                    path={[...itemPath, column]}
                    value={cell}
                    onEdit={onEdit}
                    label={`${column} ${String(index + 1)}`}
                  />
                );
              })}
            </div>
            {rowActions(index)}
          </Row>
        );
      })}
    </div>
  );
}

function ExpandableItem({
  path,
  value,
  onEdit,
  index,
  open,
  onOpenChange,
  actions,
}: NodeProps<ConfigValue[] | ConfigObject> & {
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: ReactNode;
}) {
  return (
    <div className={cn(open && "bg-muted/30")}>
      <div className="group/row flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
          className="flex h-7 min-w-0 flex-1 items-center gap-2 text-left text-xs"
        >
          <span className="w-4 shrink-0 text-right font-mono text-[11px] text-muted-foreground/60">
            {index + 1}
          </span>
          <ChevronRight
            className={cn(
              "size-3 shrink-0 text-muted-foreground",
              open && "rotate-90",
            )}
          />
          <span className="shrink-0 truncate">{itemLabel(value, index)}</span>
          {!open && (
            <span className="min-w-0 truncate text-muted-foreground">
              {itemSummary(value)}
            </span>
          )}
        </button>
        {actions}
      </div>
      {open && (
        <div className="pb-2 pl-11 pr-2 pt-1">
          {Array.isArray(value) ? (
            <ListSection
              name="items"
              path={path}
              value={value}
              onEdit={onEdit}
              nested
            />
          ) : (
            <ObjectFields path={path} value={value} onEdit={onEdit} />
          )}
        </div>
      )}
    </div>
  );
}

function ItemActions({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex h-7 shrink-0 items-center opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100">
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Move up"
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Move down"
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
      >
        <ArrowDown />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Remove"
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
