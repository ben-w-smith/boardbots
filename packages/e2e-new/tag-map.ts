/**
 * Tag Map for AI Test Discovery
 *
 * Maps file paths to feature area tags. Used by the BUILD stage
 * to determine which Playwright tests to run based on changed files.
 */

/**
 * Maps file path patterns to feature area tags.
 * Patterns are checked using string.includes().
 */
export const FEATURE_TAG_MAP: Record<string, string[]> = {
  // Auth
  "packages/server/src/auth/": ["@auth"],
  "packages/client/src/auth/": ["@auth"],
  "packages/client/src/login-page": ["@auth"],
  "packages/client/src/register-page": ["@auth"],

  // Lobby
  "packages/server/src/lobby/": ["@lobby"],
  "packages/server/src/game-room": ["@lobby", "@multiplayer"],
  "packages/client/src/lobby/": ["@lobby"],

  // Gameplay (Engine)
  "packages/engine/src/game": ["@gameplay"],
  "packages/engine/src/robot": ["@gameplay"],
  "packages/engine/src/beam": ["@gameplay"],
  "packages/engine/src/resolution": ["@gameplay"],
  "packages/engine/src/hex": ["@gameplay"],
  "packages/engine/src/diag": ["@gameplay"],

  // Gameplay (Client)
  "packages/client/src/gameui": ["@gameplay"],
  "packages/client/src/input": ["@gameplay"],
  "packages/client/src/animator": ["@gameplay", "@visual"],
  "packages/client/src/main.ts": ["@gameplay"],

  // Multiplayer
  "packages/server/src/websocket": ["@multiplayer"],
  "packages/client/src/websocket": ["@multiplayer"],

  // AI
  "packages/engine/src/ai": ["@ai"],

  // Visual/Rendering
  "packages/client/src/renderer": ["@visual"],
};

/**
 * Tier tags in order of priority.
 * - @critical: Mission-critical flows that MUST work
 * - @smoke: Basic functionality sanity check
 * - @regression: Comprehensive edge case coverage
 */
export const TIER_TAGS = ["@critical", "@smoke", "@regression"] as const;
export type TierTag = (typeof TIER_TAGS)[number];

/**
 * Feature area tags.
 */
export const FEATURE_TAGS = [
  "@auth",
  "@lobby",
  "@gameplay",
  "@multiplayer",
  "@ai",
  "@visual",
] as const;
export type FeatureTag = (typeof FEATURE_TAGS)[number];

/**
 * Determines which feature tags apply to a list of changed files.
 */
export function getFeatureTags(changedFiles: string[]): string[] {
  const tags = new Set<string>();

  for (const file of changedFiles) {
    for (const [pattern, featureTags] of Object.entries(FEATURE_TAG_MAP)) {
      if (file.includes(pattern)) {
        featureTags.forEach((t) => tags.add(t));
      }
    }
  }

  return Array.from(tags);
}

/**
 * Generates the grep pattern for running relevant tests.
 *
 * @param featureTags - Feature areas affected by changes
 * @param includeRegression - Whether to include regression tests (default: false for BUILD stage)
 * @returns Grep pattern string for --grep flag
 */
export function getTestGrepPattern(
  featureTags: string[],
  includeRegression = false,
): string {
  const tiers = includeRegression
    ? ["@critical", "@smoke", "@regression"]
    : ["@critical", "@smoke"];

  // If no specific feature tags, run all tests in the tier
  if (featureTags.length === 0) {
    return tiers.join("|");
  }

  // Run tier tests for affected feature areas
  // Pattern: (@critical|@smoke).*(@feature1|@feature2)
  const tierPattern = tiers.join("|");
  const featurePattern = featureTags.join("|");

  return `(${tierPattern}).*(${featurePattern})`;
}

/**
 * Generates the full test command for running relevant tests.
 *
 * @param changedFiles - List of files that were modified
 * @param includeRegression - Whether to include regression tests
 * @returns Object with command and description
 */
export function getTestCommand(
  changedFiles: string[],
  includeRegression = false,
): { command: string; grepPattern: string; featureTags: string[] } {
  const featureTags = getFeatureTags(changedFiles);
  const grepPattern = getTestGrepPattern(featureTags, includeRegression);

  const command = `npx playwright test --grep "${grepPattern}"`;

  return { command, grepPattern, featureTags };
}

/**
 * Example usage for BUILD stage:
 *
 * ```typescript
 * const changedFiles = [
 *   'packages/engine/src/game/state.ts',
 *   'packages/client/src/gameui.ts',
 * ];
 *
 * const { command, grepPattern, featureTags } = getTestCommand(changedFiles);
 *
 * console.log('Feature areas affected:', featureTags);
 * // Output: ['@gameplay']
 *
 * console.log('Grep pattern:', grepPattern);
 * // Output: '(@critical|@smoke).*(@gameplay)'
 *
 * console.log('Run command:', command);
 * // Output: 'npx playwright test --grep "(@critical|@smoke).*(@gameplay)"'
 * ```
 */
