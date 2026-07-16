"""
summarizer.py — Lightweight rule-based complaint summarizer.

For the hackathon MVP we don't need a heavy abstractive summarization model.
This module normalizes a raw complaint into a short, clean, third-person
summary sentence by:
  1. Stripping filler/first-person phrasing ("I want to report that...",
     "There has been...", "Please note that...")
  2. Trimming to a single concise sentence
  3. Ensuring proper capitalization and punctuation

This keeps the AI service fast and dependency-free. If you later want a
model-based abstractive summary, swap `rule_based_summary()` for a call to
a transformer summarization pipeline (e.g. Hugging Face `distilbart-cnn`)
using the same function signature.
"""

import re

FILLER_PATTERNS = [
    r"^\s*i (want to|would like to|wish to)?\s*(report|inform you)?\s*that\s+",
    r"^\s*there (has been|have been|is|are)\s+",
    r"^\s*please note that\s+",
    r"^\s*this is to (inform|report) that\s+",
    r"^\s*i am writing to (report|inform|complain about)\s+",
    r"^\s*complaint\s*[:\-]\s*",
]


def _strip_fillers(text: str) -> str:
    cleaned = text.strip()
    for pattern in FILLER_PATTERNS:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def _first_sentence(text: str) -> str:
    # Split on sentence-ending punctuation, keep the first sentence.
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return parts[0] if parts else text.strip()


def _capitalize(text: str) -> str:
    if not text:
        return text
    text = text[0].upper() + text[1:]
    if not text.endswith((".", "!", "?")):
        text += "."
    return text


def rule_based_summary(complaint_text: str, max_words: int = 20) -> str:
    """
    Produce a short, clean summary of a civic complaint.

    Example:
        Input:  "There has been no garbage collection for two weeks in Sector 8."
        Output: "Garbage collection has been delayed for two weeks in Sector 8."
        (In this lightweight version we normalize phrasing rather than
        performing deep semantic rewriting.)
    """
    text = _strip_fillers(complaint_text)
    text = _first_sentence(text)

    words = text.split()
    if len(words) > max_words:
        text = " ".join(words[:max_words])

    return _capitalize(text)


if __name__ == "__main__":
    samples = [
        "There has been no water supply in my locality for three days.",
        "I want to report that streetlights near my house are not working.",
        "Transformer exploded and wires are sparking.",
    ]
    for s in samples:
        print(f"IN : {s}")
        print(f"OUT: {rule_based_summary(s)}\n")
