# Chat UX Improvements

## Auto-Scroll Behavior

### Problem

In chat interfaces, new messages should automatically scroll into view, but only when the user is actively following the conversation. If the user has scrolled up to read history, auto-scroll would be disruptive.

### Solution: Smart Auto-Scroll

The chat implements intelligent auto-scroll that:
- ✅ Scrolls to new messages when user is at the bottom
- ✅ Preserves scroll position when user is reading history
- ✅ Detects when user manually scrolls back to bottom
- ✅ Uses smooth scrolling for better UX

### Implementation

```typescript
const isUserScrollingRef = useRef(false);
const lastScrollTopRef = useRef(0);

// Detect manual scrolling
const handleScroll = () => {
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
  const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

  // User scrolled up
  if (scrollTop < lastScrollTopRef.current) {
    isUserScrollingRef.current = !isAtBottom;
  }
  // User scrolled down to bottom
  else if (isAtBottom) {
    isUserScrollingRef.current = false;
  }

  lastScrollTopRef.current = scrollTop;
};

// Auto-scroll only if user was at bottom
useEffect(() => {
  if (!isUserScrollingRef.current && messagesEndRef.current) {
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }
}, [messages]);
```

### Key Concepts

#### 1. Bottom Detection Threshold

```typescript
const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
```

**Why 50px?**
- Accounts for rounding errors
- Allows small scroll variations
- Feels natural to users

#### 2. Scroll Direction Detection

```typescript
if (scrollTop < lastScrollTopRef.current) {
  // User scrolled UP
  isUserScrollingRef.current = !isAtBottom;
}
```

**Logic:**
- If scrolling up AND not at bottom → User is reading history
- If scrolling up BUT at bottom → Just a small movement, keep auto-scroll

#### 3. Smooth Scrolling

```typescript
messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
```

**Benefits:**
- Less jarring than instant scroll
- User can see message appearing
- Better perceived performance

### User Scenarios

#### Scenario 1: Active Conversation
**User is at bottom, new message arrives**

1. User scrolled to bottom: `isUserScrolling = false`
2. New message added to `messages` array
3. `useEffect` triggers
4. Check: `!isUserScrolling` → true
5. Smooth scroll to bottom
6. ✅ User sees new message

#### Scenario 2: Reading History
**User scrolled up, new message arrives**

1. User scrolls up: `isUserScrolling = true`
2. New message added to `messages` array
3. `useEffect` triggers
4. Check: `!isUserScrolling` → false
5. No scroll happens
6. ✅ User's position preserved

#### Scenario 3: Return to Bottom
**User scrolled up, then manually scrolls back down**

1. User scrolls up: `isUserScrolling = true`
2. User scrolls down to bottom
3. `handleScroll` detects: `isAtBottom = true`
4. Sets: `isUserScrolling = false`
5. Next message will auto-scroll
6. ✅ Auto-scroll re-enabled

### Edge Cases

#### Empty Chat
```typescript
{messages.length === 0 ? (
  <div className="flex h-full items-center justify-center">
    <p>Добро пожаловать в RPGate</p>
  </div>
) : (
  // Messages
)}
```

No scroll behavior needed when chat is empty.

#### First Message
```typescript
useEffect(() => {
  if (!isUserScrollingRef.current && messagesEndRef.current) {
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }
}, [messages]);
```

First message always scrolls into view (user hasn't scrolled yet).

#### Rapid Messages (Streaming)
During SSE streaming, messages update frequently:
- Each delta triggers `useEffect`
- Smooth scroll queues up
- Browser optimizes multiple scroll requests
- Result: Smooth continuous scroll

### Integration with ScrollArea

The component uses Radix UI's `ScrollArea`:

```typescript
const scrollContainer = scrollAreaRef.current?.querySelector(
  "[data-radix-scroll-area-viewport]"
);
```

**Why query for viewport?**
- `ScrollArea` wraps content in internal viewport
- Direct ref doesn't give access to scroll container
- Need to query for `data-radix-scroll-area-viewport`

### Performance Considerations

#### 1. Ref Usage
```typescript
const isUserScrollingRef = useRef(false);
```

**Why ref instead of state?**
- No re-renders needed
- Faster updates
- Scroll handler called frequently

#### 2. Scroll Event Throttling
Browser automatically throttles scroll events, but we could add:

```typescript
const throttledScroll = throttle(handleScroll, 100);
```

Currently not needed due to simple logic.

#### 3. Cleanup
```typescript
return () => scrollContainer.removeEventListener("scroll", handleScroll);
```

Always remove event listeners to prevent memory leaks.

## Message Rendering

### Key Generation

```typescript
key={`${msg.role}-${i}-${msg.content.slice(0, 20)}`}
```

**Why this format?**
- `role` - Distinguishes player/gm/system
- `i` - Index for uniqueness
- `content.slice(0, 20)` - Partial content for stability

**Why not just index?**
- Index alone can cause issues when messages are inserted
- Content prefix helps React identify actual changes
- Prevents unnecessary re-renders

### Message Spacing

```typescript
<div className="space-y-4 p-4">
```

- `space-y-4` - 1rem (16px) between messages
- `p-4` - 1rem padding around chat area
- Consistent with design system

## Future Improvements

### 1. Scroll-to-Bottom Button

Show button when user scrolls up:

```typescript
{isUserScrolling && (
  <button onClick={scrollToBottom}>
    ↓ New messages
  </button>
)}
```

### 2. Unread Message Indicator

Count messages since user scrolled up:

```typescript
const [unreadCount, setUnreadCount] = useState(0);

useEffect(() => {
  if (isUserScrolling) {
    setUnreadCount(prev => prev + 1);
  }
}, [messages.length]);
```

### 3. Scroll Position Restoration

Save scroll position on navigation:

```typescript
useEffect(() => {
  const savedPosition = sessionStorage.getItem("chatScroll");
  if (savedPosition) {
    scrollContainer.scrollTop = Number(savedPosition);
  }
}, []);
```

### 4. Virtual Scrolling

For very long conversations (1000+ messages):

```typescript
import { useVirtualizer } from "@tanstack/react-virtual";

const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => scrollContainer,
  estimateSize: () => 100,
});
```

### 5. Message Grouping

Group consecutive messages from same sender:

```typescript
const groupedMessages = messages.reduce((groups, msg) => {
  const lastGroup = groups[groups.length - 1];
  if (lastGroup && lastGroup[0].role === msg.role) {
    lastGroup.push(msg);
  } else {
    groups.push([msg]);
  }
  return groups;
}, []);
```

## Testing Auto-Scroll

### Manual Testing

1. **Test auto-scroll on new message:**
   - Scroll to bottom
   - Send message
   - ✅ Should auto-scroll to show new message

2. **Test preserved position:**
   - Scroll up to middle of chat
   - Send message
   - ✅ Should stay at current position

3. **Test re-enable auto-scroll:**
   - Scroll up
   - Manually scroll back to bottom
   - Send message
   - ✅ Should auto-scroll again

4. **Test streaming:**
   - Send message that triggers long GM response
   - ✅ Should smoothly scroll as text streams in

### Automated Testing

```typescript
describe("ChatMessages auto-scroll", () => {
  it("should scroll to bottom on new message when at bottom", () => {
    const { rerender } = render(<ChatMessages messages={[msg1]} />);
    
    // Simulate being at bottom
    const viewport = screen.getByRole("region");
    viewport.scrollTop = viewport.scrollHeight;
    
    // Add new message
    rerender(<ChatMessages messages={[msg1, msg2]} />);
    
    // Should scroll to bottom
    expect(viewport.scrollTop).toBe(viewport.scrollHeight);
  });
  
  it("should preserve position when scrolled up", () => {
    const { rerender } = render(<ChatMessages messages={[msg1]} />);
    
    // Simulate scrolling up
    const viewport = screen.getByRole("region");
    viewport.scrollTop = 100;
    
    // Add new message
    rerender(<ChatMessages messages={[msg1, msg2]} />);
    
    // Should stay at 100
    expect(viewport.scrollTop).toBe(100);
  });
});
```

## Accessibility

### Keyboard Navigation

Users can navigate with keyboard:
- `↑` / `↓` - Scroll up/down
- `Page Up` / `Page Down` - Scroll by page
- `Home` / `End` - Jump to top/bottom

Auto-scroll doesn't interfere with keyboard navigation.

### Screen Readers

```typescript
<div role="log" aria-live="polite" aria-atomic="false">
  {messages.map(msg => (
    <div role="article" aria-label={`${msg.role} message`}>
      {msg.content}
    </div>
  ))}
</div>
```

Screen readers announce new messages as they arrive.

### Focus Management

When new message arrives:
- Don't steal focus from input field
- Don't interrupt user typing
- Let screen reader announce in background
