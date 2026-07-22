# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# convex
- For local Convex development, schema changes are auto-deployed via `bun run dev`, not `convex deploy`. Run `bun generate` to regenerate types. Confidence: 0.65
- Optimize Convex queries for scale — avoid pulling full collections (e.g., all 50k animations) just to check existence. Use separate indexed collections or dedicated queries for lookups. Confidence: 0.75
- When restructuring data for performance (e.g., adding indexes), create a one-time migration that preserves old data, runs on deploy via an admin panel trigger, and allows removal of legacy code afterward. Confidence: 0.80

# git
- Do not add co-author names (e.g., @assistant) when committing — use a clean single-author commit. Confidence: 0.75

# ui-ux
- Don't add inner scroll containers (e.g. `overflow-y-auto` with fixed max-height) on content areas when there's empty space below in the parent — let the parent handle overflow naturally and only scroll when content reaches the bottom of the viewport. Confidence: 0.70

