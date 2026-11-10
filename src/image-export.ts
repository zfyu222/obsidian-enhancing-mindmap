/** Flatten transparent canvas layers over the same ancestor backgrounds the user sees. */
export function exportBackground(element: HTMLElement) {
  const layers: HTMLElement[] = [];
  for (let current: HTMLElement | null = element; current; current = current.parentElement) layers.unshift(current);
  const canvas = element.ownerDocument.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, 1, 1);
  const win = element.ownerDocument.defaultView!;
  layers.forEach(layer => {
    context.fillStyle = win.getComputedStyle(layer).backgroundColor;
    context.fillRect(0, 0, 1, 1);
  });
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  return `rgb(${red}, ${green}, ${blue})`;
}

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
  const background = exportBackground(map.contentEL);
  const host = map.contentEL.ownerDocument.createElement('div');
  Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', pointerEvents: 'none' });
  const crop = host.ownerDocument.createElement('div');
  Object.assign(crop.style, { position: 'relative', overflow: 'hidden', width: `${width}px`, height: `${height}px`,
    background });
  const clone = map.contentEL.cloneNode(true) as HTMLElement;
  // Its background color is already flattened into the crop, including any alpha.
  Object.assign(clone.style, { position: 'absolute', left: `${-left}px`, top: `${-top}px`,
    width: `${map.contentEL.offsetWidth}px`, height: `${map.contentEL.offsetHeight}px`, transform: 'none', backgroundColor: 'transparent' });
  const sourceImages = map.contentEL.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
  const images: HTMLImageElement[] = [];
  clone.querySelectorAll('img').forEach((image, index) => {
    const source = sourceImages[index];
    if (!source.getClientRects().length) return;
    const style = source.ownerDocument.defaultView!.getComputedStyle(source);
    // A fresh offscreen clone has no intrinsic size until decoding finishes.
    image.style.width = style.width;
    image.style.height = style.height;
    image.removeAttribute('srcset');
    image.loading = 'eager';
    image.src = source.currentSrc || source.src;
    images.push(image);
  });
  clone.querySelectorAll('.mm-node-select, .mm-edit-node').forEach(el => el.classList.remove('mm-node-select', 'mm-edit-node'));
  clone.querySelectorAll('.mm-node-menu, .mm-node-layout-indicate, .mm-selection-rectangle').forEach(el => el.remove());
  crop.appendChild(clone);
  host.appendChild(crop);
  map.containerEL.appendChild(host);
  return { element: crop, width, height, background,
    ready: async () => { await Promise.all(images.map(image => image.decode())); },
    remove: () => host.remove() };
}

export function imageFilename(path: string, pageName: string, format: string) {
  const base = path.split('/').pop()!.replace(/\.md$/i, '');
  const page = pageName ? '-' + pageName : '';
  return (base + page).replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').replace(/[. ]+$/, '') + '.' + format;
}
