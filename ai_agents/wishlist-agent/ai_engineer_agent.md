# MathQuest — Wishlist Reward Feature
## AI Engineer Agent Document

> You are an AI coding agent implementing the Claude API integration for the MathQuest wishlist reward feature. Follow this document exactly. Your job is one focused task: price a child's wish in coins using the Anthropic API and expose an internal endpoint for the backend to call.

---

## 1. Your Role

When a child submits a wish (e.g. "Pizza night"), the backend calls your internal endpoint. You call Claude, determine a fair coin cost, and return the result. The backend writes it to the database. You do not touch the database directly.

**Stack:** FastAPI, Anthropic Python SDK, existing environment variables.

---

## 2. Flow

| Step | Who | What |
|---|---|---|
| 1 | Child (frontend) | Types "Pizza night" and taps Add |
| 2 | Backend | Inserts wish row with `ai_suggested_cost=null`, fires async background task |
| 3 | Backend | `POST /internal/price-wish` → your service |
| 4 | Your service | Calls Claude API with wish title + child grade |
| 5 | Your service | Returns `{ wish_id, cost, category, reasoning }` |
| 6 | Backend | Updates wish row with the pricing data |
| 7 | Frontend | Next poll (5s) picks up the cost and displays it |

---

## 3. Endpoint You Expose

Create a FastAPI router at `/internal/price-wish`. This is a backend-to-backend endpoint — not exposed to the internet.

### Request — what the backend sends

```json
POST /internal/price-wish
Content-Type: application/json

{
  "wish_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Pizza night",
  "grade": 5
}
```

> **Never receive PII.** The backend must only send `wish_id`, `title`, and `grade`. If other fields arrive, ignore them.

### Response — what you return on success

```json
{
  "wish_id": "550e8400-e29b-41d4-a716-446655440000",
  "cost": 1000,
  "category": "food",
  "reasoning": "A meal out is a medium-effort reward worth 2-4 days of play."
}
```

### Response — on Claude API failure

```json
{
  "wish_id": "550e8400-e29b-41d4-a716-446655440000",
  "cost": 500,
  "category": "other",
  "reasoning": "Pricing unavailable — suggested default."
}
```

> **Always return HTTP 200**, even on failure. Return the fallback. The backend must never be left waiting — it needs a result to write to the database. The parent can manually adjust the cost.

---

## 4. The Claude API Call

### Model and settings

| Parameter | Value | Reason |
|---|---|---|
| `model` | `claude-haiku-4-5-20251001` | Fast and cheap — no reasoning depth needed |
| `max_tokens` | `100` | JSON response is always under 80 tokens |
| `temperature` | `0` | Deterministic — same wish = same cost every time |
| Timeout | 8 seconds | Backend waits 10s max. Leave 2s buffer. |

### System prompt — use exactly as written

```
You are a reward-cost advisor for MathQuest, a math game for children.

A child earns coins by solving math questions:
- Correct answer: 10 coins
- Correct with insight (fast + no hints): 30 coins
- Correct after hint 1: 7 coins
- Correct after hint 2: 5 coins
- Correct after hint 3: 3 coins
- Daily cap: 500 coins per day

Your job: given a wish title and the child's school grade, suggest a coin cost.
The cost must be motivating but reachable — not frustrating, not trivial.

Cost bands:
- Small (screen time, snack, small treat): 200–500 coins (1–2 days of play)
- Medium (meal out, movie, activity, outing): 800–1500 coins (3–5 days)
- Large (toy, special trip, console game): 2000–5000 coins (1–3 weeks)

Respond ONLY with valid JSON. No preamble. No markdown fences. No explanation outside JSON.
Required schema:
{
  "cost": <integer>,
  "category": "screen_time" | "food" | "toy" | "experience" | "other",
  "reasoning": "<one sentence max>"
}
```

### User message — construct per request

```
Child grade: {grade}
Wish: "{title}"
```

**Example** for grade=5, title="Pizza night":
```
Child grade: 5
Wish: "Pizza night"
```

### Full Python implementation

```python
import anthropic
import json
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()
client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

SYSTEM_PROMPT = """..."""  # paste system prompt above here

FALLBACK = {
    "cost": 500,
    "category": "other",
    "reasoning": "Pricing unavailable — suggested default."
}

class PriceRequest(BaseModel):
    wish_id: str
    title: str
    grade: int

class PriceResponse(BaseModel):
    wish_id: str
    cost: int
    category: str
    reasoning: str

@router.post("/internal/price-wish", response_model=PriceResponse)
async def price_wish(req: PriceRequest):
    try:
        # Sanitise input
        title = req.title.strip()[:120]
        if not title:
            return PriceResponse(wish_id=req.wish_id, **FALLBACK)

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=100,
            temperature=0,
            system=SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": f'Child grade: {req.grade}\nWish: "{title}"'
            }]
        )
        parsed = json.loads(message.content[0].text.strip())
        return PriceResponse(
            wish_id=req.wish_id,
            cost=int(parsed["cost"]),
            category=parsed["category"],
            reasoning=parsed["reasoning"]
        )
    except Exception:
        return PriceResponse(wish_id=req.wish_id, **FALLBACK)
```

---

## 5. Input Sanitisation

Before calling Claude:

1. Strip leading and trailing whitespace from `title`
2. Truncate `title` to 120 characters
3. If `title` is empty after stripping, return the fallback immediately — do not call Claude

> Do not try to filter or moderate the wish content. The parent reviews every wish before the child can redeem it — they are the content filter. Your job is only to price it.

---

## 6. Test Cases

Run these before handing off to the backend engineer.

| Input | Expected category | Expected cost range |
|---|---|---|
| `title="30 min extra screen time"`, grade=3 | screen_time | 200–400 |
| `title="Pizza night"`, grade=5 | food | 800–1200 |
| `title="New Lego set"`, grade=4 | toy | 2000–4000 |
| `title="Trip to the zoo"`, grade=2 | experience | 1500–3000 |
| `title=""`, grade=5 | other (fallback, no Claude call) | 500 |
| `title="a" * 200`, grade=5 | any — must not crash | any |

---

## 7. Environment Variables

- `ANTHROPIC_API_KEY` — required. Read from environment. Never hardcode.
- `INTERNAL_SERVICE_SECRET` — optional for MVP. If the backend adds a shared secret header, validate it here.

---

## 8. What You Do NOT Own

- You do not write to the database — the backend writes to `wish_items` after receiving your response
- You do not handle JWT auth — this is a backend-to-backend endpoint only
- You do not store conversation history — each pricing call is fully stateless
- You do not re-price after the initial call — one call per wish, fixed cost forever

---

## 9. Coordination Checkpoint with Backend Engineer

Confirm these before the backend wires the async background task:

- [ ] The URL your service runs on (e.g. `http://localhost:8001/internal/price-wish`)
- [ ] Whether to use a shared secret header for basic auth between services
- [ ] Timeout: backend will wait 10 seconds max before using fallback cost of 500
- [ ] Confirm fallback cost (500 coins) matches what backend will write on timeout
