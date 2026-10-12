import { selectionRoots } from '../mindmap/selection';
export function validateSummary(nodes: any[], mainRoot: any): { members: any[]; error: string } {
    const members = selectionRoots(nodes);
    if (!members.length) return { members, error: 'Select at least one node' };
    if (members.some(n => n === mainRoot || n.data.summaryRoot || n.data.summaryTree)) return { members, error: 'Select nodes in the main tree' };
    const parent = members[0].parent;
    if (!parent || members.some(n => n.parent !== parent)) return { members, error: 'Summary members must have the same parent' };
    const side = members[0].direct;
    if (!['left', 'right'].includes(side) || members.some(n => n.direct !== side)) return { members, error: 'Summary members must be on the same side' };
    members.sort((a, b) => parent.children.indexOf(a) - parent.children.indexOf(b));
    const first = parent.children.indexOf(members[0]);
    if (members.some((n, i) => parent.children.indexOf(n) !== first + i)) return { members, error: 'Summary members must be consecutive siblings' };
    return { members, error: '' };
}
