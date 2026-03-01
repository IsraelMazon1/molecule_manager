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

export interface ExperimentDetail extends Experiment {
  molecules: Molecule[];
}

export interface SimilarityHit extends Molecule {
  similarity: number; // Tanimoto coefficient [0, 1]
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

export interface AuditLogPage {
  total: number;
  limit: number;
  offset: number;
  items: AuditLog[];
}
