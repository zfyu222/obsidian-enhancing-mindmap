import MindMapPanel from './MindMapPanel';
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
import { extractSummaries, prepareMainMarkdown, sourceNodeContent } from './summary/markdown';
import MindMapToolbar from './MindMapToolbar';
import { INodeData } from './mindmap/INode'
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

export class MindMapView extends TextFileView implements HoverParent {
  plugin: MindMapPlugin;
  hoverPopover: HoverPopover | null;
  id: string = (this.leaf as any).id;
  mindmap: MindMap | null;
  toolbar: MindMapToolbar | null;
  panel: MindMapPanel | null;
  colors: string[] = [];
  timeOut: any = null;
  fileCache: any;
  firstInit: boolean = true;
  yamlString:string=''

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
    if (this.mindmap) {
      var md = this.mindmap.getMarkdown();
    //  var matchArray: string[] = []
      // var collapsedIds: string[] = []
      // const idRegexMultiline = /.+ \^([a-z0-9\-]+)$/gim
      // while ((matchArray = idRegexMultiline.exec(md)) != null) {
      //   collapsedIds = [...collapsedIds, ...matchArray.slice(1, 2)];
      // }
      // this.fileCache.frontmatter.collapsedIds='';
      // if (collapsedIds.length > 0) {
      //   this.fileCache.frontmatter.collapsedIds = collapsedIds;
      // }
      //var frontMatter = this.getFrontMatter();
      this.data = this.yamlString + md;
      // console.log(this.mindmap.path);
     // this.app.vault.adapter.write(this.mindmap.path, this.data);
       try{
        this.requestSave();
        //new Notice(`${t("Save success")}`);
       }catch(err){
        console.log(err);
        new Notice(`${t("Save fail")}`)
      }
    }
  }

  getFrontMatter() {
    var frontMatter = '---\n\n';
  //  var v: any = '';
    if (this.fileCache.frontmatter) {
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
    this.setColors();

    this.fileCache = {
      'frontmatter': {
        'mindmap-plugin': 'basic'
      }
    }

  }


  async onClose() {
    this.panel?.destroy();
    this.panel = null;
    this.toolbar?.destroy();
    this.toolbar = null;
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
    this.panel?.destroy();
    this.panel = null;
    this.toolbar?.destroy();
    this.toolbar = null;

    if (this.mindmap) {
      this.mindmap.clear();
      this.contentEl.innerHTML = '';
    }

    this.data = data;

    var mdText = this.getMdText(this.data);
    const summaryDocument = extractSummaries(mdText);
    var mindData = this.mdToData(summaryDocument.main);
    mindData.isRoot = true;

    // const frontmatterContentRegExResult = /^---$(.+?)^---$.+?/mis.exec(data)

    // if (frontmatterContentRegExResult != null && frontmatterContentRegExResult[1]) {
    //   frontmatterContentRegExResult[1].split('\n').forEach((frontmatterLine) => {
    //     const keyValue = frontmatterLine.split(': ')
    //     if (keyValue.length === 2) {
    //       const value = /^[{\[].+[}\]]$/.test(keyValue[1]) ? JSON.parse(keyValue[1]) : keyValue[1]
    //       this.fileCache.frontmatter[keyValue[0]] = value
    //     }
    //   });
    // }

    this.contentEl.innerHTML = '';
    this.contentEl.classList.add('mm-view');
    const viewport = document.createElement('div');
    viewport.className = 'mm-viewport';
    const body = document.createElement('div'); body.className = 'mm-view-body';
    this.contentEl.appendChild(body); body.appendChild(viewport);
    this.mindmap = new MindMap(mindData, viewport, this.plugin.settings);
    this.toolbar = new MindMapToolbar(this.mindmap, this.contentEl);
    this.panel = new MindMapPanel(this.mindmap, body, () => {
      const settings = (this.app as any).setting;
      settings.open(); settings.openTabById(this.plugin.manifest.id);
    });
    this.mindmap.colors = this.colors;
    if (this.firstInit) {

      setTimeout(() => {
        var leaf = this.leaf;
        if (leaf) {
          var view = leaf.view as MindMapView;

          this.mindmap.path = view?.file.path;
          if (view.file) {
            this.fileCache = this.app.metadataCache.getFileCache(view.file);
            this.yamlString = this.getFrontMatter();
          }
        }
        this.mindmap.init();
        this.mindmap.summaries.load(summaryDocument.entries, summaryDocument.preserved, summaryDocument.raw);
        this.mindmap.refresh();
        this.mindmap.view = this;
        this.toolbar?.update();
        this.panel?.update();
        this.firstInit = false;
      }, 100);
    } else {
      var view = this.leaf.view as MindMapView;
      this.fileCache = this.app.metadataCache.getFileCache(view.file);
      this.yamlString = this.getFrontMatter();

      this.mindmap.path = view?.file.path;
      this.mindmap.init();
      this.mindmap.summaries.load(summaryDocument.entries, summaryDocument.preserved, summaryDocument.raw);
      this.mindmap.refresh();
      this.mindmap.view = this;
      this.toolbar?.update();
      this.panel?.update();
    }
  }

  onunload() {
    this.panel?.destroy();
    this.panel = null;
    this.toolbar?.destroy();
    this.toolbar = null;
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

  mdToData(str: string) {
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
        id: marker.id || id || uuid(),
        summaryMember: !!marker.id,
        stylePreset: prepared.styles.get(mapData.p?.lines?.[0]),
        text: id ? mapData.v.replace(new RegExp(` ?\\^${id}$`, 'im'), '') : mapData.v,
        children: [],
        expanded: id ? false:true
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
