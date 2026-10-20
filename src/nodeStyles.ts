/** Shared preset definitions; notes store names, never a snapshot of these values. */
export interface NodeStylePreset {
    shape?: "none" | "rectangle" | "rounded" | "pill";
    borderColor?: string;
    borderWidth?: number;
    backgroundColor?: string;
    name: string;
    aliases?: string[];
    color?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
}
export function validPresetName(value: unknown): value is string {
    return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 80 && !/[\r\n\x00-\x1f<>]/.test(value);
}
export function normalizePresets(value: unknown): NodeStylePreset[] {
    if (!Array.isArray(value)) return [];
    const used = new Set<string>();
    return value.filter(p => p && validPresetName(p.name) && !used.has(p.name) && !!used.add(p.name)).map(p => ({
        ...normalizeNodeBoxStyle(p),
        name: p.name,
        aliases: Array.isArray(p.aliases) ? p.aliases.filter((a: unknown) => validPresetName(a) && a !== p.name) : [],
        color: /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : undefined,
        fontSize: Number.isFinite(p.fontSize) && p.fontSize >= 8 && p.fontSize <= 72 ? p.fontSize : undefined,
        bold: p.bold === true, italic: p.italic === true, underline: p.underline === true, strike: p.strike === true
    }));
}
export function findPreset(presets: NodeStylePreset[], name: string): NodeStylePreset | undefined {
    return presets.find(p => p.name === name) || presets.find(p => p.aliases?.includes(name));
}
export function renamePreset(presets: NodeStylePreset[], preset: NodeStylePreset, name: string): boolean {
    if (!validPresetName(name) || presets.some(p => p !== preset && (p.name === name || p.aliases?.includes(name)))) return false;
    if (name !== preset.name) {
        preset.aliases = Array.from(new Set([...(preset.aliases || []), preset.name])).filter(alias => alias !== name);
        preset.name = name;
    }
    return true;
}
export interface LocalNodeStyle extends Pick<NodeStylePreset, "shape" | "borderColor" | "borderWidth" | "backgroundColor"> { color?: string; fontSize?: number | null; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean }
/** Keep box properties optional so older notes retain their appearance. */
export function normalizeNodeBoxStyle(value: any) {
    const result: Pick<NodeStylePreset, 'shape' | 'borderColor' | 'borderWidth' | 'backgroundColor'> = {};
    if (!value || typeof value !== 'object') return result;
    if (['none','rectangle','rounded','pill'].includes(value.shape)) result.shape = value.shape;
    for (const key of ['borderColor','backgroundColor'] as const) {
        if (value[key] === '' || /^#[0-9a-f]{6}$/i.test(value[key] || '')) result[key] = value[key];
    }
    if (Number.isInteger(value.borderWidth) && value.borderWidth >= 1 && value.borderWidth <= 4) result.borderWidth = value.borderWidth;
    return result;
}
export function normalizeNodeStyle(value: any): LocalNodeStyle | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const result: any = {...normalizeNodeBoxStyle(value)};
    if (value.color === '' || /^#[0-9a-f]{6}$/i.test(value.color || '')) result.color = value.color;
    if (value.fontSize === null || (Number.isFinite(value.fontSize) && value.fontSize >= 8 && value.fontSize <= 72)) result.fontSize = value.fontSize;
    for (const key of ['bold','italic','underline','strike']) if (typeof value[key] === 'boolean') result[key] = value[key];
    return Object.keys(result).length ? result : undefined;
}
export function effectiveNodeStyle(node: any, presets: NodeStylePreset[]) {
    return {...findPreset(presets, node.data.stylePreset), ...normalizeNodeStyle(node.data.nodeStyle)};
}
/** Snapshot node-wide properties only; inline text markup and preset aliases are excluded. */
export function snapshotNodeStyle(node: any, presets: NodeStylePreset[]) {
    const style = effectiveNodeStyle(node, presets);
    return {
        ...normalizeNodeBoxStyle(style),
        color: /^#[0-9a-f]{6}$/i.test(style.color || '') ? style.color : undefined,
        fontSize: typeof style.fontSize === 'number' ? style.fontSize : undefined,
        bold: style.bold === true, italic: style.italic === true,
        underline: style.underline === true, strike: style.strike === true
    };
}
export function styleMarker(name?: string, overrides?: LocalNodeStyle): string {
    const local = normalizeNodeStyle(overrides);
    const meta = {...(validPresetName(name) ? {name} : {}), ...(local ? {overrides: local} : {})};
    return Object.keys(meta).length ? ` <!-- mm:style ${JSON.stringify(meta)} -->` : '';
}
export function readStyleMarker(text: string): {text: string; name?: string; overrides?: LocalNodeStyle} {
    // Only trailing structural metadata; literal markers in code/paragraph bodies stay content.
    const match = /[ \t]*<!-- mm:style (\{[^\n]*?\}) -->(?=[ \t]*(?:<!-- mm:(?:node|summary|item) [^\n]*? -->[ \t]*)?$)/.exec(text);
    if (!match) return {text};
    try {
        const meta = JSON.parse(match[1]);
        if (!meta || Object.keys(meta).some(key => !['name','overrides'].includes(key)) || (!validPresetName(meta.name) && !meta.overrides) || (meta.name !== undefined && !validPresetName(meta.name))) return {text};
        const overrides = normalizeNodeStyle(meta.overrides);
        if (meta.overrides !== undefined && (!overrides || Object.keys(meta.overrides).some(key => (overrides as any)[key] !== meta.overrides[key]))) return {text};
        return {text: text.slice(0, match.index) + text.slice(match.index + match[0].length), name: meta.name, overrides};
    } catch (_) { return {text}; }
}
export function applyNodeStyle(node: any, presets: NodeStylePreset[]) {
    const base = findPreset(presets, node.data.stylePreset);
    const preset = base || normalizeNodeStyle(node.data.nodeStyle) ? effectiveNodeStyle(node, presets) : undefined;
    const style = node.containEl.style;
    for (const key of ['color','font-size','weight','italic','decoration','border-color','border-width','radius','background']) style.removeProperty('--mm-preset-' + key);
    node.containEl.classList.toggle('mm-preset-node', !!preset);
    node.containEl.classList.toggle('mm-preset-color', !!preset?.color);
    node.containEl.classList.toggle('mm-preset-size', !!preset?.fontSize);
    node.containEl.classList.toggle('mm-box-shape', !!preset?.shape);
    node.containEl.classList.toggle('mm-box-border', !!preset?.shape && preset.shape !== 'none');
    node.containEl.classList.toggle('mm-box-fill', preset?.backgroundColor !== undefined);
    if (preset) {
        style.setProperty('--mm-preset-border-color', preset.borderColor || 'var(--text-normal, currentColor)');
        style.setProperty('--mm-preset-border-width', (preset.borderWidth || 1) + 'px');
        style.setProperty('--mm-preset-radius', preset.shape === 'pill' ? '999px' : preset.shape === 'rounded' ? '8px' : '0px');
        style.setProperty('--mm-preset-background', preset.backgroundColor || 'transparent');
        if (preset.color) style.setProperty('--mm-preset-color', preset.color);
        if (preset.fontSize) style.setProperty('--mm-preset-font-size', preset.fontSize + 'px');
        style.setProperty('--mm-preset-weight', preset.bold ? '700' : 'normal');
        style.setProperty('--mm-preset-italic', preset.italic ? 'italic' : 'normal');
        style.setProperty('--mm-preset-decoration', [preset.underline ? 'underline' : '', preset.strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none');
    }
    node.boundingRect = null;
    node.refreshBox();
    node.clearCacheData?.();
}
