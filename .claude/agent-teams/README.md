# Claude Code Agent Teams Configuration

> **Status**: EXPERIMENTAL (Beta Feature)
> **Last Updated**: 2026-03-14
> **Documentation**: https://code.claude.com/docs/en/agent-teams

This directory contains modular configuration for Claude Code's Agent Teams feature. When this feature changes or comes out of beta, this directory can be easily updated or removed.

## What Are Agent Teams?

Agent teams let you coordinate multiple Claude Code instances working together:
- **Team Lead**: Main session that creates the team, spawns teammates, and coordinates work
- **Teammates**: Separate Claude Code instances that each work on assigned tasks
- **Shared Task List**: Work items that teammates claim and complete
- **Direct Messaging**: Teammates can communicate with each other

### When to Use Agent Teams

Best use cases:
- **Research and review**: Multiple teammates investigate different aspects simultaneously
- **New modules or features**: Teammates own separate pieces without stepping on each other
- **Debugging with competing hypotheses**: Test different theories in parallel
- **Cross-layer coordination**: Changes spanning frontend, backend, and tests

When NOT to use:
- Sequential tasks with dependencies
- Same-file edits by multiple agents
- Routine tasks that don't benefit from parallel work

## Enabling Agent Teams

Agent teams are **disabled by default**. Enable them in your shell:

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

Or in `.claude/settings.local.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

## Display Modes

| Mode | Description | Requirements |
|------|-------------|--------------|
| `auto` | Uses split panes if in tmux, otherwise in-process | Default |
| `in-process` | All teammates in main terminal, use Shift+Down to cycle | Any terminal |
| `tmux` | Each teammate gets its own pane | tmux or iTerm2 with `it2` CLI |

Set in `settings.local.json`:

```json
{
  "teammateMode": "auto"
}
```

## Usage

Once enabled, ask Claude to create a team:

```
Create an agent team to [task description].
Spawn [N] teammates to [specific roles].
```

### Example Prompts

```
Create an agent team to review the authentication module.
Spawn 3 reviewers: one focused on security, one on performance,
one on test coverage.
```

```
Create a team with 4 teammates to refactor these modules in parallel.
Use Sonnet for each teammate.
```

## BoardBots-Specific Team Roles

See `team-roles.md` for predefined teammate roles optimized for this project:

- **Engine Developer**: Pure game logic (hex grid, moves, beam resolution)
- **Client Developer**: Vite SPA (canvas renderer, UI, WebSocket)
- **Server Developer**: Node.js/Express (game rooms, WebSocket, SQLite)
- **E2E Tester**: Playwright integration tests
- **Security Reviewer**: Auth flows, input validation, API security

## Important Limitations

Current limitations (as of beta):
- No session resumption with in-process teammates
- Task status can lag
- One team per session
- No nested teams
- Lead is fixed (cannot transfer leadership)
- Split panes require tmux or iTerm2

## Cleanup

When the feature comes out of beta or needs updating:

1. Update this directory with new configuration
2. Remove the `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env variable if no longer needed
3. Delete this directory if the feature is removed entirely
