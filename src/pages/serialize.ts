import { styleMarker } from '../nodeStyles';

/**
 * Serialize one page tree. Both live nodes and plain node data use the same rules so
 * a page reloaded from data never differs from the page that was on screen.
 */
export function treeMarkdown(root: any, headLevel: number): string {
  const lines: string[] = [];
  const level = Number.isFinite(headLevel) && headLevel > 0 ? headLevel : 2;
  const walk = (node: any, depth: number) => {
    // Live nodes keep their data on `data`; page snapshots are plain node data.
    const data = node?.data || node || {};
    const children = node?.children || data.children || [];
    const text: string = (data.text ?? '').trim();
    const parts = text.split('\n');
    const id = typeof node?.getId === 'function' ? node.getId() : data.id;
    const ending = ((data.stylePreset || data.nodeStyle) ? styleMarker(data.stylePreset, data.nodeStyle) : '') +
      ((data.summaryMember || data.relationMember || data.graftMember) ? ` <!-- mm:node ${JSON.stringify({ id })} -->` : '');
    if (depth < level) {
      const block = /^(```|~~~|\|)/.test(text);
      lines.push('', '#'.repeat(depth + 1) + ' ' + (block ? '' : (parts.shift() || '')) + ending);
      if (block) lines.push('');
      lines.push(...parts);
    } else {
      const indent = '\t'.repeat(depth - level);
      // Metadata belongs on the structural list line, outside code fences/tables.
      if (/^(```|~~~|\|)/.test(text)) {
        lines.push(`${indent}-${ending}`);
        parts.forEach(part => lines.push(`${indent}  ${part}`));
      } else {
        lines.push(`${indent}-` + (text ? ' ' + (parts.shift() || '') : '') + ending);
        if (text) parts.forEach(part => lines.push(`${indent}  ${part}`));
      }
    }
    children.forEach((child: any) => walk(child, depth + 1));
  };
  walk(root, 0);
  return lines.join('\n').trim();
}
