# Changelogs

This directory tracks significant changes to the BoardBots codebase.

## Purpose

- Document architectural decisions
- Track major refactors
- Record breaking changes
- Provide context for future maintainers

## What to Document Here

- Breaking API changes
- Major refactors
- Architecture decisions
- Database schema changes
- Deployment changes
- Significant dependency updates

## What NOT to Document Here

- Routine bug fixes (use problems/ instead)
- Minor refactors
- Comment changes
- Test additions

## File Naming

Use date-prefixed names:
- `2026-03-14-add-authentication-system.md`
- `2026-03-10-migrate-to-vite-7.md`
- `2026-02-20-add-ai-opponent.md`

## Template

```markdown
# Change: [Brief Description]

**Date**: YYYY-MM-DD
**Type**: [feature | refactor | breaking | fix | deps]

## Summary

[1-2 sentence summary of the change]

## Motivation

[Why was this change made?]

## Changes

### Files Modified

- `path/to/file1.ts`: [What changed]
- `path/to/file2.ts`: [What changed]

### New Files

- `path/to/new/file.ts`: [Purpose]

### Removed Files

- `path/to/removed/file.ts`: [Why removed]

## Breaking Changes

[If any, document migration steps]

## Migration Guide

[How to adapt existing code to this change]

## Testing

[How was this change tested?]

## Related

- Issue: #[number] (if applicable)
- PR: #[number] (if applicable)
- Problem doc: [link to problem file if bug fix]
```

## Change Types

| Type | Description |
|------|-------------|
| feature | New functionality |
| refactor | Code restructuring without behavior change |
| breaking | Breaking API or behavior change |
| fix | Bug fix |
| deps | Dependency update |

## Recent Changes

| Date | Type | Description |
|------|------|-------------|
| 2026-03-14 | docs | Added .ai documentation structure |
| ... | ... | ... |

## Guidelines

1. **Write for the future**: Assume the reader doesn't have current context
2. **Include code examples**: Show before/after for breaking changes
3. **Link to docs**: Reference updated documentation
4. **Be specific**: Include file paths and function names
5. **Document decisions**: Why was this approach chosen over alternatives?
