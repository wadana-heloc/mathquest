# test_generate_voice.py
"""
Unit tests for generate_voice.py.
No real API calls are made — all ElevenLabs client calls are mocked.
Tests verify our own logic: file naming, chapter joining, output shape,
and error propagation. They do not test whether ElevenLabs works.
"""

import pytest
from unittest.mock import MagicMock, patch, call
from generate_voice import clone_voice, narrate_story, delete_voice


class TestCloneVoice:
    """
    Tests for clone_voice().
    Covers: happy path, file name derived from mime_type, API error propagation.
    """

    @patch("generate_voice.ElevenLabs")
    def test_returns_voice_id(self, mock_elevenlabs_class):
        # MagicMock — fake ElevenLabs client instance
        mock_client = MagicMock()
        mock_elevenlabs_class.return_value = mock_client

        # MagicMock — fake Voice object returned by voices.add()
        mock_voice = MagicMock()
        mock_voice.voice_id = "JBFqnCBsd6RMkjVDRDba"
        mock_client.voices.add.return_value = mock_voice

        # str — result from clone_voice with a minimal audio sample
        result = clone_voice(b"fake_audio", "parent@example.com", "audio/mpeg")

        assert result == "JBFqnCBsd6RMkjVDRDba"

    @patch("generate_voice.ElevenLabs")
    def test_file_name_derived_from_mime_type(self, mock_elevenlabs_class):
        # MagicMock — fake client; we inspect what was passed to voices.add()
        mock_client = MagicMock()
        mock_elevenlabs_class.return_value = mock_client
        mock_client.voices.add.return_value = MagicMock(voice_id="abc123")

        # str — call with a WAV mime type; file name should end in .wav
        clone_voice(b"fake_audio", "parent@example.com", "audio/wav")

        # dict — keyword arguments passed to voices.add()
        _, kwargs = mock_client.voices.add.call_args
        # IO[bytes] — the file object passed in the files list
        file_obj = kwargs["files"][0]
        assert file_obj.name == "voice_sample.wav"

    @patch("generate_voice.ElevenLabs")
    def test_passes_voice_name_to_api(self, mock_elevenlabs_class):
        # MagicMock — fake client; we verify voice_name is passed through correctly
        mock_client = MagicMock()
        mock_elevenlabs_class.return_value = mock_client
        mock_client.voices.add.return_value = MagicMock(voice_id="abc123")

        clone_voice(b"fake_audio", "sara@example.com", "audio/mpeg")

        # dict — keyword arguments passed to voices.add()
        _, kwargs = mock_client.voices.add.call_args
        assert kwargs["name"] == "sara@example.com"

    @patch("generate_voice.ElevenLabs")
    def test_raises_on_api_error(self, mock_elevenlabs_class):
        # MagicMock — fake client that raises on voices.add()
        mock_client = MagicMock()
        mock_elevenlabs_class.return_value = mock_client
        mock_client.voices.add.side_effect = Exception("ElevenLabs API error")

        with pytest.raises(Exception, match="ElevenLabs API error"):
            clone_voice(b"fake_audio", "parent@example.com", "audio/mpeg")


class TestNarrateStory:
    """
    Tests for narrate_story().
    Covers: happy path, chapter joining format, single chapter, API error propagation.
    """

    def _make_mock_client(self, audio_chunks: list) -> MagicMock:
        """
        What it does:
            Builds a mock ElevenLabs client whose text_to_speech.convert()
            returns the given list of byte chunks as a generator.

        Returns:
            MagicMock — fake client configured with the given audio chunks

        Example input:
            audio_chunks = [b"chunk1", b"chunk2"]

        Example output:
            MagicMock with .text_to_speech.convert returning iter([b"chunk1", b"chunk2"])
        """
        # MagicMock — fake client instance
        mock_client = MagicMock()
        mock_client.text_to_speech.convert.return_value = iter(audio_chunks)
        return mock_client

    @patch("generate_voice.ElevenLabs")
    def test_returns_joined_audio_bytes(self, mock_elevenlabs_class):
        # MagicMock — fake client returning two audio chunks
        mock_client = self._make_mock_client([b"chunk1", b"chunk2"])
        mock_elevenlabs_class.return_value = mock_client

        # bytes — result from narrate_story; should be both chunks joined
        result = narrate_story(["Chapter text here."], "voice123")

        assert result == b"chunk1chunk2"

    @patch("generate_voice.ElevenLabs")
    def test_chapters_joined_with_labels_and_blank_lines(self, mock_elevenlabs_class):
        # MagicMock — fake client; we inspect the text passed to convert()
        mock_client = self._make_mock_client([b"audio"])
        mock_elevenlabs_class.return_value = mock_client

        narrate_story(["First chapter.", "Second chapter."], "voice123")

        # dict — keyword arguments passed to text_to_speech.convert()
        _, kwargs = mock_client.text_to_speech.convert.call_args
        # str — the assembled story text sent to ElevenLabs
        text = kwargs["text"]

        assert text == "Chapter 1. First chapter.\n\nChapter 2. Second chapter."

    @patch("generate_voice.ElevenLabs")
    def test_single_chapter_has_label(self, mock_elevenlabs_class):
        # MagicMock — fake client; verify single chapter still gets a label
        mock_client = self._make_mock_client([b"audio"])
        mock_elevenlabs_class.return_value = mock_client

        narrate_story(["Only one chapter."], "voice123")

        # dict — keyword arguments passed to text_to_speech.convert()
        _, kwargs = mock_client.text_to_speech.convert.call_args
        assert kwargs["text"] == "Chapter 1. Only one chapter."

    @patch("generate_voice.ElevenLabs")
    def test_passes_voice_id_to_api(self, mock_elevenlabs_class):
        # MagicMock — fake client; verify voice_id is forwarded correctly
        mock_client = self._make_mock_client([b"audio"])
        mock_elevenlabs_class.return_value = mock_client

        narrate_story(["Some text."], "my-voice-id-abc")

        # dict — keyword arguments passed to text_to_speech.convert()
        _, kwargs = mock_client.text_to_speech.convert.call_args
        assert kwargs["voice_id"] == "my-voice-id-abc"

    @patch("generate_voice.ElevenLabs")
    def test_raises_on_api_error(self, mock_elevenlabs_class):
        # MagicMock — fake client that raises on text_to_speech.convert()
        mock_client = MagicMock()
        mock_elevenlabs_class.return_value = mock_client
        mock_client.text_to_speech.convert.side_effect = Exception("TTS failed")

        with pytest.raises(Exception, match="TTS failed"):
            narrate_story(["Some text."], "voice123")


class TestDeleteVoice:
    """
    Tests for delete_voice().
    Covers: happy path (correct voice_id passed to API), API error propagation.
    """

    @patch("generate_voice.ElevenLabs")
    def test_calls_delete_with_correct_voice_id(self, mock_elevenlabs_class):
        # MagicMock — fake client; we verify delete is called with the right id
        mock_client = MagicMock()
        mock_elevenlabs_class.return_value = mock_client

        delete_voice("JBFqnCBsd6RMkjVDRDba")

        mock_client.voices.delete.assert_called_once_with("JBFqnCBsd6RMkjVDRDba")

    @patch("generate_voice.ElevenLabs")
    def test_returns_none(self, mock_elevenlabs_class):
        # MagicMock — fake client; delete_voice should return None on success
        mock_client = MagicMock()
        mock_elevenlabs_class.return_value = mock_client

        # None — return value must be None
        result = delete_voice("some-voice-id")

        assert result is None

    @patch("generate_voice.ElevenLabs")
    def test_raises_on_api_error(self, mock_elevenlabs_class):
        # MagicMock — fake client that raises on voices.delete()
        mock_client = MagicMock()
        mock_elevenlabs_class.return_value = mock_client
        mock_client.voices.delete.side_effect = Exception("Voice not found")

        with pytest.raises(Exception, match="Voice not found"):
            delete_voice("invalid-voice-id")
