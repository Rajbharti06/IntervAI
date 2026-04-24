"""
Unified LLM client — all provider differences in one place.
Routes call call_llm() or stream_llm() and never touch HTTP directly.
"""
from __future__ import annotations
import json
import re
import requests
from typing import Generator

PROVIDER_CONFIGS: dict[str, dict] = {
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o-mini",
        "style": "openai",
    },
    "anthropic": {
        "base_url": "https://api.anthropic.com/v1",
        "default_model": "claude-sonnet-4-6",
        "style": "anthropic",
    },
    "google": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta",
        "default_model": "gemini-2.0-flash",
        "style": "google",
    },
    "perplexity": {
        "base_url": "https://api.perplexity.ai",
        "default_model": "sonar-pro",
        "style": "openai",
    },
    "grok": {
        "base_url": "https://api.groq.com/openai/v1",
        "default_model": "llama-3.3-70b-versatile",
        "style": "openai",
    },
    "together_ai": {
        "base_url": "https://api.together.xyz/v1",
        "default_model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        "style": "openai",
    },
    "nvidia": {
        "base_url": "https://integrate.api.nvidia.com/v1",
        "default_model": "meta/llama-3.3-70b-instruct",
        "style": "openai",
    },
}


def get_default_model(provider: str) -> str:
    return PROVIDER_CONFIGS.get(provider, PROVIDER_CONFIGS["openai"])["default_model"]


def call_llm(
    provider: str,
    api_key: str,
    model: str,
    messages: list[dict],
    max_tokens: int = 1024,
    timeout: int = 45,
) -> str:
    """Call any supported provider. Returns raw text string."""
    cfg = PROVIDER_CONFIGS.get(provider)
    if not cfg:
        raise ValueError(f"Unknown provider: {provider}")
    style = cfg["style"]
    if style == "openai":
        return _call_openai_compat(cfg["base_url"], api_key, model, messages, max_tokens, timeout)
    if style == "anthropic":
        return _call_anthropic(cfg["base_url"], api_key, model, messages, max_tokens, timeout)
    if style == "google":
        return _call_google(cfg["base_url"], api_key, model, messages, max_tokens, timeout)
    raise ValueError(f"Unknown provider style: {style}")


def stream_llm(
    provider: str,
    api_key: str,
    model: str,
    messages: list[dict],
    max_tokens: int = 1024,
) -> Generator[str, None, None]:
    """Yield text chunks as they stream from the provider."""
    cfg = PROVIDER_CONFIGS.get(provider)
    if not cfg:
        return
    style = cfg["style"]
    if style == "openai":
        yield from _stream_openai_compat(cfg["base_url"], api_key, model, messages, max_tokens)
    elif style == "anthropic":
        yield from _stream_anthropic(cfg["base_url"], api_key, model, messages, max_tokens)
    elif style == "google":
        yield from _stream_google(cfg["base_url"], api_key, model, messages, max_tokens)


def call_llm_json(
    provider: str,
    api_key: str,
    model: str,
    messages: list[dict],
    max_tokens: int = 512,
    timeout: int = 45,
) -> dict:
    """Call LLM and return parsed JSON dict. Never raises on parse error."""
    raw = call_llm(provider, api_key, model, messages, max_tokens, timeout)
    return _parse_json(raw)


# ─── OpenAI-compatible ────────────────────────────────────────────────────────

def _call_openai_compat(
    base_url: str, api_key: str, model: str,
    messages: list[dict], max_tokens: int, timeout: int,
) -> str:
    url = base_url.rstrip("/") + "/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {"model": model, "messages": messages, "max_tokens": max_tokens}
    resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _stream_openai_compat(
    base_url: str, api_key: str, model: str,
    messages: list[dict], max_tokens: int,
) -> Generator[str, None, None]:
    url = base_url.rstrip("/") + "/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {"model": model, "messages": messages, "max_tokens": max_tokens, "stream": True}
    with requests.post(url, headers=headers, json=payload, stream=True, timeout=60) as resp:
        resp.raise_for_status()
        for line in resp.iter_lines():
            if not line:
                continue
            decoded = line.decode("utf-8") if isinstance(line, bytes) else line
            if not decoded.startswith("data: "):
                continue
            data = decoded[6:]
            if data == "[DONE]":
                break
            try:
                chunk = json.loads(data)
                text = chunk["choices"][0].get("delta", {}).get("content", "")
                if text:
                    yield text
            except Exception:
                pass


# ─── Anthropic ────────────────────────────────────────────────────────────────

def _call_anthropic(
    base_url: str, api_key: str, model: str,
    messages: list[dict], max_tokens: int, timeout: int,
) -> str:
    system, filtered = _split_system(messages)
    url = base_url.rstrip("/") + "/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    payload: dict = {"model": model, "max_tokens": max_tokens, "messages": filtered}
    if system:
        payload["system"] = system
    resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
    resp.raise_for_status()
    parts = resp.json().get("content", [])
    return "".join(p.get("text", "") for p in parts if isinstance(p, dict))


def _stream_anthropic(
    base_url: str, api_key: str, model: str,
    messages: list[dict], max_tokens: int,
) -> Generator[str, None, None]:
    system, filtered = _split_system(messages)
    url = base_url.rstrip("/") + "/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    payload: dict = {
        "model": model, "max_tokens": max_tokens,
        "messages": filtered, "stream": True,
    }
    if system:
        payload["system"] = system
    with requests.post(url, headers=headers, json=payload, stream=True, timeout=60) as resp:
        resp.raise_for_status()
        for line in resp.iter_lines():
            if not line:
                continue
            decoded = line.decode("utf-8") if isinstance(line, bytes) else line
            if not decoded.startswith("data: "):
                continue
            try:
                ev = json.loads(decoded[6:])
                if ev.get("type") == "content_block_delta":
                    text = ev.get("delta", {}).get("text", "")
                    if text:
                        yield text
            except Exception:
                pass


# ─── Google Gemini ────────────────────────────────────────────────────────────

def _call_google(
    base_url: str, api_key: str, model: str,
    messages: list[dict], max_tokens: int, timeout: int,
) -> str:
    url = base_url.rstrip("/") + f"/models/{model}:generateContent"
    contents = _messages_to_google(messages)
    payload = {
        "contents": contents,
        "generationConfig": {"maxOutputTokens": max_tokens},
    }
    resp = requests.post(
        url, headers={"Content-Type": "application/json"},
        params={"key": api_key}, json=payload, timeout=timeout,
    )
    resp.raise_for_status()
    candidates = resp.json().get("candidates", [])
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts if "text" in p)


def _stream_google(
    base_url: str, api_key: str, model: str,
    messages: list[dict], max_tokens: int,
) -> Generator[str, None, None]:
    url = base_url.rstrip("/") + f"/models/{model}:streamGenerateContent"
    contents = _messages_to_google(messages)
    payload = {
        "contents": contents,
        "generationConfig": {"maxOutputTokens": max_tokens},
    }
    with requests.post(
        url, headers={"Content-Type": "application/json"},
        params={"key": api_key, "alt": "sse"},
        json=payload, stream=True, timeout=60,
    ) as resp:
        resp.raise_for_status()
        for line in resp.iter_lines():
            if not line:
                continue
            decoded = line.decode("utf-8") if isinstance(line, bytes) else line
            if not decoded.startswith("data: "):
                continue
            try:
                chunk = json.loads(decoded[6:])
                for cand in chunk.get("candidates", []):
                    for p in cand.get("content", {}).get("parts", []):
                        text = p.get("text", "")
                        if text:
                            yield text
            except Exception:
                pass


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _split_system(messages: list[dict]) -> tuple[str | None, list[dict]]:
    """Separate system message from the rest (for Anthropic)."""
    system = None
    filtered = []
    for m in messages:
        if m.get("role") == "system":
            system = m["content"]
        else:
            filtered.append(m)
    return system, filtered


def _messages_to_google(messages: list[dict]) -> list[dict]:
    """Convert OpenAI-style messages to Google Gemini format."""
    result = []
    for m in messages:
        role = "user" if m.get("role") in ("user", "system") else "model"
        result.append({"role": role, "parts": [{"text": m["content"]}]})
    return result


def _parse_json(raw: str) -> dict:
    """Parse JSON from raw LLM output, tolerating markdown fences."""
    cleaned = (raw or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    try:
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if m:
            return json.loads(m.group())
    except Exception:
        pass
    return {}
