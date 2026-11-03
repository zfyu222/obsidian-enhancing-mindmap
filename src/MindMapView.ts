import MindMapPanel from './MindMapPanel';
import { SearchNavigation } from './search/navigation';
import { extractRelations } from './relations/model';
import { extractGrafts, GraftData } from './grafts/model';
import {
  HoverParent,
  FileManager,
  HoverPopover,
  Menu,
  TextFileView,
  WorkspaceLeaf,
  TFile,
  Notice,
  Platform
} from "obsidian";

import MindMapPlugin from './main'
import { FRONT_MATTER_REGEX } from './constants'
import MindMap from "./mindmap/mindmap";
import INode, { INodeData } from './mindmap/INode'
import { prepareMainMarkdown, sourceNodeContent } from './summary/markdown';
import MindMapToolbar from './MindMapToolbar';
import PageTabs from './PageTabs';
import { composePage } from './pages/model';
import { PageDocument, PageState } from './pages/document';
import { treeMarkdown } from './pages/serialize';
import { Transformer } from './markmapLib/markmap-lib';
import randomColor from "randomcolor";
import { t } from './lang/helpers'

// import domtoimage from './domtoimage.js'
import domtoimage from './dom-to-image-more.js'

export function uuid(): string {
  function S4() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  }
  return (S4() + S4() + '-' + S4() + '-' + S4());
}
const transformer = new Transformer();


export const mindmapViewType = "mindmapView";
export const mindmapIcon = "blocks";

export type { PageState } from './pages/document';

export class MindMapView extends TextFileView implements HoverParent {
  plugin: MindMapPlugin;
  hoverPopover: HoverPopover | null;
  id: string = (this.leaf as any).id;
  mindmap: MindMap | null;
  toolbar: MindMapToolbar | null;
  panel: MindMapPanel | null;
  pageTabs: PageTabs | null;
  pageDocument: PageDocument | null = null;
  /** Source node of a graft whose target may be chosen on another page. */
  pendingGraftSource = '';
  private pageErrorShown = false;
  private foreignTrees?: Map<string, INode>;
  private foreignBaselines?: Map<string, string>;
  private graftDocument = { entries: [] as GraftData[], preserved: '', raw: '', main: '' };
  colors: string[] = [];
  timeOut: any = null;
  fileCache: any;
  firstInit: boolean = true;
  yamlString:string=''
  searchNavigation: SearchNavigation;
  searchReady = false;
  private renderGeneration = 0;
  private initTimer?: ReturnType<typeof setTimeout>;

  getViewType() {
    return mindmapViewType;
  }
  getIcon() {
    return mindmapIcon;
  }

  getDisplayText() {
    return this.file?.basename || "mindmap";
  }

  setColors() {
    var colors:any[] = []
    try{
      if( this.plugin.settings.strokeArray){
         //colors = this.plugin.settings.strokeArray.split(',')
         colors = this.plugin.settings.strokeArray;
      }
    }catch(err){
       console.log(err,'stroke array is error');
    }

    this.colors = this.colors.concat(colors);

    for (var i = 0; i < 50; i++) {
      this.colors.push(randomColor());
    }
  }

  exportToSvg(){
    if(!this.mindmap){
      return;
    }

   // this.mindmap.contentEL.style.visibility='hidden';
    var nodes:any[] = [];
    this.mindmap.traverseAll((n:any)=>{
       if(n.isShow()){
         nodes.push(n)
       }
    });



    var oldScrollLeft = this.mindmap.containerEL.scrollLeft;
    var oldScrollTop = this.mindmap.containerEL.scrollTop;

    var box  = this.mindmap.getBoundingRect(nodes);
    var rootBox = this.mindmap.root.getPosition();

    var disX =0,disY=0;
    if(box.x>60){
      disX = box.x - 60;
    }

    if(box.y>60){
       disY = box.y - 60;
    }

    this.mindmap.root.setPosition(rootBox.x-disX,rootBox.y-disY);
    this.mindmap.refresh();

    var w = box.width + 120;
    var h = box.height + 120;

    this.mindmap.contentEL.style.width=w+'px';
    this.mindmap.contentEL.style.height=h+'px';

    setTimeout(()=>{
      domtoimage.toPng(this.mindmap.contentEL,{}).then(dataUrl=>{
        var img = new Image()
        img.src = dataUrl;
        var str = img.outerHTML;

         var p= this.mindmap.path.substr(0,this.mindmap.path.length-2);
        try{
          new Notice(p+'html');
          this.app.vault.adapter.write(p+'html', str);
          this.restoreMindmap(rootBox,oldScrollLeft,oldScrollTop)
        }catch(err){
          this.restoreMindmap(rootBox,oldScrollLeft,oldScrollTop)
          new Notice(err);
        }

      }).catch(err=>{
        this.restoreMindmap(rootBox,oldScrollLeft,oldScrollTop)
        new Notice(err);
      })
    },200);

  }

  exportToPng(i_scale: number) {
    if (!this.mindmap) {
      return;
    }

    const { rootBox, oldScrollLeft, oldScrollTop } = this.prepareForExport();

    setTimeout(() => {
      domtoimage.toPng(this.mindmap.contentEL, { scale: i_scale }).then(async (dataUrl: string) => {
        var img = new Image();
        img.src = dataUrl;

        const fileName = this.mindmap.path.replace(/\.md$/, '.png');
        const arrayBuffer = await this.dataURLtoBlob(dataUrl).arrayBuffer();
        this.app.vault.adapter.writeBinary(fileName, arrayBuffer)
          .then(() => {
            new Notice(`Mindmap exported as PNG: ${fileName}`);
            this.restoreMindmap(rootBox, oldScrollLeft, oldScrollTop);
          })
          .catch(err => {
            console.error('Failed to save PNG file:', err);
            new Notice(`Failed to export mindmap as PNG: ${err}`);
            this.restoreMindmap(rootBox, oldScrollLeft, oldScrollTop);
          });

      }).catch(err => {
        this.restoreMindmap(rootBox, oldScrollLeft, oldScrollTop);
        new Notice(`Failed to export mindmap as PNG: ${err}`);
      });
    }, 200);
  }

  exportToJpeg(i_scale: number) {
    if (!this.mindmap) {
      return;
    }

    const { rootBox, oldScrollLeft, oldScrollTop } = this.prepareForExport();

    setTimeout(() => {
      domtoimage.toJpeg(this.mindmap.contentEL, { quality: 1.0, scale: i_scale }).then(async (dataUrl: string) => {
        var img = new Image();
        img.src = dataUrl;

        const fileName = this.mindmap.path.replace(/\.md$/, '.jpeg');
        const arrayBuffer = await this.dataURLtoBlob(dataUrl).arrayBuffer();
        this.app.vault.adapter.writeBinary(fileName, arrayBuffer)
          .then(() => {
            new Notice(`Mindmap exported as JPEG: ${fileName}`);
            this.restoreMindmap(rootBox, oldScrollLeft, oldScrollTop);
          })
          .catch(err => {
            console.error('Failed to save JPEG file:', err);
            new Notice(`Failed to export mindmap as JPEG: ${err}`);
            this.restoreMindmap(rootBox, oldScrollLeft, oldScrollTop);
          });

      }).catch(err => {
        this.restoreMindmap(rootBox, oldScrollLeft, oldScrollTop);
        new Notice(`Failed to export mindmap as JPEG: ${err}`);
      });
    }, 200);
  }

  prepareForExport() {
    if (!this.mindmap) {
      return { rootBox: null, oldScrollLeft: 0, oldScrollTop: 0 };
    }

    var nodes: any[] = [];
    this.mindmap.traverseAll((n: any) => {
      if (n.isShow()) {
        nodes.push(n);
      }
    });

    var oldScrollLeft = this.mindmap.containerEL.scrollLeft;
    var oldScrollTop = this.mindmap.containerEL.scrollTop;

    var box = this.mindmap.getBoundingRect(nodes);
    var rootBox = this.mindmap.root.getPosition();

    var disX = 0, disY = 0;
    if (box.x > 60) {
      disX = box.x - 60;
    }

    if (box.y > 60) {
      disY = box.y - 60;
    }

    this.mindmap.root.setPosition(rootBox.x - disX, rootBox.y - disY);
    this.mindmap.refresh();

    var w = box.width + 120;
    var h = box.height + 120;

    this.mindmap.contentEL.style.width = w + 'px';
    this.mindmap.contentEL.style.height = h + 'px';

    return { rootBox, oldScrollLeft, oldScrollTop };
  }

  restoreMindmap(rootBox: any, left: number, top: number) {
    if (!this.mindmap) {
      return;
    }

    var size = this.plugin.settings.canvasSize;
    this.mindmap.contentEL.style.width = size + 'px';
    this.mindmap.contentEL.style.height = size + 'px';
    this.mindmap.containerEL.scrollTop = top;
    this.mindmap.containerEL.scrollLeft = left;
    this.mindmap.root.setPosition(rootBox.x, rootBox.y);
    this.mindmap.refresh();
  }

  dataURLtoBlob(dataUrl: string) {
    var arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  mindMapChange() {
    this.saveDocument();
  }

  private foreignTreeMap(): Map<string, INode> {
    if (!this.foreignTrees) this.foreignTrees = new Map();
    return this.foreignTrees;
  }

  get pages() {
    return this.pageDocument?.pages || [];
  }

  get activePageId() {
    return this.pageDocument?.activePageId || '';
  }

  /** Capture every loaded page and write the whole document once. */
  saveDocument() {
    if (!this.mindmap || !this.pageDocument) return;
    // A page action can run before the first render finished resolving the file.
    if (!this.yamlString && this.file) {
      this.fileCache = this.app.metadataCache.getFileCache(this.file);
      this.yamlString = this.getFrontMatter();
    }
    this.captureActivePage();
    this.captureForeignPages();
    this.data = this.yamlString + this.pageDocument.compose(this.mindmap.grafts?.markdown() || '');
    try {
      this.requestSave();
    } catch (err) {
      console.log(err);
      new Notice(`${t("Save fail")}`);
    }
  }

  /** Text being edited is a draft until committed; page switches must keep it. */
  private commitDraft() {
    if (this.mindmap?.root) this.mindmap.finishEditingForHistory();
  }

  private captureActivePage() {
    const map = this.mindmap, page = this.activePage();
    if (!map?.root || !page || !this.pageDocument) return;
    this.pageDocument.capture(page.meta.id, {
      tree: map.getTreeMarkdown(),
      relationsMarkdown: map.relations?.markdown() || '',
      summariesMarkdown: map.summaries?.markdown() || '',
      relations: { entries: map.relations?.snapshot() || [], preserved: map.relations?.preserved || '', raw: page.relations.raw },
      summaries: { entries: map.summaries?.data() || [], preserved: map.summaries?.preserved || '', raw: page.summaries.raw }
    });
  }

  /**
   * A foreign page is only rebuilt when the current page projects one of its nodes,
   * and only when its content actually changed; untouched pages keep their source.
   */
  private captureForeignPages() {
    const baselines = this.foreignBaselineMap();
    this.foreignTreeMap().forEach((root, pageId) => {
      const page = this.pages.find(item => item.meta.id === pageId);
      if (!page) return;
      const next = treeMarkdown(root, this.plugin.settings.headLevel);
      if (baselines.get(pageId) === next) return;
      page.tree = next;
      page.content = composePage(page.tree, page.relationsMarkdown, page.summariesMarkdown);
      page.data = undefined;
      baselines.set(pageId, next);
    });
  }

  private foreignBaselineMap(): Map<string, string> {
    if (!this.foreignBaselines) this.foreignBaselines = new Map();
    return this.foreignBaselines;
  }

  /** The graft source may live on another page, so the pending id outlives the map. */
  graftPendingChanged(id: string) {
    this.pendingGraftSource = id || '';
  }

  activePage(): PageState | undefined {
    return this.pageDocument?.active();
  }

  pageData(page: PageState): INodeData {
    if (!page.data) {
      page.data = this.mdToData(page.tree);
      page.data.isRoot = true;
    }
    return page.data;
  }

  setActivePage(id: string) {
    if (!this.pageDocument || id === this.activePageId || !this.pageDocument.find(id)) return;
    this.commitDraft();
    this.captureActivePage();
    this.captureForeignPages();
    this.pageDocument.setActive(id);
    this.renderActivePage();
  }

  addPage() {
    if (!this.mindmap || !this.pageDocument) return;
    this.commitDraft();
    this.captureActivePage();
    this.captureForeignPages();
    const name = `${t('Page')} ${this.pages.length + 1}`;
    this.pageDocument.add(name, `# ${name}`);
    this.renderActivePage();
    this.saveDocument();
  }

  renamePage(id: string, name: string) {
    if (!this.pageDocument?.rename(id, name)) return;
    this.pageTabs?.render();
    this.saveDocument();
  }

  deletePage(id: string) {
    if (!this.pageDocument) return;
    if (this.pages.length <= 1) {
      new Notice(t('Keep at least one page'));
      return;
    }
    const page = this.pageDocument.find(id);
    if (!page) return;
    this.commitDraft();
    this.captureActivePage();
    this.removeGraftLinksOf(page);
    this.pageDocument.remove(id);
    this.foreignTreeMap().delete(id);
    this.renderActivePage();
    this.saveDocument();
  }

  /** Links to a removed page cannot survive because their endpoints are gone. */
  private removeGraftLinksOf(page: PageState) {
    const map = this.mindmap;
    if (!map?.grafts?.items.length) return;
    const ids = new Set<string>();
    const visit = (node: any) => { ids.add(node.id); (node.children || []).forEach(visit); };
    visit(this.pageData(page));
    const before = map.grafts.items.length;
    map.grafts.items = map.grafts.items.filter(link => !ids.has(link.source) && !ids.has(link.target));
    if (map.grafts.items.length !== before) {
      map.grafts.sync();
      this.toolbar?.update();
      new Notice(t('Virtual branches from the removed page were deleted'));
    }
  }

  getFrontMatter() {
    var frontMatter = '---\n\n';
  //  var v: any = '';
    if (this.fileCache?.frontmatter && this.fileCache?.frontmatterPosition) {
      // for (var k in this.fileCache.frontmatter) {
      //   if (k != 'position') {
      //     if (Object.prototype.toString.call(this.fileCache.frontmatter[k]) == '[object Array]' || Object.prototype.toString.call(this.fileCache.frontmatter[k]) == '[object Object]') {
      //       v = JSON.stringify(this.fileCache.frontmatter[k]);
      //     } else if (Object.prototype.toString.call(this.fileCache.frontmatter[k]) == '[object Number]' || Object.prototype.toString.call(this.fileCache.frontmatter[k]) == "[object String]") {
      //       v = this.fileCache.frontmatter[k];
      //     }

      //     if (v) {
      //       frontMatter += `${k}: ${v}\n`;
      //     }
      //   }
      // }
      //var position = this.fileCache.frontmatter.position;
      var position = this.fileCache.frontmatterPosition;
      var end =  position['end'].offset;

      frontMatter = this.data.substr(0,end);
    }

    frontMatter+='\n\n';
    //frontMatter += `\n---\n\n`;
    return frontMatter
  }

  constructor(leaf: WorkspaceLeaf, plugin: MindMapPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.searchNavigation = new SearchNavigation(this);
    this.setColors();

    this.fileCache = {
      'frontmatter': {
        'mindmap-plugin': 'basic'
      }
    }

  }


  async onClose() {
    this.searchReady=false;this.renderGeneration++;clearTimeout(this.initTimer);this.searchNavigation.clear();
    this.panel?.destroy();
    this.panel = null;
    this.toolbar?.destroy();
    this.toolbar = null;
    this.pageTabs?.destroy();
    this.pageTabs = null;
    this.foreignTreeMap().clear();
    // Remove draggables from render, as the DOM has already detached
    //this.plugin.removeView(this);
    if (this.mindmap) {
      this.mindmap.clear();
      this.contentEl.innerHTML = '';
      this.mindmap = null;
    }


  }

  clear() {

  }

  getViewData() {
    return this.data;
  }

  setViewData(data: string) {
    this.data = data;
    this.loadPages();
    this.renderActivePage();
  }

  /** Splits the file into pages; metadata is scoped per page except file-wide grafts. */
  private loadPages() {
    const body = this.getMdText(this.data);
    this.graftDocument = extractGrafts(body);
    this.pageDocument = new PageDocument(this.graftDocument.main, this.activePageId, index => `${t('Page')} ${index + 1}`);
    if (this.pageDocument.error && !this.pageErrorShown) {
      this.pageErrorShown = true;
      new Notice(t('Invalid page marker preserved'));
    }
    if (!this.pageDocument.error) this.pageErrorShown = false;
    this.foreignTreeMap().clear();
  }

  private renderActivePage() {
    const currentHighlights = this.mindmap?.path === this.file?.path ? this.mindmap?.highlights : undefined;
    const highlightState = currentHighlights && {keywords: currentHighlights.keywords.slice(), wholeWord: currentHighlights.wholeWord, colors: currentHighlights.keywords.map(keyword => currentHighlights.color(keyword))};
    const generation=++this.renderGeneration;this.searchReady=false;clearTimeout(this.initTimer);this.searchNavigation.beginRender();
    this.panel?.destroy();
    this.panel = null;
    this.toolbar?.destroy();
    this.toolbar = null;
    this.pageTabs?.destroy();
    this.pageTabs = null;
    this.foreignTreeMap().clear();

    if (this.mindmap) {
      this.mindmap.clear();
      this.contentEl.innerHTML = '';
      this.mindmap = null;
    }

    const page = this.activePage();
    const mindData = this.pageData(page);

    this.contentEl.innerHTML = '';
    this.contentEl.classList.add('mm-view');
    const viewport = document.createElement('div');
    viewport.className = 'mm-viewport';
    const body = document.createElement('div'); body.className = 'mm-view-body';
    this.contentEl.appendChild(body); body.appendChild(viewport);
    this.mindmap = new MindMap(mindData, viewport, this.plugin.settings);
    if (highlightState) this.mindmap.highlights?.set(highlightState.keywords, highlightState.wholeWord, highlightState.colors);
    this.toolbar = new MindMapToolbar(this.mindmap, this.contentEl);
    this.pageTabs = new PageTabs(this, this.contentEl, this.toolbar.element);
    this.panel = new MindMapPanel(this.mindmap, body, () => {
      const settings = (this.app as any).setting;
      settings.open(); settings.openTabById(this.plugin.manifest.id);
    }, Platform.isMobile);
    this.mindmap.colors = this.colors;
    const finish = () => {
      if (generation !== this.renderGeneration) return;
      this.mindmap.path = this.file?.path;
      this.attachForeignTrees(page);
      this.mindmap.init();
      this.mindmap.summaries.load(page.summaries.entries, page.summaries.preserved, page.summaries.raw);
      this.mindmap.relations.load(page.relations.entries, page.relations.preserved, page.relations.raw);
      this.mindmap.grafts.load(this.graftDocument.entries, this.graftDocument.preserved, this.graftDocument.raw);
      const pending = this.pendingGraftSource || '';
      if (pending && !this.isLocalNode(pending)) {
        this.mindmap.grafts.pending = pending;
        new Notice(t('Click the node to graft under; Escape cancels'));
      }
      this.mindmap.refresh();
      this.mindmap.view = this;
      this.toolbar?.update();
      this.pageTabs?.render();
      this.panel?.update();
      this.searchReady=true;this.searchNavigation.flush();
    };
    if (this.firstInit) {
      this.initTimer = setTimeout(() => {
        if (generation !== this.renderGeneration) return;
        const view = this.leaf?.view as MindMapView;
        if (view?.file) {
          this.fileCache = this.app.metadataCache.getFileCache(view.file);
          this.yamlString = this.getFrontMatter();
        }
        finish();
        this.firstInit = false;
      }, 100);
    } else {
      const view = this.leaf.view as MindMapView;
      this.fileCache = this.app.metadataCache.getFileCache(view.file);
      this.yamlString = this.getFrontMatter();
      finish();
    }
  }

  /**
   * A graft projection needs its source subtree even when the source lives on another
   * page. Those nodes stay detached from the canvas; only their mirrors are drawn.
   */
  private attachForeignTrees(active: PageState) {
    const map = this.mindmap;
    if (!map) return;
    this.foreignTreeMap().clear();
    this.foreignBaselineMap().clear();
    map.foreignNodes = () => this.foreignNodeList();
    const local = new Set<string>();
    const collect = (node: any) => { local.add(String(node?.id || '')); (node?.children || []).forEach(collect); };
    collect(active.data);
    const sources = new Set<string>();
    const entries: GraftData[] = this.graftDocument.entries;
    entries.forEach(entry => {
      if (local.has(entry.target) && !local.has(entry.source)) sources.add(entry.source);
    });
    const pending = this.pendingGraftSource || '';
    if (pending && !local.has(pending)) sources.add(pending);
    if (!sources.size) return;
    const pages = new Map<string, PageState>();
    sources.forEach(id => {
      const page = this.findPageWithNode(id);
      if (page && page !== active) pages.set(page.meta.id, page);
    });
    pages.forEach(page => this.buildForeignTree(page));
  }

  private foreignNodeList(): any[] {
    const nodes: any[] = [];
    const visit = (node: any) => { nodes.push(node); node.children.forEach(visit); };
    this.foreignTreeMap().forEach(root => visit(root));
    return nodes;
  }

  private findPageWithNode(id: string): PageState | undefined {
    const cached = this.pages.find(page => page.data && this.hasNode(page.data, id));
    if (cached) return cached;
    const candidates = this.pages.filter(page => page.tree.includes(id));
    for (const page of candidates) if (this.hasNode(this.pageData(page), id)) return page;
    for (const page of this.pages) {
      if (candidates.includes(page) || page.data) continue;
      if (this.hasNode(this.pageData(page), id)) return page;
    }
    return undefined;
  }

  private hasNode(data: any, id: string): boolean {
    if (!data) return false;
    if (String(data.id) === id) return true;
    return (data.children || []).some((child: any) => this.hasNode(child, id));
  }

  private isLocalNode(id: string): boolean {
    const map = this.mindmap;
    if (!map?.root) return false;
    let found = false;
    map.traverseAll((node: any) => { if (node.getId() === id) found = true; });
    return found;
  }

  private buildForeignTree(page: PageState) {
    const map = this.mindmap;
    if (!map) return;
    const make = (data: INodeData, parent?: INode): INode => {
      const node = new INode({ ...data, children: undefined, isRoot: !parent } as INodeData, map);
      node.foreign = true;
      if (parent) { parent.children.push(node); node.parent = parent; }
      (data.children || []).forEach(child => make(child, node));
      return node;
    };

    const root = make(this.pageData(page));
    this.foreignTreeMap().set(page.meta.id, root);
    this.foreignBaselineMap().set(page.meta.id, treeMarkdown(root, this.plugin.settings.headLevel));
  }

  setEphemeralState(state: any) {
    super.setEphemeralState(state);
    this.searchNavigation.receive(state);
  }

  onunload() {
    this.searchReady=false;this.renderGeneration++;clearTimeout(this.initTimer);this.searchNavigation.clear();
    this.panel?.destroy();
    this.panel = null;
    this.toolbar?.destroy();
    this.toolbar = null;
    this.pageTabs?.destroy();
    this.pageTabs = null;
    this.foreignTreeMap().clear();
    this.app.workspace.offref("quick-preview");
    this.app.workspace.offref("resize");

    if (this.mindmap) {
      this.mindmap.clear();
      this.contentEl.innerHTML = '';
      this.mindmap = null;
    }

    this.plugin.setMarkdownView(this.leaf);


  }

  onload() {
    super.onload();
    this.registerEvent(
      this.app.workspace.on("quick-preview", () => this.onQuickPreview, this)
    );
//    this.registerEvent(
//      this.app.workspace.on('resize', () => this.updateMindMap(), this)
//    );
  }

  onQuickPreview(file: TFile, data: string) {
    if (file === this.file && data !== this.data) {
      this.setViewData(data);
      this.fileCache = this.app.metadataCache.getFileCache(file);
    }
  }

  updateMindMap() {
    if (this.mindmap) {
      if(Platform.isDesktopApp){
        this.mindmap.center();
      }
    }
  }

  async onFileMetadataChange(file: TFile) {
    var path = file.path;
    let md = await this.app.vault.adapter.read(path);
    this.onQuickPreview(file, md);
  }

  async saveClipboardImage(image: Blob): Promise<string> {
    const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp', 'image/svg+xml': 'svg', 'image/avif': 'avif' };
    const extension = extensions[image.type];
    if (!extension) throw new Error('Unsupported clipboard image type');
    const filename = `Pasted-image-${Date.now()}-${uuid()}.${extension}`;
    const manager = this.app.fileManager as FileManager & {
      getAvailablePathForAttachment?: (filename: string, sourcePath: string) => Promise<string>;
    };
    if (!manager.getAvailablePathForAttachment) throw new Error('Image paste requires Obsidian 1.5.7 or later');
    const path = await manager.getAvailablePathForAttachment(filename, this.file?.path || '');
    const file = await this.app.vault.createBinary(path, await image.arrayBuffer());
    return '!' + manager.generateMarkdownLink(file, this.file?.path || '');
  }

  getMdText(str: string) {
    var md = str.trim().replace(FRONT_MATTER_REGEX, '');
    return md.trim();
  }

  mdToData(str: string, includeSource = false) {
    const prepared = prepareMainMarkdown(str);
    function transformData(mapData: any) {
      var flag = true;
      if (mapData.t == 'blockquote') {
        mapData = mapData.c[0];
        flag = false;
        mapData.v = '> ' + mapData.v;
      }
      // Multiple Markdown lists may remain as structural wrappers in Markmap.
      const flattenLists = (nodes: any[]): any[] => nodes.reduce((out: any[], node: any) =>
        out.concat(['bullet_list', 'ordered_list'].includes(node.t) ? flattenLists(node.c || []) : [node]), []);
      mapData.c = flattenLists(mapData.c || []);
      const source = sourceNodeContent(mapData, prepared);
      const marker = { text: source.text, id: source.stableId };
      mapData.v = marker.text;
      const regexResult = /^(?:.* )?\^([a-z0-9\-]+)$/gim.exec(mapData.v);
      const id = source.foldedId || (!['heading', 'list_item'].includes(mapData.t) && regexResult != null ? regexResult[1] : null)

     // console.log(id);

      var map: INodeData = {
        ...(includeSource ? {sourceStartLine: mapData.t === 'root' ? -1 : (mapData.p?.lines?.[0] ?? -1), sourceEndLine: (source as any).endLine ?? mapData.p?.lines?.[1] ?? -1} : {}),
        id: marker.id || id || uuid(),
        summaryMember: !!marker.id,
        stylePreset: prepared.styles.get(mapData.p?.lines?.[0])?.name,
        nodeStyle: prepared.styles.get(mapData.p?.lines?.[0])?.overrides,
        text: id ? mapData.v.replace(new RegExp(` ?\\^${id}$`, 'im'), '') : mapData.v,
        children: [],
        expanded: true
      };

      if (flag && mapData.c && mapData.c.length) {
        mapData.c.forEach((data: any) => {
          map.children.push(transformData(data));
        });
      }

      return map;
    }

    if (str) {
      const { root } = transformer.transform(prepared.text);
      const data = transformData(root);
      // A list-only document with one top-level item has that item as its map root.
      if (root.t === 'root' && !data.text && data.children?.length === 1) return data.children[0];
      return data;

    } else {
      return {
        id: uuid(),
        text: this.app.workspace.getActiveFile()?.basename || `${t('Untitled mindmap')}`
      }
    }
  }


  onMoreOptionsMenu(menu: Menu) {
    // Add a menu item to force the board to markdown view
    menu
      .addItem((item) => {
        item
          .setTitle(`${t("Open as markdown")}`)
          .setIcon("document")
          .onClick(() => {
            this.plugin.mindmapFileModes[this.id || this.file.path] = "markdown";
            this.plugin.setMarkdownView(this.leaf);
          });
      });

    // .addItem((item)=>{
    //    item
    //    .setTitle(`${t("Export to opml")}`)
    //    .setIcon('image-file')
    //    .onClick(()=>{
    //       const targetFolder = this.plugin.app.fileManager.getNewFileParent(
    //        this.plugin.app.workspace.getActiveFile()?.path || ""
    //       );
    //       if(targetFolder){
    //         console.log(targetFolder,this.plugin.app.fileManager);

    //       }
    //    })

    // })

    super.onPaneMenu(menu,'more-options');
  }

}
