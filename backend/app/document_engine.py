"""
Document Engine — extract text from PDF, DOCX, and TXT files.

Used when candidates upload study notes, resumes, job descriptions,
or any reference material. The extracted text feeds into the soul engine
to generate highly relevant, context-aware questions.
"""

from __future__ import annotations
import io
import re


def extract_text(filename: str, raw_bytes: bytes) -> str:
    """Route to the right parser based on file extension."""
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return _extract_pdf(raw_bytes)
    if name.endswith(".docx"):
        return _extract_docx(raw_bytes)
    if name.endswith(".txt") or name.endswith(".md"):
        return _extract_txt(raw_bytes)
    # Fallback: treat as plain text
    try:
        return raw_bytes.decode("utf-8", errors="replace").strip()
    except Exception:
        return ""


def _extract_pdf(data: bytes) -> str:
    try:
        import pypdf  # pypdf is the maintained fork of PyPDF2
        reader = pypdf.PdfReader(io.BytesIO(data))
        pages = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                pages.append(t.strip())
        return "\n\n".join(pages)
    except ImportError:
        pass
    # Fallback: try PyPDF2
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(data))
        pages = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                pages.append(t.strip())
        return "\n\n".join(pages)
    except Exception as e:
        return f"[PDF extraction failed: {e}]"


def _extract_docx(data: bytes) -> str:
    try:
        import docx
        doc = docx.Document(io.BytesIO(data))
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs)
    except ImportError:
        return "[DOCX extraction requires python-docx. Install it with: pip install python-docx]"
    except Exception as e:
        return f"[DOCX extraction failed: {e}]"


def _extract_txt(data: bytes) -> str:
    for enc in ("utf-8", "utf-16", "latin-1"):
        try:
            return data.decode(enc).strip()
        except Exception:
            continue
    return data.decode("utf-8", errors="replace").strip()


def summarize_document(text: str, max_chars: int = 3000) -> str:
    """
    Return the most informative portion of a document.
    Tries to keep the beginning (usually title/intro) + important middle sections.
    """
    if not text:
        return ""
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    if len(text) <= max_chars:
        return text
    # Take first 60% + last 40%
    cut1 = int(max_chars * 0.6)
    cut2 = max_chars - cut1
    return text[:cut1] + "\n\n...[content trimmed]...\n\n" + text[-cut2:]


def extract_key_topics(text: str) -> list[str]:
    """
    Heuristic: extract likely topic keywords from the document.
    These are used to tag questions so the soul engine knows what was covered.
    """
    # Simple frequency-based noun extraction via regex
    words = re.findall(r'\b[A-Z][a-z]{3,}\b|\b[A-Z]{2,}\b', text)
    freq: dict[str, int] = {}
    for w in words:
        freq[w] = freq.get(w, 0) + 1
    # Return top 10 by frequency, minimum count 2
    topics = sorted([w for w, c in freq.items() if c >= 2], key=lambda w: -freq[w])
    return topics[:10]
