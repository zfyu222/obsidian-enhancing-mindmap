import Node from '../mindmap/INode';
import { RemoveNodes } from '../mindmap/Cmds';
import { applyNodeStyle } from '../nodeStyles';
import { Notice } from 'obsidian';
import { uuid } from '../MindMapView';
import { t } from '../lang/helpers';
import { GraftData, graftsMarkdown, validGraftGraph, validateGrafts } from './model';
import { relationCurve } from '../relations/model';

/** References are durable; projected nodes and their visual parents are runtime only. */
export default class GraftManager {
    items: GraftData[] = []; preserved = ''; pending = '';
    nodes = new Map<string, Node>(); roots: { link: GraftData; node: Node; target: Node }[] = [];
    attached = false;
    private styleKeys = new WeakMap<Node, string>();
    sourceLinks?: SVGGElement;
    constructor(public map: any) { map.appEl.addEventListener?.('input', this.preview); }
    preview = () => {
        const editor = this.map.editNode;
        if (!editor?.data.isEdit) return;
        const source = this.original(editor);
        const others = [source, ...Array.from(this.nodes.values()).filter(node => node.virtualSource === source)];
        others.forEach(node => {
            if (node === editor) return;
            node.contentEl.textContent = editor.contentEl.innerText;
            node.virtualPreview = true; node.refreshBox();
        });
        this.renderSourceLinks();
    };
    original(node: any): any { return node?.virtualSource || node; }
    originals(): any[] {
        const nodes: any[] = [];
        this.map.traverseDF((node: any) => nodes.push(node));
        this.map.summaries?.all((node: any) => nodes.push(node));
        return nodes;
    }
    snapshot() { return validateGrafts(this.items); }
    restore(items: GraftData[]) { this.items = validateGrafts(items); this.pending = ''; this.markers(); }
    load(entries: GraftData[], preserved = '', original = '') {
        // Legacy folds remain readable, but reopening always starts expanded.
        this.items = validateGrafts(entries).map(({id, source, target}) => ({id, source, target})); this.preserved = preserved;
        if (!validGraftGraph(this.originals(), this.items)) {
            this.preserved = original || graftsMarkdown(entries); this.items = [];
        }
        if (this.preserved) new Notice(t('Invalid virtual branch data preserved'));
        this.markers();
    }
    markers() {
        const ids = new Set<string>(); this.items.forEach(item => { ids.add(item.source); ids.add(item.target); });
        this.originals().forEach(node => {
            if (this.preserved || ids.has(node.getId())) node.data.graftMember = true;
            else delete node.data.graftMember;
        });
    }
    reconcile(command?: any) {
        if (this.preserved) return;
        if (command?.name === 'pasteNode' && command.data?.grafts) this.items.push(...command.data.grafts);
        const ids = new Set(this.originals().map(node => node.getId()));
        this.items = this.items.filter(item => ids.has(item.source) && ids.has(item.target));
        if (this.pending && !ids.has(this.pending)) this.pending = '';
        this.markers();
    }
    canMove(nodes: any[], destination: any) {
        return !this.items.length || validGraftGraph(this.originals(), this.items, nodes, destination);
    }
    cancel() { this.pending = ''; this.map.emit('toolbarChange'); }
    begin() {
        if (this.preserved || this.map.isComposing) return;
        if (this.pending) { this.cancel(); return; }
        this.map.finishEditingForHistory();
        const nodes = this.map.getSelectedNodes();
        if (nodes.length !== 1) return;
        this.map.relations?.cancel();
        this.pending = this.original(nodes[0]).getId();
        this.map.emit('toolbarChange'); new Notice(t('Click the node to graft under; Escape cancels'));
    }
    create(source: string, target: string) {
        this.pending = '';
        const nodes = this.originals();
        const item = { id: uuid(), source, target };
        if (this.preserved || this.map.isComposing || this.items.length >= 1000 || this.items.some(link => link.source === source && link.target === target) ||
            !validGraftGraph(nodes, [...this.items, item])) {
            new Notice(t('Virtual branch would be cyclic, duplicated or too large')); this.map.emit('toolbarChange'); return;
        }
        const manager = this;
        this.map.exec.history.execute({ name: 'addGraft', execute() { manager.items.push(item); return true; },
            undo() { manager.items = manager.items.filter(link => link.id !== item.id); }, redo() { this.execute(); } } as any);
    }
    removeSelected() {
        this.map.finishEditingForHistory();
        const ids = new Set<string>(this.map.getSelectedNodes().map((node: Node) => node.virtualGraft).filter(Boolean));
        this.removeNodes([], ids);
    }
    removeNodes(nodes: Node[], ids = new Set(nodes.filter(node => node.virtualRoot).map(node => node.virtualGraft))) {
        if (!ids.size) return false;
        const manager = this, remaining = nodes.filter(node => !node.virtualRoot);
        const command = remaining.length ? new RemoveNodes(Array.from(new Set(remaining.map(node => this.original(node))))) : null;
        const removed = this.items.filter(item => ids.has(item.id));
        if (!removed.length) return false;
        this.map.exec.history.execute({ name: 'removeGrafts', execute() {
            manager.map.clearSelectNode(); manager.items = manager.items.filter(item => !ids.has(item.id));
            command?.execute(); return true;
        }, undo() { command?.undo(); manager.items.push(...removed); }, redo() { this.execute(); } } as any);
        return true;
    }
    markdown() { return this.preserved || graftsMarkdown(this.items); }
    rememberExpansion(node: Node, expanded: boolean) {
        const item = this.items.find(link => link.id === node.virtualGraft);
        if (!item || !node.virtualSource) return;
        const path = node.virtualPath || [], key = JSON.stringify([...path, node.virtualSource.getId()]);
        const fold = (item.folds || (item.folds = [])).find(fold => JSON.stringify([...fold.path, fold.node]) === key);
        if (fold) fold.expanded = expanded;
        else item.folds.push({ path: path.slice(), node: node.virtualSource.getId(), expanded });
    }
    all(callback: (node: Node) => void) { if (!this.attached) this.nodes.forEach(callback); }
    sync() {
        const styleSettingsKey = JSON.stringify([this.map.setting.nodeStylePresets || [], this.map.setting.defaultNodeStyle]);
        const byId = new Map(this.originals().map(node => [node.getId(), node]));
        const editor = this.map.editNode?.data.isEdit ? this.map.editNode : null;
        const editingSource = this.original(editor);
        byId.forEach(node => {
            if (node.virtualPreview && node !== editingSource) { node.virtualPreview = false; node.parseText(); }
        });
        const used = new Set<string>(); this.roots = [];
        const states = new Map(this.items.map(link => [link.id, new Map((link.folds || []).map(fold => [JSON.stringify([...fold.path, fold.node]), fold]))]));
        const usedFolds = new Map(this.items.map(link => [link.id, new Set<string>()]));
        const build = (source: Node, parent: Node, link: GraftData, path: string, root = false, chain: string[] = []): Node => {
            const id = `virtual:${path}:${source.getId()}`;
            let mirror = this.nodes.get(id);
            if (!mirror) {
                mirror = new Node({ ...source.data, id, isRoot: false, isEdit: false, children: undefined }, this.map);
                mirror.containEl.classList.add('mm-virtual-node');
                mirror.containEl.title = t('Virtual node: editing changes the source');
                mirror.setPosition(0, 0);
                this.nodes.set(id, mirror); this.map.contentEL.appendChild(mirror.containEl);
            }
            used.add(id); mirror.virtualSource = source; mirror.virtualGraft = link.id; mirror.virtualRoot = root; mirror.parent = parent;
            mirror.virtualPath = chain;
            if (!mirror.data.isEdit) {
                const changed = mirror.data.text !== source.data.text || JSON.stringify(mirror.data.nodeStyle) !== JSON.stringify(source.data.nodeStyle) || mirror.data.stylePreset !== source.data.stylePreset;
                mirror.data.text = source.data.text; mirror.data.nodeStyle = source.data.nodeStyle; mirror.data.stylePreset = source.data.stylePreset;
                if ((changed || mirror.virtualPreview) && source !== editingSource) {
                    mirror.virtualPreview = false; mirror.setText(source.data.text);
                }
                const styleKey = JSON.stringify([source.data.stylePreset, source.data.nodeStyle]) + styleSettingsKey;
                if (this.styleKeys.get(mirror) !== styleKey) {
                    applyNodeStyle(mirror, this.map.setting.nodeStylePresets || [], this.map.setting.defaultNodeStyle);
                    this.styleKeys.set(mirror, styleKey);
                }
            }
            const key = JSON.stringify([...chain, source.getId()]), folds = states.get(link.id)!;
            if (!folds.has(key)) folds.set(key, { path: chain.slice(), node: source.getId(), expanded: true });
            usedFolds.get(link.id)!.add(key);
            mirror.isExpand = folds.get(key)!.expanded;
            mirror.children = source.children.map(child => build(child, mirror!, link, path, false, chain));
            this.items.filter(item => item.target === source.getId()).forEach(item => {
                const nested = byId.get(item.source); if (nested) mirror!.children.push(build(nested, mirror!, link, path + ':' + item.id, false, [...chain, item.id]));
            });
            return mirror;
        };
        const renderable = validGraftGraph(Array.from(byId.values()), this.items);
        (renderable ? this.items : []).forEach(link => {
            const source = byId.get(link.source), target = byId.get(link.target);
            if (source && target) this.roots.push({ link, node: build(source, target, link, link.id, true), target });
        });
        if (renderable) this.items.forEach(link => { link.folds = Array.from(states.get(link.id)!.entries()).filter(([key]) => usedFolds.get(link.id)!.has(key)).map(([, fold]) => fold); });
        this.markers();
        const visibility = (node: Node, visible: boolean) => {
            if (visible) node.show(); else node.hide();
            // Hidden DOM measures as zero. Restore visibility before caching the
            // dimensions consumed by layout, including restored fold snapshots.
            if (visible) node.refreshBox();
            node.clearCacheData();
            node.children.forEach(child => visibility(child, visible && node.isExpand));
        };
        this.roots.forEach(({ node, target }) => visibility(node, target.isShow() && target.isExpand));
        this.nodes.forEach((node, id) => {
            if (used.has(id)) return;
            if (this.map.editNode === node) { node.data.isEdit = false; this.map.editNode = null; }
            if (this.map.selectNode === node) this.map.selectNode = null;
            this.map.selectedNodes = this.map.selectedNodes.filter((selected: Node) => selected !== node);
            node.containEl.remove(); this.nodes.delete(id);
        });
        this.originals().forEach(node => node.clearCacheData());
        if (editor) this.preview();
    }
    withTrees(action: () => void) {
        if (this.attached) { action(); return; }
        this.sync(); this.attached = true;
        const parents = new Map<Node, Node[]>();
        this.roots.forEach(({ target, node }) => {
            if (!parents.has(target)) { parents.set(target, target.children); target.children = target.children.slice(); }
            target.children.push(node);
        });
        try { action(); } finally { parents.forEach((children, node) => node.children = children); this.attached = false; }
    }
    renderSourceLinks() {
        const host = this.map.contentEL?.querySelector?.('svg'), doc = this.map.contentEL?.ownerDocument;
        if (!host || !doc) return;
        if (!this.sourceLinks || this.sourceLinks.parentNode !== host) {
            if (!this.nodes.size) return;
            this.sourceLinks = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
            this.sourceLinks.classList.add('mm-graft-source-links');
            this.sourceLinks.setAttribute('aria-hidden', 'true');
            host.insertBefore(this.sourceLinks, host.firstChild);
        }
        this.sourceLinks.textContent = '';
        this.nodes.forEach(node => {
            const source = node.virtualSource;
            // Ordinary projected descendants do not each need a source link.
            // A nested graft has a different visual parent from its true parent.
            if (!source || (!node.virtualRoot && node.parent?.virtualSource === source.parent) || !node.isShow() || !source.isShow()) return;
            const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'mm-graft-source-line');
            path.setAttribute('data-source-id', source.getId());
            path.setAttribute('data-virtual-id', node.getId());
            path.setAttribute('d', relationCurve(node.getBox(), source.getBox()).path);
            this.sourceLinks!.appendChild(path);
        });
    }
    clear() { this.sourceLinks?.remove(); this.sourceLinks = undefined; this.map.appEl.removeEventListener?.('input', this.preview); this.nodes.forEach(node => node.containEl.remove()); this.nodes.clear(); this.roots = []; this.items = []; this.pending = ''; }
}
