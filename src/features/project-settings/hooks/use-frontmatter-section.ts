import { useMutation } from "convex/react";
import yaml from "js-yaml";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FIELD_TYPE_OPTIONS,
  type FrontmatterField,
  type FrontmatterFieldType,
} from "@/types/frontmatter";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { DEFAULT_FIELDS, type ProjectData } from "../types";

function getPlaceholderForType(type: FrontmatterField["type"]): string {
  switch (type) {
    case "string":
      return '"example"';
    case "text":
      return '"A longer text..."';
    case "url":
      return '"https://example.com"';
    case "image":
      return '"/images/hero.jpg"';
    case "slug":
      return '"my-post-slug"';
    case "number":
      return "0";
    case "boolean":
      return "true";
    case "date":
      return new Date().toISOString().split("T")[0] ?? "";
    case "datetime":
      return new Date().toISOString();
    case "tags":
      return '["tag1", "tag2"]';
    case "list":
      return '["item1", "item2"]';
    case "select":
      return '"option1"';
    case "multiselect":
      return '["opt1", "opt2"]';
    case "color":
      return '"#3b82f6"';
    case "json":
      return '{"key": "value"}';
    default:
      return '""';
  }
}

export function useFrontmatterSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const updateProject = useMutation(api.cms.projects.update);

  const initialFields = useMemo(() => {
    if (project.frontmatterSchema) {
      try {
        return JSON.parse(project.frontmatterSchema) as FrontmatterField[];
      } catch {
        return DEFAULT_FIELDS;
      }
    }
    return DEFAULT_FIELDS;
  }, [project.frontmatterSchema]);

  const [fields, setFields] = useState<FrontmatterField[]>(initialFields);
  const [isSaving, setIsSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<"visual" | "code" | "yaml">(
    "visual",
  );
  const [codeValue, setCodeValue] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [yamlValue, setYamlValue] = useState("");
  const [yamlError, setYamlError] = useState<string | null>(null);

  // Track the schema we last synced with so reactive query updates (the
  // user's own save round-tripping, or a sibling tab's save) don't wipe
  // unsaved local edits. The ref holds a normalized JSON string; we accept
  // a remote change only when the local fields match the last synced value.
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    const remoteNormalized = JSON.stringify(initialFields);

    if (lastSyncedRef.current === null) {
      lastSyncedRef.current = remoteNormalized;
      return;
    }
    if (remoteNormalized === lastSyncedRef.current) return;

    const localNormalized = JSON.stringify(fieldsRef.current);
    if (localNormalized === lastSyncedRef.current) {
      setFields(initialFields);
      lastSyncedRef.current = remoteNormalized;
    }
  }, [initialFields]);

  useEffect(() => {
    if (editorMode === "code") {
      setCodeValue(JSON.stringify(fields, null, 2));
      setCodeError(null);
    }
  }, [editorMode, fields]);

  // The YAML view is a condensed `name: type` representation that mirrors
  // how a field would look in actual markdown frontmatter -- lossy (drops
  // required/default/options/etc.) but the round trip preserves those props
  // for any field whose name still exists after the YAML edit.
  useEffect(() => {
    if (editorMode === "yaml") {
      const lines = fields
        .filter((f) => f.name.trim())
        .map((f) => `${f.name}: ${f.type}`)
        .join("\n");
      setYamlValue(`---\n${lines}\n---`);
      setYamlError(null);
    }
  }, [editorMode, fields]);

  const handleCodeChange = useCallback((value: string) => {
    setCodeValue(value);
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        setCodeError("Schema must be an array of field definitions");
        return;
      }
      for (const field of parsed) {
        if (!field.name || !field.type) {
          setCodeError("Each field must have a 'name' and 'type' property");
          return;
        }
      }
      setCodeError(null);
      setFields(parsed as FrontmatterField[]);
    } catch (err) {
      setCodeError(err instanceof SyntaxError ? err.message : "Invalid JSON");
    }
  }, []);

  // Each YAML entry is `name: type`; we merge the result with the existing
  // fields so a user who only retypes the YAML view doesn't lose props
  // (required/defaultValue/options/etc.) they configured in Visual mode for
  // fields whose names are unchanged.
  const handleYamlChange = useCallback(
    (value: string) => {
      setYamlValue(value);
      const body = value
        .split("\n")
        .filter((line) => line.trim() !== "---")
        .join("\n");
      let parsed: unknown;
      try {
        parsed = yaml.load(body);
      } catch (err) {
        setYamlError(
          err instanceof yaml.YAMLException ? err.message : "Invalid YAML",
        );
        return;
      }
      if (
        parsed == null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        setYamlError("Schema must be a mapping of `name: type` pairs");
        return;
      }
      const entries = Object.entries(parsed as Record<string, unknown>);
      const invalidType = entries.find(
        ([, v]) =>
          typeof v !== "string" ||
          !FIELD_TYPE_OPTIONS.some((opt) => opt.value === v),
      );
      if (invalidType) {
        setYamlError(
          `Unknown type for "${invalidType[0]}". Valid types: ${FIELD_TYPE_OPTIONS.map((o) => o.value).join(", ")}`,
        );
        return;
      }
      const existingByName = new Map(fields.map((f) => [f.name, f]));
      const nextFields: FrontmatterField[] = entries.map(([name, type]) => {
        const existing = existingByName.get(name);
        const fieldType = type as FrontmatterFieldType;
        if (existing) return { ...existing, type: fieldType };
        return {
          name,
          type: fieldType,
          required: false,
          defaultValue: "",
          options: "",
        };
      });
      setYamlError(null);
      setFields(nextFields);
    },
    [fields],
  );

  const addField = useCallback(() => {
    setFields((prev) => [
      ...prev,
      {
        name: "",
        type: "string",
        required: false,
        defaultValue: "",
        options: "",
      },
    ]);
  }, []);

  const removeField = useCallback((index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateField = useCallback(
    (index: number, updates: Partial<FrontmatterField>) => {
      setFields((prev) =>
        prev.map((field, i) =>
          i === index ? { ...field, ...updates } : field,
        ),
      );
    },
    [],
  );

  const clearAllDefaults = useCallback(() => {
    setFields((prev) => prev.map((field) => ({ ...field, defaultValue: "" })));
    toast.info("Cleared all default values -- click Save Schema to apply");
  }, []);

  const hasAnyDefaults = useMemo(
    () => fields.some((f) => f.defaultValue !== ""),
    [fields],
  );

  const moveField = useCallback((index: number, direction: "up" | "down") => {
    setFields((prev) => {
      const newFields = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newFields.length) return prev;
      const a = newFields[index];
      const b = newFields[targetIndex];
      if (!a || !b) return prev;
      newFields[targetIndex] = a;
      newFields[index] = b;
      return newFields;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (editorMode === "code" && codeError) {
      toast.error("Fix JSON errors before saving");
      return;
    }
    if (editorMode === "yaml" && yamlError) {
      toast.error("Fix YAML errors before saving");
      return;
    }
    const invalidField = fields.find((f) => !f.name.trim());
    if (invalidField) {
      toast.error("All fields must have a name");
      return;
    }
    setIsSaving(true);
    const serialized = JSON.stringify(fields);
    try {
      await updateProject({
        projectId,
        frontmatterSchema: serialized,
      });
      lastSyncedRef.current = serialized;
      toast.success("Frontmatter schema saved");
    } catch {
      toast.error("Failed to save frontmatter schema");
    } finally {
      setIsSaving(false);
    }
  }, [fields, projectId, updateProject, editorMode, codeError, yamlError]);

  const yamlPreview = useMemo(() => {
    const lines = fields
      .filter((f) => f.name.trim())
      .map((f) => {
        const val = f.defaultValue || getPlaceholderForType(f.type);
        return `${f.name}: ${val}`;
      });
    return `---\n${lines.join("\n")}\n---`;
  }, [fields]);

  return {
    fields,
    isSaving,
    editorMode,
    setEditorMode,
    codeValue,
    codeError,
    yamlValue,
    yamlError,
    hasAnyDefaults,
    yamlPreview,
    handleCodeChange,
    handleYamlChange,
    addField,
    removeField,
    updateField,
    clearAllDefaults,
    moveField,
    handleSave,
  };
}
