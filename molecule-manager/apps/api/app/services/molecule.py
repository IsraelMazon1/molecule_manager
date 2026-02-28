import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.models.molecule import Molecule
from app.services.chemistry import InvalidSMILESError, process_smiles


def create_molecule(
    db: Session,
    *,
    lab_id: uuid.UUID,
    created_by_user_id: uuid.UUID,
    name: str,
    smiles: str,
    date_created: date,
    method_used: str,
    notes: str | None,
) -> Molecule:
    """Validate SMILES, compute derived properties, persist and return the new Molecule.

    Raises InvalidSMILESError (from chemistry service) if SMILES is invalid —
    the router translates this to a 422.
    """
    chem = process_smiles(smiles)  # raises InvalidSMILESError on bad input

    mol = Molecule(
        lab_id=lab_id,
        created_by_user_id=created_by_user_id,
        name=name,
        smiles=smiles,
        date_created=date_created,
        method_used=method_used,
        notes=notes,
        **chem,  # canonical_smiles, svg_image, molecular_weight, molecular_formula,
                 # hbd, hba, tpsa, rotatable_bonds
    )
    db.add(mol)
    db.commit()
    db.refresh(mol)
    return mol
