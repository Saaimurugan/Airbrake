"""Amazon Bedrock Nova Lite wrapper with graceful fallback."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, List, Optional

try:
    import boto3
except Exception as exc:  # pragma: no cover - optional dependency
    boto3 = None  # type: ignore
    _BOTO3_IMPORT_ERROR = exc
else:
    _BOTO3_IMPORT_ERROR = None

logger = logging.getLogger(__name__)


def _get_bedrock_region() -> str:
    return os.getenv("BEDROCK_REGION") or os.getenv("AWS_REGION") or "us-east-1"


def _get_nova_model_id() -> str:
    return os.getenv("BEDROCK_NOVA_MODEL_ID") or os.getenv("BEDROCK_MODEL_ID") or "amazon.nova-lite-v1:0"


def _get_runtime_client():
    if boto3 is None:
        raise RuntimeError(f"boto3 import failed: {_BOTO3_IMPORT_ERROR}")
    return boto3.client("bedrock-runtime", region_name=_get_bedrock_region())


def _call_nova(prompt: str, max_tokens: int = 256) -> Optional[str]:
    try:
        client = _get_runtime_client()
        body = json.dumps({
            "messages": [{"role": "user", "content": [{"text": prompt}]}],
            "maxTokens": max_tokens,
            "temperature": 0.0,
        })
        response = client.invoke_model(modelId=_get_nova_model_id(), body=body)
        payload = json.loads(response.get("body").read().decode("utf-8"))
        output = payload.get("output", {})
        message = output.get("message", {})
        content = message.get("content") or []
        if content and isinstance(content, list):
            text = "".join(part.get("text", "") for part in content if isinstance(part, dict))
            return text.strip() or None
        return None
    except Exception as exc:
        logger.exception("Bedrock Nova failed — component=bedrock_llm operation=invoke_model")
        return None


def generate_ai_response(prompt: str, context: Optional[Any] = None, max_tokens: int = 256) -> str:
    if not isinstance(prompt, str) or not prompt.strip():
        return _fallback_summary(context)
    result = _call_nova(prompt, max_tokens=max_tokens)
    return result or _fallback_summary(context)


def generate_suggested_solution(prompt: str, context: Optional[Any] = None) -> str:
    if not isinstance(prompt, str) or not prompt.strip():
        return _fallback_summary(context)
    if isinstance(context, list):
        prompt = _build_recommendation_prompt(prompt, context)
    return generate_ai_response(prompt, context)


def _fallback_summary(context: Any) -> str:
    if isinstance(context, list) and context:
        first = context[0]
        if isinstance(first, dict):
            sol = first.get("solution") or ""
            usage = first.get("usage_count") or 0
            ver = first.get("version") or 1
            if sol:
                return f'Consider: "{sol}". Used {usage} time(s), v{ver}.'
    return "No similar solution was found."


def _build_recommendation_prompt(error_prompt: str, solutions: List[Any]) -> str:
    solutions_text = "; ".join(
        f'"{s.get("solution", "")}" (used {s.get("usage_count", 0)} times, v{s.get("version", 1)})'
        for s in solutions[:5] if s.get("solution")
    )
    return (
        "Given these similar solutions from the knowledge base, write a SHORT 1-2 sentence "
        "recommendation for the developer. "
        f"Error: {error_prompt}. "
        f"Solutions: {solutions_text}. "
        "Be concise and mention the most relevant solution."
    )
