// Ambient declaration so MCP tool files (which run in the Deno edge function at
// runtime) can reference `process.env.*` without pulling in @types/node.
declare const process: { env: Record<string, string | undefined> };
