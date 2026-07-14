"""Knowledge base helpers for solution versioning, metrics, and FAISS updates."""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional, Tuple

from ai.embeddings import create_embedding
from ai.faiss_index import get_faiss_index
from db import execute, execute_returning, query


def calculate_confidence(usage_count: int) -> float:
    return round(min(100.0, 50.0 + float(usage_count) * 2.0), 2)


TABLE = "projects_data"


def _get_log_row(error_hash: str, project_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Find the log row matching an error_hash."""
    conditions = ["row_type = 'log'", "(error_hash = %s OR MD5(LOWER(TRIM(error))) = %s)"]
    params: List[Any] = [error_hash, error_hash]
    if project_name:
        conditions.insert(0, "LOWER(project_name) = LOWER(%s)")
        params.insert(0, project_name)
    rows = query(
        f"SELECT id, project_name, error_hash FROM {TABLE} "
        f"WHERE {' AND '.join(conditions)} ORDER BY timestamp DESC LIMIT 1",
        tuple(params),
    )
    return rows[0] if rows else None


def _find_solution(solution_id: str) -> Optional[Dict[str, Any]]:
    """Find a solution row by id."""
    rows = query(
        f"SELECT * FROM {TABLE} WHERE row_type = 'solution' AND id = %s",
        (solution_id,),
    )
    return rows[0] if rows else None


def insert_solution(
    error_hash: str,
    solution: str,
    created_by: str = 'developer',
    project_name: Optional[str] = None,
    base_solution_id: Optional[str] = None,
) -> Dict[str, Any]:
    log_row = _get_log_row(error_hash, project_name)
    if not log_row:
        raise ValueError('No matching log row found')

    log_ref_id = log_row['id']
    version_rows = query(
        f"SELECT MAX(version) AS max_version FROM {TABLE} "
        f"WHERE row_type = 'solution' AND log_ref_id = %s",
        (log_ref_id,),
    )
    version = int(version_rows[0]['max_version'] or 0) + 1
    usage_count = 1
    confidence_score = calculate_confidence(usage_count)

    embedding = None
    try:
        embedding = create_embedding(solution)
    except Exception:
        pass

    row = execute_returning(
        f"INSERT INTO {TABLE} "
        f"(id, row_type, project_name, error_hash, log_ref_id, solution, created_by, "
        f"created_at, usage_count, version, confidence_score, embedding) "
        f"VALUES (%s,'solution',%s,%s,%s,%s,%s,NOW(),%s,%s,%s,%s) "
        f"RETURNING *",
        (
            str(uuid.uuid4()),
            log_row['project_name'],
            error_hash,
            log_ref_id,
            solution,
            created_by,
            usage_count,
            version,
            confidence_score,
            embedding,
        ),
    )

    if row and embedding is not None:
        try:
            get_faiss_index().add(row['id'], embedding)
        except Exception:
            pass

    return row


def increment_usage(solution_id: str) -> Dict[str, Any]:
    existing = _find_solution(solution_id)
    if not existing:
        raise ValueError('Solution not found')

    usage_count = int(existing.get('usage_count') or 0) + 1
    confidence_score = calculate_confidence(usage_count)

    row = execute_returning(
        f"UPDATE {TABLE} SET usage_count = %s, confidence_score = %s "
        f"WHERE row_type = 'solution' AND id = %s RETURNING *",
        (usage_count, confidence_score, solution_id),
    )
    if not row:
        raise ValueError('Solution not found')
    return row


def delete_solution_version(solution_id: str) -> int:
    count = execute(
        f"DELETE FROM {TABLE} WHERE row_type = 'solution' AND id = %s",
        (solution_id,),
    )
    if count > 0:
        try:
            get_faiss_index().remove(solution_id)
        except Exception:
            pass
    return count


def get_top_solutions(
    error_hash: str,
    project_name: Optional[str] = None,
    limit: int = 5,
    offset: int = 0,
) -> Tuple[List[Dict[str, Any]], int]:
    conditions = [
        "row_type = 'solution'",
        "(error_hash = %s OR error_hash IN ("
        f"  SELECT error_hash FROM {TABLE} WHERE row_type = 'log' "
        f"  AND MD5(LOWER(TRIM(error))) = %s))",
    ]
    params: List[Any] = [error_hash, error_hash]
    if project_name:
        conditions.append("LOWER(project_name) = LOWER(%s)")
        params.append(project_name)

    where = " AND ".join(conditions)
    rows = query(
        f"SELECT id, solution, created_by, created_at, usage_count, "
        f"confidence_score, version, log_ref_id "
        f"FROM {TABLE} WHERE {where} "
        f"ORDER BY confidence_score DESC, usage_count DESC, created_at DESC "
        f"LIMIT %s OFFSET %s",
        tuple(params + [limit, offset]),
    )
    total_rows = query(
        f"SELECT COUNT(*) AS total FROM {TABLE} WHERE {where}",
        tuple(params),
    )
    total = int(total_rows[0]['total']) if total_rows else 0
    return rows, total


def get_solution_versions(solution_id: str) -> List[Dict[str, Any]]:
    row = _find_solution(solution_id)
    if not row:
        return []
    versions = query(
        f"SELECT id, solution, created_by, created_at, usage_count, confidence_score, version "
        f"FROM {TABLE} WHERE row_type = 'solution' AND log_ref_id = %s "
        f"ORDER BY version DESC",
        (row['log_ref_id'],),
    )
    return versions


def get_solution_by_id(solution_id: str) -> Optional[Dict[str, Any]]:
    return _find_solution(solution_id)
