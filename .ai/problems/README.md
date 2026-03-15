# Problem Documentation

This directory tracks bugs, issues, and their investigations.

## Purpose

- Preserve investigation history for future AI assistants
- Avoid re-investigating the same issues
- Document solutions and workarounds
- Track patterns that might indicate deeper problems

## File Naming

Use descriptive kebab-case names:
- `lockdown-chain-bug.md`
- `websocket-reconnect-issue.md`
- `hex-coordinate-overflow.md`

## Template for Problem Files

```markdown
# Problem: [Brief Description]

**Status**: [investigating | identified | fixed | wontfix]
**Priority**: [critical | high | medium | low]
**Created**: YYYY-MM-DD
**Last Updated**: YYYY-MM-DD

## Description

[Clear description of the problem - what's happening vs. what should happen]

## Reproduction

1. Step 1
2. Step 2
3. ...

## Expected Behavior

[What should happen]

## Actual Behavior

[What actually happens]

## Investigation

### Tried

| Date | Approach | Result |
|------|----------|--------|
| YYYY-MM-DD | [What was tried] | [Outcome] |
| YYYY-MM-DD | [What was tried] | [Outcome] |

### Working Hypotheses

1. [Hypothesis 1]
2. [Hypothesis 2]

### Root Cause

[Once identified, document the root cause here]

## Solution

[Document the fix once found]

### Code Changes

- File 1: [What changed]
- File 2: [What changed]

### Testing

[How to verify the fix works]

## Lessons Learned

[What patterns or practices could prevent similar issues]

## Related Files

- `/path/to/relevant/file1.ts`
- `/path/to/relevant/file2.ts`
```

## Status Definitions

| Status | Meaning |
|--------|---------|
| investigating | Currently being looked into |
| identified | Root cause found, not yet fixed |
| fixed | Solution implemented and tested |
| wontfix | Decided not to fix (document reason) |

## Priority Definitions

| Priority | Meaning | Response Time |
|----------|---------|---------------|
| critical | Game-breaking, data loss | Immediate |
| high | Major feature broken | Within day |
| medium | Degraded experience | Within week |
| low | Minor annoyance | Backlog |

## Best Practices

1. **Update frequently**: Add notes as you investigate
2. **Be specific**: Include file paths, line numbers, error messages
3. **Document failures**: What didn't work is as valuable as what did
4. **Link commits**: Reference git commits that relate to the fix
5. **Add tests**: Document any tests added to prevent regression
