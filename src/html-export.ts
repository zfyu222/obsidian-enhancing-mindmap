function exportHtmlEscape(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}

/** The styled, resource-inlined DOM from dom-to-image's onclone hook, without rasterization. */
export function standaloneHtml(fragment: HTMLElement, title: string, width: number, height: number,
  labels: { fit: string; reset: string; zoomIn: string; zoomOut: string }) {
  const clone = fragment.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script, iframe, object, embed, base, meta, link, form, input, button, textarea, video, audio, source, template, animate, set, animateTransform, animateMotion, .mm-node-bar, .mm-node-resize, .mm-relation-hit').forEach(el => el.remove());
  [clone, ...Array.from(clone.querySelectorAll('*'))].forEach(el => {
    Array.from(el.attributes).forEach(attribute => {
      const name = attribute.name.toLowerCase(), value = attribute.value.trim();
      if (name.startsWith('on') || ['contenteditable', 'draggable', 'tabindex', 'autofocus', 'srcdoc', 'srcset', 'ping', 'nonce'].includes(name)) el.removeAttribute(attribute.name);
      if (['href', 'xlink:href', 'src'].includes(name) && !/^(?:#|data:image\/|https?:\/\/|mailto:)/i.test(value)) el.removeAttribute(attribute.name);
    });
    if (el.tagName.toLowerCase() === 'a') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  });
  // Only numeric geometry enters the viewer script; note text stays in escaped DOM.
  width = Math.max(1, Math.ceil(width)); height = Math.max(1, Math.ceil(height));
  if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error('Invalid export dimensions');
  const nonce = Array.from(fragment.ownerDocument.defaultView!.crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${exportHtmlEscape(title)}</title>
<style>
html,body{margin:0;height:100%;font:14px system-ui,sans-serif;background:#f1f3f5;color:#20252b}
body{display:flex;flex-direction:column}header{display:flex;gap:8px;align-items:center;padding:12px 16px;background:#fff;border-bottom:1px solid #ddd;flex-wrap:wrap;z-index:1}
h1{font-size:15px;font-weight:600;margin:0 auto 0 0;overflow-wrap:anywhere}button{font:inherit;background:#fff;border:1px solid #ccd1d7;border-radius:6px;padding:6px 12px;cursor:pointer}button:hover{background:#f1f3f5}
#mm-export-viewport{flex:1;min-height:0;overflow:auto;padding:24px;box-sizing:border-box}
#mm-export-stage{position:relative;margin:auto}#mm-export-map{position:absolute;left:0;top:0;transform-origin:0 0;box-shadow:0 4px 24px #0001}
#mm-export-map,#mm-export-map *{pointer-events:auto!important}
#mm-export-map .mm-node{cursor:default!important}#mm-export-map .mm-node-content,#mm-export-map .mm-node-content *{user-select:text!important;-webkit-user-select:text!important}
#mm-export-map pre{overflow-x:auto!important}
@media print{header{display:none}#mm-export-viewport{overflow:visible;padding:0}#mm-export-map{transform:none!important;box-shadow:none}}
</style></head><body>
<header><h1>${exportHtmlEscape(title)}</h1><button id="mm-export-minus" aria-label="${exportHtmlEscape(labels.zoomOut)}">−</button><output id="mm-export-zoom" aria-live="polite"></output><button id="mm-export-plus" aria-label="${exportHtmlEscape(labels.zoomIn)}">+</button><button id="mm-export-reset">${exportHtmlEscape(labels.reset)}</button><button id="mm-export-fit">${exportHtmlEscape(labels.fit)}</button></header>
<main id="mm-export-viewport"><div id="mm-export-stage"><div id="mm-export-map">${clone.outerHTML}</div></div></main>
<script nonce="${nonce}">
(()=>{const width=${width},height=${height};
const viewport=document.getElementById('mm-export-viewport'),stage=document.getElementById('mm-export-stage'),map=document.getElementById('mm-export-map'),zoom=document.getElementById('mm-export-zoom');
let scale=1,fitted=true;
function apply(value){scale=Math.max(.01,Math.min(4,value));stage.style.width=(width*scale)+'px';stage.style.height=(height*scale)+'px';map.style.transform='scale('+scale+')';zoom.textContent=Math.round(scale*100)+'%';}
function fit(){fitted=true;apply(Math.min(1,(viewport.clientWidth-48)/width,(viewport.clientHeight-48)/height));viewport.scrollTo(0,0);}
document.getElementById('mm-export-plus').onclick=()=>{fitted=false;apply(scale*1.2)};
document.getElementById('mm-export-minus').onclick=()=>{fitted=false;apply(scale/1.2)};
document.getElementById('mm-export-reset').onclick=()=>{fitted=false;apply(1)};
document.getElementById('mm-export-fit').onclick=fit;
window.addEventListener('resize',()=>{if(fitted)fit()});fit();
})();
</script></body></html>`;
}
