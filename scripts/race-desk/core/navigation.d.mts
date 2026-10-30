import type { ContextInput, NormalizedContext, Registry } from './index.mjs';
export type Tool = 'tyres' | 'grid' | 'ghostcar' | 'telemetry';
export interface TelemetryCircuitFact { season: number; openf1MeetingKey: number; circuitShortName: string; sourceId: string; reference: string; status: 'verified' }
export interface NavigationOptions { currentYear: number; telemetryCircuit?: TelemetryCircuitFact }
export interface ReportEntry { field: string; reason: string; candidates?: string[] }
export interface NavigationReport { preserved: ReportEntry[]; dropped: ReportEntry[]; unresolved: ReportEntry[]; ambiguous: ReportEntry[] }
export type ParseResult = { status: 'resolved'; tool: Tool; context: NormalizedContext; report: NavigationReport } | { status: 'missing' | 'ambiguous' | 'unsupported' | 'invalid'; tool: Tool | null; reason: string; report: NavigationReport };
export type LinkPlan = { kind: 'exact'; url: string; notice: null; report: NavigationReport } | { kind: 'partial' | 'generic'; url: string; notice: string; report: NavigationReport };
export function parseToolUrl(registry: Registry, absoluteUrl: string, options: NavigationOptions): ParseResult;
export function planToolLink(registry: Registry, input: ContextInput, target: Tool, options: NavigationOptions): LinkPlan;
