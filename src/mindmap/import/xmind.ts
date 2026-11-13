import JSZip from 'jszip';
import { basicFrontmatter } from '../../constants';
import { cleanPageName, composePage, serializePages } from '../../pages/model';
import { treeMarkdown } from '../../pages/serialize';
import { RelationData, relationsMarkdown } from '../../relations/model';
import { SummaryData, summaryMarkdown } from '../../summary/markdown';

interface Topic {
  id?: string;
  title?: string;
  children?: { attached?: Topic[]; detached?: Topic[]; summary?: Topic[]; callout?: Topic[] };
  notes?: { plain?: { content?: string } };
  href?: string;
  image?: { src?: string };
  summaries?: { range?: string; topicId?: string }[];
}

interface Sheet {
  title?: string;
  rootTopic: Topic;
  relationships?: { end1Id?: string; end2Id?: string }[];
}

interface ImportNode {
  id: string;
  text: string;
  children: ImportNode[];
  summaryMember?: boolean;
  relationMember?: boolean;
}

function plainText(value: string) {
  return value.replace(/[\\`*_[\]<>~|^&!#$=+\-]/g, '\\$&')
    .replace(/^(\s*\d+)\.(?=\s)/gm, '$1\\.');
}

function xmlSheets(source: string): Sheet[] {
  const xml = new DOMParser().parseFromString(source, 'application/xml');
  if (xml.doctype || xml.documentElement.localName !== 'xmap-content') throw Error('Invalid XMind XML');
  const elements = (el: Element | undefined, name: string) =>
    el ? Array.from(el.children).filter(child => child.localName === name) : [];
  const first = (el: Element | undefined, name: string) => elements(el, name)[0];
  const attribute = (el: Element, name: string) => el.getAttribute(name) || '';
  const title = (el: Element) => first(el, 'title')?.textContent || '';
  const topic = (el: Element, depth: number): Topic => {
    if (depth > 100) throw Error('XMind topic nesting exceeds 100 levels');
    const children: Topic['children'] = {};
    for (const group of elements(first(el, 'children'), 'topics')) {
      const type = attribute(group, 'type');
      if (type === 'attached' || type === 'detached' || type === 'summary' || type === 'callout') {
        children[type] = elements(group, 'topic').map(child => topic(child, depth + 1));
      }
    }
    return {
      id: attribute(el, 'id'), title: title(el), children,
      href: el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '',
      notes: { plain: { content: first(first(el, 'notes'), 'plain')?.textContent || '' } },
      summaries: elements(first(el, 'summaries'), 'summary').map(sum => ({
        range: attribute(sum, 'range'), topicId: attribute(sum, 'topic-id')
      })),
      image: { src: first(el, 'img')?.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '' }
    };
  };
  return elements(xml.documentElement, 'sheet').map(sheet => {
    const root = first(sheet, 'topic');
    if (!root) throw Error('XMind sheet has no root topic');
    return {
      title: title(sheet), rootTopic: topic(root, 0),
      relationships: elements(first(sheet, 'relationships'), 'relationship').map(link => ({
        end1Id: attribute(link, 'end1'), end2Id: attribute(link, 'end2')
      }))
    };
  });
}

export const MAX_XMIND_BYTES = 50 * 1024 * 1024;

export interface XmindImport {
  markdown: string;
  pageCount: number;
  nodeCount: number;
  assets: { path: string; data: ArrayBuffer }[];
  skippedImages: number;
}

type ZipEntry = JSZip.JSZipObject & {
  internalStream(type: 'uint8array'): JSZip.JSZipStreamHelper<Uint8Array>;
};

function readEntry(entry: JSZip.JSZipObject, limit: number, error: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const stream = (entry as ZipEntry).internalStream('uint8array');
    const chunks: Uint8Array[] = [];
    let length = 0;
    stream.on('data', chunk => {
      length += chunk.length;
      if (length > limit) {
        stream.pause();
        reject(Error(error));
      } else {
        chunks.push(chunk);
      }
    }).on('error', reject).on('end', () => {
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(bytes);
    }).resume();
  });
}

export async function convertXmind(data: ArrayBuffer, headLevel: number, assetPrefix: string): Promise<XmindImport> {
  if (data.byteLength > MAX_XMIND_BYTES) throw Error('XMind file exceeds 50 MB');
  const zip = await JSZip.loadAsync(data);
  const json = zip.file('content.json');
  const xml = zip.file('content.xml');
  if (!json && !xml) throw Error('Missing XMind content');
  const source = new TextDecoder().decode(await readEntry(json || xml, 20 * 1024 * 1024, 'XMind content exceeds 20 MB'));
  const sheets: Sheet[] = json ? JSON.parse(source.replace(/^\uFEFF/, '')) : xmlSheets(source);
  if (!Array.isArray(sheets) || !sheets.length || sheets.length > 200) throw Error('Invalid XMind sheet list');

  const images = new Map<string, string>();
  let nodeCount = 0;
  let skippedImages = 0;
  const pages = sheets.map((sheet, index) => {
    const bySourceId = new Map<string, ImportNode>();
    const summaries: SummaryData[] = [];
    const pending: { topic: Topic; attached: ImportNode[] }[] = [];
    const convert = (topic: Topic, depth: number): ImportNode => {
      if (!topic || typeof topic !== 'object' || Array.isArray(topic)) throw Error('Invalid XMind topic');
      if (depth > 100 || ++nodeCount > 20000) throw Error('XMind topic limit exceeded');
      const node: ImportNode = { id: 'xmind-' + nodeCount, text: '', children: [] };
      if (typeof topic.id === 'string' && topic.id) {
        if (bySourceId.has(topic.id)) throw Error('Duplicate XMind topic ID');
        bySourceId.set(topic.id, node);
      }
      const title = typeof topic.title === 'string' ? topic.title.trim() : '';
      const parts = (title || '—').replace(/\r\n?/g, '\n').split('\n').map(line => plainText(line.trim()));
      const note = topic.notes?.plain?.content;
      if (typeof note === 'string' && note.trim()) {
        parts.push('', ...note.trim().replace(/\r\n?/g, '\n').split('\n').map(line => plainText(line.trim())));
      }
      if (typeof topic.href === 'string' && /^https?:\/\/[^\s<>]+$/i.test(topic.href)) {
        parts.push('', '<' + topic.href + '>');
      }
      const image = topic.image?.src;
      if (typeof image === 'string' && image) {
        const match = /^xap:(?:\/\/)?(resources\/[\w./-]+\.(png|jpe?g|gif|webp|bmp))$/i.exec(image);
        if (match && zip.file(match[1])) {
          if (!images.has(match[1])) images.set(match[1], `Assets/${assetPrefix}-${images.size + 1}.${match[2].toLowerCase()}`);
          parts.push('', `![[${images.get(match[1])}]]`);
        } else {
          skippedImages++;
        }
      }
      node.text = parts.join('\n');
      const attached = (topic.children?.attached || []).map(child => convert(child, depth + 1));
      node.children = attached.concat(
        (topic.children?.detached || []).map(child => convert(child, depth + 1)),
        (topic.children?.callout || []).map(child => convert(child, depth + 1))
      );
      for (const child of topic.children?.summary || []) {
        const summary = convert(child, depth + 1);
        if (!topic.summaries?.some(item => item.topicId === child.id)) node.children.push(summary);
      }
      if (topic.summaries?.length) pending.push({ topic, attached });
      return node;
    };
    const root = convert(sheet?.rootTopic, 0);
    const summaryRoots = new Set<string>();
    for (const { topic, attached } of pending) {
      for (const summary of topic.summaries) {
        const range = /^\((\d+),(\d+)\)$/.exec(summary.range || '');
        const summaryRoot = bySourceId.get(summary.topicId);
        if (!range || !summaryRoot || !topic.children?.summary?.some(child => child.id === summary.topicId)
          || summaryRoots.has(summaryRoot.id)) throw Error('Invalid XMind summary');
        const start = Number(range[1]), end = Number(range[2]);
        if (start > end || end >= attached.length) throw Error('Invalid XMind summary range');
        const members = attached.slice(start, end + 1);
        members.forEach(member => member.summaryMember = true);
        summaryRoots.add(summaryRoot.id);
        summaries.push({ id: summaryRoot.id, root: summaryRoot, memberIds: members.map(member => member.id) });
      }
    }
    const relations: RelationData[] = [];
    const pairs = new Set<string>();
    for (const link of sheet.relationships || []) {
      const from = bySourceId.get(link.end1Id), to = bySourceId.get(link.end2Id);
      if (!from || !to || from === to) continue;
      const pair = from.id + ':' + to.id;
      if (pairs.has(pair)) continue;
      pairs.add(pair);
      from.relationMember = to.relationMember = true;
      relations.push({ id: 'xmind-relation-' + relations.length, from: from.id, to: to.id });
    }
    return {
      meta: { id: 'pg-xmind-' + (index + 1), name: cleanPageName(sheet.title || sheet.rootTopic.title) || `Page ${index + 1}` },
      content: composePage(treeMarkdown(root, Number.isFinite(headLevel) ? Math.max(1, Math.min(6, Math.floor(headLevel))) : 2), relationsMarkdown(relations), summaryMarkdown(summaries))
    };
  });

  const assets: { path: string; data: ArrayBuffer }[] = [];
  let totalBytes = 0;
  for (const [entry, path] of images) {
    const bytes = await readEntry(zip.file(entry), MAX_XMIND_BYTES - totalBytes, 'XMind images exceed 50 MB');
    totalBytes += bytes.byteLength;
    assets.push({ path, data: bytes.buffer });
  }
  return { markdown: basicFrontmatter + serializePages(pages, true) + '\n', pageCount: pages.length, nodeCount, assets, skippedImages };
}
