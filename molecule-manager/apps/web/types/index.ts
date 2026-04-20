export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Lab {
  id: string;
  name: string;
  lab_code: string;
  created_by_user_id: string | null;
  created_at: string;
}

export interface LabMember {
  user_id: string;
  email: string;
  role: "PI" | "STUDENT";
  joined_at: string;
}

export interface LabDetail extends Lab {
  members: LabMember[];
}

export interface Molecule {
  id: string;
  lab_id: string;
  created_by_user_id: string | null;
  name: string;
  smiles: string;
  canonical_smiles: string | null;
  inchi: string | null;
  inchikey: string | null;
  date_created: string; // ISO date "YYYY-MM-DD"
  method_used: string;
  notes: string | null;
  molecular_weight: number | null;
  molecular_formula: string | null;
  hbd: number | null;
  hba: number | null;
  tpsa: number | null;
  rotatable_bonds: number | null;
  svg_image: string | null;
  created_at: string;
  updated_at: string;
}

export interface Experiment {
  id: string;
  lab_id: string;
  created_by_user_id: string | null;
  title: string;
  date: string; // ISO date "YYYY-MM-DD"
  notes: string | null;
  created_at: string;
}

export interface ProteinListItem {
  id: string;
  lab_id: string;
  name: string;
  display_name: string | null;
  uniprot_id: string | null;
  pdb_id: string | null;
  source: string;
  created_at: string;
}

export interface ExperimentDetail extends Experiment {
  molecules: Molecule[];
  proteins: ProteinListItem[];
}

export interface SimilarityHit extends Molecule {
  similarity: number; // Tanimoto coefficient [0, 1]
}

export interface MolFilePreview {
  smiles: string;
  canonical_smiles: string;
  molecular_weight: number;
  molecular_formula: string;
  hbd: number;
  hba: number;
  tpsa: number;
  rotatable_bonds: number;
  svg_image: string;
}

export interface MolFileParseResponse {
  molecules: MolFilePreview[];
}

export interface SpreadsheetPreview {
  columns: string[];
  rows: Record<string, unknown>[];
  suggested_mapping: Record<string, string | null>;
  total_rows: number;
}

export interface SpreadsheetImportResult {
  imported: number;
  failed: { row: number; error: string }[];
}

export interface AppNotification {
  id: string;
  user_id: string;
  lab_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  lab_id: string;
  user_id: string | null;
  action: string; // "CREATE" | "UPDATE" | "DELETE"
  entity_type: string; // "MOLECULE" | "EXPERIMENT" | "EXPERIMENT_MOLECULE" | "LAB_MEMBER"
  entity_id: string;
  entity_name: string | null;
  detail: string | null;
  created_at: string; // ISO datetime
}

export interface Protein {
  id: string;
  lab_id: string;
  created_by_user_id: string | null;
  name: string;
  display_name: string | null;
  uniprot_id: string | null;
  pdb_id: string | null;
  sequence: string | null;
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProteinResolution {
  name: string;
  display_name: string | null;
  uniprot_id: string | null;
  pdb_id: string | null;
  sequence: string | null;
  source: string;
}

export interface ProteinCreate {
  name: string;
  display_name?: string | null;
  uniprot_id?: string | null;
  pdb_id?: string | null;
  sequence?: string | null;
  source: string;
  notes?: string | null;
}

export interface ProteinPage {
  items: Protein[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditLogPage {
  total: number;
  limit: number;
  offset: number;
  items: AuditLog[];
}
