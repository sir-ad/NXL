export enum TokenType {
  // MetaGlyph symbols
  Arrow,          // → or ->
  In,             // ∈
  Implies,        // ⇒ or =>
  Intersect,      // ∩ or &&
  Not,            // ¬
  Compose,        // ∘ or |>

  // Keywords
  Select,         // select
  True,           // true
  False,          // false

  // Operators
  Plus,           // +
  Minus,          // -
  Star,           // *
  Slash,          // /
  Gt,             // >
  Lt,             // <
  Gte,            // >=
  Lte,            // <=
  Eq,             // ==
  Neq,            // !=
  Assign,         // =
  Bang,           // !
  Pipe,           // |

  // Shorthand suffixes (context-dependent with identifier)
  Query,          // ?
  At,             // @

  // Punctuation
  LParen,         // (
  RParen,         // )
  LBrace,         // {
  RBrace,         // }
  LBracket,       // [
  RBracket,       // ]
  Colon,          // :
  Comma,          // ,
  Dot,            // .
  Ellipsis,       // ...

  // Literals
  Number,
  String,
  Identifier,

  // Structure
  Newline,
  Comment,
  EOF,
}

export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

export interface Token {
  type: TokenType;
  value: string;
  loc: SourceLocation;
}

export const KEYWORDS: Record<string, TokenType> = {
  select: TokenType.Select,
  true: TokenType.True,
  false: TokenType.False,
};

// Maps Unicode MetaGlyph symbols to their token types
export const METAGLYPH_UNICODE: Record<string, TokenType> = {
  '\u2192': TokenType.Arrow,       // →
  '\u2208': TokenType.In,          // ∈
  '\u21D2': TokenType.Implies,     // ⇒
  '\u2229': TokenType.Intersect,   // ∩
  '\u00AC': TokenType.Not,         // ¬
  '\u2218': TokenType.Compose,     // ∘
};

// Human-readable names for token types (used in error messages)
export const TOKEN_NAMES: Record<TokenType, string> = {
  [TokenType.Arrow]: '→',
  [TokenType.In]: '∈',
  [TokenType.Implies]: '⇒',
  [TokenType.Intersect]: '∩',
  [TokenType.Not]: '¬',
  [TokenType.Compose]: '∘',
  [TokenType.Select]: 'select',
  [TokenType.True]: 'true',
  [TokenType.False]: 'false',
  [TokenType.Plus]: '+',
  [TokenType.Minus]: '-',
  [TokenType.Star]: '*',
  [TokenType.Slash]: '/',
  [TokenType.Gt]: '>',
  [TokenType.Lt]: '<',
  [TokenType.Gte]: '>=',
  [TokenType.Lte]: '<=',
  [TokenType.Eq]: '==',
  [TokenType.Neq]: '!=',
  [TokenType.Assign]: '=',
  [TokenType.Bang]: '!',
  [TokenType.Pipe]: '|',
  [TokenType.Query]: '?',
  [TokenType.At]: '@',
  [TokenType.LParen]: '(',
  [TokenType.RParen]: ')',
  [TokenType.LBrace]: '{',
  [TokenType.RBrace]: '}',
  [TokenType.LBracket]: '[',
  [TokenType.RBracket]: ']',
  [TokenType.Colon]: ':',
  [TokenType.Comma]: ',',
  [TokenType.Dot]: '.',
  [TokenType.Ellipsis]: '...',
  [TokenType.Number]: 'number',
  [TokenType.String]: 'string',
  [TokenType.Identifier]: 'identifier',
  [TokenType.Newline]: 'newline',
  [TokenType.Comment]: 'comment',
  [TokenType.EOF]: 'end of file',
};
