# Session Management

## Overview

RPGate uses session-based state management to persist game progress, character data, and conversation history across page reloads.

## Session Storage

### Cookie-Based Sessions

Sessions are identified by an `rpg_session` httpOnly cookie:
- **Duration:** 90 days
- **Scope:** Same-site only
- **Security:** httpOnly (not accessible via JavaScript)
- **Format:** UUID-like string

### Database Schema

```typescript
Session {
  id: number              // Internal ID
  externalId: string      // Cookie value
  createdAt: timestamp
  title: string
  locale: string          // "ru"
  setting: string         // "medieval_fantasy"
  playerClass: string     // Deprecated (use Character table)
  playerBio: string       // Deprecated (use Character table)
}
```

## Session Lifecycle

### 1. Session Creation

Sessions are created automatically on first interaction:

```typescript
// First API call (chat, character, etc.)
const externalId = cookies().get("rpg_session")?.value || generateId();

// Create session in DB
const session = await db.insert(sessions).values({
  externalId,
  locale: "ru",
  setting: "medieval_fantasy"
});
```

### 2. Session Persistence

All game data is linked to the session:
- **Messages** - Player and GM conversation
- **Turns** - Complete game turns with metadata
- **Rolls** - Dice roll history
- **Character** - Character sheet and stats

### 3. Session Reset

**Endpoint:** `POST /api/session/reset`

**Options:**
```json
{
  "regenerateCookie": false  // Keep same session ID
}
```

**What gets deleted:**
- ✅ All messages
- ✅ All turns
- ✅ All rolls
- ✅ Character data
- ❌ Session record (kept for history)

**UI Behavior:**
1. User clicks "Сбросить сессию"
2. API deletes all related data
3. Character panel automatically reloads
4. Shows "Create character" form
5. Chat history is cleared

## Character Panel Integration

### Auto-Reload on Reset

The character panel uses React's `key` prop to force remount:

```typescript
const [characterKey, setCharacterKey] = useState(0);

async function resetSession() {
  await fetch("/api/session/reset", { method: "POST" });
  setCharacterKey(prev => prev + 1); // Force remount
}

<CharacterPanel key={characterKey} ... />
```

**Why this works:**
- Changing `key` forces React to unmount and remount the component
- `useEffect` runs again, fetching fresh data
- Component sees no character and shows creation form

### Character Creation Flow

After session reset:

1. **Panel shows creation form**
   - Class input field
   - Bio input field
   - "Создать персонажа" button

2. **User fills form and clicks create**
   - `POST /api/character` with className and bio
   - Server generates random ability scores
   - Character is saved to database

3. **Panel updates automatically**
   - Shows character stats
   - Displays ability modifiers
   - Enables "Перебросить характеристики" button

## API Endpoints

### GET /api/character
Returns current character or null if none exists.

**Response:**
```json
{
  "character": {
    "id": 1,
    "className": "Воин",
    "bio": "Храбрый воин",
    "strMod": 3,
    "dexMod": 1,
    ...
  }
}
```

### POST /api/character
Creates or updates character.

**Request:**
```json
{
  "className": "Воин",
  "bio": "Храбрый воин"
}
```

**Behavior:**
- If no character exists: Creates with random ability scores
- If character exists: Updates className and bio only

### POST /api/character/regenerate
Regenerates ability scores for existing character.

**Response:**
```json
{
  "character": { ... },
  "message": "Характеристики перегенерированы"
}
```

### POST /api/session/reset
Resets session data.

**Request:**
```json
{
  "regenerateCookie": false
}
```

**Response:**
```json
{
  "message": "Session reset successfully"
}
```

## State Management

### Client-Side State

```typescript
// Main page state
const [messages, setMessages] = useState<Msg[]>([]);
const [characterKey, setCharacterKey] = useState(0);
const [busy, setBusy] = useState(false);

// Character panel state
const [character, setCharacter] = useState<Character | null>(null);
const [loading, setLoading] = useState(true);
const [className, setClassName] = useState("");
const [bio, setBio] = useState("");
```

### State Synchronization

**On page load:**
1. Fetch `/api/history` → Update messages
2. Fetch `/api/character` → Update character panel

**On session reset:**
1. Call `/api/session/reset`
2. Clear messages: `setMessages([])`
3. Increment key: `setCharacterKey(prev => prev + 1)`
4. Character panel remounts and fetches fresh data

**On character save:**
1. Call `/api/character` with new data
2. Fetch `/api/character` to get updated data
3. Update local state

## Best Practices

### 1. Always Use Session ID

```typescript
// ✅ Good: Use session from cookie
const sessionId = cookies().get("rpg_session")?.value;

// ❌ Bad: Generate new ID each time
const sessionId = generateId();
```

### 2. Handle Missing Sessions

```typescript
// ✅ Good: Create session if not exists
let session = await getSession(externalId);
if (!session) {
  session = await createSession(externalId);
}

// ❌ Bad: Assume session exists
const session = await getSession(externalId);
session.id; // May be undefined!
```

### 3. Cascade Deletes

Database schema uses `onDelete: "cascade"`:

```typescript
messages: {
  sessionId: integer("session_id")
    .references(() => sessions.id, { onDelete: "cascade" })
}
```

This ensures all related data is deleted when session is reset.

### 4. Optimistic UI Updates

```typescript
// ✅ Good: Update UI immediately, then sync
setMessages([]);
await fetch("/api/session/reset");

// ❌ Bad: Wait for API, then update
await fetch("/api/session/reset");
setMessages([]);
```

## Troubleshooting

### Character Panel Not Updating After Reset

**Symptom:** Panel still shows old character after reset.

**Solution:** Ensure `key` prop is being updated:
```typescript
<CharacterPanel key={characterKey} ... />
```

### Session Lost After Page Reload

**Symptom:** New session created on each page load.

**Cause:** Cookie not being set or read correctly.

**Solution:** Check cookie settings:
- httpOnly: true
- sameSite: "lax"
- maxAge: 90 days

### Character Has Zero Stats

**Symptom:** All ability modifiers are 0.

**Cause:** Character created before ability score generation was implemented.

**Solution:** Click "Перебросить характеристики" button.

## Future Enhancements

- [ ] **Session Sharing** - Share session URL with friends
- [ ] **Session History** - View past sessions
- [ ] **Session Export** - Download session as JSON
- [ ] **Session Import** - Load saved session
- [ ] **Multiple Characters** - Switch between characters
- [ ] **Session Metadata** - Track play time, turns, etc.
