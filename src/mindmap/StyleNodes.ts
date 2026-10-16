import { Command } from './Cmds';
import { applyNodeStyle, normalizeNodeStyle } from '../nodeStyles';

/** Style assignments are one map history operation, including batch selection. */
export default class StyleNodes extends Command {
    assignments: {id: string; before?: string; local?: any}[];
    constructor(private map: any, nodes: any[], private preset?: string) {
        super('styleNodes');
        this.assignments = nodes.map(node => ({id: node.getId(), before: node.data.stylePreset, local: node.data.nodeStyle ? {...node.data.nodeStyle} : undefined}));
    }
    set(before: boolean) {
        this.assignments.forEach(entry => {
            const node = this.map.getNodeById(entry.id);
            if (!node) return;
            const name = before ? entry.before : this.preset;
            if (name) node.data.stylePreset = name;
            else delete node.data.stylePreset;
            if (before && entry.local) node.data.nodeStyle = {...entry.local};
            else delete node.data.nodeStyle;
            applyNodeStyle(node, this.map.setting.nodeStylePresets || []);
        });
        this.map.refresh();
        this.map.emit('mindMapChange');
        this.map.emit('toolbarChange');
    }
    execute() {
        if (!this.assignments.some(entry => entry.before !== this.preset || entry.local)) return false;
        this.set(false); return true;
    }
    undo() { this.set(true); }
}

export class ChangeNodeStyle extends Command {
    changes: {id: string; before?: any; after?: any}[];
    constructor(private map: any, nodes: any[], patch?: any) {
        super('changeNodeStyle');
        this.changes = nodes.map(node => ({id: node.getId(), before: normalizeNodeStyle(node.data.nodeStyle),
            after: patch === undefined ? undefined : normalizeNodeStyle({...node.data.nodeStyle, ...patch})}));
    }
    set(before: boolean) {
        this.changes.forEach(change => {
            const node = this.map.getNodeById(change.id); if (!node) return;
            const value = before ? change.before : change.after;
            if (value) node.data.nodeStyle = {...value}; else delete node.data.nodeStyle;
            applyNodeStyle(node, this.map.setting.nodeStylePresets || []);
        });
        this.map.refresh(); this.map.emit('mindMapChange'); this.map.emit('toolbarChange');
    }
    execute() { if (!this.changes.some(c => JSON.stringify(c.before) !== JSON.stringify(c.after))) return false; this.set(false); return true; }
    undo() { this.set(true); }
}
