import { NodeStylePreset, LocalNodeStyle } from './nodeStyles';
export class MindMapSettings {
    viewHistoryIdleSeconds = 5;
    viewHistoryDistancePercent = 25;
    defaultNodeStyle: LocalNodeStyle = {};
    nodeStylePresets: NodeStylePreset[] = [];
    theme:string = 'dark';
    canvasSize:number = 8000;
    background:string = 'transparent';
    fontSize:number = 16;
    headLevel:number = 2;
    layout:string="mindmap";
    layoutDirect:string = 'mindmap'
    color?:string;
    exportMdModel?:string;
    //strokeArray?:string=''
    strokeArray?:any[];
    focusOnMove:boolean;
}
