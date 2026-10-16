/** Shared preset definitions; notes store names, never a snapshot of these values. */
export interface NodeStylePreset {
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
export function styleMarker(name?: string): string {
    return validPresetName(name) ? ` <!-- mm:style ${JSON.stringify({name})} -->` : '';
}
export function readStyleMarker(text: string): {text: string; name?: string} {
    // Only trailing structural metadata; literal markers in code/paragraph bodies stay content.
    const match = /[ \t]*<!-- mm:style (\{[^\n]*?\}) -->(?=[ \t]*(?:<!-- mm:(?:node|summary|item) [^\n]*? -->[ \t]*)?$)/.exec(text);
    if (!match) return {text};
    try {
        const meta = JSON.parse(match[1]);
        if (Object.keys(meta).length !== 1 || !validPresetName(meta.name)) return {text};
        return {text: text.slice(0, match.index) + text.slice(match.index + match[0].length), name: meta.name};
    } catch (_) { return {text}; }
}
export function applyNodeStyle(node: any, presets: NodeStylePreset[]) {
    const preset = findPreset(presets, node.data.stylePreset);
    const style = node.containEl.style;
    for (const key of ['color','font-size','weight','italic','decoration']) style.removeProperty('--mm-preset-' + key);
    node.containEl.classList.toggle('mm-preset-node', !!preset);
    node.containEl.classList.toggle('mm-preset-color', !!preset?.color);
    node.containEl.classList.toggle('mm-preset-size', !!preset?.fontSize);
    if (preset) {
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
