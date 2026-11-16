// parse(markdown) -> HTML identical to marked 18.1.3 (defaults: gfm true, breaks false,
// pedantic false, async false). A from-scratch reimplementation targeting the exact output
// of marked v18.1.3 for the markdown-render-speed-02 cases.
//
// The regex grammar below is derived from marked's published MIT-licensed source
// (github.com/markedjs/marked, tag v18.1.3). See LICENSE for the MIT notice.

// ---------------------------------------------------------------------------
// "other" regexes (marked rules.ts `other`)
// ---------------------------------------------------------------------------
const codeRemoveIndent = /^(?: {0,3}\t| {1,4})/gm;
const outputLinkReplace = /\\([\[\]])/g;
const indentCodeCompensation = /^(\s+)(?:```)/;
const beginningSpace = /^\s+/;
const endingHash = /#$/;
const startingSpaceChar = /^ /;
const endingSpaceChar = / $/;
const endingSpaceTabChar = /[ \t]$/;
const nonSpaceChar = /[^ ]/;
const newLineCharGlobal = /\n/g;
const tabCharGlobal = /\t/g;
const leadingSpaceTab = /^[ \t]+/;
const multipleSpaceGlobal = /\s+/g;
const blankLine = /^[ \t]*$/;
const doubleBlankLine = /\n[ \t]*\n[ \t]*$/;
const blockquoteStart = /^ {0,3}>/;
const blockquoteSetextReplace = /\n {0,3}((?:=+|-+)[ \t]*)(?=\n|$)/g;
const blockquoteSetextReplace2 = /^ {0,3}>[ \t]?/gm;
const blockquoteMarkerWhitespace = /^( {0,3}>)([ \t]+)/gm;
const listIsTask = /^\[[ xX]\][ \t]+\S/;
const listReplaceTask = /^\[[ xX]\][ \t]+/;
const listTaskCheckbox = /\[[ xX]\]/;
const anyLine = /\n.*\n/;
const hrefBrackets = /^<(.*)>$/;
const tableDelimiter = /[:|]/;
const tableAlignChars = /^\||\| *$/g;
const tableRowBlankLine = /\n[ \t]*$/;
const tableAlignRight = /^ *-+: *$/;
const tableAlignCenter = /^ *:-+: *$/;
const tableAlignLeft = /^ *:-+ *$/;
const startATag = /^<a /i;
const endATag = /^<\/a>/i;
const startPreScriptTag = /^<(pre|code|kbd|script)(\s|>)/i;
const endPreScriptTag = /^<\/(pre|code|kbd|script)(\s|>)/i;
const startAngleBracket = /^</;
const endAngleBracket = />$/;
const unicodeAlphaNumeric = /[\p{L}\p{N}]/u;
const numericCharacterReference = /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/;
const numericCharacterReferenceOrAmpersand = /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g;
const escapeTest = /[&<>"']/;
const escapeReplace = /[&<>"']/g;
const escapeTestNoEncode = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/;
const escapeReplaceNoEncode = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g;
const percentDecode = /%25/g;
const findPipe = /\|/g;
const splitPipe = / \|/;
const slashPipe = /\\\|/g;
const carriageReturn = /\r\n|\r/g;
const notSpaceStart = /^\S*/;
const endingNewline = /\n$/;

// ---------------------------------------------------------------------------
// Block grammar (GFM), exact regexes from marked 18.1.3
// ---------------------------------------------------------------------------
const BLOCK_BLOCKQUOTE = /^( {0,3}> ?(?:(?![ \t]*(?:\n|$))(([^\n]+(?:\n(?! {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)| {0,3}#{1,6}(?:\s|$)| {0,3}>| {0,3}(?:`{3,}(?=[^`\n]*(?:\n|$))|~~~)[^\n]*(?:\n|$)| {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)| {0,3}(?:<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: +|\n|\/?>)|<(?:(?:script|pre|style|textarea)(?:[\s>]|$)|!--)|<\?|<![A-Za-z]|<!\[CDATA\[)|[ \t]+\n)[^\n]+)*))|[^\n]*)(?:\n|$))+/;
const BLOCK_CODE = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
const BLOCK_DEF = /^ {0,3}\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)((?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\\n]|\n(?!\n))*'|\((?:\\[\s\S]|[^()\\])*\))))? *(?:\n+|$)/;
const BLOCK_FENCES = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}(?:(?=`)\1`*|(?=~)\1~*) *(?=\n|$)|$)/;
const BLOCK_HEADING = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
const BLOCK_HR = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
const BLOCK_HTML = /^ {0,3}(?:<(script|pre|style|textarea)[\s>][\s\S]*?(?:<\/\1>[^\n]*\n*|$)|<!--(?:-?>|[\s\S]*?(?:-->|$))[^\n]*(\n+|$)|<\?[\s\S]*?(?:\?>[^\n]*\n*|$)|<![A-Z][\s\S]*?(?:>[^\n]*\n*|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>[^\n]*\n*|$)|<\/?(address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:[ \t]+|\n|\/?>|$)[\s\S]*?(?:(?:\n[ 	]*)+\n|$)|<(?!(?:script|pre|style|textarea)(?![a-z0-9-]))([a-z][a-z0-9-]*)(?: +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?)*? *\/?>(?=[ \t]*(?:\n|$))[\s\S]*?(?:(?:\n[ 	]*)+\n|$)|<\/[a-z][a-z0-9-]*\s*>(?=[ \t]*(?:\n|$))[\s\S]*?(?:(?:\n[ 	]*)+\n|$))/i;
const BLOCK_LHEADING = /^(?! {0,3}(?:[*+-]|\d{1,9}[.)]) |(?: {4}| {0,3}\t)| {0,3}(?:`{3,}|~{3,})| {0,3}>| {0,3}#{1,6}(?:\s|$)| {0,3}<[^\n>]+>\n| {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n)((?:.|\n(?!\s*?\n| {0,3}(?:[*+-]|\d{1,9}[.)]) | {0,3}(?:`{3,}|~{3,})| {0,3}>| {0,3}#{1,6}(?:\s|$)| {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)| {0,3}<[^\n>]+>\n| {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n))+?)\n {0,3}(=+|-+)[ \t]*(?:\n+|$)/;
const BLOCK_LIST = /^( {0,3}(?:[*+-]|\d{1,9}[.)]))([ \t][^\n]*?)?(?:\n|$)/;
const BLOCK_NEWLINE = /^(?:[ \t]*(?:\n|$))+/;
const BLOCK_PARAGRAPH = /^([^\n]+(?:\n(?! {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)| {0,3}#{1,6}(?:\s|$)| {0,3}>| {0,3}(?:`{3,}(?=[^`\n]*(?:\n|$))|~~~)[^\n]*(?:\n|$)| {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]| {0,3}(?:<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: +|\n|\/?>)|<(?:(?:script|pre|style|textarea)(?:[\s>]|$)|!--)|<\?|<![A-Za-z]|<!\[CDATA\[)| *([^\n ].*)\n {0,3}((?:\| *)?:?-+:? *(?:\| *:?-+:? *)*(?:\| *)?)(?:\n((?:(?! *\n| {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)| {0,3}#{1,6}(?:\s|$)| {0,3}>|(?: {4}| {0,3}	)[^\n]| {0,3}(?:`{3,}(?=[^`\n]*(?:\n|$))|~~~)[^\n]*(?:\n|$)| {0,3}(?:[*+-]|1[.)])[ \t]| {0,3}(?:<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: +|\n|\/?>)|<(?:(?:script|pre|style|textarea)(?:[\s>]|$)|!--)|<\?|<![A-Za-z]|<!\[CDATA\[)).*(?:\n|$))*)\n*|$)|[ \t]+\n)[^\n]+)*)/;
const BLOCK_TABLE = /^ *([^\n ].*)\n {0,3}((?:\| *)?:?-+:? *(?:\| *:?-+:? *)*(?:\| *)?)(?:\n((?:(?! *\n| {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)| {0,3}#{1,6}(?:\s|$)| {0,3}>|(?: {4}| {0,3}	)[^\n]| {0,3}(?:`{3,}(?=[^`\n]*(?:\n|$))|~~~)[^\n]*(?:\n|$)| {0,3}(?:[*+-]|1[.)])[ \t]| {0,3}(?:<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: +|\n|\/?>)|<(?:(?:script|pre|style|textarea)(?:[\s>]|$)|!--)|<\?|<![A-Za-z]|<!\[CDATA\[)).*(?:\n|$))*)\n*|$)/;
const BLOCK_TEXT = /^[^\n]+/;

// ---------------------------------------------------------------------------
// Inline grammar (GFM), exact regexes from marked 18.1.3
// ---------------------------------------------------------------------------
const INLINE__BACKPEDAL = /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/;
const INLINE_ANYPUNCTUATION = /\\([\p{P}\p{S}])/gu;
const INLINE_ANYPUNCTUATIONOUTSIDECODE = /(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)|`+|\\([\p{P}\p{S}])/gu;
const INLINE_AUTOLINK = /^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s\x00-\x1f<>]*|[a-zA-Z0-9.!#$%&'*+/=?_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_]))>/;
const INLINE_BLOCKSKIP = /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)|(?<!`)()(?<b>`+)[^`]+\k<b>(?!`)|<(?! )[^<>]*?>/g;
const INLINE_BR = /^( {2,}|\\)\n(?!\s*$)[ \t]*/;
const INLINE_CODE = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
const INLINE_DEL = /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/;
const INLINE_DELLDELIM = /^~~?(?:((?!~)[\p{P}\p{S}])|[^\s~])/u;
const INLINE_DELRDELIM = /^[^~]+(?=[^~])|(?!~)[\p{P}\p{S}](~~?)(?=[\s]|$)|[^\s\p{P}\p{S}](~~?)(?!~)(?=[\s\p{P}\p{S}]|$)|(?!~)[\s\p{P}\p{S}](~~?)(?=[^\s\p{P}\p{S}])|[\s](~~?)(?!~)(?=[\p{P}\p{S}])|(?!~)[\p{P}\p{S}](~~?)(?!~)(?=[\p{P}\p{S}])|[^\s\p{P}\p{S}](~~?)(?=[^\s\p{P}\p{S}])/gu;
const INLINE_EMSTRONGLDELIM = /^(?:\*+(?:((?!\*)(?!~)[\p{P}\p{S}])|([^\s*]))?)|^_+(?:((?!_)(?!~)[\p{P}\p{S}])|([^\s_]))?/u;
const INLINE_EMSTRONGRDELIMAST = /^[^_*]*?__[^_*]*?\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\*)(?!~)[\p{P}\p{S}](\*+)(?=[\s]|$)|(?:[^\s\p{P}\p{S}]|~)(\*+)(?!\*)(?=(?!~)[\s\p{P}\p{S}]|$)|(?!\*)(?!~)[\s\p{P}\p{S}](\*+)(?=(?:[^\s\p{P}\p{S}]|~))|[\s](\*+)(?!\*)(?=(?!~)[\p{P}\p{S}])|(?!\*)(?!~)[\p{P}\p{S}](\*+)(?!\*)(?=(?!~)[\p{P}\p{S}])|(?:[^\s\p{P}\p{S}]|~)(\*+)(?=(?:[^\s\p{P}\p{S}]|~))/gu;
const INLINE_EMSTRONGRDELIMUND = /^[^_*]*?\*\*[^_*]*?_[^_*]*?(?=\*\*)|[^_]+(?=[^_])|(?!_)[\p{P}\p{S}](_+)(?=[\s]|$)|[^\s\p{P}\p{S}](_+)(?!_)(?=[\s\p{P}\p{S}]|$)|(?!_)[\s\p{P}\p{S}](_+)(?=[^\s\p{P}\p{S}])|[\s](_+)(?!_)(?=[\p{P}\p{S}])|(?!_)[\p{P}\p{S}](_+)(?!_)(?=[\p{P}\p{S}])/gu;
const INLINE_ESCAPE = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
const INLINE_LINK = /^!?\[((?:\[(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?)\]\([ \t\n]*(<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\)))(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\((?:\\[\s\S]|[^)\\])*\)))?[ \t\n]*\)/;
const INLINE_NOLINK = /^!?\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+)\](?:\[\])?/;
const INLINE_PUNCTUATION = /^((?![*_])[\s\p{P}\p{S}])/u;
const INLINE_REFLINK = /^!?\[((?:\[(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?)\]\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+)\]/;
const INLINE_REFLINKSEARCH = /!?\[((?:[^\[\]\\`]*(?:\[(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\]))){0,999}?[^\[\]\\`]*?)\]\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999})\]|!?\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999})\](?:\[\])?(?!\()/g;
const INLINE_TAG = /^<!--(?:-?>|[\s\S]*?-->)|^<\/[a-zA-Z][a-zA-Z0-9-]*\s*>|^<[a-zA-Z][a-zA-Z0-9-]*(?:\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?)*?\s*\/?>|^<\?[\s\S]*?\?>|^<![a-zA-Z]+\s[\s\S]*?>|^<!\[CDATA\[[\s\S]*?\]\]>/;
const INLINE_TEXT = /^(?:[^a-zA-Z0-9](?=(?:mailto|xmpp):)|(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|[hH][tT][tT][pP][sS]?|[fF][tT][pP]:\/\/|(?<![^\s*_~(])www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9](?=(?:mailto|xmpp):)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))))/;
const INLINE_URL = /^(?:mailto:[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])|xmpp:[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])(?:\/[A-Za-z0-9@.]+)?)|^((?:[hH][tT][tT][pP][sS]?|[fF][tT][pP]):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/;

// ---------------------------------------------------------------------------
// Indent-cached block regexes (marked cachedIndentRegex: cacheIndex = clamp(indent-1, 0, 3))
// ---------------------------------------------------------------------------
const _TAG = 'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul';

function _cached(fn) {
  const cache = [];
  return (indent) => {
    const cacheIndex = Math.max(0, Math.min(3, indent - 1));
    let r = cache[cacheIndex];
    if (!r) {
      r = fn(cacheIndex);
      cache[cacheIndex] = r;
    }
    return r;
  };
}

const nextBulletRegex = _cached((i) => new RegExp(`^ {0,${i}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\\n]*)?(?:\\n|$))`));
const hrRegex = _cached((i) => new RegExp(`^ {0,${i}}((?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\\*[ \t]*){3,})(?:\\n+|$)`));
const fencesBeginRegex = _cached((i) => new RegExp(`^ {0,${i}}(?:\`\`\`|~~~)`));
const headingBeginRegex = _cached((i) => new RegExp(`^ {0,${i}}#{1,6}(?:\\s|$)`));
const htmlBeginRegex = _cached((i) => new RegExp(`^ {0,${i}}(?:</?(?:${_TAG})(?: +|$|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)`, 'i'));
const blockquoteBeginRegex = _cached((i) => new RegExp(`^ {0,${i}}>`));
function listItemRegex(bull) {
  return new RegExp(`^( {0,3}${bull})((?:[\t ][^\\n]*)?(?:\\n|$))`);
}

// ---------------------------------------------------------------------------
// Helpers (marked helpers.ts)
// ---------------------------------------------------------------------------
function escapeHtmlEntities(html, encode) {
  if (encode) {
    if (escapeTest.test(html)) return html.replace(escapeReplace, _escapeReplacement);
  } else if (escapeTestNoEncode.test(html)) {
    return html.replace(escapeReplaceNoEncode, _escapeReplacement);
  }
  return html;
}
const _escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function _escapeReplacement(ch) { return _escapeMap[ch]; }

function decodeNumericCharacterReferences(text) {
  if (!numericCharacterReference.test(text)) return text;
  return text.replace(numericCharacterReferenceOrAmpersand, (ref, dec, hex) => {
    if (dec === undefined && hex === undefined) return '&amp;';
    const code = dec === undefined ? Number.parseInt(hex, 16) : Number.parseInt(dec, 10);
    if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '\uFFFD';
    return code === 38 ? '&amp;' : String.fromCodePoint(code);
  });
}

function cleanUrl(href) {
  try {
    href = encodeURI(href).replace(percentDecode, '%');
  } catch {
    return null;
  }
  return href;
}

function splitCells(tableRow, count) {
  const row = tableRow.replace(findPipe, (match, offset, str) => {
    let escaped = false;
    let curr = offset;
    while (--curr >= 0 && str[curr] === '\\') escaped = !escaped;
    if (escaped) return '|';
    return ' |';
  });
  const cells = row.split(splitPipe);
  let i = 0;
  if (!cells[0].trim()) cells.shift();
  if (cells.length > 0 && !cells.at(-1)?.trim()) cells.pop();
  if (count) {
    if (cells.length > count) cells.splice(count);
    else while (cells.length < count) cells.push('');
  }
  for (; i < cells.length; i++) {
    cells[i] = cells[i].trim().replace(slashPipe, '|');
  }
  return cells;
}

function rtrim(str, c) {
  const l = str.length;
  if (l === 0) return '';
  let suffLen = 0;
  while (suffLen < l) {
    if (str.charAt(l - suffLen - 1) === c) suffLen++;
    else break;
  }
  return str.slice(0, l - suffLen);
}

function trimTrailingBlankLines(str) {
  const lines = str.split('\n');
  let end = lines.length - 1;
  while (end >= 0 && blankLine.test(lines[end])) end--;
  if (lines.length - end <= 2) return str;
  return lines.slice(0, end + 1).join('\n');
}

function normalizeLabel(label) {
  return label.trim().replace(multipleSpaceGlobal, ' ').toLowerCase().toUpperCase().toLowerCase();
}

function findClosingBracket(str, b) {
  if (str.indexOf(b[0]) === -1 && str.indexOf(b[1]) === -1) return -1;
  let level = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\') i++;
    else if (str[i] === b[0]) level++;
    else if (str[i] === b[1]) { level--; if (level < 0) return i; }
  }
  if (level > 0) return -2;
  return -1;
}

function expandTabs(line, indent = 0) {
  let col = indent;
  let expanded = '';
  for (const char of line) {
    if (char === '\t') {
      const added = 4 - (col % 4);
      expanded += ' '.repeat(added);
      col += added;
    } else {
      expanded += char;
      col++;
    }
  }
  return expanded;
}

// Number of code points in `s` (== [...s].length, without allocating).
function cpLen(s) {
  let n = s.length;
  for (let i = 0; i + 1 < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && s.charCodeAt(i + 1) >= 0xdc00 && s.charCodeAt(i + 1) <= 0xdfff) {
      n--;
      i++;
    }
  }
  return n;
}

// Code-unit length of the first code point of `s` (== [...s][0].length).
function firstCpLen(s) {
  const c0 = s.charCodeAt(0);
  if (c0 >= 0xd800 && c0 <= 0xdbff) {
    const c1 = s.charCodeAt(1);
    if (c1 >= 0xdc00 && c1 <= 0xdfff) return 2;
  }
  return 1;
}

// The code point immediately before index `idx` (== [...s.slice(max(0,idx-2),idx)].at(-1) ?? '').
function prevCp(s, idx) {
  if (idx <= 0) return '';
  const c0 = s.charCodeAt(idx - 1);
  if (idx - 2 >= 0) {
    const c1 = s.charCodeAt(idx - 2);
    if (c1 >= 0xd800 && c1 <= 0xdbff && c0 >= 0xdc00 && c0 <= 0xdfff) return s.slice(idx - 2, idx);
  }
  return s.slice(idx - 1, idx);
}

// First line of a string (== s.split('\n', 1)[0]) without allocating an array.
function firstLine(s) {
  const i = s.indexOf('\n');
  return i === -1 ? s : s.slice(0, i);
}

// ---------------------------------------------------------------------------
// The lexer (block + inline). Ports marked _Lexer + _Tokenizer for GFM defaults.
// ---------------------------------------------------------------------------
class Lexer {
  constructor() {
    this.tokens = [];
    this.tokens.links = Object.create(null);
    this.inlineQueue = [];
    this.state = { inLink: false, inRawBlock: false, linkEmitted: false, linkParenPossible: true, top: true };
    this.closerFrames = [];
  }

  lex(src) {
    src = src.replace(carriageReturn, '\n');
    this.blockTokens(src, this.tokens);
    for (let i = 0; i < this.inlineQueue.length; i++) {
      const next = this.inlineQueue[i];
      this.state.inRawBlock = false;
      this.inlineTokens(next.src, next.tokens);
    }
    this.inlineQueue = [];
    return this.tokens;
  }

  // ---- block level ----

  blockTokens(src, tokens, lastParagraphClipped = false) {
    let srcLength = Infinity;
    while (src) {
      if (src.length < srcLength) srcLength = src.length;
      else throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));

      let token;

      // newline
      if ((token = this._space(src))) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.raw.length === 1 && lastToken !== undefined) {
          lastToken.raw += '\n';
        } else {
          tokens.push(token);
        }
        continue;
      }
      // code
      if ((token = this._code(src))) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === 'paragraph' || lastToken?.type === 'text') {
          lastToken.raw += (lastToken.raw.endsWith('\n') ? '' : '\n') + token.raw;
          lastToken.text += '\n' + token.text;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      // fences
      if ((token = this._fences(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      // heading
      if ((token = this._heading(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      // hr
      if ((token = this._hr(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      // blockquote
      if ((token = this._blockquote(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      // list
      if ((token = this._list(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      // html
      if ((token = this._html(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      // def
      if ((token = this._def(src))) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === 'paragraph' || lastToken?.type === 'text') {
          lastToken.raw += (lastToken.raw.endsWith('\n') ? '' : '\n') + token.raw;
          lastToken.text += '\n' + token.raw;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          if (!this.tokens.links[token.tag]) {
            this.tokens.links[token.tag] = { href: token.href, title: token.title };
          }
          tokens.push(token);
        }
        continue;
      }
      // table (gfm)
      if ((token = this._table(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      // lheading
      if ((token = this._lheading(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      // paragraph
      if (this.state.top && (token = this._paragraph(src))) {
        const lastToken = tokens.at(-1);
        if (lastParagraphClipped && lastToken?.type === 'paragraph') {
          lastToken.raw += (lastToken.raw.endsWith('\n') ? '' : '\n') + token.raw;
          lastToken.text += '\n' + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        lastParagraphClipped = false;
        src = src.substring(token.raw.length);
        continue;
      }
      // text
      if ((token = this._text(src))) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === 'text') {
          lastToken.raw += (lastToken.raw.endsWith('\n') ? '' : '\n') + token.raw;
          lastToken.text += '\n' + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
    }
    this.state.top = true;
    return tokens;
  }

  _space(src) {
    const cap = BLOCK_NEWLINE.exec(src);
    if (cap && cap[0].length > 0) return { type: 'space', raw: cap[0] };
  }

  _code(src) {
    const cap = BLOCK_CODE.exec(src);
    if (cap) {
      const raw = trimTrailingBlankLines(cap[0]);
      const text = raw.replace(codeRemoveIndent, '');
      return { type: 'code', raw, codeBlockStyle: 'indented', text };
    }
  }

  _fences(src) {
    const cap = BLOCK_FENCES.exec(src);
    if (cap) {
      const raw = cap[0];
      const text = _indentCodeCompensation(raw, cap[3] || '');
      return {
        type: 'code',
        raw,
        lang: cap[2] ? cap[2].trim().replace(INLINE_ANYPUNCTUATION, '$1') : cap[2],
        text,
      };
    }
  }

  _heading(src) {
    const cap = BLOCK_HEADING.exec(src);
    if (cap) {
      let text = cap[2].trim();
      if (endingHash.test(text)) {
        const trimmed = rtrim(text, '#');
        if (!trimmed || endingSpaceTabChar.test(trimmed)) text = trimmed.trim();
      }
      return {
        type: 'heading',
        raw: rtrim(cap[0], '\n'),
        depth: cap[1].length,
        text,
        tokens: this._inline(text),
      };
    }
  }

  _hr(src) {
    const cap = BLOCK_HR.exec(src);
    if (cap) return { type: 'hr', raw: rtrim(cap[0], '\n') };
  }

  _blockquote(src) {
    const cap = BLOCK_BLOCKQUOTE.exec(src);
    if (cap) {
      let lines = rtrim(cap[0], '\n').split('\n');
      let raw = '';
      let text = '';
      const tokens = [];
      while (lines.length > 0) {
        let inBlockquote = false;
        const currentLines = [];
        let i;
        for (i = 0; i < lines.length; i++) {
          if (blockquoteStart.test(lines[i])) {
            currentLines.push(lines[i]);
            inBlockquote = true;
          } else if (!inBlockquote) {
            currentLines.push(lines[i]);
          } else {
            break;
          }
        }
        lines = lines.slice(i);
        const currentRaw = currentLines.join('\n');
        const currentText = currentRaw
          .replace(blockquoteMarkerWhitespace, (_, marker, whitespace) => marker + expandTabs(whitespace, marker.length))
          .replace(blockquoteSetextReplace, '\n    $1')
          .replace(blockquoteSetextReplace2, '');
        raw = raw ? `${raw}\n${currentRaw}` : currentRaw;
        text = text ? `${text}\n${currentText}` : currentText;
        const top = this.state.top;
        this.state.top = true;
        this.blockTokens(currentText, tokens, true);
        this.state.top = top;
        if (lines.length === 0) break;
        const lastToken = tokens.at(-1);
        if (lastToken?.type === 'code' || lastToken?.type === 'heading' || lastToken?.type === 'hr' || lastToken?.type === 'html' || lastToken?.type === 'table') {
          break;
        } else if (lastToken?.type === 'blockquote') {
          const oldToken = lastToken;
          const continuation = lines.join('\n');
          const newText = oldToken.raw + '\n' + continuation.replace(blockquoteSetextReplace2, '');
          const newToken = this._blockquote(newText);
          tokens[tokens.length - 1] = newToken;
          const leftover = newText.substring(newToken.raw.length).replace(/^\n/, '');
          const leftoverCount = leftover ? leftover.split('\n').length : 0;
          const consumed = leftoverCount ? lines.slice(0, -leftoverCount) : lines;
          if (consumed.length > 0) raw = `${raw}\n${consumed.join('\n')}`;
          text = text.substring(0, text.length - oldToken.text.length) + newToken.text;
          lines = lines.slice(consumed.length);
          if (lines.length > 0 && blockquoteStart.test(lines[0])) continue;
          break;
        } else if (lastToken?.type === 'list') {
          const oldToken = lastToken;
          const newText = oldToken.raw + '\n' + lines.join('\n');
          const newToken = this._list(newText);
          tokens[tokens.length - 1] = newToken;
          const consumedCount = newToken.raw.length > oldToken.raw.length
            ? newText.slice(oldToken.raw.length + 1, newToken.raw.length).split('\n').length
            : 0;
          if (consumedCount > 0) {
            const consumed = lines.slice(0, consumedCount).join('\n');
            raw = `${raw}\n${consumed}`;
            text = `${text}\n${consumed}`;
          }
          lines = lines.slice(consumedCount);
          continue;
        }
      }
      return { type: 'blockquote', raw, tokens, text };
    }
  }

  _list(src) {
    let cap = BLOCK_LIST.exec(src);
    if (cap) {
      const listSrc = src;
      const taken = () => listSrc.length - src.length;
      let bull = cap[1].trim();
      const isordered = bull.length > 1;
      const list = {
        type: 'list',
        raw: '',
        ordered: isordered,
        start: isordered ? +bull.slice(0, -1) : '',
        loose: false,
        items: [],
      };
      bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
      const itemRegex = listItemRegex(bull);
      let endsWithBlankLine = false;
      while (src) {
        let endEarly = false;
        let itemContents = '';
        if (!(cap = itemRegex.exec(src))) break;
        if (BLOCK_HR.test(src)) break;
        const itemStart = taken();
        src = src.substring(cap[0].length);
        const firstLineText = firstLine(cap[2]);
        const bulletIndent = cap[1].length;
        let line = firstLineText.replace(leadingSpaceTab, (whitespace) => expandTabs(whitespace, bulletIndent));
        let nextLine = firstLine(src);
        let blankLineFlag = !line.trim();
        let indent = 0;
        if (blankLineFlag) {
          indent = bulletIndent + 1;
        } else {
          indent = line.search(nonSpaceChar);
          indent = indent > 4 ? 1 : indent;
          itemContents = line.slice(indent);
          indent += bulletIndent;
        }
        if (blankLineFlag && blankLine.test(nextLine)) {
          src = src.substring(nextLine.length + 1);
          endEarly = true;
        }
        if (!endEarly) {
          const nextBullet = nextBulletRegex(indent);
          const hrR = hrRegex(indent);
          const fencesBegin = fencesBeginRegex(indent);
          const headingBegin = headingBeginRegex(indent);
          const htmlBegin = htmlBeginRegex(indent);
          const blockquoteBegin = blockquoteBeginRegex(indent);
          while (src) {
            const rawLine = firstLine(src);
            let nextLineWithoutTabs;
            nextLine = rawLine;
            nextLineWithoutTabs = nextLine.replace(leadingSpaceTab, (whitespace) => expandTabs(whitespace));
            if (fencesBegin.test(nextLine)) break;
            if (headingBegin.test(nextLine)) break;
            if (htmlBegin.test(nextLine)) break;
            if (blockquoteBegin.test(nextLine)) break;
            if (nextBullet.test(nextLine)) break;
            if (hrR.test(nextLine)) break;
            if (nextLineWithoutTabs.search(nonSpaceChar) >= indent || !nextLine.trim()) {
              itemContents += '\n' + nextLineWithoutTabs.slice(indent);
            } else {
              if (blankLineFlag) break;
              if (line.replace(tabCharGlobal, '    ').search(nonSpaceChar) >= 4) break;
              if (fencesBegin.test(line)) break;
              if (headingBegin.test(line)) break;
              if (htmlBegin.test(line)) break;
              if (hrR.test(line)) break;
              const setextContinuation = /^ {0,3}(?:=+|-+) *$/.test(nextLine) && BLOCK_LHEADING.test(`${line}\n${nextLine}`);
              const continuation = setextContinuation
                ? `    ${nextLineWithoutTabs.replace(/^ {0,3}/, '')}`
                : nextLine;
              itemContents += '\n' + continuation;
            }
            blankLineFlag = !nextLine.trim();
            src = src.substring(rawLine.length + 1);
            line = nextLineWithoutTabs.slice(indent);
          }
        }
        const raw = listSrc.slice(itemStart, taken());
        if (!list.loose) {
          if (endsWithBlankLine) list.loose = true;
          else if (doubleBlankLine.test(raw)) endsWithBlankLine = true;
        }
        list.items.push({
          type: 'list_item',
          raw,
          task: listIsTask.test(itemContents),
          loose: false,
          text: itemContents,
          tokens: [],
        });
      }
      const lastItem = list.items.at(-1);
      if (lastItem) {
        lastItem.raw = lastItem.raw.trimEnd();
        lastItem.text = lastItem.text.trimEnd();
      } else {
        return;
      }
      list.raw = listSrc.slice(0, taken()).trimEnd();
      for (const item of list.items) {
        this.state.top = false;
        item.tokens = this.blockTokens(item.text, []);
        if (!list.loose) {
          const spacers = item.tokens.filter((t) => t.type === 'space');
          const hasMultipleLineBreaks = spacers.length > 0 && spacers.some((t) => anyLine.test(t.raw));
          list.loose = hasMultipleLineBreaks;
        }
      }
      for (const item of list.items) {
        const itemToken = item.tokens[0];
        if (item.task && (itemToken?.type === 'text' || itemToken?.type === 'paragraph')) {
          item.text = item.text.replace(listReplaceTask, '');
          itemToken.raw = itemToken.raw.replace(listReplaceTask, '');
          itemToken.text = itemToken.text.replace(listReplaceTask, '');
          for (let i = this.inlineQueue.length - 1; i >= 0; i--) {
            if (listIsTask.test(this.inlineQueue[i].src)) {
              this.inlineQueue[i].src = this.inlineQueue[i].src.replace(listReplaceTask, '');
              break;
            }
          }
          const taskRaw = listTaskCheckbox.exec(item.raw);
          if (taskRaw) {
            const checkboxToken = {
              type: 'checkbox',
              raw: taskRaw[0] + ' ',
              checked: taskRaw[0] !== '[ ]',
            };
            item.checked = checkboxToken.checked;
            if (list.loose) {
              if (item.tokens[0] && ['paragraph', 'text'].includes(item.tokens[0].type) && 'tokens' in item.tokens[0] && item.tokens[0].tokens) {
                item.tokens[0].raw = checkboxToken.raw + item.tokens[0].raw;
                item.tokens[0].text = checkboxToken.raw + item.tokens[0].text;
                item.tokens[0].tokens.unshift(checkboxToken);
              } else {
                item.tokens.unshift({ type: 'paragraph', raw: checkboxToken.raw, text: checkboxToken.raw, tokens: [checkboxToken] });
              }
            } else {
              item.tokens.unshift(checkboxToken);
            }
          }
        } else if (item.task) {
          item.task = false;
        }
      }
      if (list.loose) {
        for (const item of list.items) {
          item.loose = true;
          for (const token of item.tokens) {
            if (token.type === 'text') token.type = 'paragraph';
          }
        }
      }
      return list;
    }
  }

  _html(src) {
    const cap = BLOCK_HTML.exec(src);
    if (cap) {
      const raw = trimTrailingBlankLines(cap[0]);
      return {
        type: 'html',
        block: true,
        raw,
        pre: cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style',
        text: raw,
      };
    }
  }

  _def(src) {
    const cap = BLOCK_DEF.exec(src);
    if (cap) {
      if (!startAngleBracket.test(cap[2]) && findClosingBracket(cap[2], '()') !== -1) return;
      const tag = normalizeLabel(cap[1]);
      const href = cap[2] ? cap[2].replace(hrefBrackets, '$1').replace(INLINE_ANYPUNCTUATION, '$1') : '';
      const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(INLINE_ANYPUNCTUATION, '$1') : cap[3];
      return { type: 'def', tag, raw: rtrim(cap[0], '\n'), href, title };
    }
  }

  _table(src) {
    const cap = BLOCK_TABLE.exec(src);
    if (!cap) return;
    if (!tableDelimiter.test(cap[2])) return;
    const headers = splitCells(cap[1]);
    const aligns = cap[2].replace(tableAlignChars, '').split('|');
    const rows = cap[3]?.trim() ? cap[3].replace(tableRowBlankLine, '').split('\n') : [];
    const item = { type: 'table', raw: rtrim(cap[0], '\n'), header: [], align: [], rows: [] };
    if (headers.length !== aligns.length) return;
    for (const align of aligns) {
      if (tableAlignRight.test(align)) item.align.push('right');
      else if (tableAlignCenter.test(align)) item.align.push('center');
      else if (tableAlignLeft.test(align)) item.align.push('left');
      else item.align.push(null);
    }
    for (let i = 0; i < headers.length; i++) {
      item.header.push({ text: headers[i], tokens: this._inline(headers[i]), header: true, align: item.align[i] });
    }
    for (const row of rows) {
      item.rows.push(splitCells(row, item.header.length).map((cell, i) => ({ text: cell, tokens: this._inline(cell), header: false, align: item.align[i] })));
    }
    return item;
  }

  _lheading(src) {
    const cap = BLOCK_LHEADING.exec(src);
    if (cap) {
      const text = cap[1].trim();
      return {
        type: 'heading',
        raw: rtrim(cap[0], '\n'),
        depth: cap[2].charAt(0) === '=' ? 1 : 2,
        text,
        tokens: this._inline(text),
      };
    }
  }

  _paragraph(src) {
    const cap = BLOCK_PARAGRAPH.exec(src);
    if (cap) {
      const text = cap[1].charAt(cap[1].length - 1) === '\n' ? cap[1].slice(0, -1) : cap[1];
      return { type: 'paragraph', raw: cap[0], text, tokens: this._inline(text) };
    }
  }

  _text(src) {
    const cap = BLOCK_TEXT.exec(src);
    if (cap) {
      return { type: 'text', raw: cap[0], text: cap[0], tokens: this._inline(cap[0]) };
    }
  }

  // ---- inline level ----

  _inline(src, tokens = []) {
    this.inlineQueue.push({ src, tokens });
    return tokens;
  }

  inlineTokens(src, tokens = []) {
    const prevLinkParenPossible = this.state.linkParenPossible;
    this.state.linkParenPossible = prevLinkParenPossible && src.includes(')');
    const result = this._inlineTokensInner(src, tokens);
    this.state.linkParenPossible = prevLinkParenPossible;
    return result;
  }

  _inlineTokensInner(src, tokens) {
    const maskedSrc = (src.includes('*') || src.includes('_') || src.includes('~')) ? this._maskSrc(src) : src;
    this.closerFrames.push(_scanClosers(maskedSrc));
    let keepPrevChar = false;
    let prevChar = '';
    let srcLength = Infinity;
    while (src) {
      if (src.length < srcLength) srcLength = src.length;
      else throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
      if (!keepPrevChar) prevChar = '';
      keepPrevChar = false;
      let token;
      // escape
      if ((token = this._escape(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      // tag
      if ((token = this._tag(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      // link
      if ((token = this._link(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      // reflink, nolink
      if ((token = this._reflink(src))) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.type === 'text' && lastToken?.type === 'text') {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      // em & strong
      if ((token = this._emStrong(src, maskedSrc, prevChar))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      // code
      if ((token = this._codespan(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      // br
      if ((token = this._br(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      // del (gfm)
      if ((token = this._del(src, maskedSrc, prevChar))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      // autolink
      if ((token = this._autolink(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      // url (gfm)
      if (!this.state.inLink && (token = this._url(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      // text
      if ((token = this._inlineText(src))) {
        src = src.substring(token.raw.length);
        if (token.raw.slice(-1) !== '_') prevChar = token.raw.slice(-1);
        keepPrevChar = true;
        const lastToken = tokens.at(-1);
        if (lastToken?.type === 'text') {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
    }
    this.closerFrames.pop();
    return tokens;
  }

  _escape(src) {
    const cap = INLINE_ESCAPE.exec(src);
    if (cap) return { type: 'escape', raw: cap[0], text: cap[1] };
  }

  _tag(src) {
    const cap = INLINE_TAG.exec(src);
    if (cap) {
      if (!this.state.inLink && startATag.test(cap[0])) this.state.inLink = true;
      else if (this.state.inLink && endATag.test(cap[0])) this.state.inLink = false;
      if (!this.state.inRawBlock && startPreScriptTag.test(cap[0])) this.state.inRawBlock = true;
      else if (this.state.inRawBlock && endPreScriptTag.test(cap[0])) this.state.inRawBlock = false;
      return {
        type: 'html',
        raw: cap[0],
        inLink: this.state.inLink,
        inRawBlock: this.state.inRawBlock,
        block: false,
        text: cap[0],
      };
    }
  }

  _link(src) {
    if (this.state.linkParenPossible === false) return;
    const cap = INLINE_LINK.exec(src);
    if (cap) {
      const labelStart = cap[0].charAt(0) === '!' ? 2 : 1;
      if (_isLabelEndInsideToken(src, cap[1], labelStart)) return;
      const trimmedUrl = cap[2].trim();
      if (startAngleBracket.test(trimmedUrl)) {
        if (!endAngleBracket.test(trimmedUrl)) return;
        const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), '\\');
        if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) return;
      } else {
        const lastParenIndex = findClosingBracket(cap[2], '()');
        if (lastParenIndex === -2) return;
        if (lastParenIndex > -1) {
          const start = cap[0].indexOf('!') === 0 ? 5 : 4;
          const linkLen = start + cap[1].length + lastParenIndex;
          cap[2] = cap[2].substring(0, lastParenIndex);
          cap[0] = cap[0].substring(0, linkLen).trim();
          cap[3] = '';
        }
      }
      const unescaped = rtrim(cap[0].slice(0, -1), '\\');
      if ((cap[0].length - unescaped.length) % 2 === 0) return;
      let href = cap[2];
      let title = cap[3] ? cap[3].slice(1, -1) : '';
      href = href.trim();
      if (startAngleBracket.test(href)) href = href.slice(1, -1);
      return _outputLink(cap, {
        href: href ? href.replace(INLINE_ANYPUNCTUATION, '$1') : href,
        title: title ? title.replace(INLINE_ANYPUNCTUATION, '$1') : title,
      }, cap[0], this);
    }
  }

  _reflink(src) {
    let cap;
    if ((cap = INLINE_REFLINK.exec(src)) || (cap = INLINE_NOLINK.exec(src))) {
      const labelStart = cap[0].charAt(0) === '!' ? 2 : 1;
      if (_isLabelEndInsideToken(src, cap[1], labelStart)) return;
      const link = this.tokens.links[normalizeLabel(cap[2] || cap[1])];
      if (!link) {
        const text = cap[0].charAt(0);
        return { type: 'text', raw: text, text };
      }
      return _outputLink(cap, link, cap[0], this);
    }
  }

  _emStrong(src, maskedSrc, prevChar = '') {
    let match = INLINE_EMSTRONGLDELIM.exec(src);
    if (!match) return;
    if (!match[1] && !match[2] && !match[3] && !match[4]) return;
    const delimChar = match[0][0];
    const midRun = prevChar === delimChar;
    const srcStart = maskedSrc.length - src.length;
    let runStart = srcStart;
    while (runStart > 0 && maskedSrc[runStart - 1] === delimChar) runStart--;
    const runPrevChar = [...maskedSrc.slice(Math.max(0, runStart - 2), runStart)].at(-1) ?? '';
    const runPrevPunct = runPrevChar === '*' || runPrevChar === '_' || !!INLINE_PUNCTUATION.exec(runPrevChar);
    if (runStart < srcStart) prevChar = runPrevChar;
    const prevPunct = runStart < srcStart ? runPrevPunct : !!INLINE_PUNCTUATION.exec(prevChar);
    if (match[4] && prevChar.match(unicodeAlphaNumeric)) return;
    const nextChar = match[1] || match[3] || '';
    if (!nextChar || !prevChar || prevPunct) {
      const lLength = [...match[0]].length - 1;
      let rDelim, rLength, delimTotal = lLength, midDelimTotal = 0;
      const runLength = srcStart - runStart + lLength;
      const openerCanClose = !!runPrevChar.trim() && (!!nextChar || (delimChar === '*' && !runPrevPunct));
      if (delimChar !== '*' && delimChar !== '_') return;
      const endReg = delimChar === '*' ? INLINE_EMSTRONGRDELIMAST : INLINE_EMSTRONGRDELIMUND;
      const lastPossibleEmStrongCloserIndex = this.closerFrames.at(-1)[delimChar];
      const emStrongCloserWindowStart = maskedSrc.length - src.length + lLength;
      if (lastPossibleEmStrongCloserIndex < emStrongCloserWindowStart) return;
      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
      const lastPossibleEmStrongCloserIndexInWindow = lastPossibleEmStrongCloserIndex - emStrongCloserWindowStart;
      endReg.lastIndex = 0;
      while ((match = endReg.exec(maskedSrc)) !== null) {
        if (match.index > lastPossibleEmStrongCloserIndexInWindow) break;
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
        if (!rDelim) continue;
        rLength = [...rDelim].length;
        if (match[3] || match[4]) {
          delimTotal += rLength;
          continue;
        } else if (match[5] || match[6] || openerCanClose) {
          if (midRun && (match[5] || match[6])) break;
          if (runLength % 3 && !((runLength + rLength) % 3)) {
            midDelimTotal += rLength;
            continue;
          }
        }
        delimTotal -= rLength;
        if (delimTotal > 0) continue;
        rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
        const lastCharLength = [...match[0]][0].length;
        const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
        if (Math.min(lLength, rLength) % 2) {
          const text = raw.slice(1, -1);
          return { type: 'em', raw, text, tokens: this.inlineTokens(text) };
        }
        const text = raw.slice(2, -2);
        return { type: 'strong', raw, text, tokens: this.inlineTokens(text) };
      }
    }
  }

  _codespan(src) {
    const cap = INLINE_CODE.exec(src);
    if (cap) {
      let text = cap[2].replace(newLineCharGlobal, ' ');
      const hasNonSpaceChars = nonSpaceChar.test(text);
      const hasSpaceCharsOnBothEnds = startingSpaceChar.test(text) && endingSpaceChar.test(text);
      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) text = text.substring(1, text.length - 1);
      return { type: 'codespan', raw: cap[0], text };
    }
  }

  _br(src) {
    const cap = INLINE_BR.exec(src);
    if (cap) return { type: 'br', raw: cap[0] };
  }

  _del(src, maskedSrc, prevChar = '') {
    let match = INLINE_DELLDELIM.exec(src);
    if (!match) return;
    const nextChar = match[1] || '';
    if (!nextChar || !prevChar || INLINE_PUNCTUATION.exec(prevChar)) {
      const lLength = [...match[0]].length - 1;
      let rDelim, rLength, delimTotal = lLength;
      const endReg = INLINE_DELRDELIM;
      const lastPossibleDelCloserIndex = this.closerFrames.at(-1).del;
      const delCloserWindowStart = maskedSrc.length - src.length + lLength;
      if (lastPossibleDelCloserIndex < delCloserWindowStart) return;
      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
      const lastPossibleDelCloserIndexInWindow = lastPossibleDelCloserIndex - delCloserWindowStart;
      endReg.lastIndex = 0;
      while ((match = endReg.exec(maskedSrc)) !== null) {
        if (match.index > lastPossibleDelCloserIndexInWindow) break;
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
        if (!rDelim) continue;
        rLength = [...rDelim].length;
        if (rLength !== lLength) continue;
        if (match[3] || match[4]) {
          delimTotal += rLength;
          continue;
        }
        delimTotal -= rLength;
        if (delimTotal > 0) continue;
        rLength = Math.min(rLength, rLength + delimTotal);
        const lastCharLength = [...match[0]][0].length;
        const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
        const text = raw.slice(lLength, -lLength);
        return { type: 'del', raw, text, tokens: this.inlineTokens(text) };
      }
    }
  }

  _autolink(src) {
    const cap = INLINE_AUTOLINK.exec(src);
    if (cap) {
      let text, href;
      if (cap[2] === '@') {
        text = cap[1];
        href = 'mailto:' + text;
      } else {
        text = cap[1];
        href = text;
      }
      return { type: 'link', raw: cap[0], text, href, autolink: true, tokens: [{ type: 'text', raw: text, text }] };
    }
  }

  _url(src) {
    let cap;
    if ((cap = INLINE_URL.exec(src))) {
      let text, href;
      if (cap[2] === '@') {
        text = cap[0];
        href = 'mailto:' + text;
      } else {
        let prevCapZero;
        do {
          prevCapZero = cap[0];
          cap[0] = INLINE__BACKPEDAL.exec(cap[0])?.[0] ?? '';
        } while (prevCapZero !== cap[0]);
        text = cap[0];
        if (cap[1] === 'www.') href = 'http://' + cap[0];
        else href = cap[0];
      }
      return { type: 'link', raw: cap[0], text, href, autolink: true, tokens: [{ type: 'text', raw: text, text }] };
    }
  }

  _inlineText(src) {
    const cap = INLINE_TEXT.exec(src);
    if (cap) {
      const escaped = this.state.inRawBlock;
      return { type: 'text', raw: cap[0], text: escaped ? cap[0] : decodeNumericCharacterReferences(cap[0]), escaped };
    }
  }

  _maskSrc(src) {
    let maskedSrc = src;
    if (src.includes('[')) {
      const reflinkSearch = INLINE_REFLINKSEARCH;
      const maskReflink = (match0) => {
        const refStart = match0.lastIndexOf('[');
        if (!Object.hasOwn(this.tokens.links, normalizeLabel(match0.slice(refStart + 1, -1)))) return match0;
        if (refStart > 1 && match0.charAt(0) !== '!') {
          const text = match0.slice(1, refStart - 1);
          if (this._linkInText(text)) {
            return '[' + text.replace(reflinkSearch, maskReflink) + '][' + 'a'.repeat(match0.length - refStart - 2) + ']';
          }
        }
        return '[' + 'a'.repeat(match0.length - 2) + ']';
      };
      maskedSrc = maskedSrc.replace(reflinkSearch, maskReflink);
    }
    maskedSrc = maskedSrc.replace(INLINE_ANYPUNCTUATIONOUTSIDECODE, (match0, code, punct) => {
      if (punct) return '+'.repeat(match0.length);
      if (code) return code + match0.slice(code.length, -code.length).replace(/`/g, '+') + code;
      return match0;
    });
    maskedSrc = maskedSrc.replace(INLINE_BLOCKSKIP, (match0, _link, context) => {
      const offset = context ? context.length : 0;
      return match0.slice(0, offset) + '[' + 'a'.repeat(match0.length - offset - 2) + ']';
    });
    return maskedSrc;
  }

  _linkInText(text) {
    if (!text.includes('[')) return false;
    for (const match of text.matchAll(INLINE_BLOCKSKIP)) {
      if (INLINE_LINK.test(match[0]) && text.charAt(match.index - 1) !== '!') return true;
    }
    for (const match of text.matchAll(INLINE_REFLINKSEARCH)) {
      const match0 = match[0];
      const refStart = match0.lastIndexOf('[');
      if (match0.charAt(0) === '!' || !Object.hasOwn(this.tokens.links, normalizeLabel(match0.slice(refStart + 1, -1)))) continue;
      if (refStart > 1 && this._linkInText(match0.slice(1, refStart - 1))) continue;
      return true;
    }
    return false;
  }
}

// closer scan: returns { '*': idx, '_': idx, del: idx }
function _scanClosers(src) {
  const f = { '*': -1, _: -1, del: -1 };
  const len = src.length;
  for (let i = 0; i < len; i++) {
    const ch = src[i];
    if (ch !== '*' && ch !== '_' && ch !== '~') continue;
    const prev = i === 0 ? '\n' : src[i - 1];
    let j = i + 1;
    while (j < len && src[j] === ch) j++;
    if (prev !== ' ' && prev !== '\t' && prev !== '\n' && prev !== '\r' && prev !== '\f') {
      if (ch === '~') f.del = i;
      else f[ch] = i;
    }
    i = j - 1;
  }
  return f;
}

function _indentCodeCompensation(raw, text) {
  const matchIndentToCode = raw.match(indentCodeCompensation);
  if (matchIndentToCode === null) return text;
  const indentToCode = matchIndentToCode[1];
  return text.split('\n').map((node) => {
    const matchIndentInNode = node.match(beginningSpace);
    if (matchIndentInNode === null) return node;
    const [indentInNode] = matchIndentInNode;
    return node.slice(Math.min(indentInNode.length, indentToCode.length));
  }).join('\n');
}

function _isLabelEndInsideToken(src, label, labelStart) {
  if (!label.includes('<')) return false;
  for (let i = 0; i < label.length; i++) {
    if (label[i] === '\\') { i++; continue; }
    if (label[i] === '`') {
      const code = INLINE_CODE.exec(label.slice(i));
      if (code) { i += code[0].length - 1; continue; }
    }
    if (label[i] !== '<') continue;
    const tokenSrc = src.slice(labelStart + i);
    const token = INLINE_TAG.exec(tokenSrc) || INLINE_AUTOLINK.exec(tokenSrc);
    if (!token) continue;
    if (token[0].length > label.length - i) return true;
    i += token[0].length - 1;
  }
  return false;
}

function _outputLink(cap, link, raw, lexer) {
  const href = link.href;
  const title = link.title || null;
  const text = cap[1].replace(outputLinkReplace, '$1');
  const isImage = cap[0].charAt(0) === '!';
  const outerInLink = lexer.state.inLink;
  const outerLinkEmitted = lexer.state.linkEmitted;
  const outerInRawBlock = lexer.state.inRawBlock;
  lexer.state.inLink = true;
  lexer.state.linkEmitted = false;
  const tokens = lexer.inlineTokens(text);
  const textHasLink = lexer.state.linkEmitted;
  lexer.state.linkEmitted = outerLinkEmitted;
  lexer.state.inLink = outerInLink;
  if (!isImage) {
    if (textHasLink) {
      lexer.state.inRawBlock = outerInRawBlock;
      return;
    }
    lexer.state.linkEmitted = true;
  }
  return { type: isImage ? 'image' : 'link', raw, href, title, text, tokens };
}

// ---------------------------------------------------------------------------
// Renderer (marked _Renderer + _TextRenderer)
// ---------------------------------------------------------------------------
function renderTokens(tokens, lexer) {
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    switch (token.type) {
      case 'space': break;
      case 'hr': out += '<hr>\n'; break;
      case 'heading': out += `<h${token.depth}>${renderInline(token.tokens, lexer, false)}</h${token.depth}>\n`; break;
      case 'code': out += _renderCode(token); break;
      case 'table': out += _renderTable(token, lexer); break;
      case 'blockquote': out += `<blockquote>\n${renderTokens(token.tokens, lexer)}</blockquote>\n`; break;
      case 'list': out += _renderList(token, lexer); break;
      case 'checkbox': out += `<input ${token.checked ? 'checked="" ' : ''}disabled="" type="checkbox"> `; break;
      case 'html': out += token.text; break;
      case 'def': break;
      case 'paragraph': out += `<p>${renderInline(token.tokens, lexer, false)}</p>\n`; break;
      case 'text': out += renderInline(token.tokens, lexer, false); break;
      default: throw new Error('Token with "' + token.type + '" type was not found.');
    }
  }
  return out;
}

function _renderCode(token) {
  const langString = (token.lang || '').match(notSpaceStart)?.[0];
  const code = token.text ? token.text.replace(endingNewline, '') + '\n' : '';
  if (!langString) return '<pre><code>' + escapeHtmlEntities(code, true) + '</code></pre>\n';
  return '<pre><code class="language-' + escapeHtmlEntities(langString) + '">' + escapeHtmlEntities(code, true) + '</code></pre>\n';
}

function _renderList(token, lexer) {
  let body = '';
  for (let j = 0; j < token.items.length; j++) {
    const item = token.items[j];
    body += `<li>${renderTokens(item.tokens, lexer)}</li>\n`;
  }
  const type = token.ordered ? 'ol' : 'ul';
  const startAttr = (token.ordered && token.start !== 1) ? (' start="' + token.start + '"') : '';
  return '<' + type + startAttr + '>\n' + body + '</' + type + '>\n';
}

function _renderTable(token, lexer) {
  let header = '';
  let cell = '';
  for (let j = 0; j < token.header.length; j++) cell += _renderCell(token.header[j], lexer);
  header += `<tr>\n${cell}</tr>\n`;
  let body = '';
  for (let j = 0; j < token.rows.length; j++) {
    const row = token.rows[j];
    cell = '';
    for (let k = 0; k < row.length; k++) cell += _renderCell(row[k], lexer);
    body += `<tr>\n${cell}</tr>\n`;
  }
  if (body) body = `<tbody>${body}</tbody>`;
  return '<table>\n<thead>\n' + header + '</thead>\n' + body + '</table>\n';
}

function _renderCell(token, lexer) {
  const content = renderInline(token.tokens, lexer, false);
  const type = token.header ? 'th' : 'td';
  const tag = token.align ? `<${type} align="${token.align}">` : `<${type}>`;
  return tag + content + `</${type}>\n`;
}

function renderInline(tokens, lexer, textMode) {
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (textMode) {
      switch (token.type) {
        case 'escape': out += token.text; break;
        case 'html': out += token.text; break;
        case 'link': case 'image': out += renderInline(token.tokens, lexer, true); break;
        case 'checkbox': out += token.raw; break;
        case 'strong': case 'em': case 'del': out += renderInline(token.tokens, lexer, true); break;
        case 'codespan': out += token.text; break;
        case 'br': break;
        case 'text': out += token.text; break;
        default: throw new Error('Token with "' + token.type + '" type was not found.');
      }
      continue;
    }
    switch (token.type) {
      case 'escape': out += escapeHtmlEntities(token.text); break;
      case 'html': out += token.text; break;
      case 'link': out += _renderLink(token, lexer); break;
      case 'image': out += _renderImage(token, lexer); break;
      case 'checkbox': out += `<input ${token.checked ? 'checked="" ' : ''}disabled="" type="checkbox"> `; break;
      case 'strong': out += `<strong>${renderInline(token.tokens, lexer, false)}</strong>`; break;
      case 'em': out += `<em>${renderInline(token.tokens, lexer, false)}</em>`; break;
      case 'codespan': out += `<code>${escapeHtmlEntities(token.text, true)}</code>`; break;
      case 'br': out += '<br>'; break;
      case 'del': out += `<del>${renderInline(token.tokens, lexer, false)}</del>`; break;
      case 'text': out += (token.escaped ? token.text : escapeHtmlEntities(token.text)); break;
      default: throw new Error('Token with "' + token.type + '" type was not found.');
    }
  }
  return out;
}

function _renderLink(token, lexer) {
  const parsedText = token.autolink ? escapeHtmlEntities(token.text, true) : renderInline(token.tokens, lexer, false);
  const cleanHref = cleanUrl(token.href);
  if (cleanHref === null) return parsedText;
  const href = escapeHtmlEntities(cleanHref, token.autolink);
  let out = '<a href="' + href + '"';
  if (token.title) out += ' title="' + escapeHtmlEntities(token.title) + '"';
  out += '>' + parsedText + '</a>';
  return out;
}

function _renderImage(token, lexer) {
  let text = token.text;
  if (token.tokens) text = renderInline(token.tokens, lexer, true);
  const cleanHref = cleanUrl(token.href);
  if (cleanHref === null) return escapeHtmlEntities(text);
  const href = cleanHref;
  let out = `<img src="${escapeHtmlEntities(href)}" alt="${escapeHtmlEntities(text)}"`;
  if (token.title) out += ` title="${escapeHtmlEntities(token.title)}"`;
  out += '>';
  return out;
}

// ---------------------------------------------------------------------------
// parse()
// ---------------------------------------------------------------------------
export function parse(markdown) {
  const lexer = new Lexer();
  const tokens = lexer.lex(markdown);
  return renderTokens(tokens, lexer);
}
