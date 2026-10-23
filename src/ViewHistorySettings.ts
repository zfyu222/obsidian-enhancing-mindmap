import { Notice } from 'obsidian';
import { t } from './lang/helpers';
import { ViewHistoryOptions, normalizeViewHistoryOptions } from './mindmap/view-history-options';

export function renderViewHistorySettings(host: HTMLElement, plugin: {
    settings: Partial<ViewHistoryOptions>;
    saveSettings(refreshStyles?: boolean): Promise<void>;
}) {
    const heading = document.createElement('h3');
    heading.textContent = t('Viewing position history'); host.appendChild(heading);
    const inputs: HTMLInputElement[] = [];
    const fields: {key: keyof ViewHistoryOptions; name: string; description: string; min: number; max: number; step: number}[] = [
        {key: 'viewHistoryIdleSeconds', name: 'Viewing idle time (seconds)', description: 'Viewing idle time description', min: 0.5, max: 60, step: 0.5},
        {key: 'viewHistoryDistancePercent', name: 'Minimum viewing distance (%)', description: 'Minimum viewing distance description', min: 1, max: 100, step: 1}
    ];
    fields.forEach(field => {
        const row = document.createElement('div'); row.className = 'setting-item';
        const info = document.createElement('div'); info.className = 'setting-item-info';
        const name = document.createElement('div'); name.className = 'setting-item-name'; name.textContent = t(field.name as any);
        const description = document.createElement('div'); description.className = 'setting-item-description'; description.textContent = t(field.description as any);
        info.append(name, description);
        const control = document.createElement('div'); control.className = 'setting-item-control';
        const input = document.createElement('input'); input.type = 'number';
        input.min = String(field.min); input.max = String(field.max); input.step = String(field.step);
        input.setAttribute('aria-label', t(field.name as any));
        input.value = String(normalizeViewHistoryOptions(plugin.settings)[field.key]);
        inputs.push(input); control.appendChild(input); row.append(info, control); host.appendChild(row);
        input.addEventListener('change', async () => {
            const previous = normalizeViewHistoryOptions(plugin.settings)[field.key];
            if (!input.value.trim() || !input.checkValidity()) { input.value = String(previous); return; }
            const value = Number(input.value);
            if (value === previous) return;
            plugin.settings[field.key] = value;
            inputs.forEach(element => element.disabled = true);
            try { await plugin.saveSettings(false); }
            catch { plugin.settings[field.key] = previous; input.value = String(previous); new Notice(t('Save fail')); }
            finally { inputs.forEach(element => element.disabled = false); }
        });
    });
}
