"""Amazon Bedrock Titan embeddings wrapper."""

from __future__ import annotations

import json
import logging
import os
from typing import List, Optional

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


def _get_embedding_model_id() -> str:
    return os.getenv("BEDROCK_EMBEDDING_MODEL_ID") or os.getenv("BEDROCK_TITAN_MODEL_ID") or "amazon.titan-embed-text-v2:0"


def _get_embedding_dimensions() -> int:
    value = os.getenv("BEDROCK_EMBEDDING_DIMENSIONS", "1024")
    try:
        return int(value)
    except (TypeError, ValueError):
        return 1024


def _get_runtime_client():
    if boto3 is None:
        raise RuntimeError(f"boto3 import failed: {_BOTO3_IMPORT_ERROR}")
    return boto3.client("bedrock-runtime", region_name=_get_bedrock_region())


def create_embedding(text: str) -> List[float]:
    """Create a Titan embedding for the supplied text."""
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Text must be a non-empty string")

    try:
        client = _get_runtime_client()
        dimensions = _get_embedding_dimensions()
        body = json.dumps({
            "inputText": text.strip(),
            "dimensions": dimensions,
            "normalize": True,
        })
        response = client.invoke_model(modelId=_get_embedding_model_id(), body=body)
        payload = json.loads(response.get("body").read().decode("utf-8"))
        embedding = payload.get("embedding") or []
        if not isinstance(embedding, list) or not embedding:
            raise ValueError("Empty embedding returned")
        normalized = [float(v) for v in embedding]
        if len(normalized) != dimensions:
            raise ValueError(
                f"Bedrock embedding dimension mismatch — expected {dimensions}, got {len(normalized)}"
            )
        return normalized
    except Exception as exc:
        logger.exception("Bedrock embedding failed — component=bedrock_embeddings operation=invoke_model")
        raise RuntimeError(
            f"Bedrock embedding failed — component=bedrock_embeddings operation=invoke_model error={type(exc).__name__}: {exc}"
        ) from exc


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Return cosine similarity between two vectors."""
    import math

    if not a or not b:
        return 0.0
    dot = sum(float(x) * float(y) for x, y in zip(a, b))
    norm_a = math.sqrt(sum(float(x) * float(x) for x in a))
    norm_b = math.sqrt(sum(float(y) * float(y) for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)
