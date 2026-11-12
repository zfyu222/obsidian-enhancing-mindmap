/**
 * Pages are separated by a standalone metadata comment outside code fences:
 * `<!-- mm:page {"id":"pg-...","name":"..."} -->`.
 * A file without markers is one unnamed page and is written back unchanged.
 */
export interface PageMeta { id: string; name: string }
/** raw keeps untrimmed source lines for search mapping; body is the trimmed page source. */
export interface PageChunk { meta: PageMeta; raw: string; body: string; startLine: number }
export interface PageBlock { meta: PageMeta; content: string }
export interface SplitResult { pages: PageChunk[]; marked: boolean; error: string }

const PAGE_PREFIX = '<!-- mm:page ';
const PAGE_PATTERN = /^<!-- mm:page (\{.*\}) -->$/;
const ID_PATTERN = /^[\w-]{1,128}$/;
const MAX_NAME = 80;

function S4() {
  return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

export function newPageId(): string {
  return `pg-${S4()}${S4()}-${S4()}-${S4()}`;
}

/** Returns the cleaned name, or an empty string when the value cannot be displayed. */
export function cleanPageName(value: unknown): string {
  if (typeof value !== 'string') return '';
  // Control characters and line breaks cannot survive a single metadata comment.
  const name = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  return name.slice(0, MAX_NAME);
}

export function pageMarker(meta: PageMeta): string {
  return `${PAGE_PREFIX}${JSON.stringify({ id: meta.id, name: cleanPageName(meta.name) })} -->`;
}

function parseMarker(line: string): PageMeta | null {
  if (!line.startsWith(PAGE_PREFIX)) return null;
  const match = PAGE_PATTERN.exec(line);
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (Object.keys(value).some(key => key !== 'id' && key !== 'name')) return null;
    if (typeof value.id !== 'string' || !ID_PATTERN.test(value.id)) return null;
    const name = cleanPageName(value.name);
    if (!name) return null;
    return { id: value.id, name };
  } catch (_) {
    return null;
  }
}

interface Segment { meta: PageMeta; startLine: number; endLine: number }

/** Split the document body (frontmatter already removed) into page segments. */
export function splitPages(markdown: string): SplitResult {
  const lines = markdown.split(/\r?\n/);
  const segments: Segment[] = [];
  const ids = new Set<string>();
  let current: PageMeta | null = null;
  let start = 0;
  let preamble: string | null = null;
  let fence = '';
  let error = '';
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const delimiter = /^\s*(`{3,}|~{3,})/.exec(line);
    if (delimiter) { if (!fence) fence = delimiter[1][0]; else if (delimiter[1][0] === fence) fence = ''; }
    if (fence || delimiter) continue;
    const meta = parseMarker(line);
    if (!meta) {
      // Keep malformed markers in place instead of guessing at other unknown metadata.
      if (line.startsWith(PAGE_PREFIX)) error = error || 'Invalid page marker: ' + line;
      continue;
    }
    if (ids.has(meta.id)) { error = error || 'Duplicate page id: ' + meta.id; continue; }
    ids.add(meta.id);
    if (current) segments.push({ meta: current, startLine: start, endLine: index });
    else preamble = lines.slice(0, index).join('\n');
    current = meta;
    start = index + 1;
  }
  if (!current) {
    const raw = lines.join('\n');
    return { pages: [{ meta: { id: newPageId(), name: '' }, raw, body: raw.trim(), startLine: 0 }], marked: false, error };
  }
  segments.push({ meta: current, startLine: start, endLine: lines.length });
  const pages: PageChunk[] = segments.map((segment, index) => {
    const raw = index === 0 && preamble?.trim() ? `${preamble}\n${lines.slice(segment.startLine, segment.endLine).join('\n')}` : lines.slice(segment.startLine, segment.endLine).join('\n');
    return { meta: segment.meta, raw, body: raw.trim(), startLine: index === 0 && preamble?.trim() ? 0 : segment.startLine };
  });
  return { pages, marked: true, error };
}

export function serializePages(pages: PageBlock[], marked: boolean): string {
  if (!pages.length) return '';
  if (!marked) return pages[0].content.trim();
  return pages.map(page => `${pageMarker(page.meta)}\n\n${page.content.trim()}`).join('\n\n');
}

/** Join a page tree with its own relations and summaries; empty sections are skipped. */
export function composePage(tree: string, relations: string, summaries: string): string {
  return [tree.trim(), relations.trim(), summaries.trim()].filter(Boolean).join('\n\n');
}

/** Single-page files keep the original section order, with grafts before summaries. */
export function composeSinglePage(tree: string, relations: string, grafts: string, summaries: string): string {
  return [tree.trim(), relations.trim(), grafts.trim(), summaries.trim()].filter(Boolean).join('\n\n');
}
