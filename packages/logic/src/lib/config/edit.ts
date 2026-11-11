import {
  parse as parseToml,
  patch as patchToml,
} from "@decimalturn/toml-patch";
import type { ConfigFormat } from "@wryte/backend/_lib/configFiles";
import {
  applyEdits,
  type FormattingOptions,
  modify,
  parse as parseJson,
} from "jsonc-parser";
import { isMap, isSeq, parseDocument } from "yaml";
import { type ConfigPath, type EditableValue, isPlainObject } from "./value";

export type ConfigEdit =
  | { kind: "set"; path: ConfigPath; value: EditableValue }
  | { kind: "insert"; path: ConfigPath; index: number; value: EditableValue }
  | { kind: "remove"; path: ConfigPath }
  | { kind: "move"; path: ConfigPath; from: number; to: number };

function childOf(container: unknown, key: string | number): unknown {
  if (Array.isArray(container) && typeof key === "number") {
    return container[key];
  }
  if (isPlainObject(container) && typeof key === "string") {
    return container[key];
  }
  throw new Error("Config path does not exist");
}

function valueAt(root: unknown, path: ConfigPath): unknown {
  return path.reduce(childOf, root);
}

function arrayAt(root: unknown, path: ConfigPath): unknown[] {
  const target = valueAt(root, path);
  if (!Array.isArray(target)) throw new Error("Config path is not a list");
  return target;
}

function splitPath(path: ConfigPath): {
  parent: ConfigPath;
  key: string | number;
} {
  const key = path[path.length - 1];
  if (key === undefined) throw new Error("The document root cannot be edited");
  return { parent: path.slice(0, -1), key };
}

function applyToValue(root: unknown, edit: ConfigEdit): void {
  if (edit.kind === "insert") {
    arrayAt(root, edit.path).splice(edit.index, 0, edit.value);
    return;
  }
  if (edit.kind === "move") {
    const list = arrayAt(root, edit.path);
    list.splice(edit.to, 0, ...list.splice(edit.from, 1));
    return;
  }
  const { parent, key } = splitPath(edit.path);
  const container = valueAt(root, parent);
  if (Array.isArray(container) && typeof key === "number") {
    if (edit.kind === "set") container[key] = edit.value;
    else container.splice(key, 1);
    return;
  }
  if (isPlainObject(container) && typeof key === "string") {
    if (edit.kind === "set") container[key] = edit.value;
    else delete container[key];
    return;
  }
  throw new Error("Config path does not exist");
}

function jsonFormatting(text: string): FormattingOptions {
  const indent = /^([ \t]+)\S/m.exec(text)?.[1] ?? "  ";
  return {
    insertSpaces: !indent.startsWith("\t"),
    tabSize: indent.startsWith("\t") ? 1 : indent.length,
    eol: text.includes("\r\n") ? "\r\n" : "\n",
  };
}

function editJson(text: string, edit: ConfigEdit): string {
  const formattingOptions = jsonFormatting(text);
  const change = (
    source: string,
    path: ConfigPath,
    value: unknown,
    isArrayInsertion = false,
  ) =>
    applyEdits(
      source,
      modify(source, [...path], value, { formattingOptions, isArrayInsertion }),
    );

  if (edit.kind === "set") return change(text, edit.path, edit.value);
  if (edit.kind === "remove") return change(text, edit.path, undefined);
  if (edit.kind === "insert") {
    return change(text, [...edit.path, edit.index], edit.value, true);
  }
  const moved: unknown = arrayAt(parseJson(text), edit.path)[edit.from];
  const without = change(text, [...edit.path, edit.from], undefined);
  return change(without, [...edit.path, edit.to], moved, true);
}

function editYaml(text: string, edit: ConfigEdit): string {
  const document = parseDocument(text);
  if (edit.kind === "set") {
    document.setIn(edit.path, edit.value);
  } else if (edit.kind === "remove") {
    document.deleteIn(edit.path);
  } else {
    const list: unknown = document.getIn(edit.path, true);
    if (!isSeq(list)) throw new Error("Config path is not a list");
    if (edit.kind === "insert") {
      list.items.splice(edit.index, 0, document.createNode(edit.value));
    } else {
      list.items.splice(edit.to, 0, ...list.items.splice(edit.from, 1));
    }
  }
  if (!isMap(document.contents) && !isSeq(document.contents)) {
    throw new Error("The document root cannot be edited");
  }
  return document.toString({ lineWidth: 0 });
}

function editToml(text: string, edit: ConfigEdit): string {
  const root: unknown = parseToml(text);
  applyToValue(root, edit);
  return patchToml(text, root);
}

export function applyConfigEdit(
  text: string,
  format: ConfigFormat,
  edit: ConfigEdit,
): string {
  if (format === "json") return editJson(text, edit);
  if (format === "yaml") return editYaml(text, edit);
  return editToml(text, edit);
}
