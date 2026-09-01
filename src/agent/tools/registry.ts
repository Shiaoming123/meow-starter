import type { ToolDef } from './types';

const tools = new Map<string, ToolDef>();

export function registerTool(def: ToolDef): void {
  tools.set(def.name, def);
}

export function getTool(name: string): ToolDef | undefined {
  return tools.get(name);
}

export function listTools(): ToolDef[] {
  return [...tools.values()];
}

export function clearTools(): void {
  tools.clear();
}
