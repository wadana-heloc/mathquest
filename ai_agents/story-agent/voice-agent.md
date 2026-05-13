# voice-agent.md — MathQuest Voice Narration (AI Engineer Scope)

## Keeping This File Up To Date

**When we add a new function, change a contract, or discover a new constraint — update this file.**
Specifically:
- Update function signatures if they change
- Update the "Tell the Backend" section when backend responsibilities are clarified
- Update the "Keep in Mind" section when new edge cases are discovered
- Update the Definition of Done checklist as tasks are completed

---

## What This Module Does

`generate_voice.py` adds parent-voice narration to MathQuest stories.

Flow:
1. Parent uploads a voice recording → backend calls `clone_voice()` → ElevenLabs creates a voice clone → backend stores the returned `voice_id` in the database against the child
2. After a story is generated → backend calls `narrate_story()` with the story chapters and the stored `voice_id` → ElevenLabs produces MP3 audio in the parent's voice → backend stores the audio and gives the child access

This module does **not** handle HTTP routing, authentication, file uploads, database storage, or Supabase Storage — those belong to the backend team.

---

## Project Structure

```
ai_agents/story-agent/
  story_config.py        # All constants — now includes ElevenLabs model + output format
  generate_story.py      # Story text generation via Anthropic Claude (unchanged)
  generate_voice.py      # Voice cloning + TTS via ElevenLabs (new)
  test_generate_story.py # Existing tests (unchanged)
  test_generate_voice.py # New tests for generate_voice.py (to be written)
  .env                   # ANTHROPIC_API_KEY + ELEVENLABS_API_KEY
  CLAUDE.md              # AI engineer working guidelines
  voice-agent.md         # This file
```

---

## Function Contracts

### `clone_voice(audio_bytes, voice_name, mime_type) -> str`

**Purpose:** Upload an audio sample to ElevenLabs and create an instant voice clone.

**Input:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `audio_bytes` | `bytes` | Raw audio file content (backend reads upload into memory and passes directly) |
| `voice_name` | `str` | Label for the voice on ElevenLabs — backend passes the **parent's email** |
| `mime_type` | `str` | MIME type of the audio (e.g. `"audio/mpeg"`, `"audio/wav"`, `"audio/mp4"`) |

**Output:** `str` — the ElevenLabs `voice_id` for the cloned voice. Backend stores this in the database.

**Raises:** Any ElevenLabs API error — the backend catches and returns an appropriate HTTP error.

**Example:**
```python
voice_id = clone_voice(
    audio_bytes=b"...(mp3 bytes)...",
    voice_name="parent@example.com",
    mime_type="audio/mpeg",
)
# voice_id → "JBFqnCBsd6RMkjVDRDba"
```

---

### `narrate_story(chapters, voice_id) -> bytes`

**Purpose:** Convert a story's chapters to MP3 audio in the cloned parent voice.

**Input:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `chapters` | `list[str]` | Chapters from `generate_story()` output — i.e. `story["chapters"]` |
| `voice_id` | `str` | The ElevenLabs voice_id previously returned by `clone_voice()` |

**Output:** `bytes` — MP3 audio of the full story narrated in the parent's voice. Backend stores this in Supabase Storage and saves the public URL in the database.

**Chapter assembly (internal):** Chapters are joined as:
```
Chapter 1. {text}

Chapter 2. {text}

...
```
The narrator reads "Chapter 1." before each section, matching how a parent would read a storybook aloud.

**Raises:** Any ElevenLabs API error — the backend catches and returns an appropriate HTTP error.

**Example:**
```python
story = generate_story(parent_prompt="A girl who loves math finds a magic door")
audio_bytes = narrate_story(
    chapters=story["chapters"],
    voice_id="JBFqnCBsd6RMkjVDRDba",
)
# audio_bytes → b"\xff\xfb\x90\x00..."  (MP3 bytes, ready for Supabase Storage)
```

---

### `delete_voice(voice_id) -> None`

**Purpose:** Delete a cloned voice from ElevenLabs. Backend calls this before cloning a new voice for the same parent (to avoid accumulating unused voices on the ElevenLabs account quota).

**Input:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `voice_id` | `str` | The ElevenLabs voice_id to delete |

**Output:** `None`

**Raises:** Any ElevenLabs API error — the backend catches it.

**Example:**
```python
# Before re-cloning a parent's voice:
delete_voice("JBFqnCBsd6RMkjVDRDba")
new_voice_id = clone_voice(audio_bytes, voice_name, mime_type)
```

---

## Configuration (story_config.py additions)

```python
# str — ElevenLabs model used for TTS narration
ELEVENLABS_MODEL = "eleven_multilingual_v2"

# str — ElevenLabs output format: MP3 at 44.1kHz / 128kbps
TTS_OUTPUT_FORMAT = "mp3_44100_128"
```

---

## Environment Variables

Add to `ai_agents/story-agent/.env` (alongside existing `ANTHROPIC_API_KEY`):

```
ELEVENLABS_API_KEY=your_key_here
```

The backend must also have `ELEVENLABS_API_KEY` set in its environment when it imports `generate_voice`.

---

## Typical Call Chain (for backend reference)

```
# 1. When parent uploads voice recording (once per child):
voice_id = clone_voice(audio_bytes, parent_email, mime_type)
# → backend saves voice_id to children.voice_id in database

# 2. When parent generates a story (each time):
story    = generate_story(parent_prompt)
audio    = narrate_story(story["chapters"], voice_id)
# → backend uploads audio bytes to Supabase Storage
# → backend saves the public audio URL to stories.audio_url in database

# 3. When parent re-uploads a new voice:
delete_voice(old_voice_id)
new_voice_id = clone_voice(audio_bytes, parent_email, mime_type)
# → backend updates children.voice_id with the new voice_id
```

---

## Tell the Backend

The following are **not your responsibility** — but the backend team needs to implement them for the feature to work end-to-end:

### 1. Database changes

```sql
-- Add to children table: stores the ElevenLabs voice_id per child
ALTER TABLE public.children ADD COLUMN voice_id text;

-- Add to stories table: stores the public URL of the generated audio file
ALTER TABLE public.stories ADD COLUMN audio_url text;
```

### 2. Supabase Storage bucket

Create a public bucket called `story-audio` for storing generated MP3 files. Audio paths should follow the pattern: `{child_id}/{uuid}.mp3`

### 3. New backend endpoint — voice upload

```
POST /parent/children/{child_id}/voice-sample
Content-Type: multipart/form-data
Body: audio file

Steps:
1. Auth check (parent)
2. Ownership check (child belongs to this parent)
3. If children.voice_id already exists → call delete_voice(old_voice_id)
4. Read audio bytes from upload
5. Call clone_voice(audio_bytes, parent_email, mime_type)
6. Save returned voice_id to children.voice_id
7. Return { voice_id: str }
```

### 4. Updated story generate endpoint

```
POST /parent/children/{child_id}/stories/generate
(existing endpoint — add voice narration step)

After calling generate_story():
1. Fetch children.voice_id for this child
2. If voice_id exists:
   a. Call narrate_story(story["chapters"], voice_id)
   b. Upload returned bytes to Supabase Storage → get public URL
   c. Include audio_url in the response
3. If no voice_id: return story without audio_url (narration is optional)
```

### 5. Updated story save endpoint

```
POST /parent/children/{child_id}/stories
(existing endpoint — accept audio_url field)

Accept optional audio_url in request body.
Store it in stories.audio_url when saving.
```

### 6. Updated story response schema

`StoryResponse` and `StoryGenerateResponse` should include:
```
audio_url: str | None  # null when no voice has been uploaded for this child
```

### 7. Install the ElevenLabs Python package

```
elevenlabs>=1.0.0
```
Add to `backend/pyproject.toml` dependencies.

---

## Keep in Mind

- **Narration is optional** — if a child's parent has not uploaded a voice, `generate_story` still works and returns a story without audio. The feature degrades gracefully.
- **Voice clones count against ElevenLabs quota** — always call `delete_voice` before `clone_voice` when replacing a voice to avoid quota exhaustion.
- **`voice_id` is per child, not per parent** — a parent could theoretically upload different voices for different children (e.g. different recording quality per session). The database stores `voice_id` on the child row.
- **`voice_name` is the parent's email** — this makes voices identifiable on the ElevenLabs dashboard without storing any extra user data.
- **Audio format is always MP3** — `TTS_OUTPUT_FORMAT = "mp3_44100_128"` in `story_config.py`. The frontend audio player must support MP3 (all modern browsers do).
- **ElevenLabs accepts many input formats** — MP3, WAV, M4A, OGG, WebM. The backend should pass the actual MIME type from the HTTP upload; your function passes it through honestly.
- **`load_dotenv()` is called in `generate_voice.py`** — same pattern as `generate_story.py`. In production the backend injects `ELEVENLABS_API_KEY` via environment; `dotenv` is only for local development.
- **Do not log or print `ELEVENLABS_API_KEY`** — treat it like `ANTHROPIC_API_KEY`.

---

## Definition of Done

- [x] `story_config.py` updated with `ELEVENLABS_MODEL` and `TTS_OUTPUT_FORMAT`
- [x] `generate_voice.py` implemented with `clone_voice`, `narrate_story`, `delete_voice`
- [x] All functions follow the comment standard in `CLAUDE.md` (file header, function block, variable inline comments)
- [x] `test_generate_voice.py` written with mocked ElevenLabs client (no real API calls)
- [x] `TestCloneVoice` — happy path, file naming, voice name passthrough, API error
- [x] `TestNarrateStory` — happy path, chapter joining format, single chapter, voice_id passthrough, API error
- [x] `TestDeleteVoice` — happy path, returns None, API error
- [x] `.env` updated with `ELEVENLABS_API_KEY` placeholder
- [x] `voice-agent.md` kept up to date throughout
