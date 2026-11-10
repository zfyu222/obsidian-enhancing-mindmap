/** Capture a cropped copy so exporting never moves the live graph or its viewport. */
export function imageSnapshot(map: any) {
  const boxes: any[] = [];
  map.traverseAll((node: any) => { if (node.isShow()) boxes.push(node.getBox()); });
  const svg = map.contentEL.querySelector('svg');
  if (svg) {
    const box = svg.getBBox();
    if (box.width || box.height) boxes.push(box);
  }
  if (!boxes.length) throw new Error('Empty mind map');
  const left = Math.min(...boxes.map(box => box.x)) - 60;
  const top = Math.min(...boxes.map(box => box.y)) - 60;
  const width = Math.ceil(Math.max(...boxes.map(box => box.x + box.width)) - left + 60);
  const height = Math.ceil(Math.max(...boxes.map(box => box.y + box.height)) - top + 60);
  const host = map.contentEL.ownerDocument.createElement('div');
  Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', pointerEvents: 'none' });
  const crop = host.ownerDocument.createElement('div');
  Object.assign(crop.style, { position: 'relative', overflow: 'hidden', width: `${width}px`, height: `${height}px`,
    background: getComputedStyle(map.contentEL).backgroundColor });
  const clone = map.contentEL.cloneNode(true) as HTMLElement;
  Object.assign(clone.style, { position: 'absolute', left: `${-left}px`, top: `${-top}px`,
    width: `${map.contentEL.offsetWidth}px`, height: `${map.contentEL.offsetHeight}px`, transform: 'none' });
  clone.querySelectorAll('.mm-node-select, .mm-edit-node').forEach(el => el.classList.remove('mm-node-select', 'mm-edit-node'));
  clone.querySelectorAll('.mm-node-menu, .mm-node-layout-indicate, .mm-selection-rectangle').forEach(el => el.remove());
  crop.appendChild(clone);
  host.appendChild(crop);
  map.containerEL.appendChild(host);
  return { element: crop, width, height, remove: () => host.remove() };
}

export function imageFilename(path: string, pageName: string, format: string) {
  const base = path.split('/').pop()!.replace(/\.md$/i, '');
  const page = pageName ? '-' + pageName : '';
  return (base + page).replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').replace(/[. ]+$/, '') + '.' + format;
}
