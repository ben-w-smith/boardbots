# BoardBots Authentication Flow

## Overview

BoardBots uses JWT-based authentication with access/refresh token pairs.

## Token Strategy

```
+------------------+          +------------------+
|  Access Token    |          |  Refresh Token   |
|  - 15 min expiry |          |  - 7 day expiry  |
|  - Stored in JS  |          |  - httpOnly cookie |
|  - Sent in header|          |  - Sent automatically |
+------------------+          +------------------+
```

## Authentication Endpoints

### POST /api/auth/register

**Request:**
```json
{
  "username": "player1",
  "password": "securePassword123"
}
```

**Response (201):**
```json
{
  "user": { "id": 1, "username": "player1" },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Validation:**
- Username: 3-20 chars, alphanumeric + underscore/hyphen
- Password: 8+ chars, 1 uppercase, 1 lowercase, 1 number
- Reserved usernames: admin, system, api, moderator, bot
- Case-insensitive username comparison

### POST /api/auth/login

**Request:**
```json
{
  "username": "player1",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "user": { "id": 1, "username": "player1" },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Security:**
- Generic "Invalid credentials" error (no username enumeration)
- Rate limited (5 attempts per 15 minutes)

### POST /api/auth/refresh

**Request:**
- Refresh token sent via httpOnly cookie

**Response (200):**
```json
{
  "user": { "id": 1, "username": "player1" },
  "token": "eyJhbGciOiJIUzI1NiIs..." // New access token
}
```

**Behavior:**
- Issues new token pair
- Old refresh token invalidated
- Clears cookie if invalid/expired

### POST /api/auth/logout

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

**Behavior:**
- Clears refresh token cookie

### GET /api/auth/me

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "user": { "userId": 1, "username": "player1" }
}
```

## Middleware

### requireAuth

Protects routes that require authentication:

```typescript
router.get("/protected", requireAuth, (req, res) => {
  // req.user contains { userId, username, iat, exp }
});
```

**Error Responses:**
- 401: No token provided
- 401: Invalid token
- 401: Token expired

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| /login | 5 requests | 15 minutes |
| /register | 3 requests | 60 minutes |

Rate limiter uses IP-based tracking.

## Client Integration

### Token Storage

```typescript
// Access token stored in memory/localStorage
let accessToken: string | null = null;

// Refresh token automatically handled by browser (httpOnly cookie)
```

### Token Refresh Flow

```typescript
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    // Try to refresh token
    const refreshResponse = await fetch("/api/auth/refresh", {
      method: "POST",
    });

    if (refreshResponse.ok) {
      const data = await refreshResponse.json();
      accessToken = data.token;
      // Retry original request
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${accessToken}`,
        },
      });
    }
  }

  return response;
}
```

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Password Hashing

- Algorithm: bcrypt
- Cost factor: 12

```typescript
const hash = await hashPassword(password);
const isValid = await comparePassword(password, hash);
```

## Security Considerations

1. **httpOnly Cookies**: Refresh tokens cannot be accessed via JavaScript
2. **SameSite: strict**: Prevents CSRF attacks
3. **Short-lived Access Tokens**: 15 minute expiry limits exposure
4. **Rate Limiting**: Prevents brute force attacks
5. **Password Strength**: Enforces minimum complexity requirements
6. **Case-Insensitive Usernames**: Prevents similar username confusion

## Integration with Game Rooms

Authenticated users can associate their games with their account:

```typescript
// In GameRoom.handleJoin()
if (playerIndex === 0) {
  this.persisted.hostName = playerName;
  const user = (ws as any).user;
  if (user) {
    this.persisted.userId = user.userId;
  }
}
```

Game winners are tracked for statistics:

```typescript
// In checkAndHandleGameOver()
if (winnerSession && winnerSession[1].user) {
  this.persisted.winnerId = winnerSession[1].user.userId;
  dbService.updateGameWinner(this.gameCode, winnerSession[1].user.userId);
}
```
