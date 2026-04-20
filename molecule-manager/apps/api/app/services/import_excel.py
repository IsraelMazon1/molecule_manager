"""Spreadsheet import service — parse Excel/CSV files and bulk-create molecules."""

from __future__ import annotations

import io
import uuid
from datetime import date, datetime

import pandas as pd
from rapidfuzz import fuzz
from sqlalchemy.orm import Session

from app.models.molecule import Molecule
from app.services.chemistry import InvalidSMILESError, process_smiles

MAX_ROWS = 1000
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

# Our target schema fields and common aliases for fuzzy matching.
FIELD_ALIASES: dict[str, list[str]] = {
    "name": ["name", "compound name", "molecule name", "title", "compound", "molecule"],
    "smiles": ["smiles", "smiles string", "structure", "canonical smiles", "smi"],
    "method_used": ["method", "method used", "synthesis method", "route", "method_used"],
    "date_created": ["date", "date created", "date synthesized", "created", "date_created", "synthesis date"],
    "notes": ["notes", "comments", "description", "remark", "remarks"],
}

FUZZY_THRESHOLD = 70


def _suggest_mapping(columns: list[str]) -> dict[str, str | None]:
    """Use fuzzy matching to suggest a mapping from our fields to spreadsheet columns."""
    mapping: dict[str, str | None] = {}
    used_columns: set[str] = set()

    for field, aliases in FIELD_ALIASES.items():
        best_score = 0
        best_col: str | None = None

        for col in columns:
            if col in used_columns:
                continue
            col_lower = col.strip().lower()
            for alias in aliases:
                score = fuzz.WRatio(col_lower, alias)
                if score > best_score:
                    best_score = score
                    best_col = col

        if best_score >= FUZZY_THRESHOLD and best_col is not None:
            mapping[field] = best_col
            used_columns.add(best_col)
        else:
            mapping[field] = None

    return mapping


def parse_spreadsheet(file_bytes: bytes, filename: str) -> dict:
    """Parse an Excel or CSV file and return columns, rows, and a suggested mapping.

    Raises ValueError if the file is too large, has too many rows, or cannot be parsed.
    """
    if len(file_bytes) > MAX_FILE_SIZE:
        raise ValueError(f"File exceeds the 5 MB size limit ({len(file_bytes) / 1024 / 1024:.1f} MB)")

    lower = filename.lower()
    try:
        if lower.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes), nrows=MAX_ROWS)
        elif lower.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(file_bytes), nrows=MAX_ROWS, engine="openpyxl")
        else:
            raise ValueError("Unsupported file format. Please upload .xlsx, .xls, or .csv")
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(f"Could not parse file: {exc}")

    if len(df) == 0:
        raise ValueError("File contains no data rows")

    if len(df) > MAX_ROWS:
        raise ValueError(f"File contains more than {MAX_ROWS} rows. Please split your data.")

    columns = [str(c) for c in df.columns.tolist()]
    # Replace NaN with None for JSON serialization
    rows = df.where(df.notnull(), None).to_dict(orient="records")
    # Convert any non-serializable types to strings
    for row in rows:
        for k, v in row.items():
            if isinstance(v, (datetime, date)):
                row[k] = v.isoformat() if hasattr(v, "isoformat") else str(v)
            elif v is not None and not isinstance(v, (str, int, float, bool)):
                row[k] = str(v)

    suggested_mapping = _suggest_mapping(columns)

    return {
        "columns": columns,
        "rows": rows,
        "suggested_mapping": suggested_mapping,
        "total_rows": len(rows),
    }


def bulk_import_molecules(
    db: Session,
    *,
    lab_id: uuid.UUID,
    user_id: uuid.UUID,
    rows: list[dict],
    mapping: dict[str, str | None],
) -> dict:
    """Create molecules from spreadsheet rows using the provided column mapping.

    Returns { "imported": int, "failed": [{ "row": int, "error": str }] }.
    All valid molecules are committed in a single transaction.
    """
    smiles_col = mapping.get("smiles")
    if not smiles_col:
        raise ValueError("SMILES column mapping is required")

    name_col = mapping.get("name")
    method_col = mapping.get("method_used")
    date_col = mapping.get("date_created")
    notes_col = mapping.get("notes")

    today = date.today()
    created: list[Molecule] = []
    failed: list[dict] = []

    for idx, row in enumerate(rows):
        smiles_val = row.get(smiles_col)
        if not smiles_val or not str(smiles_val).strip():
            failed.append({"row": idx + 1, "error": "Missing SMILES value"})
            continue

        smiles_str = str(smiles_val).strip()
        name_val = str(row.get(name_col, "")).strip() if name_col and row.get(name_col) else f"Imported molecule {idx + 1}"
        method_val = str(row.get(method_col, "")).strip() if method_col and row.get(method_col) else "Spreadsheet import"
        notes_val = str(row.get(notes_col, "")).strip() if notes_col and row.get(notes_col) else None

        # Parse date
        date_val = today
        if date_col and row.get(date_col):
            raw = str(row[date_col]).strip()
            try:
                date_val = date.fromisoformat(raw[:10])
            except (ValueError, IndexError):
                date_val = today

        try:
            chem = process_smiles(smiles_str)
        except InvalidSMILESError:
            failed.append({"row": idx + 1, "error": f"Invalid SMILES: {smiles_str}"})
            continue
        except Exception as exc:
            failed.append({"row": idx + 1, "error": str(exc)})
            continue

        mol = Molecule(
            lab_id=lab_id,
            created_by_user_id=user_id,
            name=name_val or f"Imported molecule {idx + 1}",
            smiles=smiles_str,
            date_created=date_val,
            method_used=method_val or "Spreadsheet import",
            notes=notes_val,
            **chem,
        )
        db.add(mol)
        created.append(mol)

    if created:
        db.commit()
        for mol in created:
            db.refresh(mol)

    return {
        "imported": len(created),
        "failed": failed,
    }
