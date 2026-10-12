import INode, { INodeData } from './INode'
import Layout from './Layout'
import { Notice, Platform } from 'obsidian'
import SVG from 'svg.js'
import { MindMapView } from '../MindMapView'
import { frontMatterKey, basicFrontmatter } from '../constants';
import Exec from './Execute'
import {uuid} from '../MindMapView'
import { serializeSubtree, serializeForest, parseSubtree, clipboardAction } from './clipboard'
import { selectionRoots, containsNode, selectionRect, intersectsRect } from './selection'

import importXmind  from './import/xmindZen'
import jsZip from 'jszip'
import { t } from 'src/lang/helpers'

let deleteIcon = '<svg class="icon" width="16px" height="16.00px" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path  d="M799.2 874.4c0 34.4-28 62.4-62.368 62.4H287.2a62.496 62.496 0 0 1-62.4-62.4V212h574.4v662.4zM349.6 100c0-7.2 5.6-12.8 12.8-12.8h300c7.2 0 12.768 5.6 12.768 12.8v37.6H349.6V100z m636.8 37.6H749.6V100c0-48-39.2-87.2-87.2-87.2h-300a87.392 87.392 0 0 0-87.2 87.2v37.6H37.6C16.8 137.6 0 154.4 0 175.2s16.8 37.6 37.6 37.6h112v661.6A137.6 137.6 0 0 0 287.2 1012h449.6a137.6 137.6 0 0 0 137.6-137.6V212h112c20.8 0 37.6-16.8 37.6-37.6s-16.8-36.8-37.6-36.8zM512 824c20.8 0 37.6-16.8 37.6-37.6v-400c0-20.8-16.768-37.6-37.6-37.6-20.8 0-37.6 16.8-37.6 37.6v400c0 20.8 16.8 37.6 37.6 37.6m-175.2 0c20.8 0 37.6-16.8 37.6-37.6v-400c0-20.8-16.8-37.6-37.6-37.6s-37.6 16.8-37.6 37.6v400c0.8 20.8 17.6 37.6 37.6 37.6m350.4 0c20.8 0 37.632-16.8 37.632-37.6v-400c0-20.8-16.8-37.6-37.632-37.6-20.768 0-37.6 16.8-37.6 37.6v400c0 20.8 16.8 37.6 37.6 37.6" /></svg>';
let addIcon = '<svg class="icon" width="16px" height="16.00px" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path  d="M512 1024C230.4 1024 0 793.6 0 512S230.4 0 512 0s512 230.4 512 512-230.4 512-512 512z m0-960C265.6 64 64 265.6 64 512s201.6 448 448 448 448-201.6 448-448S758.4 64 512 64z"  /><path d="M800 544H224c-19.2 0-32-12.8-32-32s12.8-32 32-32h576c19.2 0 32 12.8 32 32s-12.8 32-32 32z"  /><path  d="M512 832c-19.2 0-32-12.8-32-32V224c0-19.2 12.8-32 32-32s32 12.8 32 32v576c0 19.2-12.8 32-32 32z"  /></svg>';
let tempDispLevel = 0;

interface Setting {
    theme?: string;
    canvasSize?: number;
    background?: string;
    fontSize?: number;
    color?: string,
    exportMdModel?: string,
    headLevel: number,
    layoutDirect: string,
    strokeArray?:any[],
    focusOnMove?: boolean
}

export default class MindMap {
    root: INode;
    status: string;
    appEl: HTMLElement;
    contentEL: HTMLElement;
    containerEL: HTMLElement;
    path?: string;
    editNode?: INode;
    selectNode?: INode;
    lastSelectedNode?: INode;
    // selectingNodes?:boolean;
    selectedNodes: INode[] = [];
    _dragNodes: INode[] = [];
    _selectionStart?: { x: number; y: number };
    _selectionBase: INode[] = [];
    _selectionMoved = false;
    _selectionOverlay?: HTMLElement;
    _panning = false;
    _panMoved = false;
    _suppressContextUntil = 0;
    _suppressClickUntil = 0;
    setting: Setting;
    data: INodeData;
    drag?: boolean;
    startX?: number;
    startY?: number;
    dx?: number;
    dy?: number;
    mmLayout?: Layout;
    draw: any;
    edgeGroup: any;
    _nodeNum: number = 0;
    _tempNum: number = 0;
    view?: MindMapView;
    colors: string[] = [];
    _dragNode: INode;
    exec: Exec;
    scalePointer: number[] = [];
    mindScale = 100;
    timeOut: any = null;
    _indicateDom:HTMLElement;
    _menuDom:HTMLElement;
    _dragType:string='';
    _left:number;
    _top:number;
    dispLevel:number;
    isComposing = false;
    isFocused = true;

    constructor(data: INodeData, containerEL: HTMLElement, setting?: Setting) {
        this.setting = Object.assign({
            theme: 'default',
            //canvasSize: 8000,
            canvasSize: 36000,
            fontSize: 16,
            background: 'transparent',
            color: 'inherit',
            exportMdModel: 'default',
            headLevel: 2,
            layoutDirect: ''
        }, setting || {});


        this.data = data;
        this.appEl = document.createElement('div');

        this.appEl.classList.add('mm-mindmap');
        this.appEl.classList.add(`mm-theme-${this.setting.theme}`);
        this.appEl.style.overflow = "auto";


        this.contentEL = document.createElement('div');
        this.contentEL.style.position = "relative";
        this.contentEL.style.width = "100%";
        this.contentEL.style.height = "100%";
        this.appEl.appendChild(this.contentEL);
        this.draw = SVG(this.contentEL).size('100%', '100%');

        this.setAppSetting();
        containerEL.appendChild(this.appEl);
        this.containerEL = containerEL;


        //layout direct
        this._indicateDom = document.createElement('div');
        this._indicateDom.classList.add('mm-node-layout-indicate');
        this._indicateDom.style.display='none';

        //menu
        this._menuDom = document.createElement('div');
        this._menuDom.classList.add('mm-node-menu');
        this._menuDom.style.display='none';
        this.setMenuIcon();

        this.contentEL.appendChild(this._indicateDom);
        this.contentEL.appendChild(this._menuDom);

        //history
        this.exec = new Exec();

        // link line
        this.edgeGroup = this.draw.group();

        this.appClickFn = this.appClickFn.bind(this);
        this.appDragstart = this.appDragstart.bind(this);
        this.appDragend = this.appDragend.bind(this);
        this.appDragover = this.appDragover.bind(this);
        this.appDblclickFn = this.appDblclickFn.bind(this);
        this.appMouseOverFn = this.appMouseOverFn.bind(this);
        this.appDrop = this.appDrop.bind(this);
        this.appKeyup = this.appKeyup.bind(this);
        this.compositionStart = this.compositionStart.bind(this);
        this.compositionEnd = this.compositionEnd.bind(this);

        this.appKeydown = this.appKeydown.bind(this);
        this.appMousewheel = this.appMousewheel.bind(this);
        this.appMouseMove = this.appMouseMove.bind(this);

        this.appMouseDown = this.appMouseDown.bind(this);
        this.appMouseUp = this.appMouseUp.bind(this);
        this.appContextMenu = this.appContextMenu.bind(this);
        this.appPaste = this.appPaste.bind(this);

        this.appFocusIn = this.appFocusIn.bind(this);
        this.appFocusOut = this.appFocusOut.bind(this);

        //custom event
        this.initNode = this.initNode.bind(this);
        this.renderEditNode = this.renderEditNode.bind(this);
        this.mindMapChange = this.mindMapChange.bind(this);

        this.initEvent();
        //this.center();
        this.dispLevel=0;
    }

    setMenuIcon(){
        var addNodeDom = document.createElement('span');
        var deleteNodeDom = document.createElement('span');
        addNodeDom.classList.add('mm-icon-add-node');
        deleteNodeDom.classList.add('mm-icon-delete-node');
        addNodeDom.innerHTML = addIcon;
        deleteNodeDom.innerHTML = deleteIcon;
        this._menuDom.appendChild(addNodeDom);
        this._menuDom.appendChild(deleteNodeDom);
    }

    setAppSetting() {
        this.appEl.style.width = `${this.setting.canvasSize}px`;
        this.appEl.style.height = `${this.setting.canvasSize}px`;
        this.contentEL.style.width = `100%`;
        this.contentEL.style.height = `100%`;
        //  this.contentEL.style.color=`${this.setting.color};`;
        this.contentEL.style.background = `${this.setting.background}`;
        this.contentEL.style.fontSize = `${this.setting.fontSize}px`;
    }
    //create node
    init(collapsedIds?: string[]) {
        var that = this;
        var data = this.data;
        var x = this.setting.canvasSize / 2 - 60;
        var y = this.setting.canvasSize / 2 - 200;
        var waitCollapseNodes:INode[]=[];

        function initNode(d: INodeData, isRoot: boolean, p?: INode) {
            that._nodeNum++;
            var n = new INode(d, that);
            // if (collapsedIds && collapsedIds.includes(n.getId())) {
            //     n.isExpand = false;
            // }
            // if (p && (!p.isExpand || p.isHide)) {
            //     n.isHide = true;
            // }

            that.contentEL.appendChild(n.containEl);
            if (isRoot) {
                n.setPosition(x, y);
                that.root = n;
                n.data.isRoot = true;
            } else {
                n.setPosition(0, 0);
                p.children.push(n);
                n.parent = p;
            }

            n.refreshBox();

            if(!d.expanded){
                waitCollapseNodes.push(n)
            }
            n.refreshBox();
            if (d.children && d.children.length) {
                d.children.forEach((dd: INodeData) => {
                    initNode(dd, false, n);
                });
            }
        }
        initNode(data, true);

        if(waitCollapseNodes.length){
            waitCollapseNodes.forEach(n=>{
                n.collapse();
            });
        }
    }

    traverseBF(callback: Function, node?: INode) {
        var array = [];
        array.push(node || this.root);
        var currentNode = array.shift();
        while (currentNode) {
            for (let i = 0, len = currentNode.children.length; i < len; i++) {
                array.push(currentNode.children[i]);
            }
            callback(currentNode);
            currentNode = array.shift();
        }
    }

    traverseDF(callback: Function, node?: INode, cbFirst?: boolean) {
        function recurse(currentNode: INode) {
            if (currentNode) {
                if (cbFirst) {
                    callback(currentNode);
                }
                if (currentNode.children) {
                    for (var i = 0, length = currentNode.children.length; i < length; i++) {
                        recurse(currentNode.children[i]);
                    }
                }
                if (!cbFirst) {
                    callback(currentNode);
                }
            }
        }
        recurse(node || this.root);

    }

    getNodeById(id: string) {
        var snode: INode = null;
        this.traverseDF((n: INode) => {
            if (n.getId() == id) {
                snode = n;
            }
        });

        return snode;
    }

    getSelectedNodes(): INode[] {
        return this.selectedNodes?.length ? this.selectedNodes.slice() : (this.selectNode ? [this.selectNode] : []);
    }

    getSelectedRoots(): INode[] {
        const roots = new Set(selectionRoots(this.getSelectedNodes()));
        const ordered: INode[] = [];
        this.traverseDF((node: INode) => { if (roots.has(node)) ordered.push(node); }, this.root, true);
        return ordered;
    }

    setSelectedNodes(nodes: INode[], primary?: INode, focus = true) {
        if (this.editNode?.data.isEdit && (nodes.length !== 1 || nodes[0] !== this.editNode)) {
            this.editNode.cancelEdit();
            this.editNode = null;
        }
        this.getSelectedNodes().forEach(node => node.unSelect());
        this.selectedNodes = Array.from(new Set(nodes));
        this.selectNode = primary && this.selectedNodes.includes(primary) ? primary : this.selectedNodes[0];
        this.selectedNodes.forEach(node => {
            node.isSelect = true;
            node.containEl.setAttribute('draggable', 'true');
            node.containEl.classList.add('mm-node-select');
        });
        if (focus && this.selectNode) this.selectNode.select(true);
    }

    clearSelectNode() {
        this.lastSelectedNode = this.selectNode;
        this.getSelectedNodes().forEach(node => node.unSelect());
        this.selectedNodes = [];
        this.selectNode = null;
        if (this.editNode?.data.isEdit) this.editNode.cancelEdit();
        this.editNode = null;
    }

    deleteSelectedNodes(nodes = this.getSelectedRoots()) {
        if (nodes.some(node => node.data.isEdit)) return;
        this.execute('removeNodes', { nodes });
        this._menuDom.style.display = 'none';
    }

    initEvent() {
        this.appEl.addEventListener('click', this.appClickFn);
        this.appEl.addEventListener('contextmenu', this.appContextMenu, true);
        document.addEventListener('paste', this.appPaste, true);
        this.appEl.addEventListener('mouseover', this.appMouseOverFn);
        this.appEl.addEventListener('dblclick', this.appDblclickFn);
        this.appEl.addEventListener('dragstart', this.appDragstart);
        this.appEl.addEventListener('dragover', this.appDragover);
        this.appEl.addEventListener('dragend', this.appDragend);
        this.appEl.addEventListener('drop', this.appDrop);
        document.addEventListener('keyup', this.appKeyup);
        document.addEventListener('keydown', this.appKeydown, true);
        document.addEventListener('compositionstart',this.compositionStart)
        document.addEventListener('compositionend',this.compositionEnd)
        document.body.addEventListener('mousewheel', this.appMousewheel);

        if(Platform.isDesktop){
            this.appEl.addEventListener('mousedown', this.appMouseDown);
            document.addEventListener('mouseup', this.appMouseUp);
            window.addEventListener('blur', this.appMouseUp);
        }

        document.addEventListener('mousemove', this.appMouseMove);

        this.containerEL.addEventListener('focusin', this.appFocusIn);
        this.containerEL.addEventListener('focusout', this.appFocusOut);
        //custom event
        this.on('initNode', this.initNode);
        this.on('renderEditNode', this.renderEditNode);
        this.on('mindMapChange', this.mindMapChange);

    }

    removeEvent() {
        this.appEl.removeEventListener('click', this.appClickFn);
        this.appEl.removeEventListener('contextmenu', this.appContextMenu, true);
        document.removeEventListener('paste', this.appPaste, true);
        this.appEl.removeEventListener('dragstart', this.appDragstart);
        this.appEl.removeEventListener('dragover', this.appDragover);
        this.appEl.removeEventListener('dragend', this.appDragend);
        this.appEl.removeEventListener('dblClick', this.appDblclickFn);
        this.appEl.removeEventListener('mouseover', this.appMouseOverFn);
        this.appEl.removeEventListener('drop', this.appDrop);
        document.removeEventListener('keyup', this.appKeyup);
        document.removeEventListener('keydown', this.appKeydown, true);
        document.removeEventListener('compositionstart',this.compositionStart)
        document.removeEventListener('compositionend',this.compositionEnd)

        document.body.removeEventListener('mousewheel', this.appMousewheel);

        if(Platform.isDesktop){
            this.appEl.removeEventListener('mousedown', this.appMouseDown);
            document.removeEventListener('mouseup', this.appMouseUp);
            window.removeEventListener('blur', this.appMouseUp);
        }

        document.removeEventListener('mousemove', this.appMouseMove);
        this._selectionOverlay?.remove();
        this._selectionStart = null;
        this._panning = false;

        this.containerEL.removeEventListener('focusin', this.appFocusIn);
        this.containerEL.removeEventListener('focusout', this.appFocusOut);

        this.off('initNode', this.initNode);
        this.off('renderEditNode', this.renderEditNode);
        this.off('mindMapChange', this.mindMapChange);
    }

    initNode(evt: CustomEvent) {
        this._tempNum++;
        //console.log(this._nodeNum,this._tempNum);

        if (this._tempNum == this._nodeNum) {
            this.refresh();
            //this.center();
        }
    }

    renderEditNode(evt: CustomEvent) {
        var node = evt.detail.node || null;
        node?.clearCacheData();
        this.refresh();
    }

    mindMapChange() {
        //console.log(this.view)
        this.view?.mindMapChange();
    }
    appFocusIn(evt: FocusEvent){
        setTimeout(() => {
            if (this.containerEL.contains(evt.relatedTarget as Node)) return;
            this.isFocused = true;
        }, 100);
    }
    appFocusOut(evt: FocusEvent){
        if (this.containerEL.contains(evt.relatedTarget as Node)) return;
        this.isFocused = false;
    }
    appKeydown(e: KeyboardEvent) {
        if (!this.view || this.view.app.workspace.getActiveViewOfType(MindMapView) !== this.view) return;
        const target = e.target as HTMLElement;
        if (target ? !this.containerEL.contains(target) : !this.isFocused) return;
        if (e.defaultPrevented || this.isComposing || e.isComposing || e.keyCode === 229 || e.key === 'Process') return;
        const node = this.selectNode;
        const editing = !!(node?.data.isEdit || this.editNode?.data.isEdit);
        const textTarget = target && (target.isContentEditable ||
            (typeof target.closest === 'function' && target.closest('input, textarea, [contenteditable="true"]')));
        // Only Enter/Tab in this node's editor may finish editing. Other text fields are native.
        if (textTarget && !(editing && node?.contentEl.contains(target))) return;
        const consume = () => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        };
        const action = clipboardAction(e, editing);
        if (action && (node || (action === 'paste' && this.root))) {
            consume();
            if (action === 'copy') void this.copyToClipboard();
            else void this.pasteFromClipboard();
            return;
        }
        const key = e.key.toLowerCase();
        const mod = e.ctrlKey || e.metaKey;
        if (mod && !e.altKey && !e.shiftKey && key === 'z' && editing) {
            const editor = this.editNode || node;
            const history = this.exec?.history;
            const latest = history?.undos[history.undos.length - 1];
            // The first auto-editor has no text edit to undo until its content changes.
            if (latest?.name === 'addNode' && (latest as typeof latest & { node?: INode }).node === editor &&
                editor.contentEl.innerText.trim() === editor._oldText?.trim()) {
                consume();
                this.undo();
            }
            return;
        }
        if (mod && !e.altKey && !editing) {
            if (key === 'z' || (key === 'y' && !e.shiftKey)) {
                consume();
                if (key === 'y' || e.shiftKey) this.redo();
                else this.undo();
            }
            return;
        }
        if (mod || e.altKey || e.shiftKey || !node) return;
        if (key === 'tab' || key === 'insert' || key === 'enter') {
            consume();
            if (editing) {
                node.cancelEdit();
                this.editNode = null;
                node.select();
                return;
            }
            if (key === 'enter') {
                if (!node.parent) return;
                this.execute('addSiblingNode', {
                    parent: node.parent,
                    index: node.parent.children.indexOf(node) + 1
                });
            } else {
                if (!node.isExpand) node.expand();
                this.execute('addChildNode', { parent: node });
            }
            this._menuDom.style.display = 'none';
        } else if (!editing && key === ' ') {
            consume();
            node.edit();
            this._menuDom.style.display = 'none';
        } else if (!editing && (key === 'delete' || key === 'backspace') && !node.data.isRoot) {
            consume();
            this.deleteSelectedNodes();
        }
    }

     compositionStart(e: KeyboardEvent) {

        this.isComposing = true;
     }
     compositionEnd(e: KeyboardEvent) {

        this.isComposing = false;
     }

    appKeyup(e: KeyboardEvent) {
        if (!this.isFocused) return; // Check if Mindmap is in focus or not
        var keyCode = e.keyCode || e.which || e.charCode;
        var ctrlKey = e.ctrlKey || e.metaKey;
        var shiftKey = e.shiftKey;
        var altKey = e.altKey;

        // if (ctrlKey) {                         // Shift -> Selecting
        //     // Ctrl -> selecting
        //     this.selectingNodes = true;
        // } else {
        //     this.selectingNodes = false;
        // }

        if (!ctrlKey && !shiftKey && !altKey) { // NO SPECIAL KEY
            // Enter
            // if (keyCode == 13 || e.key =='Enter') {
            //     var node = this.selectNode;
            //     e.preventDefault();
            //     e.stopPropagation();
            //     if(node) {// A node is selected
            //         if (!node.data.isEdit) {// Not editing a node => Add sibling node
            //             if (!node.isExpand) {
            //                 node.expand();
            //             }
            //             if (!node.parent) return;
            //             node.mindmap.execute('addSiblingNode', {
            //                 parent: node.parent
            //             });
            //             this._menuDom.style.display='none';
            //         }
            //         else {// Editing mode => end edit mode
            //             //node.cancelEdit();

            //             this.clearSelectNode();
            //             node.select();
            //             node.mindmap.editNode=null;
            //             //this.selectNode.unSelect();
            //         }
            //     }
            //     //else: no node selected: nothing to do
            // }

            //delete
            // if (keyCode == 46 || e.key == 'Delete' || e.key == 'Backspace') {
            //     var node = this.selectNode;
            //     if (node && !node.data.isRoot && !node.data.isEdit) {
            //         e.preventDefault();
            //         e.stopPropagation();
            //         node.mindmap.execute("deleteNodeAndChild", { node });
            //         this._menuDom.style.display='none';
            //     }
            //     //else: Deletion makes no sense
            // }


            // Tab / Insert
            // if (keyCode == 9 || keyCode == 45 || e.key == 'Tab') {
            //     e.preventDefault();
            //     e.stopPropagation();
            //     var node = this.selectNode;
            //     if(node) {
            //         if (!node.data.isEdit) {// Not editing
            //             if (!node.isExpand) {
            //                 node.expand();
            //             }
            //             node.mindmap.execute("addChildNode", { parent: node });
            //             this._menuDom.style.display='none';
            //         } else{
            //             // this.selectNode.unSelect();
            //             this.clearSelectNode();
            //             node.select();
            //             node.mindmap.editNode=null;
            //         }
            //     }
            //     //else: no node selected -> nothing to do
            // }

                // Escape
            if (keyCode == 27) {
                e.preventDefault();
                e.stopPropagation();

                var node = this.selectNode;
                if (node && node.data.isEdit) {
                    node.select();
                    node.mindmap.editNode = null;
                    node.cancelEdit();
                    this.undo();
                    //this.selectNode.unSelect();
                }
            }

            // up
            if (keyCode == 38 || e.key == 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();

                var node = this.selectNode;
                if( node && !node.data.isEdit )
                {
                    var l_selectedNode = node;
                    while(  (this.selectNode == node)       &&
                            (l_selectedNode != this.root)   )
                    {
                        this._selectNode(l_selectedNode, "up");
                        l_selectedNode = l_selectedNode.parent;
                    }
                }
            }

            if (keyCode == 40 || e.key == 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();

                var node = this.selectNode;
                if( node && !node.data.isEdit )
                {
                    var l_selectedNode = node;
                    while(  (this.selectNode == node)       &&
                            (l_selectedNode != this.root)   )
                    {
                        this._selectNode(l_selectedNode, "down");
                        l_selectedNode = l_selectedNode.parent;
                    }
                }
            }

            if (keyCode == 39 || e.key == 'ArrowRight') {
                e.preventDefault();
                e.stopPropagation();

                var node = this.selectNode;
                if (node && !node.data.isEdit) {
                    var rootPos = this.root.getPosition();
                    var nodePos = node.getPosition();
                    if(rootPos.x > nodePos.x)
                    {// Node on left side of the mindmap
                        node.unSelect();
                        node.parent.select();
                    }
                    else
                    {
                        var node = this.selectNode;
                        node.mindmap.execute('expandNode', {
                            node
                        });
                        this._selectNode(node, "right");
                    }
                }
            }

            if (keyCode == 37 || e.key == 'ArrowLeft') {
                e.preventDefault();
                e.stopPropagation();

                var node = this.selectNode;
                if (node && !node.data.isEdit) {
                    var rootPos = this.root.getPosition();
                    var nodePos = node.getPosition();
                    if(rootPos.x < nodePos.x)
                    {// Node on right side of the mindmap
                        node.unSelect();
                        node.parent.select();
                    }
                    else
                    {
                        var node = this.selectNode;
                        node.mindmap.execute('expandNode', {
                            node
                        });
                        this._selectNode(node, "left");
                    }
                }
            }

            // Home : Select root node
            if (keyCode == 36) {
                e.preventDefault();
                e.stopPropagation();

                if( (!this.selectNode)          ||
                    (!this.selectNode.data.isEdit)   )
                {// No edition: select root node
                    if(this.selectNode)
                    { this.selectNode.unSelect(); }
                    this.root.select();
                    this.center();
                }
            }
        }


        if (ctrlKey && !shiftKey && !altKey) {  // CTRL KEY
            /*//ctr + /  (or Ctrl + NumpadDivide) toggle expand node
            // if ((keyCode == 191) || (keyCode == 111)) {
            //     var node = this.selectNode;
            //     this._toggleExpandNode(node);
            // }
            if ((keyCode == 191) || (keyCode == 111)) {
                var node = this.selectNode;
                if (node && !node.data.isEdit) {
                    if (node.isExpand) {
                        node.mindmap.execute('collapseNode', {
                            node
                        })
                    } else {
                        node.mindmap.execute('expandNode', {
                            node
                        })
                    }
                }
            }*/

            // Ctrl + B => Bold
            // if (keyCode == 66) {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     if(this.selectNode) {
            //         var l_prefix_1 = "**";
            //         var l_prefix_2 = "__";
            //         var node = this.selectNode;

            //         if(node.data.isEdit)
            //         {// A node is edited: set in bold only the selected part
            //             var l_check_prefix = true;
            //             node.setSelectedText(l_prefix_1, l_prefix_2, l_check_prefix);
            //         }

            //         else
            //         {// Set in bold the whole node
            //             this._formatNode(node, l_prefix_1, l_prefix_2);
            //             e.preventDefault();
            //             e.stopPropagation();
            //         }

            //         this.refresh();
            //         this.scale(this.mindScale);
            //     }
            //     //else: no node selected: nothing to do
            // }


            // Ctrl + I => Italic
            // if (keyCode == 73) {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     if(this.selectNode) {
            //         var node = this.selectNode;

            //         if(node.data.isEdit)
            //         {// A node is edited: set in italics only the selected part
            //             node.setSelectedText_italic();
            //         }

            //         else
            //         {// Set in italics the whole node
            //             var text = node.data.text;
            //             if( (  ((text.substring(0,1)=="*") ||
            //                     (text.substring(0,1)=="_") )        &&
            //                 (text.substring(0,2)!="**")             &&
            //                 (text.substring(0,2)!="__")             )   ||
            //                 (text.substring(0,3)=="***")                ||
            //                 (text.substring(0,3)=="___")                )
            //             {// Already italic
            //                 text = text.substring(1); // Remove leading * / _

            //                 if( (text.substring(text.length-1)=="*") ||
            //                     (text.substring(text.length-1)=="_") )   {
            //                     // Remove trailing * / _
            //                     text = text.substring(0,text.length-1);
            //                 }
            //                 // else: no trailing *
            //             }
            //             else {// Not in italic
            //                 text = "*"+text+"*"; // Use "*" to allow bold/italic change in whatever order
            //             }

            //             // Set in node text
            //             node.data.oldText = node.data.text;
            //             node.setText(text);
            //             e.preventDefault();
            //             e.stopPropagation();
            //         }

            //         this.refresh();
            //         this.scale(this.mindScale);
            //     }
            //     //else: no node selected: nothing to do
            // }


            // ctrl + E  center mindmap view
            // if (keyCode == 69) {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     //this.center();
            //     this.centerOnNode(this.selectNode);
            // }


            // ctrl + Up: Move one node above
            // if (keyCode == 38 || e.key == 'ArrowUp') {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     var node = this.selectNode;
            //     if(!node)
            //     {// No node selected: select root node
            //         this.root.select();
            //         node = this.selectNode;
            //     }
            //     else if((!node.data.isEdit)  &&
            //             (!node.data.isRoot)  )
            //     {// The node can be moved
            //         var type='top';
            //         if(node.getIndex() == 0)
            //         {// First sibling: move BELOW "previous" (=last) node
            //             type='down';
            //         }
            //         //else: no special treatment
            //         this.moveNode(node, node.getPreviousSibling(), type);
            //     }
            //     this.centerOnNode(this.selectNode);
            // }


            // // Ctrl + Down: Move one step below
            // if (keyCode == 40 || e.key == 'ArrowDown') {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     var node = this.selectNode;
            //     if(!node)
            //     {// No node selected: select root node
            //         this.root.select();
            //         node = this.selectNode;
            //     }
            //     else if((!node.data.isEdit)  &&
            //             (!node.data.isRoot)  )
            //     {// The node can be moved
            //         var type='down';
            //         if(node.getIndex() == node.parent.children.length-1)
            //         {// Last sibling: move ABOVE "next" (=first) node
            //             type='top';
            //         }
            //         //else: no special treatment
            //         this.moveNode(node, node.getNextSibling(), type);
            //     }
            //     this.centerOnNode(this.selectNode);
            // }


            // // Ctrl + Left
            // if (keyCode == 37 || e.key == 'ArrowLeft') {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     var node = this.selectNode;
            //     if(!node)
            //     {// No node selected: select root node
            //         this.root.select();
            //         node = this.selectNode;
            //     }
            //     else {// Move current node as parent/child depending on the position
            //         var rootPos = this.root.getPosition();
            //         var nodePos = node.getPosition();
            //         if(rootPos.x < nodePos.x)
            //         {
            //             this._moveAsParent(node);
            //         }
            //         else
            //         {
            //             this._moveAsChild(node, node.getPreviousSibling());
            //         }
            //     }
            //     this.centerOnNode(this.selectNode);
            // }


            // // Ctrl + Right
            // if (keyCode == 39 || e.key == 'ArrowRight') {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     var node = this.selectNode;
            //     if(!node)
            //     {// No node selected
            //         this.root.select();
            //         node = this.selectNode;
            //     }
            //     else {
            //         var rootPos = this.root.getPosition();
            //         var nodePos = node.getPosition();
            //         if(rootPos.x < nodePos.x)
            //         {
            //             // this.selectedNodes.forEach((n:INode) => {
            //             //     this._moveAsChild(n);
            //             // });
            //             this._moveAsChild(node, node.getPreviousSibling());
            //         }
            //         else
            //         {
            //             this._moveAsParent(node);
            //         }
            //     }
            //     this.centerOnNode(this.selectNode);
            // }


            // // Ctrl + J: Join with following node
            // if (keyCode == 74) {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     var node = this.selectNode;
            //     if(node)
            //     {  this.joinWithFollowingNode(node); }
            //     // else: No node selected: nothing to do
            // }



            // Ctrl + Home : Select root node
            if (keyCode == 36) {
                e.preventDefault();
                e.stopPropagation();

                if( (!this.selectNode)              ||
                    (!this.selectNode.data.isEdit)  )
                {// No edition: select root node
                    if(this.selectNode && !this.selectNode.data.isRoot)
                    {
                        this.selectNode.unSelect();
                        this.root.select();
                    }
                    this.center();
                }
            }
        }


        if (ctrlKey && shiftKey && !altKey) {   // CTRL + SHIFT key
            // //Shift + Ctrl + space: toggle expand node
            // if (keyCode == 32) {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     var node = this.selectNode;
            //     if(node)
            //     { this._toggleExpandNode(node); }
            // }


            // Ctrl + Shift + Z => Old text
            // if (keyCode == 90) {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     var node = this.selectNode;
            //     if(node) {
            //         // var text = (node.data.oldText as string);
            //         var text = (node.data.oldText);
            //         node.setText(text);
            //         e.preventDefault();
            //         e.stopPropagation();
            //         console.log(text+" / "+node.data.text);
            //     }
            // }


            // Ctrl + Shift + Home : Center map
            // if (keyCode == 36) {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     this.center();
            // }

        }


        if (altKey && !ctrlKey && !shiftKey) {          // Alt key

            // Alt + H => Highlight
            // if (keyCode == 72) {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     if(this.selectNode) {// There is a node selected: format
            //         var l_prefix_1 = "==";
            //         var l_prefix_2 = l_prefix_1;
            //         var node = this.selectNode;

            //         if(node.data.isEdit)
            //         {// A node is edited: set in bold only the selected part
            //             var l_check_prefix = true;
            //             node.setSelectedText(l_prefix_1, l_prefix_2, l_check_prefix);
            //         }

            //         else
            //         {// Set in bold the whole node
            //             this._formatNode(node, l_prefix_1, l_prefix_2);
            //             e.preventDefault();
            //             e.stopPropagation();
            //         }
            //     }
            //     //else: no node selected: nothing to do
            // }


            // Alt + é => Strike through
            // if (keyCode == 50) {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     if(this.selectNode) {// There is a node selected: format
            //         var l_prefix_1 = "~~";
            //         var l_prefix_2 = l_prefix_1;
            //         var node = this.selectNode;

            //         if(node.data.isEdit)
            //         {// A node is edited: set in bold only the selected part
            //             var l_check_prefix = true;
            //             node.setSelectedText(l_prefix_1, l_prefix_2, l_check_prefix);
            //         }

            //         else
            //         {// Set in bold the whole node
            //             this._formatNode(node, l_prefix_1, l_prefix_2);
            //             e.preventDefault();
            //             e.stopPropagation();
            //         }
            //     }
            //     //else: no node selected: nothing to do
            // }


            // Alt + Home : Node info in console
            // if (keyCode == 36) {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     var node = this.selectNode;
            //     if(node) {
            //         console.log("Node idx: "+node.getIndex());
            //         console.log("Previous node idx: "+node.getPreviousSibling().getIndex());
            //         console.log("Next node idx: "+node.getNextSibling().getIndex());
            //         console.log("Node pos: x="+node.getPosition().x+" / y="+node.getPosition().y);
            //         console.log("Node dim: x="+node.getDimensions().x+" / y="+node.getDimensions().y);
            //         console.log("Canvas: "+this.setting.canvasSize);
            //         console.log("Disp scroll: x="+this.containerEL.scrollLeft+" / y="+this.containerEL.scrollTop);
            //         console.log("Disp client: x="+this.containerEL.clientWidth+" / y="+this.containerEL.clientHeight);

            //         //node.setText
            //     }
            // }


            // // Alt + PageUp: collapse one level from max displayed level
            // if (keyCode == 33) {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     node = this.selectNode;
            //     if( (node)                                                  &&
            //         (this.getMaxNodeDisplayedLevel(node)>node.getLevel())   )
            //     {// Collapse only if current selected node would not be hidden
            //         this.setChildrenDisplayedLevel(this.getMaxNodeDisplayedLevel(node)-1);
            //         this.refresh();
            //         this.scale(this.mindScale);
            //         this.selectNode.select();
            //     }
            // }


            // // Alt + PageDn: expand one level
            // if (keyCode == 34) {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     node = this.selectNode;
            //     if(node) {
            //         this.setChildrenDisplayedLevel(this.getMaxNodeDisplayedLevel(node)+1);
            //         this.refresh();
            //         this.scale(this.mindScale);
            //         this.selectNode.select();
            //     }
            // }


        }


        if (altKey && !ctrlKey && shiftKey) {           // Alt + Shift key

            // Alt + Shift + PageUp: collapse one level from current node
            // if (keyCode == 33) {
            //     if(this.selectNode) {
            //         this.setDisplayedLevel(this.selectNode.getLevel()-1);
            //         this.refresh();
            //         this.selectNode.parent.select();
            //     }
            // }


            // Alt + PageDn: expand one level
            // if (keyCode == 34) {
            //     if(this.selectNode) {
            //         this.setDisplayedLevel(this.selectNode.getLevel()+1);
            //         this.refresh();
            //         this.selectNode.select();
            //     }
            // }

        }


        if (altKey && ctrlKey && !shiftKey) {           // Alt + Ctrl key
            // Alt + Ctrl + S: Select node's text
            // if (keyCode == 83) {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     let node = this.selectNode;
            //     if(node) {
            //         node.edit();
            //         node.selectText();
            //     }
            // }


        }


        if (altKey && ctrlKey && shiftKey) {            // Alt + Ctrl+ Shift key
            // None
            // if (keyCode == xx) {
            //     e.preventDefault();
            //     e.stopPropagation();

            //     let node = this.selectNode;
            //     if(node) {
            //         TBD
            //     }
            // }
        }


    }
    _hierarchySelectNode(node: INode, direct: string){
        if (!node) {
            return;
        }
        var viewportWidth = this.containerEL.clientWidth;
        var viewportHeight = this.containerEL.clientHeight;
        var diagonalViewport = Math.sqrt(viewportWidth * viewportWidth + viewportHeight * viewportHeight);
        const MAX_PARENT_DISTANCE = diagonalViewport / 5;
        var waitNode: INode = null;
        var nodePos = node.getPosition();
        // var mind = this;
        var rootPos = this.root.getPosition();
        var rootDirect = rootPos.x > nodePos.x ? 'right' : 'left';

        if (node === this.root) {
            waitNode = this.__selectChildren(node,direct);
            if (waitNode) {
                this.clearSelectNode();
                waitNode.select();
                return;
            }
        };

        if(direct === 'up'){
            if(node.parent){
                var indexOfNode = node.parent.children.indexOf(node);
                if (indexOfNode === 0 ) {
                    var parentPos = node.parent.getPosition();
                    var dx = Math.abs(parentPos.x - nodePos.x);
                    var dy = Math.abs(parentPos.y - nodePos.y);
                    var dis = Math.sqrt(dx * dx + dy * dy);
                    if(dis > MAX_PARENT_DISTANCE){
                        this._selectNode(node,direct);
                        return;
                    }
                    waitNode = node.parent;
                    this.clearSelectNode();
                    waitNode.select();
                    return;
                }else if (indexOfNode > 0){
                    waitNode = node.parent.children[indexOfNode - 1];
                    this.clearSelectNode();
                    waitNode.select();
                    return;
                }
            }
            this._selectNode(node,direct);
        }
        else if(direct === 'down'){
            if(node.parent){
                var indexOfNode = node.parent.children.indexOf(node);
                if (indexOfNode === (node.parent.children.length - 1) ) {
                    var parentPos = node.parent.getPosition();
                    var dx = Math.abs(parentPos.x - nodePos.x);
                    var dy = Math.abs(parentPos.y - nodePos.y);
                    var dis = Math.sqrt(dx * dx + dy * dy);
                    if(dis > MAX_PARENT_DISTANCE){
                        this._selectNode(node,direct);
                        return;
                    }
                    waitNode = node.parent;
                    this.clearSelectNode();
                    waitNode.select();
                    return;
                }else if (indexOfNode < (node.parent.children.length - 1)){
                    waitNode = node.parent.children[indexOfNode + 1];
                    this.clearSelectNode();
                    waitNode.select();
                    return;
                }
            }
            this._selectNode(node,direct);
        }
        else if(direct === 'right') {
            if(rootDirect === 'right' && node.parent){
                waitNode = node.parent;
                this.clearSelectNode();
                waitNode.select();
                return;
            }else{
                waitNode = this.__selectChildren(node,direct);
                if (waitNode) {
                    this.clearSelectNode();
                    waitNode.select();
                    return;
                }
            }
            // this._selectNode(node,direct);
        }
        else if(direct === 'left') {
            if(rootDirect === 'left' && node.parent){
                waitNode = node.parent;
                this.clearSelectNode();
                waitNode.select();
                return;
            }else{
                waitNode = this.__selectChildren(node,direct);
                if (waitNode) {
                    this.clearSelectNode();
                    waitNode.select();
                    return;
                }
            }
            // this._selectNode(node,direct);
        }
    }

    __selectChildren(node: INode, direct: string){
        if (!node) return;
        if (!node.isExpand) return;
        var minDis: number;
        var waitNode: INode = null;
        var pos = node.getPosition();
        if (node.children) {
            node.children.forEach(n => {
                var p = n.getPosition();
                var dx = Math.abs(p.x - pos.x);
                var dy = Math.abs(p.y - pos.y);
                var dis = Math.sqrt(dx * dx + dy * dy);
                var _helper = ()=>{
                    if (minDis) {
                        if (minDis > dis) {
                            minDis = dis;
                            waitNode = n;
                        }
                    } else {
                        minDis = dis;
                        waitNode = n;
                    }
                }
                switch (direct) {
                    case "right":
                        if (p.x > pos.x) _helper()
                        break;
                    case "left":
                        if (p.x < pos.x) _helper()
                        break;
                    case "up":
                        if (p.y < pos.y) _helper()
                        break;
                    case "down":
                        if (p.y > pos.y) _helper()
                        break;
                }
            });
        }
        return waitNode;
    }

    _formatNode(node: INode, i_prefix_1: string, i_prefix_2: string) {
        var text = node.data.text;

        if( (text.substring(0,2) == i_prefix_1)  ||
            (text.substring(0,2) == i_prefix_2)  )
        {// Prefix must be substracted, bold first
            text = text.substring(2); // Remove leading prefix

            if( (text.substring(text.length-2) == i_prefix_1)  ||
                (text.substring(text.length-2) == i_prefix_2)  )
            {// Suffix must be substracted
                text = text.substring(0,text.length-2);
            }
            // else: no trailing prefix
        }

        else if(    (text.substring(1,3) == i_prefix_1)  ||
                    (text.substring(1,3) == i_prefix_2)  )
        {// Prefix must be substracted, italic (?) first
            text = text[0] + text.substring(3); // Remove prefix

            if( (text.slice(-3, -1) == i_prefix_1)   ||
                (text.slice(-3, -1) == i_prefix_2)   )
            {// Suffix must be substracted
                text = text.substring(0,text.length-3) +
                text.slice(-1);
            }
            // else: no trailing prefix
        }

        else if(    (text.substring(2,4) == i_prefix_1)  ||
                    (text.substring(2,4) == i_prefix_2)  )
        {// Prefix must be substracted, highlight (?) first
            text = text.substring(0,2) + text.substring(4); // Remove prefix

            if( (text.slice(-4, -2) == i_prefix_1)   ||
                (text.slice(-4, -2) == i_prefix_2)   )
            {// Suffix must be substracted
                text = text.substring(0,text.length-4) +
                text.slice(-2);
            }
            // else: no trailing prefix
        }

        else {// No pre-/suf-fix: add it
            text = i_prefix_1+text+i_prefix_1;
        }

        // Set the text in the node
        node.mindmap.execute('changeNodeText',{
            node:node,
            text:text,
            oldText:node.data.text
        });
        // node.data.oldText = node.data.text;
        // node.setText(text);
        node.select();
    }


    _moveAsParent(node: INode) {
        if( (!node.data.isEdit)     &&
            (!node.data.isRoot)     &&
            (node.getLevel() > 1)   )
        {// The node can be moved
            this.moveNode(node, node.parent, 'down');
        }

        return;
    }


    _moveAsChild(movedNode: INode, newParentNode: INode) {
        if( (!movedNode.data.isEdit)  &&
            (!movedNode.data.isRoot)  )
        {// The node can be moved
            this.moveNode(movedNode, newParentNode, 'child-right');
        }


        return;
    }


    _toggleExpandNode(node: INode) {
        if (node && !node.data.isEdit) {
            if (node.isExpand) {
                node.mindmap.execute('collapseNode', {
                    node
                });
            }
            else {
                node.mindmap.execute('expandNode', {
                    node
                });
            }
        }

        return;
    }


    _selectNode(node: INode, direct: string) {
        if (!node) {
            return;
        }

        var minDis: number;
        var waitNode: INode = null;
        var pos = node.getPosition();
        var rootPos = this.root.getPosition();
        var level = node.getLevel();
        var mind = this;


        mind.traverseDF((n: INode) => {
            var p = n.getPosition();
            var l = n.getLevel();
            var dx = Math.abs(p.x - pos.x);
            var dy = Math.abs(p.y - pos.y);
            var dis = Math.sqrt(dx * dx + dy * dy);
            switch (direct) {
                case "right":
                    if( ((pos.x>this.root.getPosition().x)  &&
                         (l == level+1)                     )   ||
                        ((pos.x<this.root.getPosition().x)  &&
                         (l == level-1)                     )   ||
                        ((level == 0)                       &&
                         l==1)                                  )
                    {// The tested node is at the correct level
                        if( (n == node.parent) || (node == n.parent) )
                        {// Move only within same lineage
                            if (p.x > pos.x) {
                                if (minDis) {
                                    if (minDis > dis) {
                                        minDis = dis;
                                        waitNode = n;
                                    }
                                } else {
                                    minDis = dis;
                                    waitNode = n;
                                }
                            }
                        }
                    }
                    break;
                case "left":
                    if( ((pos.x>this.root.getPosition().x)  &&
                         (l == level-1)                     )   ||
                        ((pos.x<this.root.getPosition().x)  &&
                         (l == level+1)                     )   ||
                         ((level == 0)                      &&
                          l==1)                                 )
                    {// The tested node is at the correct level
                        if( (n == node.parent) || (node == n.parent) )
                        {// Move only within same lineage
                            if (p.x < pos.x) {
                                if (minDis) {
                                    if (minDis > dis) {
                                        minDis = dis;
                                        waitNode = n;
                                    }
                                } else {
                                    minDis = dis;
                                    waitNode = n;
                                }
                            }
                        }
                    }
                    break;
                case "up":
                    if( (n.isShow())                &&
                        (((pos.x<rootPos.x) &&
                          (p.x<rootPos.x)   )   ||
                         ((pos.x>rootPos.x) &&
                          (p.x>rootPos.x)   )   )   )
                    {// Move only on shown nodes + on the same side of the root
                        if (p.y < pos.y) {
                            if(level == l)
                            {
                                if (minDis) {
                                    if (minDis > dis) {
                                        minDis = dis;
                                        waitNode = n;
                                    }
                                } else {
                                    minDis = dis;
                                    waitNode = n;
                                }
                            }
                        }
                    }
                    break;
                case "down":
                    if( (n.isShow())                &&
                        (((pos.x<rootPos.x) &&
                          (p.x<rootPos.x)   )   ||
                         ((pos.x>rootPos.x) &&
                          (p.x>rootPos.x)   )   )   )
                    {// Move only on shown nodes + on the same side of the root
                        if (p.y > pos.y) {
                            if(level == l)
                            {
                                if (minDis) {
                                    if (minDis > dis) {
                                        minDis = dis;
                                        waitNode = n;
                                    }
                                } else {
                                    minDis = dis;
                                    waitNode = n;
                                }
                            }
                        }
                    }
                    break;
            }
        });

        if (waitNode) {
            mind.clearSelectNode();
            waitNode.select();
        }
    }

    isNodeEditorTarget(target: EventTarget | null): boolean {
        const node = this.editNode || this.selectNode;
        return !!node?.data.isEdit && !!target && node.contentEl.contains(target as Node);
    }

    appClickFn(evt: MouseEvent) {
        // Leave browser caret placement and text selection inside the editor untouched.
        if (this.isNodeEditorTarget(evt.target)) return;
        if (Date.now() < this._suppressClickUntil) { this._suppressClickUntil = 0; evt.preventDefault(); return; }
        var targetEl = evt.target as HTMLElement;

        if (targetEl) {

            if (targetEl.tagName == 'A' && targetEl.hasClass("internal-link")) {
                evt.preventDefault();
                var targetEl = evt.target as HTMLElement;
                var href = targetEl.getAttr("href");
                if(href){
                    this.view.app.workspace.openLinkText(
                        href,
                        this.view.file.path,
                        evt.ctrlKey || evt.metaKey
                    );
                }
            }

            if (targetEl.hasClass('mm-node-bar')) {
                evt.preventDefault();
                evt.stopPropagation();
                var id = targetEl.closest('.mm-node').getAttribute('data-id');
                var node = this.getNodeById(id);

                if (node.isExpand) {
                    node.mindmap.execute('collapseNode', {
                        node
                    });
                } else {
                    node.mindmap.execute('expandNode', {
                        node
                    });
                }
                return
            }

            if(targetEl.closest('.mm-node-menu')){
                 if(targetEl.closest('.mm-icon-add-node')){
                      var selectNode = this.selectNode;
                      if(selectNode){
                         selectNode.mindmap.execute("addChildNode", { parent: selectNode });
                         this._menuDom.style.display='none';
                      }
                 }

                 if(targetEl.closest('.mm-icon-delete-node')){
                    var selectNode = this.selectNode;
                    if(selectNode){
                       this.deleteSelectedNodes();
                       this._menuDom.style.display='none';
                    }
                 }
                 return;
            }

            if (targetEl.closest('.mm-node')) {
                var id = targetEl.closest('.mm-node').getAttribute('data-id');
                var node = this.getNodeById(id);
                if (evt.ctrlKey || evt.metaKey || evt.shiftKey) {
                    const selected = this.getSelectedNodes();
                    this.setSelectedNodes(selected.includes(node) ? selected.filter(n => n !== node) : [...selected, node], node);
                } else {
                    this.setSelectedNodes([node], node);
                }
                this._menuDom.style.display = 'none';
            } else {
                this.clearSelectNode();
                this._menuDom.style.display='none';
            }
        }
    }

    appDragstart(evt: DragEvent) {
        if (this.isNodeEditorTarget(evt.target)) return;
        const element = (evt.target as HTMLElement)?.closest('.mm-node');
        if (!element) return;
        evt.stopPropagation();
        const node = this.getNodeById(element.getAttribute('data-id'));
        if (!this.getSelectedNodes().includes(node)) this.setSelectedNodes([node], node);
        this._dragNodes = this.getSelectedRoots();
        if (!this._dragNodes.length || this._dragNodes.some(n => !n.parent || n.data.isEdit)) { evt.preventDefault(); return; }
        this._dragNode = node;
        this.drag = true;
        this.startX = evt.pageX;
        this.startY = evt.pageY;
        evt.dataTransfer?.setData('text/plain', serializeForest(this._dragNodes));
        if (evt.dataTransfer) evt.dataTransfer.effectAllowed = 'copyMove';
    }

    appDragend(evt: MouseEvent) {
        this.drag = false;
        this._dragNodes = [];
        this._indicateDom.style.display = 'none'
        this._menuDom.style.display = 'none';
    }

    appDragover(evt: MouseEvent) {
        evt.preventDefault();
        evt.stopPropagation();
        var target =evt.target as HTMLElement;
        var x = evt.clientX;
        var y = evt.clientY;

        if (this.drag) {
            this.dx = x - this.startX;
            this.dy = y - this.startY;
        }

        if(this.drag && target.closest('.mm-node')){
            var nodeId =target.closest('.mm-node').getAttribute('data-id');
            var node = this.getNodeById(nodeId);
            if (this._dragNodes.some(root => containsNode(root, node))) {
                this._indicateDom.style.display = 'none';
                return;
            }
            var box = node.getBox();
            this._dragType = this._getDragType(node, x, y);
            this._indicateDom.style.display = 'block';
            this._indicateDom.style.left = box.x + box.width / 2 - 40 / 2 + 'px';
            this._indicateDom.style.top = box.y - 90 + 'px';
            this._indicateDom.className = 'mm-node-layout-indicate';

            if( this._dragType == 'top') {
                this._indicateDom.classList.add('mm-arrow-top');
            } else if ( this._dragType == 'down') {
                this._indicateDom.classList.add('mm-arrow-down');
            } else if ( this._dragType == 'left') {
                this._indicateDom.classList.add('mm-arrow-left');
            } else if ( this._dragType == 'right') {
                this._indicateDom.classList.add('mm-arrow-right');
            } else {
                this._indicateDom.classList.add('drag-type');
                var arr = this._dragType.split('-');
                if (arr[1]) {
                    this._indicateDom.classList.add('mm-arrow-' + arr[1]);
                } else {
                    this._indicateDom.classList.add('mm-arrow-right');
                }
            }
        }else{
            this._indicateDom.style.display = 'none';
        }

    }

    _getDragType(node:INode, x:number, y:number) {
        if (!node) return;

        var box = node.contentEl.getBoundingClientRect();

        box.x = box.x
        box.y = box.y;

        var direct = node.direct;
        switch (direct) {
            case 'right':
                if (y < box.y + box.height / 2 && x < box.x + box.width / 4 * 3) {
                    return 'top'
                }
                if (y > box.y + box.height / 2 && x < box.x + box.width / 4 * 3) {
                    return 'down'
                }
                return 'child-right'
            case 'left':
                if (y < box.y + box.height / 2 && x > box.x + box.width / 4) {
                    return 'top'
                }
                if (y > box.y + box.height / 2 && x > box.x + box.width / 4) {
                    return 'down'
                }

                return 'child-left'

            case 'top':
            case 'up':

                if (x < box.x + box.width / 4) {
                    return 'left'
                }
                if (x > box.x + box.width / 4 * 3) {
                    return 'right'
                }

                return 'child-top'
            case 'down':
            case 'bottom':
                if (x < box.x + box.width / 4) {
                    return 'left'
                }
                if (x > box.x + box.width / 4 * 3) {
                    return 'right'
                }
                return 'child-down'
            default:
                return 'child';

        }
    }

    appDrop(evt: any) {
        const element = (evt.target as HTMLElement)?.closest('.mm-node');
        if (element && this.drag && this._dragNodes.length) {
            evt.preventDefault();
            const dropNode = this.getNodeById(element.getAttribute('data-id'));
            if (!this._dragNodes.some(root => containsNode(root, dropNode))) {
                if (evt.ctrlKey || evt.metaKey) {
                    this.pasteNode(serializeForest(this._dragNodes), dropNode);
                } else {
                    const type = this._getDragType(dropNode, evt.clientX, evt.clientY);
                    this.execute('moveNodes', { nodes: this._dragNodes, dropNode, type });
                }
            }
        }
        this.drag = false;
        this._dragNodes = [];
        this._suppressClickUntil = Date.now() + 150;

        var files = evt.dataTransfer?.files || [];
            if(files.length){
                  var f = files[0];
                  if(f.name.toLowerCase().endsWith('.xmind')){
                   try{
                       var me = this;
                       var reader = new FileReader();
                       reader.onload=()=>{
                            jsZip.loadAsync(reader.result).then((e)=>{
                               var files = e.files;
                               for (var k in files) {
                                  if (k == "content.json") {
                                   files[k].async("text").then((res) => {
                                     var mindData = JSON.parse(res);
                                       var data:any = importXmind(mindData[0]);



                                       me.clearNode();
                                       me.data = data.basicData;
                                       me.init();
                                       setTimeout(()=>{
                                           me.center();
                                           me.mindMapChange();
                                       },100);
                                   });
                                 }
                               }
                            })
                       }
                       reader.readAsArrayBuffer(f);
                   }catch(err){
                      new Notice('Parse xmind error')
                   }
                  }


       }

        this._indicateDom.style.display = 'none'
        this._menuDom.style.display = 'none';
    }

    appMouseOverFn(evt: MouseEvent) {
        const targetEl = evt.target as HTMLElement;

        if (targetEl.tagName !== "A") return;

        if (targetEl.hasClass("internal-link")) {
            this.view.app.workspace.trigger("hover-link", {
                event: evt,
                source: frontMatterKey,
                hoverParent: this.view,
                targetEl,
                linktext: targetEl.getAttr("href"),
                sourcePath: this.view.file.path,
            });
        }
    }

    appMouseMove(evt: MouseEvent) {
        if (this._panning) {
            if (Math.abs(evt.clientX - this.startX) + Math.abs(evt.clientY - this.startY) >= 4) this._panMoved = true;
            this.containerEL.scrollLeft = this._left - (evt.clientX - this.startX);
            this.containerEL.scrollTop = this._top - (evt.clientY - this.startY);
            return;
        }
        if (this._selectionStart) {
            if (Math.abs(evt.clientX - this._selectionStart.x) + Math.abs(evt.clientY - this._selectionStart.y) < 4 && !this._selectionMoved) return;
            this._selectionMoved = true;
            const bounds = this.containerEL.getBoundingClientRect();
            const rect = selectionRect(this._selectionStart.x, this._selectionStart.y,
                Math.max(bounds.left, Math.min(bounds.right, evt.clientX)),
                Math.max(bounds.top, Math.min(bounds.bottom, evt.clientY)));
            if (!this._selectionOverlay) {
                this._selectionOverlay = document.createElement('div');
                this._selectionOverlay.className = 'mm-selection-rectangle';
                document.body.appendChild(this._selectionOverlay);
            }
            Object.assign(this._selectionOverlay.style, { display: 'block', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.right - rect.left}px`, height: `${rect.bottom - rect.top}px` });
            const selected: INode[] = [];
            this.traverseDF((node: INode) => {
                const box = node.containEl.getBoundingClientRect();
                if (node.isShow() && intersectsRect(bounds, box) && intersectsRect(rect, box)) selected.push(node);
            }, this.root, true);
            this.setSelectedNodes([...this._selectionBase, ...selected], undefined, false);
            return;
        }
        const target = evt.target as HTMLElement;
        if (!target || !this.appEl.contains(target)) return;
        this.scalePointer = [evt.offsetX, evt.offsetY];
        const element = target.closest('.mm-node');
        if (element) {
            const node = this.getNodeById(element.getAttribute('data-id'));
            if (node) { const box = node.getBox(); this.scalePointer = [box.x + box.width / 2, box.y + box.height / 2]; }
        }
    }

    appMouseDown(evt: MouseEvent) {
        const target = evt.target as HTMLElement;
        if (target.closest('.mm-node-menu, .mm-node-bar, a, input, textarea, [contenteditable="true"]')) return;
        if (evt.button === 2) {
            evt.preventDefault();
            this._panning = true;
            this._panMoved = false;
            this._suppressContextUntil = 0;
            this.startX = evt.clientX;
            this.startY = evt.clientY;
            this._left = this.containerEL.scrollLeft;
            this._top = this.containerEL.scrollTop;
            return;
        }
        if (evt.button !== 0) return;
        const element = target.closest('.mm-node');
        if (element) {
            const node = this.getNodeById(element.getAttribute('data-id'));
            if (!evt.ctrlKey && !evt.metaKey && !evt.shiftKey && !this.getSelectedNodes().includes(node)) this.setSelectedNodes([node], node);
            return;
        }
        evt.preventDefault();
        this._selectionBase = evt.ctrlKey || evt.metaKey || evt.shiftKey ? this.getSelectedNodes() : [];
        this.clearSelectNode();
        this._selectionStart = { x: evt.clientX, y: evt.clientY };
        this._selectionMoved = false;
        this._menuDom.style.display = 'none';
    }

    appMouseUp(evt: MouseEvent | FocusEvent) {
        if (this._selectionStart && (evt.type === 'blur' || (evt as MouseEvent).button === 0)) {
            if (this._selectionMoved) this._suppressClickUntil = Date.now() + 150;
            this._selectionStart = null;
            if (this._selectionOverlay) this._selectionOverlay.style.display = 'none';
            if (this.selectNode) this.selectNode.select(true);
        }
        if (this._panning && (evt.type === 'blur' || (evt as MouseEvent).button === 2)) {
            if (this._panMoved) this._suppressContextUntil = Date.now() + 500;
            this._panning = false;
        }
    }

    appContextMenu(evt: MouseEvent) {
        if (this._panning || Date.now() < this._suppressContextUntil) {
            evt.preventDefault();
            evt.stopImmediatePropagation();
        }
    }

    appDblclickFn(evt: MouseEvent) {
        if (this.isNodeEditorTarget(evt.target)) return;
        if (evt.target instanceof HTMLElement) {

            if (evt.target.hasClass('mm-node-bar')) {
                evt.preventDefault();
                evt.stopPropagation();
                return;
            }
            if (evt.target.closest('.mm-node') instanceof HTMLElement) {
                var id = evt.target.closest('.mm-node').getAttribute('data-id');
                this.setSelectedNodes([this.getNodeById(id)]);
                if (!this.editNode || (this.editNode && this.editNode != this.selectNode)) {
                    this.selectNode?.edit();
                    this.editNode = this.selectNode;
                    this._menuDom.style.display='none';
                }
            }
        }
    }

    appMousewheel(evt: any) {
        // if(!evt) evt = window.event;
        var ctrlKey = evt.ctrlKey || evt.metaKey;
        var delta;
        if (evt.wheelDelta) {
            //IE、chrome  -120
            delta = evt.wheelDelta / 120;
        } else if (evt.detail) {
            //FF 3
            delta = -evt.detail / 3;
        }

        if (delta) {
            if (delta < 0) {
                if (ctrlKey) {
                    this.setScale("down");
                }
            } else {
                if (ctrlKey) {
                    this.setScale("up");
                }
            }
        }
    }

    clearNode() {
        this.clearSelectNode();
        this._dragNodes = [];
        this._selectionStart = null;
        if (this._selectionOverlay) this._selectionOverlay.style.display = 'none';
        //delete node
        this.traverseBF((n: INode) => {
            this.contentEL.removeChild(n.containEl);
        });

        //delete line
        if (this.mmLayout) {
            this.mmLayout.svgDom?.clear();
        }

    }

    clear() {
        this.clearNode();
        this.removeEvent();
        this.draw?.clear();
    }
    //get node list rect point
    getBoundingRect(list: INode[]) {
        var box = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            right: 0,
            bottom: 0
        };
        list.forEach((item, i) => {
            var b = item.getBox();
           // console.log(b.x,b.y);
            if (i == 0) {
                box.x = b.x;
                box.y = b.y;
                box.right = b.x + b.width;
                box.bottom = b.y + b.height;
            } else {
                if (b.x < box.x) {
                    box.x = b.x
                }
                if (b.y < box.y) {
                    box.y = b.y
                }
                if (b.x + b.width > box.right) {
                    box.right = b.x + b.width;
                }
                if (b.y + b.height > box.bottom) {
                    box.bottom = b.y + b.height;
                }
            }
        });

        box.width = box.right - box.x;
        box.height = box.bottom - box.y;

        return box;
    }

    moveNode(dragNode: INode, dropNode: INode, type:string, setInHistory: boolean = true) {

        if (dragNode == dropNode || dragNode.data.isRoot) {
            return
        }

        var flag = false;
        var p = dropNode.parent;
        while (p) {
            if (p == dragNode) {
                flag = true;
                break;
            }
            p = p.parent;
        }
        if (flag) {  //parent  can not change to child
            return;
        }

        dropNode.clearCacheData();
        dragNode.clearCacheData();

        if (type == 'right' || type == 'left'){
            if (!dropNode.isExpand) {
                dropNode.expand();
            }
        }

        if (type == 'top' || type == 'left' ||type == 'down' || type == 'right') {
            this.execute('moveNode', { type: 'siblings', node: dragNode, oldParent: dragNode.parent, dropNode, direct: type, inHistory: setInHistory})
        }
        else if (type.indexOf('child') > -1) {
            var typeArr = type.split('-');
            if (typeArr[1]) {
                this.execute('moveNode', { type: 'child', node: dragNode, oldParent: dragNode.parent, parent: dropNode, direct: typeArr[1] })
            }
            else {
                this.execute('moveNode', { type: 'child', node: dragNode, oldParent: dragNode.parent, parent: dropNode });
            }
        }

       // this.execute('moveNode', { type: 'child', node: dragNode, oldParent: dragNode.parent, parent: dropNode })
    }


    // Move all the current node's siblings as this node's children
    moveAllSiblingsAsChildren(node: INode) {
        var sibs = node.getSiblings();
        sibs.forEach((sib) => {
            this._moveAsChild(sib, node);
        })

        return;
    }


    // Move the current node's next siblings as this node's children
    moveNextSiblingsAsChildren(node: INode) {
        var sibs = node.getAllNextSiblings();
        sibs.forEach((sib) => {
            this._moveAsChild(sib, node);
        })

        return;
    }


    // Join the current node with the following node
    joinWithFollowingNode(node: INode, in_asCitation: Boolean) {
        let joinedNode = node.getNextSibling();

        // Set node's text, except for the starting emoticon and finishing link (if any)
        const emoticonRegex = /^[\u263a-\u27bf\u{1f300}-\u{1f9ff}]/u;
        // Regex to match links with the link pattern [🔗](...)
        // [🔗] is constant and (...) is any content inside parentheses.
        const linkRegex = /\[🔗\]\(.*\.pdf\)/g;
        const pageRegex = / \(p\. \d+\)$/;
        // Remove the emoticon and links from the text
        let node_text = (node.data.text)
            .replace(linkRegex, "")        // Remove all links of the form [🔗](...)
            .trimEnd()                     // Trim ending whitespace
            .replace(pageRegex, "")        // Remove last page of the form (p. ...)
        let joinedText = joinedNode.data.text
            .replace(emoticonRegex, "")    // Remove starting emoticon
            .trimStart();                  // Trim leading whitespace

        let l_middle_text = " "
        if (in_asCitation)
        { l_middle_text += "(…)"
        }
        l_middle_text += "<br>"
        node.setText(node_text + l_middle_text + joinedText);

        // let joinedText = joinedNode.data.text.replace(emoticonRegex, "").trimStart();
        // node.setText(node.data.text + " (…) " + joinedText);
        // node.setText(node.data.text + " (…) " + joinedNode.data.text);


        if(!joinedNode.isLeaf())
        {// The joined node has children: copy them to the current node
            joinedNode.children.forEach((n) => {
                //this._moveAsChild(n, node);
                let copiedNode = this.copyNode(n);
                this.selectNode.unSelect();
                node.select();
                this.pasteNode(copiedNode);
            });
        }

        // Delete joined node
        this.removeNode(joinedNode);

        this.clearSelectNode();
        this.refresh();
        this.scale(this.mindScale);
        node.select();
    }

    //execute cmd , store history
    execute(name: string, data?: any) {
        return this.exec.execute(name, data);
    }
    undo() {
        this.exec.undo();
        console.log("Undo");
    }

    redo() {
        this.exec.redo();
        console.log("Redo");
    }

    addNode(node: INode, parent?: INode, index = -1) {
        if (parent) {
            parent.addChild(node, index);
            if (parent.direct) {
                node.direct = parent.direct;
            }
            this._addNodeDom(node);
            node.clearCacheData();
        }
    }

    _addNodeDom(node: INode) {
        this.traverseBF((n: INode) => {
            if (!this.contentEL.contains(n.containEl)) {
                this.contentEL.appendChild(n.containEl);
            }
        }, node);
    }

    removeNode(node: INode) {
        if (node.parent) {
            var p = node.parent;
            var i = node.parent.removeChild(node);
            this._removeChildDom(node);
            p.clearCacheData();
            return i;
        } else {
            this._removeChildDom(node);
            return -1;
        }

    }

    _removeChildDom(node: INode) {
        this.traverseBF((n: INode) => {
            if (this.contentEL.contains(n.containEl)) {
                this.contentEL.removeChild(n.containEl);
            }
        }, node);
    }

    //layout
    layout() {
        if (!this.mmLayout) {
            this.mmLayout = new Layout(this.root, this.setting.layoutDirect||'mind map', this.colors);
            // Select and center on the mindmap's root when opening it
            this.root.select();
            this.centerOnNode(this.root);
            return;
        }

        this.mmLayout.layout(this.root, this.setting.layoutDirect || this.mmLayout.direct || 'mind map');

    }

    refresh() {
        this.layout();
    }

    emit(name: string, data?: any) {
        var evt = new CustomEvent(name, {
            detail: data || {}
        });
        this.appEl.dispatchEvent(evt);
    }

    on(name: string, fn: any) {
        this.appEl.addEventListener(name, fn);
    }

    off(name: string, fn: any) {
        if (name && fn) {
            this.appEl.removeEventListener(name, fn);
        }
    }

    center() {
        //console.log("Center mindmap")
        this._setMindScalePointer(this.root);
        var oldScale = this.mindScale;
        this.scale(100);

        var w = this.containerEL.clientWidth;
        var h = this.containerEL.clientHeight;
        this.containerEL.scrollTop = this.setting.canvasSize / 2 - h / 2 - 60;
        this.containerEL.scrollLeft = this.setting.canvasSize / 2 - w / 2 + 30;

        this.scale(oldScale);
    }


    centerOnNode(node: INode) {
        if(node == null)
        {//No node given as input argument
            this.center();
        } else {
            //console.log("Center mindmap on node "+node.getId())
            this._setMindScalePointer(node);
            var oldScale = this.mindScale;
            this.scale(100);

            var w = this.containerEL.clientWidth;
            var h = this.containerEL.clientHeight;
            let pos_x = node.getPosition().x;
            let pos_y = node.getPosition().y;
            let dim_x = node.getDimensions().x;
            let dim_y = node.getDimensions().y;
            //this.containerEL.scrollTop = this.setting.canvasSize / 2 - h / 2 - 60 ;
            //this.containerEL.scrollLeft = this.setting.canvasSize / 2 - w / 2 + 30 ;
            this.containerEL.scrollTop  = pos_y - (h/2 - dim_y/2) + 90;
            //this.containerEL.scrollLeft = pos_x - (w/2 - dim_x/2) + 40;
            this.containerEL.scrollLeft = pos_x - (w/2 - dim_x/2) + 200;

            this.scale(oldScale);
        }
    }


    _resetMaxDisplayedLevel() {
        this.dispLevel = 0;
        return;
    }


    _getMaxDisplayedLevel(node: INode)
    {// Returns the highest displayed level.
     // Use getMaxDisplayedLevel (without _).
        if( (node.getLevel() > tempDispLevel)   &&
            (node.isShow())                     )
        {// Displayed node with higher level
            tempDispLevel = node.getLevel();
        }

        if(!node.isLeaf())
        {// The node has children
            node.children.forEach((n) => {
                this._getMaxDisplayedLevel(n);
            });
        }

        return;
    }


    getMaxDisplayedLevel()
    {// Returns the highest displayed level.
        tempDispLevel = 0;
        this._getMaxDisplayedLevel(this.root);
        this.dispLevel = tempDispLevel;

        return this.dispLevel;
    }


    getMaxNodeDisplayedLevel(node: INode)
    {// Returns the highest displayed level.
        tempDispLevel = 0;
        this._getMaxDisplayedLevel(node);

        return tempDispLevel;
    }


    _setDisplayedLevel(node: INode, level:number)
    {// Display nodes whose level is <= number
        var currentLevel = 0;

        if( (node.getLevel()<level) )
        {// Current level is to be displayed
            node.expand();
            if(!node.isLeaf())
            {// The node has children
                node.children.forEach((n) => {
                    this._setDisplayedLevel(n, level);
                });
            }
        }
        else{
            node.collapse();
        }

        return;
    }


    setDisplayedLevel(level:number)
    {// Display nodes whose level is <= number
        var currentLevel = 0;

        if(level>0) {
            var minLevel = 0;

            this.root.expand();
            this.root.children.forEach((n) => {
                this._setDisplayedLevel(n, level);
            });
        }
        else
        {
            this.root.collapse();
        }

        return;
    }


    setChildrenDisplayedLevel(level:number)
    {// Display children nodes whose level is <= number
        var currentLevel = 0;
        let node = this.selectNode;

        if(level>0 && node) {
            var minLevel = 0;

            if(node.getLevel() == level)
            {// Max required displayed level is node level
                node.mindmap.execute('collapseNode', {
                    node
                });
            }
            else
            {// Expand to required level
                node.expand();
                node.children.forEach((n) => {
                    this._setDisplayedLevel(n, level);
                });
            }
        }
        else
        {
            this.root.collapse();
        }

        this.scale(this.mindScale);

        return;
    }

    _setMindScalePointer(node: INode) {
        this.scalePointer = [];
        // var root = this.root;
        if (node) {
            var rbox = node.getBox();
            this.scalePointer.push(rbox.x + rbox.width / 2, rbox.y + rbox.height / 2);
            if(!node.isSelect){
                this.clearSelectNode();
                node.select();
            }
        }
    }

    getMarkdown() {
        var md = '';
        var level = this.setting.headLevel;
        this.traverseDF((n: INode) => {
            var l = n.getLevel() + 1;
            var hPrefix = '', space = '';
            if (l > 1) {
                hPrefix = '\n';
            }
            const ending = n.isExpand ? '' : ` ^${n.getId()}`
            if (n.getLevel() < level) {
                for (let i = 0; i < l; i++) {
                    hPrefix += '#';
                }
                md += (hPrefix + ' ');
                md += n.getData().text.trim() + ending + '\n';

            } else {
                for (var i = 0; i < n.getLevel() - level; i++) {
                    space += '\t';
                }
                var text = n.getData().text.trim();
                if (text) {
                    var textArr = text.split('\n');
                    var lineLength = textArr.length;

                    if (lineLength == 1) {
                        md += `${space}- ${text}${ending}\n`;
                    } else if (lineLength > 1) {
                        //code
                        if (text.startsWith('```')) {
                            md+='\n'
                            md += `${space}-\n`;
                            textArr.forEach((t: string, i: number) => {
                                md += `${space}  ${t.trim()}${i === textArr.length - 1 ? ending : '' }\n`
                            });
                            md+='\n'
                        } else {
                            //text
                            md += `${space}- `;
                            textArr.forEach((t: string, i: number) => {
                                var contentText = "void";
                                if(t.trim().length > 0){
                                    contentText = t.trim();
                                }
                                if (i > 0) {
                                    md += `${space}${contentText}${i === textArr.length - 1 ? ending : '' }\n`
                                } else {
                                    md += `${contentText}\n`
                                }
                            });
                        }

                    }
                } else {
                    md += `${space}-${ending}\n`;
                }
            }
        }, this.root, true);
        return md.trim();
    }
    scale(num: number) {
        if (num < 20) {
            num = 20;
        }
        if (num > 300) {
            num = 300;
        }
        this.mindScale = num;
        if (this.scalePointer.length) {
            this.appEl.style.transformOrigin = `${this.scalePointer[0]}px ${this.scalePointer[1]}px`;
            this.appEl.style.transform = "scale(" + this.mindScale / 100 + ")";
        } else {
            this.appEl.style.transform = "scale(" + this.mindScale / 100 + ")";
        }

    }

    setScale(type: string) {
        if (type == "up") {
            var n = this.mindScale + 10;
        } else {
            var n = this.mindScale - 10;
        }
        this.scale(n);

        if (this.timeOut) {
            clearTimeout(this.timeOut)
        }

        this.timeOut = setTimeout(() => {
            new Notice(`${n} %`);
        }, 600);
    }

    copyNode(node?: INode): string {
        return node ? serializeSubtree(node) : serializeForest(this.getSelectedRoots());
    }

    async cutSelectedNodes(): Promise<void> {
        const nodes = this.getSelectedRoots();
        if (!nodes.length || nodes.some(node => !node.parent || node.data.isEdit) || this.editNode?.data.isEdit) return;
        try {
            await navigator.clipboard.writeText(serializeForest(nodes));
            if (nodes.every(node => this.getNodeById(node.getId()) === node && !node.data.isEdit)) this.deleteSelectedNodes(nodes);
        } catch (_) {
            new Notice('Unable to cut mind map nodes to the clipboard.');
        }
    }

    async copyToClipboard(node?: INode): Promise<boolean> {
        if (!(node || this.getSelectedRoots().length) || node?.data.isEdit || this.editNode?.data.isEdit) return false;
        try {
            await navigator.clipboard.writeText(this.copyNode(node));
            return true;
        } catch (_) {
            new Notice('Unable to copy mind map nodes to the clipboard.');
            return false;
        }
    }

    canPasteTo(target: INode): boolean {
        return !!target && this.getNodeById(target.getId()) === target &&
            !target.data.isEdit && !this.editNode?.data.isEdit &&
            this.view?.app.workspace.getActiveViewOfType(MindMapView) === this.view;
    }

    appPaste(evt: ClipboardEvent) {
        const element = evt.target as HTMLElement;
        if (evt.defaultPrevented || !this.canPasteTo(this.selectNode || this.root) ||
            (element ? !this.containerEL.contains(element) : !this.isFocused) ||
            element?.closest('input, textarea, [contenteditable="true"]')) return;
        const data = evt.clipboardData;
        if (!data) return;
        const text = data.getData('text/plain');
        const images = Array.from(data.files).filter(file => file.type.startsWith('image/'));
        if (!text && !images.length) return;
        evt.preventDefault(); evt.stopImmediatePropagation();
        void this.pasteContent(text, images, this.selectNode || this.root);
    }

    async pasteFromClipboard(): Promise<void> {
        const target = this.selectNode || this.root;
        if (!this.canPasteTo(target)) return;
        try {
            let text = '';
            const images: Blob[] = [];
            const clipboard = navigator.clipboard as typeof navigator.clipboard & {
                read?: () => Promise<Array<{ types: string[], getType(type: string): Promise<Blob> }>>;
            };
            if (clipboard.read) {
                try {
                    for (const item of await clipboard.read()) {
                        if (item.types.includes('text/plain')) text += await (await item.getType('text/plain')).text();
                        const imageType = item.types.find(type => type.startsWith('image/'));
                        if (imageType) images.push(await item.getType(imageType));
                    }
                } catch (_) { text = await clipboard.readText(); }
            } else text = await clipboard.readText();
            await this.pasteContent(text, images, target);
        } catch (_) {
            new Notice('Unable to paste clipboard content into the mind map.');
        }
    }

    async pasteContent(text: string, images: Blob[], target: INode): Promise<void> {
        if (!this.canPasteTo(target)) return;
        // Internal node data takes precedence over other clipboard representations.
        if (this.pasteNode(text, target)) return;
        const texts = text.replace(/\r\n?/g, '\n').split('\n').filter(line => line.trim().length > 0);
        try {
            for (const image of images) {
                if (!this.canPasteTo(target)) return;
                texts.push(await this.view.saveClipboardImage(image));
            }
            if (!texts.length || !this.canPasteTo(target)) return;
            const data = texts.map(content => ({ id: uuid(), pid: null, text: content, isRoot: false, isEdit: false, expanded: true, isExpand: true }));
            this.execute('pasteNode', { node: target, data });
        } catch (_) {
            new Notice('Unable to save clipboard image. No nodes were pasted.');
        }
    }

    pasteNode(text: string, node: INode = this.selectNode): boolean {
        if (!node || node.data.isEdit) return false;
        const data = parseSubtree(text, uuid);
        if (!data) return false;
        this.execute('pasteNode', { node, data });
        return true;
    }

}
