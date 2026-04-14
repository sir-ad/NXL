#!/usr/bin/env node
import { Command } from 'commander';
import { compileCommand } from './commands/compile.js';
import { replCommand } from './commands/repl.js';
import { tokensCommand } from './commands/tokens.js';
import { runCommand } from './commands/run.js';
import { fmtCommand } from './commands/fmt.js';
import { lintCommand } from './commands/lint.js';
import { checkCommand } from './commands/check.js';

const program = new Command();

program
  .name('nxl')
  .description('NXL - Token-efficient programming language for LLMs')
  .version('0.1.0');

program
  .command('compile <file>')
  .description('Compile NXL file to Python or JavaScript')
  .option('-t, --target <target>', 'Target language (python|javascript)', 'python')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(compileCommand);

program
  .command('run <file>')
  .description('Execute an NXL file')
  .option('--time', 'Print execution time')
  .option('--agent', 'Enable agent runtime (mem/tool/llm shorthands)')
  .action(runCommand);

program
  .command('repl')
  .description('Start interactive NXL REPL')
  .action(replCommand);

program
  .command('tokens <file>')
  .description('Analyze token efficiency of a file')
  .option('--compare <original>', 'Compare against original file')
  .action(tokensCommand);

program
  .command('fmt <file>')
  .description('Format an NXL file (prints to stdout by default)')
  .option('-w, --write', 'Overwrite the file in place')
  .option('--check', 'Exit with error if file would change (CI mode)')
  .option('--indent <n>', 'Spaces per indent level (default 2)')
  .action(fmtCommand);

program
  .command('lint <file>')
  .description('Lint an NXL file for common issues')
  .option('--rule <rule...>', 'Only report specific rules (e.g. no-undef)')
  .option('--no-warn', 'Only report errors, suppress warnings')
  .action(lintCommand);

program
  .command('check <file>')
  .description('Type-check an NXL file (gradual — only errors when types are known)')
  .option('--strict', 'Include warnings in addition to errors')
  .action(checkCommand);

program.parse();
