"""Amazon Bedrock Titan embeddings wrapper with graceful fallback."""

from __future__ import annotations

from typing import List

try:
    from ai.bedrock_embeddings import cosine_similarity, create_embedding
except Exception as exc:  # pragma: no cover - import safety
    def create_embedding(text: str) -> List[float]:
        raise RuntimeError(
            f"Embedding module import failed — component=ai.embeddings error={type(exc).__name__}: {exc}"
        ) from exc

    def cosine_similarity(a: List[float], b: List[float]) -> float:
        return 0.0

EMBEDDING_DIM = 1024

__all__ = ["create_embedding", "cosine_similarity", "EMBEDDING_DIM"]
