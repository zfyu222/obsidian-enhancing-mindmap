import { NodeStylePreset, normalizeNodeBoxStyle, normalizePresets, renamePreset, applyNodeStyle } from './nodeStyles';
import { t } from './lang/helpers';

/** Preset swatches and the platform color palette share one optional color value. */
export function renderPresetColorPicker(host: HTMLElement, initial: string | undefined, onChange: () => void, live = true) {
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
    const chooseCustom = (event: Event) => { current = picker.value.toLowerCase(); update(); if (live || event.type === 'change') onChange(); };
    picker.addEventListener('input', chooseCustom); picker.addEventListener('change', chooseCustom);
    update();
    return {get value() { return current; },
        setValue(value?: string) { current = /^#[0-9a-f]{6}$/i.test(value || '') ? value!.toLowerCase() : ''; update(); },
        setDisabled(disabled: boolean) { buttons.forEach(({element}) => element.disabled = disabled); picker.disabled = disabled; }
    };
}

/** A compact shared editor for node-wide box styling. */
export function renderNodeBoxControls(host: HTMLElement, onChange: (patch: any) => void) {
    const element = document.createElement('details'); element.className = 'mm-box-controls'; host.appendChild(element);
    const heading = document.createElement('summary'); heading.textContent = t('Border and fill'); element.appendChild(heading);
    const row = (label: string) => { const el = document.createElement('label'); el.className = 'mm-box-row'; el.textContent = t(label as any); element.appendChild(el); return el; };
    const shape = document.createElement('select'); shape.setAttribute('aria-label', t('Node shape'));
    for (const [value,label] of [['none','No border'],['rectangle','Rectangle'],['rounded','Rounded rectangle'],['pill','Pill']]) {
        const option = document.createElement('option'); option.value = value; option.textContent = t(label as any); shape.appendChild(option);
    }
    row('Node shape').appendChild(shape); shape.addEventListener('change', () => onChange({shape:shape.value}));
    const width = document.createElement('select'); width.setAttribute('aria-label', t('Border thickness'));
    for (const value of [1,2,3,4]) { const option = document.createElement('option'); option.value = String(value); option.textContent = value + ' px'; width.appendChild(option); }
    row('Border thickness').appendChild(width); width.addEventListener('change', () => onChange({borderWidth:Number(width.value)}));
    const colors: Record<string, {picker: HTMLInputElement; reset: HTMLButtonElement}> = {};
    for (const [key,label,resetLabel] of [['borderColor','Border color','Follow theme'],['backgroundColor','Fill color','Transparent']]) {
        const field = row(label), picker = document.createElement('input'); picker.type = 'color'; picker.setAttribute('aria-label',t(label as any));
        picker.addEventListener('change', () => onChange({[key]:picker.value})); field.appendChild(picker);
        const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = t(resetLabel as any);
        reset.addEventListener('click', () => onChange({[key]:''})); field.appendChild(reset); colors[key] = {picker,reset};
    }
    return {element, setValue(value: any, disabled = false) {
        shape.value = value.shape || 'none'; width.value = String(value.borderWidth || 1);
        shape.disabled = disabled; width.disabled = disabled;
        for (const key of Object.keys(colors)) { const {picker,reset} = colors[key]; picker.value = value[key] || (key === 'borderColor' ? '#333333' : '#ffffff'); picker.disabled = disabled; reset.disabled = disabled; reset.setAttribute('aria-pressed', String(!value[key])); }
    }};
}

/** Defaults stay in plugin settings; notes contain only explicit overrides. */
export function renderDefaultNodeStyleSettings(host: HTMLElement, plugin: any) {
    const section = document.createElement('details'); section.className = 'mm-default-style'; host.appendChild(section);
    const title = document.createElement('summary'); title.textContent = t('Default node style'); section.appendChild(title);
    const description = document.createElement('p'); description.textContent = t('Default node style description'); section.appendChild(description);
    let draft = {...normalizeNodeBoxStyle(plugin.settings.defaultNodeStyle)};
    const box = renderNodeBoxControls(section, patch => { draft = {...draft, ...patch}; box.setValue(draft); update(); save.textContent = t('Save default node style'); });
    box.element.open = true; box.setValue(draft);
    const preview = document.createElement('div'); preview.className = 'mm-node mm-preset-preview';
    const content = document.createElement('div'); content.className = 'mm-node-content'; content.textContent = t('Preset preview'); preview.appendChild(content); section.appendChild(preview);
    const update = () => applyNodeStyle({containEl:preview,data:{},refreshBox(){}}, [], draft); update();
    const error = document.createElement('p'); error.className = 'mm-preset-error'; error.setAttribute('role','alert'); section.appendChild(error);
    const save = document.createElement('button'); save.type = 'button'; save.textContent = t('Save default node style'); section.appendChild(save);
    const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = t('Restore original node style'); section.appendChild(reset);
    const commit = async (value: any) => {
        const before = plugin.settings.defaultNodeStyle; save.disabled = true; reset.disabled = true; box.setValue(draft,true);
        plugin.settings.defaultNodeStyle = normalizeNodeBoxStyle(value);
        try { await plugin.saveSettings(); draft = {...plugin.settings.defaultNodeStyle}; error.textContent = ''; save.textContent = t('Preset saved'); }
        catch (_) { plugin.settings.defaultNodeStyle = before; error.textContent = t('Unable to save presets'); }
        finally { save.disabled = false; reset.disabled = false; box.setValue(draft); update(); }
    };
    save.addEventListener('click', () => void commit(draft));
    reset.addEventListener('click', () => void commit({}));
}

/** Native controls keep this editor usable in both desktop and mobile settings. */
export function renderStylePresetSettings(host: HTMLElement, plugin: any) {
    const section = document.createElement('details'); section.className = 'mm-preset-settings'; host.appendChild(section);
    const title = document.createElement('summary'); title.textContent = t('Node style presets'); section.appendChild(title);
    const description = document.createElement('p'); description.className = 'setting-item-description';
    description.textContent = t('Preset settings description'); section.appendChild(description);
    const list = document.createElement('div'); section.appendChild(list);
    const add = document.createElement('button'); add.type = 'button'; add.textContent = t('Add style preset'); section.appendChild(add);
    const commit = async () => { await plugin.saveSettings(); };
    const draw = () => {
        list.textContent = '';
        const presets: NodeStylePreset[] = plugin.settings.nodeStylePresets;
        title.textContent = t('Node style presets') + ' (' + presets.length + ')';
        presets.forEach(preset => {
            const card = document.createElement('details'); card.className = 'mm-preset-card'; list.appendChild(card);
            const cardTitle = document.createElement('summary'); cardTitle.textContent = preset.name; card.appendChild(cardTitle);
            const form = document.createElement('form'); card.appendChild(form);
            const field = (label: string, type: string, value: string) => {
                const row = document.createElement('label'); row.className = 'mm-preset-field'; row.textContent = label;
                const input = document.createElement('input'); input.type = type; input.value = value; input.setAttribute('aria-label', label);
                row.appendChild(input); form.appendChild(row); return input;
            };
            const name = field(t('Preset name'), 'text', preset.name); name.maxLength = 80;
            const color = renderPresetColorPicker(form, preset.color, () => { updatePreview(); save.textContent = t('Save preset'); });
            let boxDraft = {shape: preset.shape, borderColor: preset.borderColor, borderWidth: preset.borderWidth, backgroundColor: preset.backgroundColor};
            const box = renderNodeBoxControls(form, patch => { boxDraft = {...boxDraft, ...patch}; updatePreview(); save.textContent = t('Save preset'); });
            box.setValue(boxDraft);
            const size = field(t('Preset font size'), 'number', preset.fontSize?.toString() || ''); size.min = '8'; size.max = '72';
            const configuredSize = Number(plugin.settings.fontSize);
            const defaultSize = Number.isFinite(configuredSize) && configuredSize > 0 ? configuredSize : 16;
            size.classList.add('mm-preset-font-size');
            size.placeholder = `${t('Default')} (${defaultSize})`;
            size.title = `${t('Global default font size')}: ${defaultSize} px`;
            const sizeHint = document.createElement('div'); sizeHint.className = 'mm-preset-size-hint';
            sizeHint.textContent = `${t('Global default font size')}: ${defaultSize} px`; form.appendChild(sizeHint);
            const toggles: Record<string, HTMLInputElement> = {};
            for (const [key, label] of [['bold', 'Bold'], ['italic', 'Italic'], ['underline', 'Underline'], ['strike', 'Strikethrough']]) {
                const input = field(t(label as any), 'checkbox', ''); input.checked = !!(preset as any)[key]; toggles[key] = input;
            }
            const preview = document.createElement('div'); preview.className = 'mm-node mm-preset-preview'; preview.style.fontSize = defaultSize + 'px';
            const content = document.createElement('div'); content.className = 'mm-node-content'; content.textContent = t('Preset preview'); preview.appendChild(content); form.appendChild(preview);
            const error = document.createElement('p'); error.className = 'mm-preset-error'; error.setAttribute('role', 'alert'); form.appendChild(error);
            const draft = (): NodeStylePreset => ({...preset, ...boxDraft, name: name.value.trim(), color: color.value.trim() || undefined,
                fontSize: size.value ? Number(size.value) : undefined, bold: toggles.bold.checked, italic: toggles.italic.checked, underline: toggles.underline.checked, strike: toggles.strike.checked});
            const updatePreview = () => {
                const value = normalizePresets([{...draft(), name: 'preview'}])[0];
                applyNodeStyle({containEl: preview, data: {stylePreset: 'preview'}, refreshBox() {}}, [value], plugin.settings.defaultNodeStyle);
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
                try { await commit(); cardTitle.textContent = preset.name; error.textContent = ''; save.textContent = t('Preset saved'); }
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
        section.open = true;
        const card = list.lastElementChild as HTMLDetailsElement;
        if (card) { card.open = true; card.querySelector('input')?.focus(); }
    });
    draw();
}
