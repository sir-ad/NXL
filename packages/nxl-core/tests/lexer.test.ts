import { describe, it, expect } from 'bun:test';
import { Lexer, TokenType } from '../src/lexer/index.js';

function tokenTypes(source: string): TokenType[] {
  return new Lexer(source).tokenize()
    .filter(t => t.type !== TokenType.Newline && t.type !== TokenType.EOF)
    .map(t => t.type);
}

function tokenValues(source: string): string[] {
  return new Lexer(source).tokenize()
    .filter(t => t.type !== TokenType.Newline && t.type !== TokenType.EOF)
    .map(t => t.value);
}

describe('Lexer', () => {
  describe('MetaGlyph Unicode symbols', () => {
    it('tokenizes → (arrow)', () => {
      expect(tokenTypes('→')).toEqual([TokenType.Arrow]);
    });

    it('tokenizes ∈ (membership)', () => {
      expect(tokenTypes('∈')).toEqual([TokenType.In]);
    });

    it('tokenizes ⇒ (implies)', () => {
      expect(tokenTypes('⇒')).toEqual([TokenType.Implies]);
    });

    it('tokenizes ∩ (intersect)', () => {
      expect(tokenTypes('∩')).toEqual([TokenType.Intersect]);
    });

    it('tokenizes ¬ (not)', () => {
      expect(tokenTypes('¬')).toEqual([TokenType.Not]);
    });

    it('tokenizes ∘ (compose)', () => {
      expect(tokenTypes('∘')).toEqual([TokenType.Compose]);
    });
  });

  describe('ASCII fallbacks', () => {
    it('tokenizes -> as Arrow', () => {
      expect(tokenTypes('->')).toEqual([TokenType.Arrow]);
    });

    it('tokenizes => as Implies', () => {
      expect(tokenTypes('=>')).toEqual([TokenType.Implies]);
    });

    it('tokenizes && as Intersect', () => {
      expect(tokenTypes('&&')).toEqual([TokenType.Intersect]);
    });

    it('tokenizes |> as Compose', () => {
      expect(tokenTypes('|>')).toEqual([TokenType.Compose]);
    });
  });

  describe('operators', () => {
    it('tokenizes comparison operators', () => {
      expect(tokenTypes('> < >= <= == !=')).toEqual([
        TokenType.Gt, TokenType.Lt, TokenType.Gte,
        TokenType.Lte, TokenType.Eq, TokenType.Neq,
      ]);
    });

    it('tokenizes arithmetic operators', () => {
      expect(tokenTypes('+ - * /')).toEqual([
        TokenType.Plus, TokenType.Minus, TokenType.Star, TokenType.Slash,
      ]);
    });

    it('tokenizes ellipsis', () => {
      expect(tokenTypes('...')).toEqual([TokenType.Ellipsis]);
    });
  });

  describe('numbers', () => {
    it('tokenizes integers', () => {
      expect(tokenValues('42')).toEqual(['42']);
    });

    it('tokenizes decimals', () => {
      expect(tokenValues('3.14')).toEqual(['3.14']);
    });

    it('tokenizes duration suffixes', () => {
      expect(tokenValues('30s 5m 1h')).toEqual(['30s', '5m', '1h']);
    });
  });

  describe('strings', () => {
    it('tokenizes double-quoted strings', () => {
      const tokens = new Lexer('"hello"').tokenize();
      expect(tokens[0].type).toBe(TokenType.String);
      expect(tokens[0].value).toBe('hello');
    });

    it('tokenizes single-quoted strings', () => {
      const tokens = new Lexer("'world'").tokenize();
      expect(tokens[0].type).toBe(TokenType.String);
      expect(tokens[0].value).toBe('world');
    });

    it('handles escape sequences', () => {
      const tokens = new Lexer('"hello\\nworld"').tokenize();
      expect(tokens[0].value).toBe('hello\nworld');
    });
  });

  describe('identifiers and keywords', () => {
    it('tokenizes identifiers', () => {
      expect(tokenTypes('foo bar_baz')).toEqual([TokenType.Identifier, TokenType.Identifier]);
    });

    it('tokenizes hyphenated identifiers', () => {
      expect(tokenValues('agt-001')).toEqual(['agt-001']);
    });

    it('tokenizes select keyword', () => {
      expect(tokenTypes('select')).toEqual([TokenType.Select]);
    });

    it('tokenizes boolean keywords', () => {
      expect(tokenTypes('true false')).toEqual([TokenType.True, TokenType.False]);
    });
  });

  describe('shorthand tokens', () => {
    it('tokenizes ? ! @ as individual tokens', () => {
      expect(tokenTypes('?')).toEqual([TokenType.Query]);
      expect(tokenTypes('!')).toEqual([TokenType.Bang]);
      expect(tokenTypes('@')).toEqual([TokenType.At]);
    });
  });

  describe('comments', () => {
    it('skips line comments', () => {
      const types = tokenTypes('foo // this is a comment\nbar');
      expect(types).toEqual([TokenType.Identifier, TokenType.Identifier]);
    });
  });

  describe('full NXL expressions', () => {
    it('tokenizes a pipeline statement', () => {
      const types = tokenTypes('tasks → select ∈(ready) ∩ ¬(blocked)');
      expect(types).toEqual([
        TokenType.Identifier, TokenType.Arrow, TokenType.Select,
        TokenType.In, TokenType.LParen, TokenType.Identifier, TokenType.RParen,
        TokenType.Intersect,
        TokenType.Not, TokenType.LParen, TokenType.Identifier, TokenType.RParen,
      ]);
    });

    it('tokenizes a conditional statement', () => {
      const types = tokenTypes('priority>5 ⇒ exec:immediate');
      expect(types).toEqual([
        TokenType.Identifier, TokenType.Gt, TokenType.Number,
        TokenType.Implies,
        TokenType.Identifier, TokenType.Colon, TokenType.Identifier,
      ]);
    });

    it('tokenizes a composition', () => {
      const types = tokenTypes('retrieve ∘ validate ∘ transform');
      expect(types).toEqual([
        TokenType.Identifier, TokenType.Compose,
        TokenType.Identifier, TokenType.Compose,
        TokenType.Identifier,
      ]);
    });

    it('tokenizes shorthand syntax', () => {
      const types = tokenTypes('mem?[query, recent=10]');
      expect(types).toEqual([
        TokenType.Identifier, TokenType.Query, TokenType.LBracket,
        TokenType.Identifier, TokenType.Comma,
        TokenType.Identifier, TokenType.Assign, TokenType.Number,
        TokenType.RBracket,
      ]);
    });
  });
});
