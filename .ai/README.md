# BoardBots AI Assistant Documentation

This directory contains structured documentation to help AI assistants understand the BoardBots codebase and track ongoing investigations.

## Directory Structure

```
.ai/
├── README.md              # This file - overview of the .ai directory
├── context/               # Project context and architecture docs
│   ├── architecture.md    # High-level system architecture
│   ├── game-flow.md       # How the game works
│   └── auth-flow.md       # Authentication and user management
├── problems/              # Bug tracking and investigations
│   ├── README.md          # How to document problems
│   └── *.md               # Individual problem files
├── research/              # Research findings and experiments
│   └── README.md          # Research documentation guidelines
└── changelogs/            # Change tracking
    └── README.md          # Change documentation guidelines
```

## Purpose

1. **Context Preservation**: Store architectural knowledge that's expensive to re-learn
2. **Problem Tracking**: Document bugs, their investigation history, and solutions
3. **Research**: Keep notes on experiments, benchmarks, and findings
4. **Change History**: Track significant changes and their rationale

## Usage Guidelines

### For AI Assistants

1. **Before starting work**: Read `context/architecture.md` and relevant domain docs
2. **When investigating bugs**: Create a file in `problems/` using the template
3. **After solving problems**: Update the problem file with the solution
4. **When making significant changes**: Document in `changelogs/`

### File Naming Conventions

- **Problems**: `descriptive-name.md` (e.g., `lockdown-chain-bug.md`)
- **Research**: `topic-name.md` (e.g., `ai-performance-benchmark.md`)
- **Changelogs**: `YYYY-MM-DD-brief-description.md`

## Key Files to Know

| File | Purpose |
|------|---------|
| `/AGENTS.md` | Main project context (root level) |
| `/packages/engine/AGENTS.md` | Engine-specific patterns and gotchas |
| `/packages/client/AGENTS.md` | Client-specific patterns and gotchas |
| `/packages/server/AGENTS.md` | Server-specific patterns and gotchas |

## Quick Links

- [Architecture Overview](./context/architecture.md)
- [Game Flow](./context/game-flow.md)
- [Authentication Flow](./context/auth-flow.md)
- [Problem Tracking](./problems/README.md)
