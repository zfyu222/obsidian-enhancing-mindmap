import MindMap from './mindmap/mindmap';
import { t } from './lang/helpers';

/** Lives outside the scrolling/scaling canvas. All edits use the graph history. */
export default class MindMapToolbar {
  element: HTMLElement;
  buttons: Record<string, HTMLButtonElement> = {};
  update = () => {
    const map = this.map;
    const ready = !!map.root;
    const roots = ready ? map.getSelectedRoots() : [];
    if (this.buttons.summary) {
      const validation = ready ? map.summaries?.validation() : null;
      this.buttons.summary.disabled = !validation || !!validation.error || !!map.summaries?.preserved;
      this.buttons.summary.title = (validation?.error ? t(validation.error as any) : t('Add summary'));
    }
    if(this.buttons.relation){const count=ready?map.getSelectedNodes().length:0;this.buttons.relation.disabled=!map.relations || !!map.relations.preserved || (!map.relations.pending && count!==1 && count!==2);this.buttons.relation.setAttribute('aria-pressed',String(!!map.relations?.pending));this.buttons.removeRelation.disabled=!map.relations?.selected;}
    this.buttons.child.disabled = !ready;
    this.buttons.sibling.disabled = !map.selectNode?.parent;
    this.buttons.delete.disabled = !roots.some(node => !node.data.isRoot || node.data.summaryRoot);
    const editor = map.editNode || map.selectNode;
    const draft = !!editor?.data.isEdit && editor.contentEl.textContent !== editor.data.text;
    this.buttons.undo.disabled = !map.exec.history.undos.length && !draft;
    this.buttons.redo.disabled = !map.exec.history.redos.length;
    this.buttons.zoomOut.disabled = !ready || map.mindScale <= 20;
    this.buttons.zoomIn.disabled = !ready || map.mindScale >= 300;
    this.buttons.reset.disabled = !ready;
    this.buttons.reset.textContent = `${map.mindScale}%`;
    this.buttons.center.disabled = !ready;
  };

  constructor(private map: MindMap, host: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'mm-toolbar';
    this.element.setAttribute('role', 'group');
    this.element.setAttribute('aria-label', t('Mind map toolbar'));
    host.insertBefore(this.element, host.firstChild);
    // Keep the node editor/selection intact until the click commits its command.
    this.element.addEventListener('mousedown', event => {
      if (event.button === 0) event.preventDefault();
    });
    // Inline SVG keeps icons available on older Obsidian versions as well.
    const icons: Record<string, string> = {
      relation: '<path d="M3 17C8 2 16 22 21 7m-5 0h5v5" stroke-dasharray="3 3"/>',
      removeRelation: '<path d="M3 17C8 2 16 22 21 7m-5 0h5v5M4 3l5 5m0-5L4 8"/>',
      summary: '<path d="M6 3q5 0 5 5v8q0 5-5 5m5-9h4"/><rect x="15" y="8" width="6" height="8" rx="1"/>',
      child: '<rect x="3" y="3" width="8" height="6" rx="1"/><path d="M7 9v8h5m5-4v8m-4-4h8"/>',
      sibling: '<rect x="3" y="3" width="8" height="6" rx="1"/><path d="M3 13h8m-4-4v12m10-12v8m-4-4h8"/>',
      delete: '<path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6"/>',
      undo: '<path d="M9 4 4 9l5 5M4 9h9a7 7 0 0 1 7 7v4"/>',
      redo: '<path d="m15 4 5 5-5 5m5-5h-9a7 7 0 0 0-7 7v4"/>',
      zoomOut: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6"/>',
      zoomIn: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6m-3-3v6"/>',
      panel: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M15 4v16"/>',
      center: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>'
    };
    const button = (id: string, label: string, title: string, action: () => void) => {
      const el = document.createElement('button');
      el.type = 'button';
      if (icons[id]) {
        el.classList.add('mm-toolbar-icon');
        el.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[id]}</svg>`;
      } else {
        el.textContent = label;
      }
      el.title = title;
      el.setAttribute('aria-label', title);
      el.dataset.action = id;
      el.addEventListener('click', () => {
        if (!map.root || map.isComposing) return;
        action();
        this.update();
        if (!map.editNode?.data.isEdit) map.focusAfterHistory();
      });
      this.buttons[id] = el;
      this.element.appendChild(el);
    };
    button('relation', t('Add relation line'), t('Add relation line'), () => map.relations?.begin());
    button('removeRelation', t('Delete relation line'), t('Delete relation line'), () => map.relations?.remove());
    button('summary', t('Add summary'), t('Add summary'), () => map.summaries?.create());
    button('child', t('Add child'), `${t('Add child')} (Tab)`, () => {
      map.finishEditingForHistory();
      const parent = map.selectNode || map.root;
      if (!parent.isExpand) parent.expand();
      map.execute('addChildNode', { parent });
    });
    button('sibling', t('Add sibling'), `${t('Add sibling')} (Enter)`, () => {
      map.finishEditingForHistory();
      const node = map.selectNode;
      if (node?.parent) map.execute('addSiblingNode', {
        parent: node.parent, index: node.parent.children.indexOf(node) + 1
      });
    });
    button('delete', t('Delete nodes'), `${t('Delete nodes')} (Delete)`, () => {
      map.finishEditingForHistory();
      map.deleteSelectedNodes(map.getSelectedRoots().filter(node => !node.data.isRoot || node.data.summaryRoot));
    });
    button('undo', t('Undo'), t('Undo'), () => map.undo());
    button('redo', t('Redo'), t('Redo'), () => map.redo());
    button('zoomOut', '−', t('Zoom out'), () => map.scale(map.mindScale - 10));
    button('reset', '100%', t('Reset zoom'), () => map.scale(100));
    button('zoomIn', '+', t('Zoom in'), () => map.scale(map.mindScale + 10));
    button('center', t('Center map'), t('Center map'), () => map.center());
    button('panel', t('Mind map panel'), t('Toggle mind map panel'), () => map.view?.panel?.toggle());
    map.on('toolbarChange', this.update);
    map.on('mindMapChange', this.update);
    map.appEl.addEventListener('input', this.update);
    this.update();
  }

  destroy() {
    this.map.off('toolbarChange', this.update);
    this.map.off('mindMapChange', this.update);
    this.map.appEl.removeEventListener('input', this.update);
    this.element.remove();
  }
}
