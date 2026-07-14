"""Ingest knowledge-base documents — stores embedding in projects_data."""

from __future__ import annotations

from typing import Any, Dict


def ingest_solution(solution_record: Dict[str, Any]) -> Dict[str, Any]:
    """Persist embedding to projects_data (row_type='solution')."""
    doc_id = str(solution_record.get("id") or "")
    solution_text = str(solution_record.get("solution") or "").strip()

    if not doc_id or not solution_text:
        return {"id": doc_id, "solution": solution_text}

    try:
        from ai.embeddings import create_embedding
        from db import execute
        embedding = create_embedding(solution_text)
        execute(
            "UPDATE projects_data SET embedding = %s "
            "WHERE row_type = 'solution' AND id = %s",
            (embedding, doc_id),
        )
    except Exception:
        pass

    return {"id": doc_id, "solution": solution_text}


def delete_from_index(doc_id: str) -> None:
    """No-op — FAISS index is rebuilt from projects_data on demand."""
    pass
