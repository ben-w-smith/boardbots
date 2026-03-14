/**
 * Games API Client - Handles game history API calls
 */

import { authManager } from '../auth.js';

export interface GameHistoryItem {
  gameCode: string;
  phase: string;
  players: string;
  createdAt: number;
  winnerId: number | null;
  aiEnabled: boolean;
  status?: 'active' | 'cancelled' | 'completed' | 'archived';
}

export interface GameHistoryResponse {
  games: GameHistoryItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface GameDetailResponse {
  game: {
    gameCode: string;
    state: string | null;
    players: string;
    phase: string;
    createdAt: number;
    winnerId: number | null;
    aiEnabled: boolean;
    aiDepth: number;
    aiPlayerIndex: number | null;
  };
}

/**
 * Get paginated game history for the authenticated user
 */
export async function getGameHistory(
  limit: number = 20,
  offset: number = 0
): Promise<GameHistoryResponse> {
  const response = await authManager.authFetch(
    `/api/games?limit=${limit}&offset=${offset}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch game history: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get detailed information about a specific game
 */
export async function getGameDetail(gameCode: string): Promise<GameDetailResponse> {
  const response = await authManager.authFetch(`/api/games/${gameCode}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Game not found');
    }
    throw new Error(`Failed to fetch game detail: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Format relative time from timestamp
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) {
    return 'Just now';
  } else if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
  }
}

/**
 * Parse players JSON string and get opponent name
 */
export function getOpponentName(playersJson: string, currentUsername: string): string {
  try {
    const players = JSON.parse(playersJson) as [string, string][];
    for (const [name] of players) {
      if (name.toLowerCase() !== currentUsername.toLowerCase()) {
        return name;
      }
    }
    // If no opponent found (AI game), return AI
    if (players.length === 1) {
      return 'AI';
    }
    return 'Unknown';
  } catch {
    return 'Unknown';
  }
}

/**
 * Determine game result from the user's perspective
 */
export function getGameResult(
  winnerId: number | null,
  userId: number,
  phase: string
): 'win' | 'loss' | 'draw' | 'in_progress' {
  if (phase !== 'finished') {
    return 'in_progress';
  }
  if (winnerId === null) {
    return 'draw';
  }
  if (winnerId === userId) {
    return 'win';
  }
  return 'loss';
}

/**
 * Cancel a game
 */
export async function cancelGame(gameCode: string): Promise<void> {
  const response = await authManager.authFetch(`/api/games/${gameCode}/cancel`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to cancel game: ${response.statusText}`);
  }
}

/**
 * Archive a game
 */
export async function archiveGame(gameCode: string): Promise<void> {
  const response = await authManager.authFetch(`/api/games/${gameCode}/archive`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to archive game: ${response.statusText}`);
  }
}

/**
 * Unarchive a game
 */
export async function unarchiveGame(gameCode: string): Promise<void> {
  const response = await authManager.authFetch(`/api/games/${gameCode}/unarchive`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to unarchive game: ${response.statusText}`);
  }
}
