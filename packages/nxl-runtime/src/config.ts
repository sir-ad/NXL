export interface RuntimeConfig {
  anthropicKey?: string;
  defaultModel?: string;
  enableMemory?: boolean;
  enableTools?: boolean;
  enableLLM?: boolean;
}

export function resolveConfig(partial: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    anthropicKey: partial.anthropicKey ?? process.env['ANTHROPIC_API_KEY'],
    defaultModel: partial.defaultModel ?? process.env['NXL_DEFAULT_MODEL'] ?? 'claude-haiku-4-5-20251001',
    enableMemory: partial.enableMemory ?? true,
    enableTools: partial.enableTools ?? true,
    enableLLM: partial.enableLLM ?? true,
  };
}
