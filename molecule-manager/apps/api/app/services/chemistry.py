"""
Chemistry service — all RDKit calls are isolated here.

Never import RDKit anywhere else in the codebase.
"""
from rdkit import Chem, RDLogger
from rdkit.Chem import Descriptors, rdMolDescriptors
from rdkit.Chem.Draw import rdMolDraw2D

# Suppress RDKit's stderr noise (invalid-SMILES warnings, sanitisation errors).
# We handle all error cases explicitly through return values / exceptions.
RDLogger.DisableLog("rdApp.*")


# ---------------------------------------------------------------------------
# Custom exception
# ---------------------------------------------------------------------------


class InvalidSMILESError(ValueError):
    """Raised when a SMILES string cannot be parsed by RDKit."""

    def __init__(self, smiles: str) -> None:
        super().__init__(f"Invalid SMILES: {smiles!r}")
        self.smiles = smiles


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def validate_smiles(smiles: str) -> bool:
    """Return True if *smiles* is parseable by RDKit and contains atoms."""
    if not smiles or not smiles.strip():
        return False
    mol = Chem.MolFromSmiles(smiles.strip())
    return mol is not None and mol.GetNumAtoms() > 0


def canonicalize_smiles(smiles: str) -> str:
    """Return the canonical SMILES for *smiles*.

    Raises InvalidSMILESError if the string is not valid.
    """
    mol = Chem.MolFromSmiles(smiles.strip() if smiles else "")
    if mol is None or mol.GetNumAtoms() == 0:
        raise InvalidSMILESError(smiles)
    return Chem.MolToSmiles(mol)


def compute_properties(smiles: str) -> dict:
    """Compute physicochemical properties for *smiles*.

    Returns a dict with keys:
        molecular_weight, molecular_formula, hbd, hba, tpsa, rotatable_bonds

    Raises InvalidSMILESError if the string is not valid.
    """
    mol = Chem.MolFromSmiles(smiles.strip() if smiles else "")
    if mol is None or mol.GetNumAtoms() == 0:
        raise InvalidSMILESError(smiles)

    return {
        "molecular_weight": round(Descriptors.MolWt(mol), 4),
        "molecular_formula": rdMolDescriptors.CalcMolFormula(mol),
        "hbd": rdMolDescriptors.CalcNumHBD(mol),
        "hba": rdMolDescriptors.CalcNumHBA(mol),
        "tpsa": round(Descriptors.TPSA(mol), 4),
        "rotatable_bonds": rdMolDescriptors.CalcNumRotatableBonds(mol),
    }


def generate_svg(smiles: str) -> str:
    """Generate a 300×300 SVG depiction of *smiles*.

    Raises InvalidSMILESError if the string is not valid.
    """
    mol = Chem.MolFromSmiles(smiles.strip() if smiles else "")
    if mol is None or mol.GetNumAtoms() == 0:
        raise InvalidSMILESError(smiles)

    drawer = rdMolDraw2D.MolDraw2DSVG(300, 300)
    drawer.DrawMolecule(mol)
    drawer.FinishDrawing()
    return drawer.GetDrawingText()


def compute_morgan_fingerprint(smiles: str) -> str:
    """Generate a Morgan fingerprint (radius=2, 2048 bits) and return it as a bit string.

    Raises InvalidSMILESError if the string is not valid.
    """
    from rdkit.Chem import AllChem  # type: ignore[import]

    mol = Chem.MolFromSmiles(smiles.strip() if smiles else "")
    if mol is None or mol.GetNumAtoms() == 0:
        raise InvalidSMILESError(smiles)
    fp = AllChem.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=2048)
    return fp.ToBitString()


def tanimoto_similarity(smiles1: str, smiles2: str) -> float:
    """Return the Tanimoto coefficient [0, 1] between two SMILES using Morgan fingerprints.

    Returns 0.0 if either SMILES is unparseable.
    """
    from rdkit import DataStructs  # type: ignore[import]
    from rdkit.Chem import AllChem  # type: ignore[import]

    mol1 = Chem.MolFromSmiles(smiles1.strip() if smiles1 else "")
    mol2 = Chem.MolFromSmiles(smiles2.strip() if smiles2 else "")
    if mol1 is None or mol2 is None:
        return 0.0
    fp1 = AllChem.GetMorganFingerprintAsBitVect(mol1, radius=2, nBits=2048)
    fp2 = AllChem.GetMorganFingerprintAsBitVect(mol2, radius=2, nBits=2048)
    return float(DataStructs.TanimotoSimilarity(fp1, fp2))


def bulk_tanimoto(query_smiles: str, stored_fingerprints: list[str | None]) -> list[float]:
    """Compute Tanimoto between a query SMILES and a list of stored bit strings.

    Parses the query molecule once and reuses it for all comparisons.
    Entries that are None or cannot be parsed return 0.0.
    """
    from rdkit import DataStructs  # type: ignore[import]
    from rdkit.Chem import AllChem  # type: ignore[import]

    q = Chem.MolFromSmiles(query_smiles.strip() if query_smiles else "")
    if q is None:
        return [0.0] * len(stored_fingerprints)
    query_fp = AllChem.GetMorganFingerprintAsBitVect(q, radius=2, nBits=2048)

    results: list[float] = []
    for fp_str in stored_fingerprints:
        if not fp_str:
            results.append(0.0)
            continue
        try:
            stored_fp = DataStructs.CreateFromBitString(fp_str)
            results.append(float(DataStructs.TanimotoSimilarity(query_fp, stored_fp)))
        except Exception:
            results.append(0.0)
    return results


def smiles_to_inchi(smiles: str) -> str:
    """Return the InChI string for *smiles*.

    Raises InvalidSMILESError if the string is not valid.
    """
    from rdkit.Chem.inchi import MolToInchi  # type: ignore[import]

    mol = Chem.MolFromSmiles(smiles.strip() if smiles else "")
    if mol is None or mol.GetNumAtoms() == 0:
        raise InvalidSMILESError(smiles)
    return MolToInchi(mol) or ""


def smiles_to_inchikey(smiles: str) -> str:
    """Return the InChIKey (27-char hash) for *smiles*.

    Returns an empty string if the InChI cannot be computed.
    """
    from rdkit.Chem.inchi import InchiToInchiKey  # type: ignore[import]

    inchi = smiles_to_inchi(smiles)
    return InchiToInchiKey(inchi) if inchi else ""


def is_substructure(query_smiles: str, target_smiles: str) -> bool:
    """Return True if *query_smiles* is a substructure of *target_smiles*.

    Returns False (rather than raising) if either SMILES is unparseable.
    """
    q = Chem.MolFromSmiles(query_smiles.strip() if query_smiles else "")
    t = Chem.MolFromSmiles(target_smiles.strip() if target_smiles else "")
    if q is None or t is None:
        return False
    return t.HasSubstructMatch(q)


def process_smiles(smiles: str) -> dict:
    """Validate, canonicalize, compute properties, and generate SVG.

    Returns a dict ready to populate the Molecule model fields:
        canonical_smiles, svg_image, molecular_weight, molecular_formula,
        hbd, hba, tpsa, rotatable_bonds, inchi, inchikey, morgan_fingerprint

    Raises InvalidSMILESError (structured) if the SMILES is invalid.
    """
    if not validate_smiles(smiles):
        raise InvalidSMILESError(smiles)

    canonical = canonicalize_smiles(smiles)
    return {
        "canonical_smiles": canonical,
        "svg_image": generate_svg(canonical),
        "inchi": smiles_to_inchi(canonical),
        "inchikey": smiles_to_inchikey(canonical),
        "morgan_fingerprint": compute_morgan_fingerprint(canonical),
        **compute_properties(canonical),
    }
