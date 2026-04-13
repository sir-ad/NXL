#!/usr/bin/env node
import { Command } from 'commander';
import { compileCommand } from './commands/compile.js';
import { replCommand } from './commands/repl.js';
import { tokensCommand } from './commands/tokens.js';

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
  .command('repl')
  .description('Start interactive NXL REPL')
  .option('-t, --target <target>', 'Target language (python|javascript)', 'python')
  .action(replCommand);

program
  .command('tokens <file>')
  .description('Analyze token efficiency of a file')
  .option('--compare <original>', 'Compare against original file')
  .action(tokensCommand);

program.parse();
