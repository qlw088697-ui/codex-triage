export type DoctorStatus = "ok" | "warning" | "fail";

export interface DoctorIssue {
  severity: DoctorStatus;
  cause: string;
  measured?: string | null;
  expected?: string | null;
  remedy?: string | null;
  fields?: string[];
}

export type DoctorDetailValue = string | string[];

export interface DoctorCheck {
  id: string;
  category: string;
  status: DoctorStatus;
  summary: string;
  details: Record<string, DoctorDetailValue>;
  notes: string[];
  issues: DoctorIssue[];
  remediation?: string | null;
  durationMs: number;
}

export interface DoctorReport {
  schemaVersion: number;
  generatedAt: string;
  overallStatus: DoctorStatus;
  codexVersion: string;
  checks: DoctorCheck[];
}
