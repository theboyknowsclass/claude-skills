export type ModelFile = { path: string; name: string; dir: string; mtimeMs: number; size: number }
export type Scan = { files: ModelFile[]; scannedAt: number; error?: string; note?: string }

declare module 'claude-code' {
  interface PluginState {
    'model-files': { scan: Shaped<Scan> }
  }
}
