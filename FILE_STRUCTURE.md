# MathQuest — File Structure

```
mathquest/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── (auth)/                       # Auth route group — no shared layout
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── signup/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx                # Minimal layout for auth pages
│   │   │
│   │   ├── (child)/                      # Child-facing game — own layout
│   │   │   ├── game/
│   │   │   │   └── page.tsx              # Main game canvas page
│   │   │   ├── journal/
│   │   │   │   └── page.tsx              # Trick discovery journal
│   │   │   ├── storybook/
│   │   │   │   ├── page.tsx              # Story library list
│   │   │   │   └── [storyId]/
│   │   │   │       └── page.tsx          # Story reader + math gate
│   │   │   └── layout.tsx                # Child layout (coin bar, session timer)
│   │   │
│   │   ├── (parent)/                     # Parent dashboard — own layout
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx              # Analytics overview
│   │   │   ├── settings/
│   │   │   │   └── page.tsx              # Difficulty, time limits, rewards
│   │   │   ├── stories/
│   │   │   │   ├── page.tsx              # Story library + approval queue
│   │   │   │   └── generate/
│   │   │   │       └── page.tsx          # AI story generation form
│   │   │   ├── audio/
│   │   │   │   └── page.tsx              # Audio upload + context mapping
│   │   │   └── layout.tsx                # Parent layout (nav sidebar)
│   │   │
│   │   ├── api/                          # API routes (server-side only)
│   │   │   ├── problems/
│   │   │   │   ├── route.ts              # GET /api/problems
│   │   │   │   ├── attempt/
│   │   │   │   │   └── route.ts          # POST /api/problems/attempt
│   │   │   │   └── hint/
│   │   │   │       └── route.ts          # POST /api/problems/hint
│   │   │   ├── child/
│   │   │   │   ├── state/
│   │   │   │   │   └── route.ts          # GET /api/child/state
│   │   │   │   └── session/
│   │   │   │       ├── start/
│   │   │   │       │   └── route.ts      # POST /api/child/session/start
│   │   │   │       └── end/
│   │   │   │           └── route.ts      # POST /api/child/session/end
│   │   │   ├── tricks/
│   │   │   │   └── route.ts              # GET /api/tricks
│   │   │   ├── stories/
│   │   │   │   ├── route.ts              # GET /api/stories
│   │   │   │   ├── generate/
│   │   │   │   │   └── route.ts          # POST /api/stories/generate
│   │   │   │   └── [id]/
│   │   │   │       └── approve/
│   │   │   │           └── route.ts      # PATCH /api/stories/:id/approve
│   │   │   ├── audio/
│   │   │   │   ├── route.ts              # GET /api/audio
│   │   │   │   └── upload/
│   │   │   │       └── route.ts          # POST /api/audio/upload
│   │   │   └── parent/
│   │   │       ├── analytics/
│   │   │       │   └── route.ts          # GET /api/parent/analytics
│   │   │       ├── settings/
│   │   │       │   └── route.ts          # PATCH /api/parent/settings
│   │   │       └── children/
│   │   │           └── route.ts          # GET /api/parent/children
│   │   │
│   │   ├── layout.tsx                    # Root layout (fonts, global providers)
│   │   ├── page.tsx                      # Root redirect → login or game
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── game/                         # Child-facing game components
│   │   │   ├── GameCanvas.tsx            # Phaser.js portal wrapper
│   │   │   ├── ProblemCard.tsx           # Math problem display + answer input
│   │   │   ├── HintBox.tsx               # Tiered hint display + coin cost
│   │   │   ├── CoinDisplay.tsx           # Animated coin counter
│   │   │   ├── StreakCounter.tsx          # 3/5/10 streak tracker
│   │   │   ├── InsightFlash.tsx          # Trick discovery animation
│   │   │   ├── BossEncounter.tsx         # Boss phase UI overlay
│   │   │   └── SessionTimer.tsx          # Countdown to time limit
│   │   │
│   │   ├── journal/                      # Trick journal components
│   │   │   ├── TrickCard.tsx             # Individual trick display
│   │   │   └── TrickGrid.tsx             # Grid of discovered tricks
│   │   │
│   │   ├── storybook/                    # Story reader components
│   │   │   ├── StoryPage.tsx             # Single page with math gate
│   │   │   ├── PageTurnGate.tsx          # Math problem blocking page turn
│   │   │   └── StoryProgress.tsx         # Chapter progress indicator
│   │   │
│   │   ├── parent/                       # Parent dashboard components
│   │   │   ├── AnalyticsChart.tsx        # Recharts wrapper for session data
│   │   │   ├── WeakConceptsTable.tsx     # Sorted by error/hint rate
│   │   │   ├── TrickDiscoveryLog.tsx     # Timeline of trick unlocks
│   │   │   ├── StoryApprovalCard.tsx     # Pending story review UI
│   │   │   ├── AudioUploader.tsx         # Drag-drop audio with context map
│   │   │   └── ChildSelector.tsx         # Switch between child accounts
│   │   │
│   │   └── ui/                           # Shared design system
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Card.tsx
│   │       ├── Badge.tsx
│   │       ├── Modal.tsx
│   │       └── LoadingSpinner.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                 # Browser Supabase client
│   │   │   ├── server.ts                 # Server Supabase client (cookies)
│   │   │   └── middleware.ts             # Session refresh middleware
│   │   ├── game/
│   │   │   ├── phaser-config.ts          # Phaser game config
│   │   │   ├── scenes/
│   │   │   │   ├── BootScene.ts
│   │   │   │   ├── Zone1Scene.ts
│   │   │   │   ├── Zone2Scene.ts
│   │   │   │   └── BossScene.ts
│   │   │   └── event-bridge.ts           # EventEmitter3 Phaser↔React bridge
│   │   ├── insight/
│   │   │   └── detector.ts               # Time-threshold insight detection logic
│   │   ├── ai/
│   │   │   └── story-generator.ts        # Claude API story generation (server only)
│   │   └── utils.ts                      # cn(), formatCoins(), etc.
│   │
│   ├── stores/                           # Zustand stores
│   │   ├── gameStore.ts                  # Zone, coins, streak, session state
│   │   ├── childStore.ts                 # Child profile + trick discoveries
│   │   └── sessionStore.ts               # Active session tracking
│   │
│   ├── hooks/                            # Custom React hooks
│   │   ├── useChildState.ts              # Fetch + cache child game state
│   │   ├── useSession.ts                 # Auth session helper
│   │   ├── useProblem.ts                 # Problem fetch + submit logic
│   │   └── useAudio.ts                   # Audio context management
│   │
│   ├── types/
│   │   ├── database.ts                   # Supabase generated types (auto)
│   │   ├── game.ts                       # Problem, Attempt, Trick, Session types
│   │   └── api.ts                        # API request/response types
│   │
│   └── middleware.ts                     # Auth guard: redirect by role
│
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql        # All 12 tables + RLS policies
│   └── seed.sql                          # 30 seed problems + 25 tricks
│
├── public/
│   ├── fonts/                            # Self-hosted fonts
│   ├── icons/                            # Zone icons, trick icons
│   └── placeholder/                      # Geometric character placeholders
│
├── tests/
│   ├── e2e/                              # Playwright tests
│   │   ├── auth.spec.ts
│   │   ├── core-loop.spec.ts             # Problem → answer → coin flow
│   │   └── answer-exposure.spec.ts       # Security: answer never in response
│   └── unit/
│       └── insight-detector.test.ts
│
├── .env.local                            # NEXT_PUBLIC_SUPABASE_URL, keys
├── .env.example                          # Template (committed, no secrets)
├── middleware.ts                         # Root middleware (auth routing)
└── next.config.js
```

## Key Architecture Decisions

**Route Groups**
- `(auth)` — no auth required, redirects away if already logged in
- `(child)` — requires child session, redirects to login if missing
- `(parent)` — requires parent session, redirects to login if missing
- Middleware in `src/middleware.ts` handles all role-based redirects

**The Answer Security Rule**
The `answer` field from the `problems` table is ONLY read inside `/api/problems/attempt/route.ts`.
It never appears in `GET /api/problems` responses. Search for the string `"answer"` in any client component = immediate bug.

**Phaser ↔ React Bridge**
`lib/game/event-bridge.ts` exports a singleton `EventEmitter3` instance.
Phaser scenes emit events (`PROBLEM_TRIGGERED`, `ZONE_CLEARED`).
React components listen and update Zustand store.
Never import Phaser in a React component directly.
