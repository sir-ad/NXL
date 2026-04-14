import type { Value } from '@nxl/interpreter';
import { display } from '@nxl/interpreter';
import { RuntimeError } from '@nxl/interpreter';

export type ToolFn = (args: Record<string, Value>, positional: Value[]) => Value | Promise<Value>;

export interface ToolDef {
  name: string;
  description: string;
  fn: ToolFn;
}

export class ToolRegistry {
  private tools: Map<string, ToolDef> = new Map();

  register(name: string, description: string, fn: ToolFn): void {
    this.tools.set(name, { name, description, fn });
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async invoke(toolName: string, args: Record<string, Value>, positional: Value[]): Promise<Value> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new RuntimeError(`Unknown tool: '${toolName}'`);
    }
    return tool.fn(args, positional);
  }

  list(): ToolDef[] {
    return [...this.tools.values()];
  }
}

// Example built-in tools
import { mkString, mkDict, mkList, NULL } from '@nxl/interpreter';

export function registerExampleTools(registry: ToolRegistry): void {
  registry.register(
    'get_weather',
    'Get weather for a city',
    (args, pos) => {
      const city = args['city'] ?? pos[0];
      const cityStr = city?.kind === 'string' ? city.value : display(city ?? NULL);
      return mkDict(new Map([
        ['city', mkString(cityStr)],
        ['temp', mkString('72°F')],
        ['conditions', mkString('Partly cloudy')],
        ['humidity', mkString('45%')],
      ]));
    }
  );

  registry.register(
    'read_file',
    'Read a file and return its contents',
    (args, pos) => {
      const path = args['path'] ?? pos[0];
      const pathStr = path?.kind === 'string' ? path.value : '';
      try {
        const { readFileSync } = require('node:fs') as typeof import('node:fs');
        return mkString(readFileSync(pathStr, 'utf8'));
      } catch {
        return mkString(`(error: could not read '${pathStr}')`);
      }
    }
  );

  registry.register(
    'list_tools',
    'List available tools',
    () => mkList(registry.list().map(t => mkString(t.name)))
  );
}
