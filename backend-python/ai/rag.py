"""Retrieval helpers — DSQL single-table retrieval."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from db import query

TABLE = "projects_data"


def retrieve_similar_solutions(
    query_text: str,
    k: int = 5,
    error_hash: Optional[str] = None,
    project_name: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Retrieve solutions from projects_data (row_type='solution'),
    ranked by usage_count and confidence_score."""
    if not query_text.strip():
        return []

    conditions = ["row_type = 'solution'"]
    params: List[Any] = []

    if error_hash:
        conditions.append("error_hash = %s")
        params.append(error_hash)
    if project_name:
        conditions.append("LOWER(project_name) = LOWER(%s)")
        params.append(project_name)

    where = " AND ".join(conditions)

    try:
        rows = query(
            f"SELECT id, solution, created_by, created_at, usage_count, "
            f"confidence_score, version, error_hash, project_name "
            f"FROM {TABLE} WHERE {where} "
            f"ORDER BY usage_count DESC, confidence_score DESC, created_at DESC "
            f"LIMIT %s",
            tuple(params + [k]),
        )
    except Exception:
        return []

    ranked = []
    for row in rows:
        updated_at = row.get("created_at")
        ranked.append({
            "id": row.get("id"),
            "solution": row.get("solution", ""),
            "similarity": 50.0,
            "usage_count": int(row.get("usage_count") or 0),
            "confidence": float(row.get("confidence_score") or 50.0),
            "version": int(row.get("version") or 1),
            "updated_at": (
                updated_at.isoformat()
                if hasattr(updated_at, "isoformat")
                else str(updated_at or "")
            ),
        })

    return ranked
