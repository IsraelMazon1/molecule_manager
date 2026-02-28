# Import all models here so Alembic (and anything else importing this package)
# sees every table registered on Base.metadata.
from app.models.user import User  # noqa: F401
from app.models.lab import Lab  # noqa: F401
from app.models.lab_member import LabMember  # noqa: F401
from app.models.molecule import Molecule  # noqa: F401
from app.models.experiment import Experiment  # noqa: F401
from app.models.experiment_molecule import ExperimentMolecule  # noqa: F401
