import { test, expect } from '@playwright/test';
import { PomFactory } from '../helpers/pom-factory';

// AUTO-GENERATED FROM KNOWLEDGE GRAPH.
// Do not edit these paths manually. Edit the graph and re-run the generator.

test.describe('BoardBots Core User Journeys', () => {
  test('Journey #1: Initial -> [Idle]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    
    // Assert Final State
    await pom.assertState('Idle');
  });

  test('Journey #2: CLICK_LOGIN -> [LoginModal]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CLICK_LOGIN]
    await pom.executeAction('CLICK_LOGIN');
    
    // Assert Final State
    await pom.assertState('LoginModal');
  });

  test('Journey #3: CLICK_REGISTER -> [RegisterModal]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CLICK_REGISTER]
    await pom.executeAction('CLICK_REGISTER');
    
    // Assert Final State
    await pom.assertState('RegisterModal');
  });

  test('Journey #4: CREATE_GAME -> [WaitingForOpponent]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CREATE_GAME]
    await pom.executeAction('CREATE_GAME');
    
    // Assert Final State
    await pom.assertState('WaitingForOpponent');
  });

  test('Journey #5: CLICK_JOIN_GAME -> [JoiningGame]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CLICK_JOIN_GAME]
    await pom.executeAction('CLICK_JOIN_GAME');
    
    // Assert Final State
    await pom.assertState('JoiningGame');
  });

  test('Journey #6: CLICK_LOGIN -> SUBMIT_LOGIN_SUCCESS -> [Dashboard]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CLICK_LOGIN]
    await pom.executeAction('CLICK_LOGIN');
    // Transition [LoginModal] -> [SUBMIT_LOGIN_SUCCESS]
    await pom.executeAction('SUBMIT_LOGIN_SUCCESS');
    
    // Assert Final State
    await pom.assertState('Dashboard');
  });

  test('Journey #7: CREATE_GAME -> START_GAME -> [InGame]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CREATE_GAME]
    await pom.executeAction('CREATE_GAME');
    // Transition [WaitingForOpponent] -> [START_GAME]
    await pom.executeAction('START_GAME');
    
    // Assert Final State
    await pom.assertState('InGame');
  });

  test('Journey #8: CLICK_JOIN_GAME -> JOIN_GAME -> [WaitingForOpponent]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CLICK_JOIN_GAME]
    await pom.executeAction('CLICK_JOIN_GAME');
    // Transition [JoiningGame] -> [JOIN_GAME]
    await pom.executeAction('JOIN_GAME');
    
    // Assert Final State
    await pom.assertState('WaitingForOpponent');
  });

  test('Journey #9: CLICK_LOGIN -> SUBMIT_LOGIN_SUCCESS -> CREATE_GAME -> [WaitingForOpponent]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CLICK_LOGIN]
    await pom.executeAction('CLICK_LOGIN');
    // Transition [LoginModal] -> [SUBMIT_LOGIN_SUCCESS]
    await pom.executeAction('SUBMIT_LOGIN_SUCCESS');
    // Transition [Dashboard] -> [CREATE_GAME]
    await pom.executeAction('CREATE_GAME');
    
    // Assert Final State
    await pom.assertState('WaitingForOpponent');
  });

  test('Journey #10: CLICK_LOGIN -> SUBMIT_LOGIN_SUCCESS -> CLICK_JOIN_GAME -> [JoiningGame]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CLICK_LOGIN]
    await pom.executeAction('CLICK_LOGIN');
    // Transition [LoginModal] -> [SUBMIT_LOGIN_SUCCESS]
    await pom.executeAction('SUBMIT_LOGIN_SUCCESS');
    // Transition [Dashboard] -> [CLICK_JOIN_GAME]
    await pom.executeAction('CLICK_JOIN_GAME');
    
    // Assert Final State
    await pom.assertState('JoiningGame');
  });

  test('Journey #11: CREATE_GAME -> START_GAME -> GAME_ENDED -> [GameOver]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CREATE_GAME]
    await pom.executeAction('CREATE_GAME');
    // Transition [WaitingForOpponent] -> [START_GAME]
    await pom.executeAction('START_GAME');
    // Transition [InGame] -> [GAME_ENDED]
    await pom.executeAction('GAME_ENDED');
    
    // Assert Final State
    await pom.assertState('GameOver');
  });

  test('Journey #12: CLICK_JOIN_GAME -> JOIN_GAME -> START_GAME -> [InGame]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CLICK_JOIN_GAME]
    await pom.executeAction('CLICK_JOIN_GAME');
    // Transition [JoiningGame] -> [JOIN_GAME]
    await pom.executeAction('JOIN_GAME');
    // Transition [WaitingForOpponent] -> [START_GAME]
    await pom.executeAction('START_GAME');
    
    // Assert Final State
    await pom.assertState('InGame');
  });

  test('Journey #13: CLICK_LOGIN -> SUBMIT_LOGIN_SUCCESS -> CREATE_GAME -> LEAVE_LOBBY -> [Idle]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CLICK_LOGIN]
    await pom.executeAction('CLICK_LOGIN');
    // Transition [LoginModal] -> [SUBMIT_LOGIN_SUCCESS]
    await pom.executeAction('SUBMIT_LOGIN_SUCCESS');
    // Transition [Dashboard] -> [CREATE_GAME]
    await pom.executeAction('CREATE_GAME');
    // Transition [WaitingForOpponent] -> [LEAVE_LOBBY]
    await pom.executeAction('LEAVE_LOBBY');
    
    // Assert Final State
    await pom.assertState('Idle');
  });

  test('Journey #14: CLICK_LOGIN -> SUBMIT_LOGIN_SUCCESS -> CREATE_GAME -> START_GAME -> [InGame]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CLICK_LOGIN]
    await pom.executeAction('CLICK_LOGIN');
    // Transition [LoginModal] -> [SUBMIT_LOGIN_SUCCESS]
    await pom.executeAction('SUBMIT_LOGIN_SUCCESS');
    // Transition [Dashboard] -> [CREATE_GAME]
    await pom.executeAction('CREATE_GAME');
    // Transition [WaitingForOpponent] -> [START_GAME]
    await pom.executeAction('START_GAME');
    
    // Assert Final State
    await pom.assertState('InGame');
  });

  test('Journey #15: CLICK_LOGIN -> SUBMIT_LOGIN_SUCCESS -> CLICK_JOIN_GAME -> JOIN_GAME -> [WaitingForOpponent]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CLICK_LOGIN]
    await pom.executeAction('CLICK_LOGIN');
    // Transition [LoginModal] -> [SUBMIT_LOGIN_SUCCESS]
    await pom.executeAction('SUBMIT_LOGIN_SUCCESS');
    // Transition [Dashboard] -> [CLICK_JOIN_GAME]
    await pom.executeAction('CLICK_JOIN_GAME');
    // Transition [JoiningGame] -> [JOIN_GAME]
    await pom.executeAction('JOIN_GAME');
    
    // Assert Final State
    await pom.assertState('WaitingForOpponent');
  });

  test('Journey #16: CLICK_JOIN_GAME -> JOIN_GAME -> START_GAME -> GAME_ENDED -> [GameOver]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CLICK_JOIN_GAME]
    await pom.executeAction('CLICK_JOIN_GAME');
    // Transition [JoiningGame] -> [JOIN_GAME]
    await pom.executeAction('JOIN_GAME');
    // Transition [WaitingForOpponent] -> [START_GAME]
    await pom.executeAction('START_GAME');
    // Transition [InGame] -> [GAME_ENDED]
    await pom.executeAction('GAME_ENDED');
    
    // Assert Final State
    await pom.assertState('GameOver');
  });

  test('Journey #17: CLICK_LOGIN -> SUBMIT_LOGIN_SUCCESS -> CREATE_GAME -> LEAVE_LOBBY -> CLICK_LOGIN -> [LoginModal]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CLICK_LOGIN]
    await pom.executeAction('CLICK_LOGIN');
    // Transition [LoginModal] -> [SUBMIT_LOGIN_SUCCESS]
    await pom.executeAction('SUBMIT_LOGIN_SUCCESS');
    // Transition [Dashboard] -> [CREATE_GAME]
    await pom.executeAction('CREATE_GAME');
    // Transition [WaitingForOpponent] -> [LEAVE_LOBBY]
    await pom.executeAction('LEAVE_LOBBY');
    // Transition [Idle] -> [CLICK_LOGIN]
    await pom.executeAction('CLICK_LOGIN');
    
    // Assert Final State
    await pom.assertState('LoginModal');
  });

  test('Journey #18: CLICK_LOGIN -> SUBMIT_LOGIN_SUCCESS -> CREATE_GAME -> LEAVE_LOBBY -> CLICK_REGISTER -> [RegisterModal]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CLICK_LOGIN]
    await pom.executeAction('CLICK_LOGIN');
    // Transition [LoginModal] -> [SUBMIT_LOGIN_SUCCESS]
    await pom.executeAction('SUBMIT_LOGIN_SUCCESS');
    // Transition [Dashboard] -> [CREATE_GAME]
    await pom.executeAction('CREATE_GAME');
    // Transition [WaitingForOpponent] -> [LEAVE_LOBBY]
    await pom.executeAction('LEAVE_LOBBY');
    // Transition [Idle] -> [CLICK_REGISTER]
    await pom.executeAction('CLICK_REGISTER');
    
    // Assert Final State
    await pom.assertState('RegisterModal');
  });

  test('Journey #19: CLICK_LOGIN -> SUBMIT_LOGIN_SUCCESS -> CREATE_GAME -> START_GAME -> GAME_ENDED -> [GameOver]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CLICK_LOGIN]
    await pom.executeAction('CLICK_LOGIN');
    // Transition [LoginModal] -> [SUBMIT_LOGIN_SUCCESS]
    await pom.executeAction('SUBMIT_LOGIN_SUCCESS');
    // Transition [Dashboard] -> [CREATE_GAME]
    await pom.executeAction('CREATE_GAME');
    // Transition [WaitingForOpponent] -> [START_GAME]
    await pom.executeAction('START_GAME');
    // Transition [InGame] -> [GAME_ENDED]
    await pom.executeAction('GAME_ENDED');
    
    // Assert Final State
    await pom.assertState('GameOver');
  });

  test('Journey #20: CLICK_LOGIN -> SUBMIT_LOGIN_SUCCESS -> CLICK_JOIN_GAME -> JOIN_GAME -> START_GAME -> [InGame]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CLICK_LOGIN]
    await pom.executeAction('CLICK_LOGIN');
    // Transition [LoginModal] -> [SUBMIT_LOGIN_SUCCESS]
    await pom.executeAction('SUBMIT_LOGIN_SUCCESS');
    // Transition [Dashboard] -> [CLICK_JOIN_GAME]
    await pom.executeAction('CLICK_JOIN_GAME');
    // Transition [JoiningGame] -> [JOIN_GAME]
    await pom.executeAction('JOIN_GAME');
    // Transition [WaitingForOpponent] -> [START_GAME]
    await pom.executeAction('START_GAME');
    
    // Assert Final State
    await pom.assertState('InGame');
  });

  test('Journey #21: CLICK_LOGIN -> SUBMIT_LOGIN_SUCCESS -> CLICK_JOIN_GAME -> JOIN_GAME -> START_GAME -> GAME_ENDED -> [GameOver]', async ({ page }) => {
    const pom = new PomFactory(page);
    await pom.navigateToRoot();

    // Transition [Idle] -> [CLICK_LOGIN]
    await pom.executeAction('CLICK_LOGIN');
    // Transition [LoginModal] -> [SUBMIT_LOGIN_SUCCESS]
    await pom.executeAction('SUBMIT_LOGIN_SUCCESS');
    // Transition [Dashboard] -> [CLICK_JOIN_GAME]
    await pom.executeAction('CLICK_JOIN_GAME');
    // Transition [JoiningGame] -> [JOIN_GAME]
    await pom.executeAction('JOIN_GAME');
    // Transition [WaitingForOpponent] -> [START_GAME]
    await pom.executeAction('START_GAME');
    // Transition [InGame] -> [GAME_ENDED]
    await pom.executeAction('GAME_ENDED');
    
    // Assert Final State
    await pom.assertState('GameOver');
  });

});
