/** Identity and selection only; these types do not establish sample availability. */
export type SessionKind =
  | "fp1" | "fp2" | "fp3" | "sprint-qualifying" | "sprint" | "qualifying" | "race";

export interface SourceRecord {
  id: string;
  repository: string;
  revision: string;
  path: string;
  gitBlob: string;
  reviewedAt: string;
  capturedAt?: string;
  url?: string;
}
export interface EvidenceClaim {
  field: string;
  value: unknown;
  sourceId: string;
  reference: string;
  status: "verified";
}
export interface RaceSession {
  kind: SessionKind;
  openf1SessionKey: number | null;
  startUtc: string | null;
  evidence: EvidenceClaim[];
}
export interface RaceRecord {
  raceId: string;
  season: number;
  eventName: string;
  displayName: string;
  venue: { venueId: string; name: string; timeZone: string };
  sourceKeys: {
    openf1MeetingKey: number | null;
    jolpica: { season: number; round: number } | null;
    tyresRaceId: string | null;
    tyresSlug: string | null;
  };
  sessions: RaceSession[];
  evidence: EvidenceClaim[];
}
export interface Registry {
  schemaVersion: 1;
  sources: SourceRecord[];
  races: RaceRecord[];
}
export interface DriverSelection {
  openf1SessionKey: number;
  driverNumber: number;
  lapNumber: number | null;
}
export interface ContextInput {
  schemaVersion?: 1;
  raceId: string;
  sessionKind?: SessionKind | string | null;
  openf1SessionKey?: number | null;
  drivers?: DriverSelection[];
}
export interface NormalizedContext {
  schemaVersion: 1;
  raceId: string;
  sessionKind: SessionKind | null;
  openf1SessionKey: number | null;
  drivers: DriverSelection[];
}
export type RaceSelector =
  | { raceId: string }
  | { openf1MeetingKey: number }
  | { season: number; jolpicaRound: number }
  | { tyresRaceId: string }
  | { season: number; tyresSlug: string }
  | { eventName: string; season?: number };
export type SessionSelector =
  | { kind: SessionKind; openf1SessionKey?: number }
  | { openf1SessionKey: number };
export type Missing = { status: "missing"; reason: string };
export type Ambiguous = {
  status: "ambiguous";
  reason: "race-name-ambiguous";
  raceIds: string[];
};
export type RaceResolution =
  | { status: "resolved"; race: RaceRecord }
  | Missing | Ambiguous;
export type SessionResolution =
  | { status: "resolved"; race: RaceRecord; session: RaceSession }
  | Missing | Ambiguous;
export type ContextResolution =
  | { status: "resolved"; context: NormalizedContext; conversionLosses: "telemetry-single-lap"[] }
  | Missing;
export interface ValidationError { path: string; code: string; message: string }
export interface Coverage {
  races: number;
  sessions: number;
  missing: Record<
    "openf1MeetingKey" | "jolpica" | "tyresRaceId" | "tyresSlug" | "openf1SessionKey" | "startUtc",
    string[]
  >;
}
export class RegistryValidationError extends Error {
  constructor(errors: ValidationError[]);
  errors: ValidationError[];
}
export function validateRegistry(registry: unknown): { valid: boolean; errors: ValidationError[]; coverage: Coverage };
export function normalizeSessionKind(value: string): SessionKind | null;
export function resolveRace(registry: unknown, selector: RaceSelector): RaceResolution;
export function resolveSession(registry: unknown, raceSelector: RaceSelector, sessionSelector: SessionSelector): SessionResolution;
export function normalizeContext(registry: unknown, input: ContextInput): ContextResolution;
export function validateSelectedScope(context: unknown): asserts context is NormalizedContext;
