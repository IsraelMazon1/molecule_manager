import re
import logging

import httpx

logger = logging.getLogger(__name__)

AMINO_ACIDS = set("ACDEFGHIKLMNPQRSTVWY")
RCSB_ENTRY_URL = "https://data.rcsb.org/rest/v1/core/entry"
RCSB_SEARCH_URL = "https://search.rcsb.org/rcsbsearch/v2/query"
UNIPROT_SEARCH_URL = "https://rest.uniprot.org/uniprotkb/search"

TIMEOUT = 10.0

COMMON_PROTEINS: dict[str, dict] = {
    "BRCA1": {"name": "BRCA1", "display_name": "Breast cancer type 1 susceptibility protein", "uniprot_id": "P38398", "pdb_id": "1JM7"},
    "BRCA2": {"name": "BRCA2", "display_name": "Breast cancer type 2 susceptibility protein", "uniprot_id": "P51587", "pdb_id": "1MIU"},
    "TP53": {"name": "TP53", "display_name": "Cellular tumor antigen p53", "uniprot_id": "P04637", "pdb_id": "1TUP"},
    "EGFR": {"name": "EGFR", "display_name": "Epidermal growth factor receptor", "uniprot_id": "P00533", "pdb_id": "1NQL"},
    "KRAS": {"name": "KRAS", "display_name": "GTPase KRas", "uniprot_id": "P01116", "pdb_id": "4OBE"},
    "BRAF": {"name": "BRAF", "display_name": "Serine/threonine-protein kinase B-raf", "uniprot_id": "P15056", "pdb_id": "1UWH"},
    "PIK3CA": {"name": "PIK3CA", "display_name": "Phosphatidylinositol 4,5-bisphosphate 3-kinase catalytic subunit alpha isoform", "uniprot_id": "P42336", "pdb_id": "2RD0"},
    "PTEN": {"name": "PTEN", "display_name": "Phosphatidylinositol 3,4,5-trisphosphate 3-phosphatase and dual-specificity protein phosphatase PTEN", "uniprot_id": "P60484", "pdb_id": "1D5R"},
    "APC": {"name": "APC", "display_name": "Adenomatous polyposis coli protein", "uniprot_id": "P25054", "pdb_id": "1T08"},
    "MYC": {"name": "MYC", "display_name": "Myc proto-oncogene protein", "uniprot_id": "P01106", "pdb_id": "1NKP"},
    "AKT1": {"name": "AKT1", "display_name": "RAC-alpha serine/threonine-protein kinase", "uniprot_id": "P31749", "pdb_id": "1UNQ"},
    "MTOR": {"name": "MTOR", "display_name": "Serine/threonine-protein kinase mTOR", "uniprot_id": "P42345", "pdb_id": "4DRH"},
    "ATM": {"name": "ATM", "display_name": "Serine-protein kinase ATM", "uniprot_id": "Q13315", "pdb_id": "5NP0"},
    "CDK4": {"name": "CDK4", "display_name": "Cyclin-dependent kinase 4", "uniprot_id": "P11802", "pdb_id": "2W96"},
    "CDK6": {"name": "CDK6", "display_name": "Cyclin-dependent kinase 6", "uniprot_id": "Q00534", "pdb_id": "1BI7"},
}


def _is_pdb_id(query: str) -> bool:
    return bool(re.fullmatch(r"\d[A-Za-z0-9]{3}", query))


def _is_sequence(query: str) -> bool:
    cleaned = query.upper().replace(" ", "").replace("\n", "")
    return len(cleaned) >= 10 and all(c in AMINO_ACIDS for c in cleaned)


def _fetch_pdb_metadata(pdb_id: str) -> dict:
    url = f"{RCSB_ENTRY_URL}/{pdb_id.upper()}"
    resp = httpx.get(url, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()

    struct = data.get("struct", {})
    name = struct.get("title", pdb_id.upper())

    return {
        "name": name,
        "display_name": name,
        "uniprot_id": None,
        "pdb_id": pdb_id.upper(),
        "sequence": None,
        "source": "pdb_id",
    }


def _fetch_uniprot_for_pdb(pdb_id: str) -> str | None:
    url = f"{UNIPROT_SEARCH_URL}?query=xref:pdb-{pdb_id.upper()}&format=json&size=1"
    try:
        resp = httpx.get(url, timeout=TIMEOUT)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if results:
            return results[0].get("primaryAccession")
    except Exception:
        logger.debug("Failed to cross-reference UniProt for PDB %s", pdb_id)
    return None


def _parse_uniprot_entry(entry: dict) -> dict:
    accession = entry.get("primaryAccession", "")

    protein_name = ""
    pn = entry.get("proteinDescription", {}).get("recommendedName")
    if pn:
        protein_name = pn.get("fullName", {}).get("value", "")

    genes = entry.get("genes", [])
    gene_name = ""
    if genes:
        primary = genes[0].get("geneName")
        if primary:
            gene_name = primary.get("value", "")

    sequence = entry.get("sequence", {}).get("value")

    return {
        "accession": accession,
        "protein_name": protein_name,
        "gene_name": gene_name,
        "sequence": sequence,
    }


def _uniprot_search(query_string: str) -> dict | None:
    params = {
        "query": query_string,
        "format": "json",
        "size": "5",
        "fields": "accession,protein_name,gene_names,sequence",
    }
    try:
        resp = httpx.get(UNIPROT_SEARCH_URL, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if not results:
            return None
        return _parse_uniprot_entry(results[0])
    except Exception:
        logger.debug("UniProt search failed for query: %s", query_string)
        return None


def _search_uniprot_by_name(name: str) -> dict | None:
    tiers = [
        f"gene_exact:{name} AND organism_id:9606 AND reviewed:true",
        f"gene:{name} AND organism_id:9606 AND reviewed:true",
        f"protein_name:{name} AND organism_id:9606 AND reviewed:true",
        f"{name} AND reviewed:true",
    ]
    for tier_query in tiers:
        result = _uniprot_search(tier_query)
        if result:
            return result
    return None


def _find_pdb_for_uniprot(uniprot_id: str) -> str | None:
    query = {
        "query": {
            "type": "terminal",
            "service": "text",
            "parameters": {
                "attribute": "rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_accession",
                "operator": "exact_match",
                "value": uniprot_id,
            },
        },
        "return_type": "entry",
        "request_options": {"results_content_type": ["experimental"], "paginate": {"start": 0, "rows": 1}},
    }
    try:
        resp = httpx.post(RCSB_SEARCH_URL, json=query, timeout=TIMEOUT)
        resp.raise_for_status()
        results = resp.json().get("result_set", [])
        if results:
            return results[0].get("identifier")
    except Exception:
        logger.debug("RCSB search failed for UniProt %s", uniprot_id)
    return None


def resolve_protein(query: str) -> dict:
    query = query.strip()
    if not query:
        return {"error": "Empty query"}

    lookup = COMMON_PROTEINS.get(query.upper())
    if lookup:
        return {**lookup, "sequence": None, "source": "name"}

    if _is_pdb_id(query):
        try:
            result = _fetch_pdb_metadata(query)
            uniprot_id = _fetch_uniprot_for_pdb(query)
            if uniprot_id:
                result["uniprot_id"] = uniprot_id
            return result
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                return {"error": f"PDB ID '{query.upper()}' not found"}
            return {"error": f"RCSB API error: {exc.response.status_code}"}
        except Exception as exc:
            return {"error": f"Failed to fetch PDB data: {exc}"}

    if _is_sequence(query):
        cleaned = query.upper().replace(" ", "").replace("\n", "")
        return {
            "name": f"Sequence ({len(cleaned)} aa)",
            "display_name": None,
            "uniprot_id": None,
            "pdb_id": None,
            "sequence": cleaned,
            "source": "sequence",
        }

    uniprot_result = _search_uniprot_by_name(query)
    if not uniprot_result:
        return {"error": f"No protein found for '{query}'"}

    display_name = uniprot_result["protein_name"] or query
    name = uniprot_result["gene_name"] or display_name
    accession = uniprot_result["accession"]

    pdb_id = _find_pdb_for_uniprot(accession)

    return {
        "name": name,
        "display_name": display_name,
        "uniprot_id": accession,
        "pdb_id": pdb_id,
        "sequence": uniprot_result.get("sequence"),
        "source": "name",
    }
