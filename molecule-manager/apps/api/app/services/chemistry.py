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


def process_smiles(smiles: str) -> dict:
    """Validate, canonicalize, compute properties, and generate SVG.

    Returns a dict ready to populate the Molecule model fields:
        canonical_smiles, svg_image, molecular_weight, molecular_formula,
        hbd, hba, tpsa, rotatable_bonds

    Raises InvalidSMILESError (structured) if the SMILES is invalid.
    """
    if not validate_smiles(smiles):
        raise InvalidSMILESError(smiles)

    canonical = canonicalize_smiles(smiles)
    return {
        "canonical_smiles": canonical,
        "svg_image": generate_svg(canonical),
        **compute_properties(canonical),
    }
