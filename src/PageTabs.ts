import { Menu } from 'obsidian';
import { t } from './lang/helpers';
import type { MindMapView } from './MindMapView';

/** Page switcher above the canvas; one tab per page in document order. */
export default class PageTabs {
  element: HTMLElement;
  private renaming = '';

  constructor(private view: MindMapView, host: HTMLElement, after?: HTMLElement | null) {
    this.element = document.createElement('div');
    this.element.className = 'mm-pages';
    this.element.setAttribute('role', 'tablist');
    this.element.setAttribute('aria-label', t('Mind map pages'));
    if (after?.parentNode === host) host.insertBefore(this.element, after.nextSibling);
    else host.insertBefore(this.element, host.firstChild);
    this.render();
  }

  render() {
    const active = this.view.activePageId;
    this.element.textContent = '';
    this.view.pages.forEach(page => {
      if (this.renaming === page.meta.id) {
        const input = document.createElement('input');
        input.className = 'mm-page-name';
        input.value = page.meta.name;
        input.setAttribute('aria-label', t('Rename page'));
        input.addEventListener('keydown', event => {
          event.stopPropagation();
          if (event.key === 'Enter') { event.preventDefault(); input.blur(); }
          else if (event.key === 'Escape') { event.preventDefault(); this.renaming = ''; this.render(); }
        });
        input.addEventListener('blur', () => {
          if (this.renaming !== page.meta.id) return;
          const value = input.value;
          this.renaming = '';
          this.view.renamePage(page.meta.id, value);
          this.render();
        });
        this.element.appendChild(input);
        setTimeout(() => { input.focus(); input.select(); }, 0);
        return;
      }
      const tab = document.createElement('button');
      tab.className = 'mm-page-tab' + (page.meta.id === active ? ' is-active' : '');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(page.meta.id === active));
      tab.setAttribute('data-page-id', page.meta.id);
      tab.textContent = page.meta.name;
      tab.title = page.meta.name;
      tab.addEventListener('click', () => { if (!this.renaming) this.view.setActivePage(page.meta.id); });
      tab.addEventListener('dblclick', event => { event.preventDefault(); this.startRename(page.meta.id); });
      tab.addEventListener('contextmenu', event => {
        event.preventDefault();
        this.menu(page.meta.id).showAtMouseEvent(event);
      });
      this.element.appendChild(tab);
      if (page.meta.id === active) setTimeout(() => this.reveal(tab), 0);
    });
    const add = document.createElement('button');
    add.className = 'mm-page-add';
    add.setAttribute('aria-label', t('New page'));
    add.title = t('New page');
    add.textContent = '+';
    add.addEventListener('click', () => this.view.addPage());
    this.element.appendChild(add);

    const more = document.createElement('button');
    more.className = 'mm-page-more';
    more.setAttribute('aria-label', t('Page menu'));
    more.title = t('Page menu');
    more.textContent = '⋯';
    more.addEventListener('click', event => this.menu(active).showAtMouseEvent(event));
    this.element.appendChild(more);
  }

  private startRename(id: string) {
    this.renaming = id;
    this.render();
  }

  private menu(id: string): Menu {
    const menu = new Menu((this.view as any).app);
    menu.addItem(item => item.setTitle(t('Rename page')).setIcon('pencil').onClick(() => this.startRename(id)));
    menu.addItem(item => item.setTitle(t('Delete page')).setIcon('trash').onClick(() => this.view.deletePage(id)));
    return menu;
  }

  private reveal(tab: HTMLElement) {
    const left = tab.offsetLeft, right = left + tab.offsetWidth;
    if (left < this.element.scrollLeft) this.element.scrollLeft = left;
    else if (right > this.element.scrollLeft + this.element.clientWidth) this.element.scrollLeft = right - this.element.clientWidth;
  }

  destroy() {
    this.element.remove();
  }
}
