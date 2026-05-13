# generate_voice.py
"""
Uses the ElevenLabs API to clone a parent's voice from an audio sample and to
narrate generated stories in that cloned voice. This module owns voice cloning,
text-to-speech, and voice deletion. It does not handle HTTP routing, auth,
database storage, or file uploads — those belong to the backend team.

The backend team imports clone_voice(), narrate_story(), and delete_voice() and
calls them from their server-side routes after verifying the parent session.
"""

import io
import os

from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from story_config import ELEVENLABS_MODEL, TTS_OUTPUT_FORMAT

load_dotenv()


def clone_voice(audio_bytes: bytes, voice_name: str, mime_type: str) -> str:
    """
    What it does:
        Uploads an audio sample to ElevenLabs and creates an instant voice clone.
        Returns the voice_id that identifies the clone and can be reused for TTS.
        Raises on any ElevenLabs API failure — the caller handles HTTP errors.

    Returns:
        str — the ElevenLabs voice_id for the newly cloned voice

    Example input:
        audio_bytes = b"...(mp3 bytes)..."
        voice_name  = "parent@example.com"
        mime_type   = "audio/mpeg"

    Example output:
        "JBFqnCBsd6RMkjVDRDba"
    """
    # ElevenLabs — reads ELEVENLABS_API_KEY from environment; never pass key explicitly
    client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

    # IO[bytes] — wrap raw bytes in a named file-like object so the SDK knows
    # the filename and MIME type when building the multipart upload request
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = f"voice_sample.{mime_type.split('/')[-1]}"

    # Voice — the ElevenLabs response object; .voice_id is the stable identifier
    # used in all future TTS and delete calls for this parent
    voice = client.voices.add(
        name=voice_name,
        files=[audio_file],
        description="Parent voice for MathQuest story narration",
    )

    # str — stable voice identifier stored by the backend in children.voice_id
    return voice.voice_id


def narrate_story(chapters: list, voice_id: str) -> bytes:
    """
    What it does:
        Converts a story's chapters to MP3 audio in the cloned parent voice.
        Joins chapters as "Chapter 1. {text}" labels so the narrator reads the
        chapter number before each section, matching how a parent reads aloud.
        Raises on any ElevenLabs API failure — the caller handles HTTP errors.

    Returns:
        bytes — MP3 audio data of the full narrated story, ready for storage

    Example input:
        chapters = ["Mira walked up the hill.", "She found a glowing door."]
        voice_id = "JBFqnCBsd6RMkjVDRDba"

    Example output:
        b"\\xff\\xfb\\x90\\x00..."  (MP3 bytes)
    """
    # ElevenLabs — reads ELEVENLABS_API_KEY from environment; never pass key explicitly
    client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

    # list[str] — each chapter prefixed with its number, e.g. "Chapter 1. Mira walked..."
    labelled = [f"Chapter {i + 1}. {text}" for i, text in enumerate(chapters)]

    # str — full story text with chapters separated by blank lines for natural pacing
    story_text = "\n\n".join(labelled)

    # Iterator[bytes] — ElevenLabs streams audio in chunks to reduce latency
    audio_stream = client.text_to_speech.convert(
        voice_id=voice_id,
        text=story_text,
        model_id=ELEVENLABS_MODEL,
        output_format=TTS_OUTPUT_FORMAT,
    )

    # bytes — join all streamed chunks into one MP3 blob for the backend to store
    return b"".join(audio_stream)


def delete_voice(voice_id: str) -> None:
    """
    What it does:
        Deletes a cloned voice from ElevenLabs by its voice_id.
        The backend calls this before cloning a new voice for the same parent
        to avoid accumulating unused voices against the ElevenLabs account quota.
        Raises on any ElevenLabs API failure — the caller handles HTTP errors.

    Returns:
        None

    Example input:
        voice_id = "JBFqnCBsd6RMkjVDRDba"

    Example output:
        None  (raises if the voice_id does not exist or the request fails)
    """
    # ElevenLabs — reads ELEVENLABS_API_KEY from environment; never pass key explicitly
    client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

    # None — deletes the voice; raises an ElevenLabs API error if voice_id is invalid
    client.voices.delete(voice_id)
