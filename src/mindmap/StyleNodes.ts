import { Command } from './Cmds';
import { applyNodeStyle } from '../nodeStyles';

/** Style assignments are one map history operation, including batch selection. */
export default class StyleNodes extends Command {
    assignments: {id: string; before?: string}[];
    constructor(private map: any, nodes: any[], private preset?: string) {
        super('styleNodes');
        this.assignments = nodes.map(node => ({id: node.getId(), before: node.data.stylePreset}));
    }
    set(before: boolean) {
        this.assignments.forEach(entry => {
            const node = this.map.getNodeById(entry.id);
            if (!node) return;
            const name = before ? entry.before : this.preset;
            if (name) node.data.stylePreset = name;
            else delete node.data.stylePreset;
            applyNodeStyle(node, this.map.setting.nodeStylePresets || []);
        });
        this.map.refresh();
        this.map.emit('mindMapChange');
        this.map.emit('toolbarChange');
    }
    execute() {
        if (!this.assignments.some(entry => entry.before !== this.preset)) return false;
        this.set(false); return true;
    }
    undo() { this.set(true); }
}
