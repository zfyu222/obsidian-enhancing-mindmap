import { Menu } from 'obsidian';
import { t } from './lang/helpers';
import type { MindMapView } from './MindMapView';

/** Page switcher below the canvas; one tab per page in document order. */
export default class PageTabs {
  element: HTMLElement;
  private list: HTMLElement;
  private prev: HTMLButtonElement | null = null;
  private next: HTMLButtonElement | null = null;
  private renaming = '';

  constructor(private view: MindMapView, host: HTMLElement, after?: HTMLElement | null) {
    this.element = document.createElement('div');
    this.element.className = 'mm-pages';
    this.element.setAttribute('aria-label', t('Mind map pages'));
    this.element.addEventListener('contextmenu', event => {
      if ((event.target as Element)?.closest('button, input')) return;
      event.preventDefault();
      this.view.addPage();
    });
    if (after?.parentNode === host) host.insertBefore(this.element, after.nextSibling);
    else host.appendChild(this.element);
    this.render();
  }

  render() {
    const active = this.view.activePageId;
    this.element.textContent = '';
    this.list = document.createElement('div');
    this.list.className = 'mm-page-list';
    this.list.setAttribute('role', 'tablist');
    this.list.setAttribute('aria-label', t('Mind map pages'));
    this.list.addEventListener('scroll', () => this.updateScroll());
    this.element.appendChild(this.list);
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
        this.list.appendChild(input);
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
      this.list.appendChild(tab);
      if (page.meta.id === active) setTimeout(() => this.reveal(tab), 0);
    });

    const controls = document.createElement('div');
    controls.className = 'mm-page-controls';
    this.prev = this.scrollButton('‹', 'Scroll pages left', -1);
    this.next = this.scrollButton('›', 'Scroll pages right', 1);
    const more = document.createElement('button');
    more.className = 'mm-page-more';
    more.setAttribute('aria-label', t('Page menu'));
    more.title = t('Page menu');
    more.textContent = '⋯';
    more.addEventListener('click', event => this.menu(active).showAtMouseEvent(event));
    controls.append(this.prev, this.next, more);
    this.element.appendChild(controls);
    setTimeout(() => this.updateScroll(), 0);
  }

  private scrollButton(label: string, title: string, direction: number): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'mm-page-scroll';
    button.textContent = label;
    button.title = t(title as any);
    button.setAttribute('aria-label', t(title as any));
    button.addEventListener('click', () => {
      this.list.scrollBy({ left: direction * Math.max(120, Math.round(this.list.clientWidth * 0.6)), behavior: 'smooth' });
    });
    return button;
  }

  private updateScroll() {
    if (!this.list) return;
    const remaining = this.list.scrollWidth - this.list.clientWidth;
    if (this.prev) this.prev.disabled = this.list.scrollLeft <= 1;
    if (this.next) this.next.disabled = remaining <= 1 || this.list.scrollLeft >= remaining - 1;
    this.element.classList.toggle('is-scrollable', remaining > 1);
  }

  private startRename(id: string) {
    this.renaming = id;
    this.render();
  }

  private menu(id: string): Menu {
    const menu = new Menu((this.view as any).app);
    menu.addItem(item => item.setTitle(t('New page')).setIcon('plus').onClick(() => this.view.addPage()));
    menu.addItem(item => item.setTitle(t('Rename page')).setIcon('pencil').onClick(() => this.startRename(id)));
    menu.addItem(item => item.setTitle(t('Delete page')).setIcon('trash').onClick(() => this.view.deletePage(id)));
    return menu;
  }

  private reveal(tab: HTMLElement) {
    if (!this.list) return;
    const tabRect = tab.getBoundingClientRect(), listRect = this.list.getBoundingClientRect();
    if (!listRect.width) return;
    if (tabRect.left < listRect.left) this.list.scrollLeft += tabRect.left - listRect.left - 4;
    else if (tabRect.right > listRect.right) this.list.scrollLeft += tabRect.right - listRect.right + 4;
    this.updateScroll();
  }

  destroy() {
    this.element.remove();
  }
}
