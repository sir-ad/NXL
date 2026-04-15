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
    defaultModel: partial.defaultModel ?? process.env['NXL_DEFAULT_MODEL'] ?? 'gpt-4o-mini',
    enableMemory: partial.enableMemory ?? true,
    enableTools: partial.enableTools ?? true,
    enableLLM: partial.enableLLM ?? true,
  };
}
