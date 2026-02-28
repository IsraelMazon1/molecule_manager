"""Unit tests for the chemistry service.

Run inside the api container:
    pytest tests/
"""
import pytest

from app.services.chemistry import (
    InvalidSMILESError,
    canonicalize_smiles,
    compute_properties,
    generate_svg,
    process_smiles,
    validate_smiles,
)

# ---------------------------------------------------------------------------
# Reference molecules
# ---------------------------------------------------------------------------

ETHANOL = "CCO"
BENZENE = "c1ccccc1"
ASPIRIN = "CC(=O)Oc1ccccc1C(=O)O"

# Two representations of the same molecule (ethanol)
ETHANOL_REVERSED = "OCC"

# Kekulé benzene — should canonicalise to aromatic form
BENZENE_KEKULE = "C1=CC=CC=C1"


# ---------------------------------------------------------------------------
# validate_smiles
# ---------------------------------------------------------------------------


class TestValidateSmiles:
    def test_valid_ethanol(self):
        assert validate_smiles(ETHANOL) is True

    def test_valid_benzene(self):
        assert validate_smiles(BENZENE) is True

    def test_valid_aspirin(self):
        assert validate_smiles(ASPIRIN) is True

    def test_empty_string(self):
        assert validate_smiles("") is False

    def test_whitespace_only(self):
        assert validate_smiles("   ") is False

    def test_garbage_string(self):
        assert validate_smiles("not-a-smiles") is False

    def test_nonsense_atom(self):
        assert validate_smiles("XYZ") is False


# ---------------------------------------------------------------------------
# canonicalize_smiles
# ---------------------------------------------------------------------------


class TestCanonicalize:
    def test_same_molecule_two_representations(self):
        """OCC and CCO are both ethanol — canonical form must match."""
        assert canonicalize_smiles(ETHANOL_REVERSED) == canonicalize_smiles(ETHANOL)

    def test_kekule_to_aromatic(self):
        """Kekulé benzene should canonicalise to the same form as aromatic."""
        assert canonicalize_smiles(BENZENE_KEKULE) == canonicalize_smiles(BENZENE)

    def test_returns_string(self):
        result = canonicalize_smiles(ASPIRIN)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_invalid_raises(self):
        with pytest.raises(InvalidSMILESError):
            canonicalize_smiles("not-a-smiles")

    def test_empty_raises(self):
        with pytest.raises(InvalidSMILESError):
            canonicalize_smiles("")


# ---------------------------------------------------------------------------
# compute_properties
# ---------------------------------------------------------------------------


class TestComputeProperties:
    def test_returns_all_keys(self):
        props = compute_properties(ETHANOL)
        expected_keys = {
            "molecular_weight",
            "molecular_formula",
            "hbd",
            "hba",
            "tpsa",
            "rotatable_bonds",
        }
        assert expected_keys == set(props.keys())

    def test_ethanol_formula(self):
        assert compute_properties(ETHANOL)["molecular_formula"] == "C2H6O"

    def test_ethanol_hbd(self):
        # Ethanol has one hydroxyl → one HBD
        assert compute_properties(ETHANOL)["hbd"] == 1

    def test_ethanol_hba(self):
        # Ethanol oxygen is one HBA
        assert compute_properties(ETHANOL)["hba"] == 1

    def test_ethanol_rotatable_bonds(self):
        # C–O is the only rotatable bond in ethanol
        assert compute_properties(ETHANOL)["rotatable_bonds"] == 1

    def test_benzene_formula(self):
        assert compute_properties(BENZENE)["molecular_formula"] == "C6H6"

    def test_benzene_no_hbd(self):
        assert compute_properties(BENZENE)["hbd"] == 0

    def test_benzene_zero_rotatable_bonds(self):
        assert compute_properties(BENZENE)["rotatable_bonds"] == 0

    def test_molecular_weight_is_float(self):
        mw = compute_properties(ASPIRIN)["molecular_weight"]
        assert isinstance(mw, float)
        # Aspirin MW ≈ 180.16
        assert 179.0 < mw < 182.0

    def test_tpsa_is_float(self):
        tpsa = compute_properties(ETHANOL)["tpsa"]
        assert isinstance(tpsa, float)

    def test_invalid_raises(self):
        with pytest.raises(InvalidSMILESError):
            compute_properties("not-a-smiles")


# ---------------------------------------------------------------------------
# generate_svg
# ---------------------------------------------------------------------------


class TestGenerateSvg:
    def test_returns_string(self):
        svg = generate_svg(BENZENE)
        assert isinstance(svg, str)

    def test_contains_svg_element(self):
        svg = generate_svg(BENZENE)
        assert "<svg" in svg

    def test_contains_closing_tag(self):
        svg = generate_svg(ETHANOL)
        assert "</svg>" in svg

    def test_invalid_raises(self):
        with pytest.raises(InvalidSMILESError):
            generate_svg("not-a-smiles")


# ---------------------------------------------------------------------------
# process_smiles (integration)
# ---------------------------------------------------------------------------


class TestProcessSmiles:
    def test_valid_returns_all_fields(self):
        result = process_smiles(ETHANOL)
        expected = {
            "canonical_smiles",
            "svg_image",
            "molecular_weight",
            "molecular_formula",
            "hbd",
            "hba",
            "tpsa",
            "rotatable_bonds",
        }
        assert expected == set(result.keys())

    def test_canonical_smiles_is_string(self):
        result = process_smiles(BENZENE)
        assert isinstance(result["canonical_smiles"], str)
        assert len(result["canonical_smiles"]) > 0

    def test_svg_is_valid(self):
        result = process_smiles(ASPIRIN)
        assert "<svg" in result["svg_image"]
        assert "</svg>" in result["svg_image"]

    def test_two_representations_same_canonical(self):
        """process_smiles should produce identical canonical SMILES for the same molecule."""
        r1 = process_smiles(ETHANOL)
        r2 = process_smiles(ETHANOL_REVERSED)
        assert r1["canonical_smiles"] == r2["canonical_smiles"]

    def test_invalid_raises_structured_error(self):
        with pytest.raises(InvalidSMILESError) as exc_info:
            process_smiles("not-a-smiles")
        # The exception carries the original input
        assert exc_info.value.smiles == "not-a-smiles"

    def test_empty_raises_structured_error(self):
        with pytest.raises(InvalidSMILESError):
            process_smiles("")
