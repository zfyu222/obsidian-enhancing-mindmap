import { extractRelations, relationsMarkdown, RelationData } from '../relations/model';
import { extractSummaries, summaryMarkdown, SummaryData } from '../summary/markdown';
import { cleanPageName, composePage, composeSinglePage, newPageId, PageMeta, serializePages, splitPages } from './model';

export interface PageState {
  meta: PageMeta;
  /** Full page block source; unloaded pages are written back untouched. */
  content: string;
  tree: string;
  relations: { entries: RelationData[]; preserved: string; raw: string };
  summaries: { entries: SummaryData[]; preserved: string; raw: string };
  relationsMarkdown: string;
  summariesMarkdown: string;
  data?: any;
}

export interface PageSnapshot {
  tree: string;
  relationsMarkdown: string;
  summariesMarkdown: string;
  relations: PageState['relations'];
  summaries: PageState['summaries'];
}

/**
 * The page set of one note. Keeps per-page source so pages that were never opened
 * are not rewritten, and turns the file into a single document on save.
 */
export class PageDocument {
  pages: PageState[] = [];
  activePageId = '';
  marked = false;
  error = '';

  /** `pagesSource` is the document body after file-wide grafts were removed. */
  constructor(pagesSource: string, keepActiveId = '', nameFor = (index: number) => `Page ${index + 1}`) {
    const split = splitPages(pagesSource);
    this.marked = split.marked;
    this.error = split.error;
    this.pages = split.pages.map((chunk, index) => {
      const relations = extractRelations(chunk.body);
      const summaries = extractSummaries(relations.main);
      return {
        // An unnamed page still needs a marker name once the note becomes multi-page.
        meta: { id: chunk.meta.id, name: cleanPageName(chunk.meta.name) || nameFor(index) },
        content: chunk.body,
        tree: summaries.main,
        relations: { entries: relations.entries, preserved: relations.preserved, raw: relations.raw },
        summaries: { entries: summaries.entries, preserved: summaries.preserved, raw: summaries.raw },
        relationsMarkdown: relations.preserved || relationsMarkdown(relations.entries),
        summariesMarkdown: summaries.preserved || summaryMarkdown(summaries.entries)
      };
    });
    this.activePageId = this.pages.some(page => page.meta.id === keepActiveId) ? keepActiveId : this.pages[0].meta.id;
  }

  active(): PageState {
    return this.pages.find(page => page.meta.id === this.activePageId) || this.pages[0];
  }

  find(id: string): PageState | undefined {
    return this.pages.find(page => page.meta.id === id);
  }

  setActive(id: string): boolean {
    if (id === this.activePageId || !this.find(id)) return false;
    this.activePageId = id;
    return true;
  }

  capture(id: string, snapshot: PageSnapshot) {
    const page = this.find(id);
    if (!page) return;
    page.tree = snapshot.tree;
    page.relationsMarkdown = snapshot.relationsMarkdown;
    page.summariesMarkdown = snapshot.summariesMarkdown;
    page.relations = snapshot.relations;
    page.summaries = snapshot.summaries;
    page.content = composePage(page.tree, page.relationsMarkdown, page.summariesMarkdown);
    page.data = undefined;
  }

  add(name: string, tree: string): PageState {
    const meta: PageMeta = { id: newPageId(), name: cleanPageName(name) || name };
    const page: PageState = {
      meta, content: tree, tree,
      relations: { entries: [], preserved: '', raw: '' },
      summaries: { entries: [], preserved: '', raw: '' },
      relationsMarkdown: '', summariesMarkdown: ''
    };
    this.pages.push(page);
    this.marked = true;
    this.activePageId = meta.id;
    return page;
  }

  rename(id: string, name: string): boolean {
    const page = this.find(id);
    const clean = cleanPageName(name);
    if (!page || !clean || clean === page.meta.name) return false;
    page.meta.name = clean;
    this.marked = true;
    return true;
  }

  remove(id: string): PageState | undefined {
    if (this.pages.length <= 1) return undefined;
    const index = this.pages.findIndex(page => page.meta.id === id);
    if (index < 0) return undefined;
    const [page] = this.pages.splice(index, 1);
    if (this.activePageId === id) this.activePageId = this.pages[Math.max(0, index - 1)].meta.id;
    return page;
  }

  /** Single-page notes keep their original section order; multi-page notes move grafts last. */
  compose(grafts: string): string {
    if (this.pages.length === 1 && !this.marked) {
      const page = this.pages[0];
      return composeSinglePage(page.tree, page.relationsMarkdown, grafts, page.summariesMarkdown);
    }
    return [serializePages(this.pages.map(page => ({ meta: page.meta, content: page.content })), true), grafts.trim()].filter(Boolean).join('\n\n');
  }
}
