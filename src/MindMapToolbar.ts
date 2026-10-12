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
    this.buttons.child.disabled = !ready;
    this.buttons.sibling.disabled = !map.selectNode?.parent;
    this.buttons.delete.disabled = !roots.some(node => !node.data.isRoot);
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
    const button = (id: string, label: string, title: string, action: () => void) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = label;
      el.title = title;
      el.setAttribute('aria-label', title);
      el.dataset.action = id;
      el.addEventListener('click', () => {
        if (!map.root || map.isComposing) return;
        action();
        this.update();
        map.focusAfterHistory();
      });
      this.buttons[id] = el;
      this.element.appendChild(el);
    };
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
      map.deleteSelectedNodes(map.getSelectedRoots().filter(node => !node.data.isRoot));
    });
    button('undo', t('Undo'), t('Undo'), () => map.undo());
    button('redo', t('Redo'), t('Redo'), () => map.redo());
    button('zoomOut', '−', t('Zoom out'), () => map.scale(map.mindScale - 10));
    button('reset', '100%', t('Reset zoom'), () => map.scale(100));
    button('zoomIn', '+', t('Zoom in'), () => map.scale(map.mindScale + 10));
    button('center', t('Center map'), t('Center map'), () => map.center());
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
