export class Emitter {
  private output = '';
  private indentLevel = 0;
  private indentStr = '    '; // 4 spaces
  private atLineStart = true;

  indent(): void {
    this.indentLevel++;
  }

  dedent(): void {
    this.indentLevel = Math.max(0, this.indentLevel - 1);
  }

  write(text: string): void {
    if (this.atLineStart && text.trim() !== '') {
      this.output += this.indentStr.repeat(this.indentLevel);
      this.atLineStart = false;
    }
    this.output += text;
  }

  writeln(text = ''): void {
    if (text) this.write(text);
    this.output += '\n';
    this.atLineStart = true;
  }

  toString(): string {
    return this.output;
  }
}
