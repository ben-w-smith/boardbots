import { getShortestPaths } from '@xstate/graph';
import { getInitialSnapshot } from 'xstate';
import * as fs from 'fs';
import * as path from 'path';

// Import the Knowledge Graph
import { boardBotsMachine } from '../architecture/knowledge-graph';

/**
 * AGENTIC GRAPH PARSER
 * This script is framework/agent agnostic. It reads the XState Knowledge Graph
 * and outputs deterministic Playwright test scaffolds for every single user journey.
 *
 * Usage: `npm run generate-tests` or `npx ts-node scripts/generate-tests.ts`
 */

function generateTests() {
  console.log('🤖 Agentic Graph Parser initialized...');
  console.log('📖 Reading architecture/knowledge-graph.ts');

  // Extract every possible path a user can take from the initial state
  const paths = getShortestPaths(boardBotsMachine);

  const testScaffolds: string[] = [];

  testScaffolds.push(`import { test, expect } from '@playwright/test';`);
  testScaffolds.push(`import { PomFactory } from '../helpers/pom-factory';\n`);

  testScaffolds.push(`// AUTO-GENERATED FROM KNOWLEDGE GRAPH.`);
  testScaffolds.push(`// Do not edit these paths manually. Edit the graph and re-run the generator.\n`);

  testScaffolds.push(`test.describe('BoardBots Core User Journeys', () => {`);

  // Iterate over the XState paths and convert them to Playwright Tests
  let pathIndex = 0;
  for (const [stateId, statePath] of Object.entries(paths)) {
    const targetState = statePath.state.value;
    const steps = statePath.steps;

    // Skip the root state if there are no steps
    if (steps.length === 0) continue;

    pathIndex++;

    // Build a descriptive name from the path steps
    const pathDescription = steps
      .map(s => (s.event as { type: string }).type)
      .filter(t => t !== 'xstate.init')
      .join(' -> ');

    // Handle nested states (convert array/object to string)
    const stateName = typeof targetState === 'string'
      ? targetState
      : JSON.stringify(targetState);

    const testName = `Journey #${pathIndex}: ${pathDescription || 'Initial'} -> [${stateName}]`;
    testScaffolds.push(`  test('${testName}', async ({ page }) => {`);
    testScaffolds.push(`    const pom = new PomFactory(page);`);
    testScaffolds.push(`    await pom.navigateToRoot();\n`);

    // Write the sequential Playwright actions based on Graph Edges
    steps.forEach((step, index) => {
      const eventName = (step.event as { type: string }).type;
      const sourceState = index === 0
        ? getInitialSnapshot(boardBotsMachine).value
        : steps[index - 1].state.value;

      const sourceName = typeof sourceState === 'string'
        ? sourceState
        : JSON.stringify(sourceState);

      // Skip xstate.init events as they are no-ops
      if (eventName === 'xstate.init') {
        return;
      }

      testScaffolds.push(`    // Transition [${sourceName}] -> [${eventName}]`);
      testScaffolds.push(`    await pom.executeAction('${eventName}');`);
    });

    testScaffolds.push(`    `);
    testScaffolds.push(`    // Assert Final State`);
    testScaffolds.push(`    await pom.assertState('${stateName}');`);
    testScaffolds.push(`  });\n`);
  }

  testScaffolds.push(`});\n`);

  // Write the results to the E2E package
  const outPath = path.join(__dirname, '../packages/e2e/tests/generated-journeys.spec.ts');
  fs.writeFileSync(outPath, testScaffolds.join('\n'));

  console.log(`✅ Successfully generated ${Object.keys(paths).length - 1} User Journeys.`);
  console.log(`📄 Wrote tests to: ${outPath}`);
  console.log(`\nNext Step for Agent: Implement UI in packages/client until Playwright tests pass.`);
}

generateTests();
