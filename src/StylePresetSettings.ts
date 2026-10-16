import { NodeStylePreset, normalizePresets, renamePreset, applyNodeStyle } from './nodeStyles';
import { t } from './lang/helpers';

/** Preset swatches and the platform color palette share one optional color value. */
export function renderPresetColorPicker(host: HTMLElement, initial: string | undefined, onChange: () => void) {
    let current = /^#[0-9a-f]{6}$/i.test(initial || '') ? initial!.toLowerCase() : '';
    const group = document.createElement('div'); group.className = 'mm-preset-colors';
    group.setAttribute('role', 'group'); group.setAttribute('aria-label', t('Text color'));
    const title = document.createElement('div'); title.textContent = t('Text color'); group.appendChild(title); host.appendChild(group);
    const swatches = document.createElement('div'); swatches.className = 'mm-preset-swatches'; group.appendChild(swatches);
    const buttons: {element: HTMLButtonElement; color: string}[] = [];
    const options = [['', 'Follow theme'], ['#e53935', 'Red'], ['#fb8c00', 'Orange'], ['#fdd835', 'Yellow'],
        ['#43a047', 'Green'], ['#00897b', 'Teal'], ['#1e88e5', 'Blue'], ['#8e24aa', 'Purple'],
        ['#d81b60', 'Pink'], ['#757575', 'Gray'], ['#212121', 'Black'], ['#ffffff', 'White']];
    options.forEach(([value, label]) => {
        const button = document.createElement('button'); button.type = 'button';
        button.title = t(label as any); button.setAttribute('aria-label', t(label as any));
        if (value) { button.className = 'mm-preset-swatch'; button.style.backgroundColor = value; }
        else { button.className = 'mm-preset-theme-color'; button.textContent = t('Follow theme'); }
        button.addEventListener('click', () => { current = value; update(); onChange(); });
        swatches.appendChild(button); buttons.push({element: button, color: value});
    });
    const custom = document.createElement('label'); custom.className = 'mm-preset-custom-color'; custom.textContent = t('Custom text color');
    const picker = document.createElement('input'); picker.type = 'color'; picker.setAttribute('aria-label', t('Custom text color'));
    custom.appendChild(picker); group.appendChild(custom);
    const update = () => {
        buttons.forEach(({element, color}) => element.setAttribute('aria-pressed', String(current === color)));
        picker.value = current || '#5294e2';
    };
    const chooseCustom = () => { current = picker.value.toLowerCase(); update(); onChange(); };
    picker.addEventListener('input', chooseCustom); picker.addEventListener('change', chooseCustom);
    update();
    return {get value() { return current; }};
}

/** Native controls keep this editor usable in both desktop and mobile settings. */
export function renderStylePresetSettings(host: HTMLElement, plugin: any) {
    const section = document.createElement('section'); section.className = 'mm-preset-settings'; host.appendChild(section);
    const title = document.createElement('h3'); title.textContent = t('Node style presets'); section.appendChild(title);
    const description = document.createElement('p'); description.className = 'setting-item-description';
    description.textContent = t('Preset settings description'); section.appendChild(description);
    const list = document.createElement('div'); section.appendChild(list);
    const add = document.createElement('button'); add.type = 'button'; add.textContent = t('Add style preset'); section.appendChild(add);
    const commit = async () => { await plugin.saveSettings(); };
    const draw = () => {
        list.textContent = '';
        const presets: NodeStylePreset[] = plugin.settings.nodeStylePresets;
        presets.forEach(preset => {
            const card = document.createElement('div'); card.className = 'mm-preset-card'; list.appendChild(card);
            const form = document.createElement('form'); card.appendChild(form);
            const field = (label: string, type: string, value: string) => {
                const row = document.createElement('label'); row.className = 'mm-preset-field'; row.textContent = label;
                const input = document.createElement('input'); input.type = type; input.value = value; input.setAttribute('aria-label', label);
                row.appendChild(input); form.appendChild(row); return input;
            };
            const name = field(t('Preset name'), 'text', preset.name); name.maxLength = 80;
            const color = renderPresetColorPicker(form, preset.color, () => { updatePreview(); save.textContent = t('Save preset'); });
            const size = field(t('Preset font size'), 'number', preset.fontSize?.toString() || ''); size.min = '8'; size.max = '72';
            const toggles: Record<string, HTMLInputElement> = {};
            for (const [key, label] of [['bold', 'Bold'], ['italic', 'Italic'], ['underline', 'Underline'], ['strike', 'Strikethrough']]) {
                const input = field(t(label as any), 'checkbox', ''); input.checked = !!(preset as any)[key]; toggles[key] = input;
            }
            const preview = document.createElement('div'); preview.className = 'mm-node mm-preset-preview';
            const content = document.createElement('div'); content.className = 'mm-node-content'; content.textContent = t('Preset preview'); preview.appendChild(content); form.appendChild(preview);
            const error = document.createElement('p'); error.className = 'mm-preset-error'; error.setAttribute('role', 'alert'); form.appendChild(error);
            const draft = (): NodeStylePreset => ({...preset, name: name.value.trim(), color: color.value.trim() || undefined,
                fontSize: size.value ? Number(size.value) : undefined, bold: toggles.bold.checked, italic: toggles.italic.checked, underline: toggles.underline.checked, strike: toggles.strike.checked});
            const updatePreview = () => {
                const value = normalizePresets([{...draft(), name: 'preview'}])[0];
                applyNodeStyle({containEl: preview, data: {stylePreset: 'preview'}, refreshBox() {}}, [value]);
            };
            form.addEventListener('input', () => { updatePreview(); save.textContent = t('Save preset'); }); updatePreview();
            const actions = document.createElement('div'); actions.className = 'mm-preset-actions'; form.appendChild(actions);
            const save = document.createElement('button'); save.type = 'submit'; save.textContent = t('Save preset'); actions.appendChild(save);
            const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = t('Delete preset'); actions.appendChild(remove);
            form.addEventListener('submit', async event => {
                event.preventDefault(); const value = draft();
                if ((value.color && !/^#[0-9a-f]{6}$/i.test(value.color)) || (value.fontSize !== undefined && (!Number.isFinite(value.fontSize) || value.fontSize < 8 || value.fontSize > 72))) {
                    error.textContent = t('Invalid preset values'); return;
                }
                if (!renamePreset(presets, preset, value.name)) { error.textContent = t('Invalid preset name'); return; }
                Object.assign(preset, value, {aliases: preset.aliases});
                save.disabled = true;
                try { await commit(); error.textContent = ''; save.textContent = t('Preset saved'); }
                catch (_) { error.textContent = t('Unable to save presets'); }
                finally { save.disabled = false; }
            });
            remove.addEventListener('click', async () => {
                plugin.settings.nodeStylePresets = presets.filter(p => p !== preset);
                try { await commit(); draw(); } catch (_) { error.textContent = t('Unable to save presets'); }
            });
        });
    };
    add.addEventListener('click', async () => {
        const presets: NodeStylePreset[] = plugin.settings.nodeStylePresets;
        let index = 1; let name: string;
        do { name = t('New style') + ' ' + index++; } while (presets.some(p => p.name === name || p.aliases?.includes(name)));
        presets.push({name});
        await commit(); draw();
        list.lastElementChild?.querySelector('input')?.focus();
    });
    draw();
}
