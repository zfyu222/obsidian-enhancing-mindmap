# obsidian-enhancing-mindmap-plugin

This fork is maintained for the [OBSB project](https://github.com/zfyu222/OBSB).
Install BRAT from Obsidian's Community Plugins, add
`zfyu222/obsidian-enhancing-mindmap`, and select the latest release (or a specific
beta tag). Releases contain the compiled `main.js`, `manifest.json` and `styles.css`.
The plugin ID is unchanged, so this fork replaces an existing installation of
Enhancing Mindmap in the same vault.

Since 0.2.6-beta.4, deleting all text keeps an empty node and its children.
Empty headings/list items remain ordinary Markdown and survive reopening,
including collapsed nodes. Text changes support undo/redo; empty nodes retain
a minimum clickable size. Update through BRAT to beta.4 or later.

Since 0.2.6-beta.5, drag with the right mouse button to pan the canvas;
left dragging selects nodes. Ctrl/Cmd+V accepts regular clipboard text and images:
each nonempty text line and each image becomes a child of the selected node (or
root when nothing is selected). One paste is one undo. Internal node clipboard
payloads keep their subtree behavior; editing text retains native paste.
Images are saved using Obsidian's configured attachment location and embedded as
Markdown links. Image attachments remain after undo for redo and existing links.
Image paste requires Obsidian 1.5.7+; clipboard image availability also depends on
the platform. Browser fixture tests simulate the clipboard and vault API.

Since 0.2.6-beta.6, clicking inside a node's text editor places the caret
without refocusing the node container. Double-clicking selects words normally,
and editing temporarily disables node dragging. Clicking another node still
commits text changes, which can be undone.

Since 0.2.6-beta.7, Ctrl/Cmd+Z removes a just-created node from its automatic
editor if its text is unchanged. Typed content keeps native text undo; when that
returns to the initial content, another undo removes the node. Fast undo cancels
the pending editor callback and synchronously restores parent selection.

For releases, update `manifest.json`, `package.json` and `versions.json` together,
run `npm ci --ignore-scripts`, `npm test`, `npm run build` and `npm run test:bundle`, then commit and push.
Push a tag matching the version exactly, without a `v` prefix. The release
workflow validates versions, tests, builds and uploads BRAT assets; tags with
a prerelease suffix are published as prereleases. Compiled `main.js` remains
an upstream tracked file; release builds are generated from source, not that file.
[English](https://github.com/MarkMindCkm/obsidian-enhancing-mindmap) [中文](https://github.com/MarkMindCkm/obsidian-enhancing-mindmap/blob/main/Readme-zh.md)

![test](https://user-images.githubusercontent.com/18719494/124454742-63ec8580-ddbb-11eb-8da0-7cd44f38a225.gif)

## Will output this markdown:

```
---

mindmap-plugin: basic

---

# Enhancing Mind map

## Links
- <https://github.com/MarkMindLtd/obsidian-enhancing-mindmap>
- [GitHub](https://github.com/MarkMindLtd/obsidian-enhancing-mindmap)

## Related
- [coc-markmap](https://github.com/gera2ld/coc-markmap)
- [gatsby-remark-markmap](https://github.com/gera2ld/gatsby-remark-markmap)

## Features
- links
- **inline** ~~text~~ *styles*
- multiline
   text
- `inline code`
- Katex - $x = {-b \pm \sqrt{b^2-4ac} \over 2a}$
```

### notice

The plug-in only support a limited markdown format 

## Short cuts

| New Mind Map              | Ctrl/Cmd+P       |
| ------------------------- | ---------------- |
| New child node            | Tab              |
| New brother node          | enter            |
| Delete node               | Delete           |
| Copy node and subtree     | Ctrl/Cmd+C       |
| Paste subtree as child    | Ctrl/Cmd+V       |
| edit node                 | Space/dblclick node|
| Undo                      | Ctrl/Cmd+Z       |
| Redo                      | Ctrl/Cmd+Y       |
| Quit edit node            | Tab              |
| Expand node               | Ctrl/Cmd + /     |
| Collapse node             | Ctrl/Cmd + /     |
| Move node to another node  | Drag and drop node |
| Tab node                 | Up/down/left/right |
| Zoom in/out              | Ctrl/Cmd + mouse wheel|
| Zoom in                  | Ctrl/Cmd + =       |
| Zoom out                 | Ctrl/Cmd + -       |
| mind map to center          | Ctrl/Cmd + E |

Select a node and press Ctrl/Cmd+C, then select a destination node and press
Ctrl/Cmd+V to insert a copy of the entire subtree as its child. You can paste
repeatedly or into another mind map. While editing text, these shortcuts keep
their normal text clipboard behavior. Alt+Shift+C/V commands remain available.
Each paste is one undoable operation.

Node shortcuts are handled in the active mind map before default browser actions:
Tab/Insert adds a child, Enter adds a sibling immediately after the selected node,
and either key finishes node text editing. Shift+Enter keeps multiline text entry.
Ctrl/Cmd+Z undoes node operations (including an entire pasted subtree);
Ctrl/Cmd+Y and Ctrl/Cmd+Shift+Z redo them. While editing text, text undo remains native.

## Features

### Box selection and batch actions

Drag on blank space with the left mouse button to select visible intersecting
nodes. Hold Ctrl/Cmd/Shift to add to a box selection, or click nodes with these
modifiers to toggle them. The middle mouse button pans the canvas.

Delete/Backspace deletes the selected subtrees; Ctrl/Cmd+C copies them and
Ctrl/Cmd+V pastes them under the selected destination. Drag any selected node to
move the whole selection using the usual child/sibling drop zones; Ctrl/Cmd-drag
copies it under the destination. If both a parent and its descendant are selected,
only the parent subtree is processed. Outline order is preserved. Each batch
delete, move or paste is one undoable operation. The map root cannot be deleted
or moved, and selected subtrees cannot be dropped into themselves.

The optional `npm run test:browser` test exercises real browser mouse/key events
against extracted release-bundle logic with fixture nodes, not a live Obsidian
instance. It needs Playwright and a browser installed separately. You may pass
an existing Playwright module path and browser channel:
`npm run test:browser -- /path/to/playwright msedge`.
The screenshot is saved under `node_modules/.cache/mindmap-tests/marquee.png`.

1. edit node
2. drag node to another node
3. undo/redo
4. toggle between mindmap and markdown views  
5. synchronize data between boards
...

![test (2)](https://user-images.githubusercontent.com/18719494/124458786-fd1d9b00-ddbf-11eb-8dbc-eeefb5b7abf5.gif)

## Manual installation
1. Download the latest release
2. Extract the obsidian-enhancing-mindmap folder from the zip to your vault's plugins folder: <vault>/.obsidian/plugins/
3. Note: On some machines the .obsidian folder may be hidden. On MacOS you should be able to press Command+Shift+Dot to show the folder in Finder.
4. Reload Obsidian
5. If prompted about Safe Mode, you can disable safe mode and enable the plugin.


## Plans 
1. more theme
2. more mind map layouts
3. save to image/opml
4. imports opml/xmind

## For developers
Pull requests are both welcome and appreciated. 😀

Run `npm test` with Node.js 18 or later for clipboard regression tests, and
`npm run build` to generate the plugin bundle.

## Donating
https://www.buymeacoffee.com/markmind  
<a href="https://www.buymeacoffee.com/markmind"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=markmind&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff"></a>



