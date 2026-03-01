"""
PubChem REST API integration.

All network calls are isolated here. Uses only stdlib urllib so no extra
dependency is required.
"""
import json
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"
_AC_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound"
_PROPS = "IsomericSMILES,MolecularFormula,MolecularWeight,IUPACName"
_TIMEOUT = 10  # seconds


def _get_json(url: str) -> dict | None:
    """Fetch JSON from *url*.

    Returns None on HTTP 404 (compound / query not found).
    Raises RuntimeError on network errors or unexpected HTTP status codes.
    """
    try:
        with urllib.request.urlopen(url, timeout=_TIMEOUT) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None
        raise RuntimeError(f"PubChem returned HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"PubChem unreachable: {exc.reason}") from exc


def _row_to_result(item: dict) -> dict:
    # PubChem serialises IsomericSMILES as "SMILES" in the Properties response
    smiles = item.get("IsomericSMILES") or item.get("SMILES") or ""
    return {
        "pubchem_cid": item["CID"],
        "name": item.get("IUPACName") or "",
        "smiles": smiles,
        "molecular_formula": item.get("MolecularFormula") or "",
        "molecular_weight": float(item.get("MolecularWeight") or 0),
        "iupac_name": item.get("IUPACName") or "",
    }


def _fetch_name_props(name: str) -> dict | None:
    """Fetch properties for the first compound matching *name*. Returns None on miss."""
    enc = urllib.parse.quote(name, safe="")
    try:
        data = _get_json(
            f"{_BASE}/compound/name/{enc}/property/{_PROPS}/JSON?MaxRecords=1"
        )
        if data and "PropertyTable" in data:
            items = data["PropertyTable"]["Properties"]
            return _row_to_result(items[0]) if items else None
    except RuntimeError:
        return None
    return None


def search_pubchem(query: str) -> list[dict]:
    """Search PubChem by name or CAS number.

    Strategy:
      1. Autocomplete for prefix/partial name matching (e.g. "doxy" →
         doxycycline, doxylamine, …). Properties are fetched in parallel
         for each candidate name.
      2. If autocomplete yields no candidates (e.g. a CAS number like
         "50-78-2"), fall back to a direct name/synonym lookup.

    Returns up to 10 results, deduplicated by CID.
    """
    encoded = urllib.parse.quote(query.strip(), safe="")

    # ── Step 1: autocomplete → parallel property fetch ─────────────────────────
    try:
        ac_data = _get_json(f"{_AC_BASE}/{encoded}/JSON?limit=10")
    except RuntimeError:
        ac_data = None

    names: list[str] = []
    if ac_data:
        names = (ac_data.get("dictionary_terms") or {}).get("compound") or []

    if names:
        seen_cids: set[int] = set()
        results: list[dict] = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(_fetch_name_props, n): n for n in names[:10]}
            for future in as_completed(futures, timeout=8):
                try:
                    r = future.result()
                    if r and r["pubchem_cid"] not in seen_cids:
                        seen_cids.add(r["pubchem_cid"])
                        results.append(r)
                except Exception:
                    pass
        return results

    # ── Step 2: fallback — direct name / synonym / CAS search ─────────────────
    try:
        data = _get_json(
            f"{_BASE}/compound/name/{encoded}/property/{_PROPS}/JSON?MaxRecords=10"
        )
        if data and "PropertyTable" in data:
            return [_row_to_result(item) for item in data["PropertyTable"]["Properties"][:10]]
    except RuntimeError:
        pass

    return []


def fetch_pubchem_by_cid(cid: int) -> dict | None:
    """Fetch a single compound by PubChem CID.

    Returns the same shape dict as search_pubchem items, or None if not found.
    Raises RuntimeError on network errors.
    """
    url = f"{_BASE}/compound/cid/{cid}/property/{_PROPS}/JSON"
    data = _get_json(url)

    if not data or "PropertyTable" not in data:
        return None

    items = data["PropertyTable"]["Properties"]
    if not items:
        return None

    return _row_to_result(items[0])
