import MindMap from './mindmap/mindmap';
import { findPreset } from './nodeStyles';
import { t } from './lang/helpers';

/** A per-map inspector. Additional tools can be added as separate sections. */
export default class MindMapPanel {
    element: HTMLElement;
    private select: HTMLSelectElement;
    private status: HTMLElement;
    constructor(private map: MindMap, host: HTMLElement, manage: () => void) {
        this.element = document.createElement('aside'); this.element.className = 'mm-side-panel';
        this.element.setAttribute('aria-label', t('Mind map panel')); host.appendChild(this.element);
        const title = document.createElement('h3'); title.textContent = t('Mind map panel'); this.element.appendChild(title);
        const section = document.createElement('section'); this.element.appendChild(section);
        const heading = document.createElement('h4'); heading.textContent = t('Node style'); section.appendChild(heading);
        this.status = document.createElement('p'); this.status.className = 'mm-panel-status'; section.appendChild(this.status);
        this.select = document.createElement('select'); this.select.setAttribute('aria-label', t('Node style preset')); section.appendChild(this.select);
        this.select.addEventListener('change', () => {
            if (this.select.value === '__mixed__') return;
            map.applyStylePreset(this.select.value || undefined);
            map.focusAfterHistory();
        });
        const settings = document.createElement('button'); settings.type = 'button'; settings.textContent = t('Manage style presets');
        settings.addEventListener('click', manage); section.appendChild(settings);
        map.on('toolbarChange', this.update); map.on('mindMapChange', this.update); this.update();
    }
    update = () => {
        const nodes = this.map.root ? this.map.getSelectedNodes() : [];
        const presets = this.map.setting.nodeStylePresets || [];
        const values = new Set(nodes.map(node => findPreset(presets, node.data.stylePreset)?.name || node.data.stylePreset || ''));
        const mixed = values.size > 1; const value = values.values().next().value || '';
        this.select.textContent = '';
        const option = (value: string, text: string) => { const el = document.createElement('option'); el.value = value; el.textContent = text; this.select.appendChild(el); };
        option('', t('No preset'));
        presets.forEach(preset => option(preset.name, preset.name));
        if (mixed) option('__mixed__', t('Mixed presets'));
        else if (value && !findPreset(presets, value)) option(value, t('Missing preset') + ': ' + value);
        this.select.value = mixed ? '__mixed__' : value;
        this.select.disabled = nodes.length === 0;
        this.status.textContent = nodes.length ? t('Selected nodes') + ': ' + nodes.length : t('Select a node to style');
    };
    toggle() { this.element.hidden = !this.element.hidden; }
    destroy() {
        this.map.off('toolbarChange', this.update); this.map.off('mindMapChange', this.update); this.element.remove();
    }
}
