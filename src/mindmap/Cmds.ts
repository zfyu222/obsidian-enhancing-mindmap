import INode from './INode'
import MindMap  from './mindmap';
import { selectionRoots, containsNode } from './selection';

export abstract class Command {
    name:string;
    mind?:any;
    constructor(name:string) {
        this.name = name;
    }
    execute(): boolean {return false}
    undo() {}
    redo() {
        this.execute();
    }
    refresh(mind?:any){
            var m = mind||this.mind;
            if(m){
                m.emit('renderEditNode',{});
                m.emit('mindMapChange',{});
            }
    }
}

export class AddNode extends Command {
    node:INode;
    parent:INode = null;
    mind:MindMap =null;
    index:number = -1;
    constructor(node:INode, parent:INode, mind?:MindMap) {
        super('addNode');
        this.node = node;
        this.parent = parent;
        this.mind = mind||this.node.mindmap;
    }
    execute():boolean {
        if (this.index > -1) {
            this.mind.addNode(this.node, this.parent, this.index);   //add node to position of parent children
        } else {
            this.mind.addNode(this.node, this.parent);
        }
        this.node.refreshBox();
        this.refresh();
        this.mind.clearSelectNode();
        setTimeout(()=>{
            this.node.select();
            this.node.edit();
        },0);
        return true; //exit with no error
    }

    undo() {
        var p = this.node.parent;
        this.index = this.mind.removeNode(this.node);
        this.mind.clearSelectNode();
        setTimeout(()=>{
            this.refresh();
            p&&p.select();
        },0)
    }
}


export class RemoveNode extends Command {
    node:INode;
    parent:INode = null;
    mind:MindMap =null;
    index:number = -1;
    constructor(node:INode, mind?:MindMap) {
        super('removeNode');
        this.node = node;
        this.parent = this.node.parent||null;
        this.mind = mind||this.node.mindmap;
    }
    execute():boolean {
        if(this.node.data.isRoot == true){
            return false;
        }
        this.node.clearCacheData();
        this.mind.clearSelectNode();
        this.index = this.mind.removeNode(this.node);
        this.refresh();
        this.parent && this.parent.select();
        return true; //exit with no error
    }

    undo() {
        this.mind.addNode(this.node, this.parent, this.index);
        this.node.clearCacheData();
        this.node.refreshBox();
        this.mind.clearSelectNode();
        this.refresh();
        setTimeout(()=>{
            this.node.select();
        },0)
    }
}


export class ChangeNodeText extends Command {
    node:INode;
    oldText:string;
    text:string;
    isFirst:boolean;
    constructor(node:INode, oldText:string, text:string) {
        super('changeNodeText');
        this.node = node;
        this.oldText = oldText;
        this.text = text;
        this.isFirst = true;
    }
    execute():boolean {
        //if(!this.isFirst){
            this.node.setText(this.text);
        //}
        this.node.refreshBox();
        this.node.clearCacheData();
        this.refresh(this.node.mindmap);
        return true; //exit with no error
    }
    undo() {
        this.node.setText(this.oldText);
        this.node.clearCacheData();
        this.node.refreshBox();
        this.refresh(this.node.mindmap);
        this.isFirst =false;
    }
}

export class MoveNode extends Command {
    data:any={};
    node:INode;
    oldParent:INode;
    parent:INode;
    newParent?:INode;
    dropNode?:INode;
    type?:string;
    index:number = -1;
    constructor(data:any) {
        super('moveNode');
        this.data = data;
        if (this.data.type.indexOf('child') > -1) {
            this.node = this.data.node;
            this.oldParent = this.data.oldParent;
            this.parent = this.data.parent;
        } else {
            this.node = this.data.node;
            this.oldParent = this.node.parent;
            this.dropNode = this.data.dropNode;
            this.newParent = this.dropNode.parent;
            this.type = this.data.direct;
        }
    }

    execute():boolean {
        this.node.mindmap.clearSelectNode();
        if (this.data.type.indexOf('child') > -1) {
            if (this.oldParent) {
                this.index = this.oldParent.removeChild(this.node)
            }
            this.parent.addChild(this.node);
            this.node.mindmap.traverseBF((n:INode) => {
                n.boundingRect = null;
                n.stroke = ''
            }, this.node);

            this.node.clearCacheData();
            this.oldParent.clearCacheData();
            this.refresh(this.node.mindmap);
            this.node.select();
        } else {

            if (this.oldParent) {
                this.index = this.oldParent.removeChild(this.node);
            }
            this.node.mindmap.traverseBF((n:INode) => {
                n.boundingRect = null;
                n.stroke = ''
            }, this.node);

            this.oldParent.clearCacheData();
            var dropNodeIndex = this.newParent.children.indexOf(this.dropNode);

            if (this.type == 'top' || this.type == 'left') {
                this.newParent.addChild(this.node, dropNodeIndex)
            }
            else {
                this.newParent.addChild(this.node, dropNodeIndex + 1);
            }

            this.node.clearCacheData();
            this.refresh(this.node.mindmap);
            this.node.select();
        }
        return true; //exit with no error
    }

    undo() {
        this.node.mindmap.clearSelectNode();
        if (this.data.type.indexOf('child') > -1) {
            this.parent.removeChild(this.node);
            if (this.oldParent) {
                this.oldParent.addChild(this.node, this.index);
            }

            this.node.mindmap.traverseBF((n:INode) => {
                n.boundingRect = null;
                n.stroke = ''
            }, this.node);

            this.parent.clearCacheData();
            this.node.clearCacheData();
            this.refresh(this.node.mindmap);
            this.node.select();
        }
        else {
            this.newParent.removeChild(this.node);
            this.dropNode.clearCacheData();
            this.oldParent.addChild(this.node, this.index);
            this.node.clearCacheData();
            this.refresh(this.node.mindmap);
            this.node.select();
        }
    }
}


export class MovePos extends Command {
    node:INode;
    oldPos:any;
    newPos:any;
    constructor(node:INode, oldPos:any, newPos:any) {
        super('movePos');
        this.node = node;
        this.oldPos = oldPos;
        this.newPos = newPos;
    }

    execute():boolean {
        this.node.setPosition(this.newPos.x, this.newPos.y);
        this.refresh(this.node.mindmap);
        return true; //exit with no error
    }

    undo() {
        this.node.setPosition(this.oldPos.x, this.oldPos.y);
        this.refresh(this.node.mindmap);
    }
}

export class CollapseNode extends Command{
   node:INode;
   constructor(node:INode){
       super('collapseNOde')
       this.node = node;
       this.node.mindmap.clearSelectNode();

       this.node.refreshBox();
   }
   execute(){
       this.node.clearCacheData();
       this.node.collapse();
       this.refresh(this.node.mindmap);
       this.node.select();
       return true; //exit with no error
   }
   undo(){
    this.node.clearCacheData();
    this.node.expand();
    this.refresh(this.node.mindmap);
    this.node.select();
   }
}

export class ExpandNode extends Command{
    node:INode;
    constructor(node:INode){
        super('collapseNOde')
        this.node = node;
        this.node.mindmap.clearSelectNode();
        this.node.refreshBox();
    }
    execute(){
        this.node.clearCacheData();
        this.node.expand();
        this.refresh(this.node.mindmap);
        this.node.select();
        return true; //exit with no error
    }
    undo(){
     this.node.clearCacheData();
     this.node.collapse();
     this.refresh(this.node.mindmap);
     this.node.select();
    }
 }


 export class PasteNode extends Command {
    node: INode;
    data: any[];
    firstNode: INode;
    firstNodes: INode[] = [];
    wasExpanded: boolean;
    constructor(node: INode, data: any[]) {
        super('pasteNode');
        this.node = node;
        this.data = data;
        this.mind = node.mindmap;
        this.wasExpanded = node.isExpand;
    }

    execute(): boolean {
        this.firstNodes = [];
        if (!this.node.isExpand) this.node.expand();
        const nodes = new Map<string, INode>();
        const collapsed: INode[] = [];
        this.data.forEach((original: any, i: number) => {
            // INode mutates its data; keep the command payload intact for redo.
            const d = JSON.parse(JSON.stringify(original));
            const n = new INode(d, this.mind);
            const parent = d.pid == null ? this.node : nodes.get(d.pid);
            if (d.pid == null) this.firstNodes.push(n);
            d.pid = parent.getId();
            this.mind.addNode(n, parent);
            nodes.set(d.id, n);
            if (i === 0) this.firstNode = n;
            if (d.isExpand === false || d.expanded === false) collapsed.push(n);
            n.setPosition(0, 0);
            n.refreshBox();
        });
        // Collapse after attaching all descendants, so they are hidden together.
        collapsed.forEach(n => n.collapse());
        this.node.clearCacheData();
        this.refresh();
        return true;
    }

    undo() {
        if (this.firstNode) {
            let selected = this.mind.selectNode;
            while (selected) {
                if (this.firstNodes.indexOf(selected) >= 0) {
                    this.mind.clearSelectNode();
                    this.node.select();
                    break;
                }
                selected = selected.parent;
            }
            this.firstNodes.forEach(node => this.mind.removeNode(node));
            if (!this.wasExpanded) this.node.collapse();
            this.node.clearCacheData();
            this.refresh();
        }
    }
}

export class RemoveNodes extends Command {
    entries: { node: INode; parent: INode; index: number }[];
    constructor(nodes: INode[]) {
        super('removeNodes');
        const roots = selectionRoots(nodes).filter(node => !!node.parent && !node.data.isRoot);
        this.entries = roots.map(node => ({ node, parent: node.parent, index: node.parent.children.indexOf(node) }));
        this.mind = roots[0]?.mindmap;
    }
    execute(): boolean {
        if (!this.entries.length) return false;
        this.mind.clearSelectNode();
        this.entries.forEach(({ node }) => this.mind.removeNode(node));
        this.entries[0].parent.select();
        this.refresh();
        return true;
    }
    undo() {
        // Original order is significant when restoring siblings to the same parent.
        this.entries.slice().sort((a, b) => a.index - b.index).forEach(({ node, parent, index }) => this.mind.addNode(node, parent, index));
        this.mind.setSelectedNodes(this.entries.map(entry => entry.node));
        this.refresh();
    }
}

export class MoveNodes extends Command {
    entries: { node: INode; parent: INode; index: number; direct: string }[];
    drop: INode;
    type: string;
    destination: INode;
    expanded: boolean;
    constructor(nodes: INode[], drop: INode, type: string) {
        super('moveNodes');
        this.drop = drop;
        this.type = type;
        const roots = selectionRoots(nodes);
        this.entries = roots.map(node => ({ node, parent: node.parent, index: node.parent?.children.indexOf(node), direct: node.direct }));
        this.destination = type.indexOf('child') >= 0 ? drop : drop.parent;
        this.expanded = this.destination?.isExpand;
        this.mind = drop.mindmap;
    }
    execute(): boolean {
        if (!this.entries.length || !this.destination || this.entries.some(({ node }) => !node.parent || containsNode(node, this.drop))) return false;
        this.mind.clearSelectNode();
        this.entries.forEach(({ node }) => this.mind.removeNode(node));
        const child = this.type.indexOf('child') >= 0;
        let index = child ? this.destination.children.length : this.destination.children.indexOf(this.drop) + (this.type === 'top' || this.type === 'left' ? 0 : 1);
        this.destination.expand();
        this.entries.forEach(({ node }) => {
            this.mind.addNode(node, this.destination, index++);
            if (child && this.type.split('-')[1]) node.direct = this.type.split('-')[1];
            this.mind.traverseBF((n: INode) => { n.boundingRect = null; n.stroke = ''; }, node);
        });
        this.mind.setSelectedNodes(this.entries.map(entry => entry.node));
        this.refresh();
        return true;
    }
    undo() {
        this.mind.clearSelectNode();
        this.entries.forEach(({ node }) => this.mind.removeNode(node));
        this.entries.slice().sort((a, b) => a.index - b.index).forEach(({ node, parent, index, direct }) => {
            this.mind.addNode(node, parent, index);
            node.direct = direct;
            this.mind.traverseBF((n: INode) => { n.boundingRect = null; n.stroke = ''; }, node);
        });
        if (!this.expanded) this.destination.collapse();
        this.mind.setSelectedNodes(this.entries.map(entry => entry.node));
        this.refresh();
    }
}
