import Anthropic from '@anthropic-ai/sdk';
import { mkString } from '@nxl/interpreter';
import type { Value } from '@nxl/interpreter';
import { display } from '@nxl/interpreter';
import { RuntimeError } from '@nxl/interpreter';

export interface LLMConfig {
  apiKey?: string;
  defaultModel?: string;
}

export class LLM {
  private client: Anthropic | null = null;
  private defaultModel: string;

  constructor(config: LLMConfig = {}) {
    this.defaultModel = config.defaultModel ?? 'gpt-4o-mini';
    const key = config.apiKey ?? process.env['ANTHROPIC_API_KEY'];
    if (key) {
      this.client = new Anthropic({ apiKey: key });
    }
  }

  async call(args: Record<string, Value>, positional: Value[]): Promise<Value> {
    const promptVal = args['prompt'] ?? positional[0];
    if (!promptVal) throw new RuntimeError('llm@: prompt is required');

    const prompt = display(promptVal);
    const modelVal = args['model'];
    const model = modelVal?.kind === 'string' ? modelVal.value : this.defaultModel;

    const maxTokensVal = args['max_tokens'];
    const maxTokens = maxTokensVal?.kind === 'number' ? maxTokensVal.value : 1024;

    const systemVal = args['system'];
    const system = systemVal?.kind === 'string' ? systemVal.value : undefined;

    if (!this.client) {
      console.warn('[llm@] No ANTHROPIC_API_KEY set — returning stub response');
      return mkString(`(stub llm response to: "${prompt.slice(0, 60)}")`);
    }

    try {
      const params: Anthropic.MessageCreateParamsNonStreaming = {
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      };
      if (system) params.system = system;

      const response = await this.client.messages.create(params);
      const content = response.content[0];
      if (content.type === 'text') return mkString(content.text);
      return mkString('(non-text response)');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new RuntimeError(`llm@: API error — ${msg}`);
    }
  }
}
