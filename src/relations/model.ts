export interface RelationData { id: string; from: string; to: string }
export function validateRelations(value: any): RelationData[] {
    if (!Array.isArray(value) || value.length > 10000) throw Error('Invalid relations');
    const ids = new Set<string>(), pairs = new Set<string>();
    return value.map(link => {
        if (!link || Object.keys(link).some(key => !['id','from','to'].includes(key)) ||
            ['id','from','to'].some(key => typeof link[key] !== 'string' || !/^[\w-]{1,128}$/.test(link[key])) ||
            link.from === link.to || ids.has(link.id) || pairs.has(link.from + ':' + link.to)) throw Error('Invalid relation');
        ids.add(link.id); pairs.add(link.from + ':' + link.to);
        return {id:link.id,from:link.from,to:link.to};
    });
}
/** Only standalone structural comments outside fenced code are metadata. */
export function extractRelations(markdown: string) {
    const raw: string[] = [], main: string[] = []; let fence = '';
    for (const line of markdown.split('\n')) {
        const delimiter = /^\s*(`{3,}|~{3,})/.exec(line);
        if (delimiter) { if (!fence) fence = delimiter[1][0]; else if (delimiter[1][0] === fence) fence = ''; }
        if (!fence && !delimiter && line.startsWith('<!-- mm:relations ')) raw.push(line);
        else main.push(line);
    }
    if (!raw.length) return {main:markdown,entries:[] as RelationData[],preserved:'',raw:''};
    const original = raw.join('\n');
    try {
        if (raw.length !== 1 || !raw[0].endsWith(' -->')) throw Error('Malformed relations');
        const meta = JSON.parse(raw[0].slice('<!-- mm:relations '.length,-4));
        if (!meta || meta.version !== 1 || Object.keys(meta).some(key=>!['version','links'].includes(key))) throw Error('Unknown relations');
        return {main:main.join('\n'),entries:validateRelations(meta.links),preserved:'',raw:original};
    } catch (_) { return {main:main.join('\n'),entries:[] as RelationData[],preserved:original,raw:original}; }
}
export function relationsMarkdown(links: RelationData[]) {
    return links.length ? '<!-- mm:relations ' + JSON.stringify({version:1,links}) + ' -->' : '';
}
/** Attach to rectangle boundaries and keep the curve outside the node text. */
export function relationCurve(a: {x:number;y:number;width:number;height:number}, b: {x:number;y:number;width:number;height:number}) {
    const ac = {x:a.x+a.width/2,y:a.y+a.height/2}, bc = {x:b.x+b.width/2,y:b.y+b.height/2};
    const dx = bc.x-ac.x, dy = bc.y-ac.y;
    let start: {x:number;y:number}, end: {x:number;y:number}, c1: {x:number;y:number}, c2: {x:number;y:number};
    if (Math.abs(dx) > Math.abs(dy)) {
        const s=dx>=0?1:-1, bend=Math.max(32,Math.abs(dx)/2);
        start={x:s>0?a.x+a.width:a.x,y:ac.y}; end={x:s>0?b.x:b.x+b.width,y:bc.y};
        c1={x:start.x+s*bend,y:start.y};c2={x:end.x-s*bend,y:end.y};
    } else {
        const s=dy>=0?1:-1, bend=Math.max(32,Math.abs(dy)/2);
        start={x:ac.x,y:s>0?a.y+a.height:a.y};end={x:bc.x,y:s>0?b.y:b.y+b.height};
        c1={x:start.x,y:start.y+s*bend};c2={x:end.x,y:end.y-s*bend};
    }
    const angle=Math.atan2(end.y-c2.y,end.x-c2.x), ux=Math.cos(angle),uy=Math.sin(angle);
    return {path:`M ${start.x} ${start.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`,
        arrow:`M ${end.x} ${end.y} L ${end.x-ux*9-uy*4} ${end.y-uy*9+ux*4} L ${end.x-ux*9+uy*4} ${end.y-uy*9-ux*4} Z`};
}
