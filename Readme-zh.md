# obsidian-enhancing-mindmap-plugin


![test](https://user-images.githubusercontent.com/18719494/124454742-63ec8580-ddbb-11eb-8da0-7cd44f38a225.gif)

## 输出的 markdown 样式:

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
## 注意

该插件支持如上以及无序列表等有限的markdown格式，无法支持其他格式，一定要注意这点，否则可能会丢失数据，切记。

## Short cuts

| 新建脑图             | Ctrl/Cmd+P       |
| ------------------------- | ---------------- |
| 新增子节点            | Tab              |
| 新增兄弟节点          | enter            |
| 删除节点               | Delete           |
| 编辑节点                 | Space/dblclick node|
| 后退                      | Ctrl/Cmd+Z       |
| 前进                      | Ctrl/Cmd+Y       |
| 取消编辑节点            | Tab              |
| 展开节点               | Ctrl/Cmd + /     |
| 收缩节点             | Ctrl/Cmd + /     |
| 拖动节点  | Drag and drop node |
| 切换节点                 | Up/down/left/right |
| 放大、缩小                 | Ctrl/Cmd + 滚轮 |
| 居中          | Ctrl/Cmd + E |

选中节点后按 Ctrl/Cmd+C，再选中目标节点按 Ctrl/Cmd+V，会将整个子树复制为目标节点的子节点。
支持重复粘贴和跨思维导图粘贴；编辑文字时仍使用普通文字复制粘贴。
原有 Alt+Shift+C/V 命令仍可使用，每次子树粘贴可以整体撤销和重做。

Tab/Insert 添加子节点，Enter 在选中节点后添加同级节点；编辑节点文字时，Tab/Enter 完成编辑，Shift+Enter 换行。
Ctrl/Cmd+Z 撤销节点操作（包括整棵粘贴的子树），Ctrl/Cmd+Y 或 Ctrl/Cmd+Shift+Z 重做；文字编辑期间保留原生文字撤销。

本 fork 由 [OBSB 项目](https://github.com/zfyu222/OBSB)维护。
通过 BRAT 添加 `zfyu222/obsidian-enhancing-mindmap`，选择最新 Release 或指定测试版安装。
插件 ID 保持不变，同一知识库中会替换原版 Enhancing Mindmap。
发布时同步 `manifest.json`、`package.json`、`versions.json` 的版本，推送同名 tag（不加 `v`），
GitHub Actions 会校验版本、测试、构建并上传 BRAT 需要的三个文件；测试版 tag 自动标记为预发布。

## 功能

### 框选与批量操作

在空白处按住左键拖动框选可见节点，鼠标中键拖动平移画布。
按住 Ctrl/Cmd/Shift 框选可以追加节点；配合这些修饰键单击节点可以切换选中状态。
Delete/Backspace 批量删除，Ctrl/Cmd+C 复制多棵子树，Ctrl/Cmd+V 粘贴为目标节点的子节点。
从任一选中节点拖动，可将整组移动到目标的子节点或同级位置；Ctrl/Cmd+拖动则复制到目标下。
同时选中父节点和后代时，只操作父节点子树；保持 Markdown 中的节点顺序。
每次批量删除、拖动和粘贴均可整体撤销/重做。根节点不能删除或移动，不能拖入所选子树内部。

1. 编辑节点
2. 拖动节点至某节点
3. 前进/后退
4. 在markdown和思维导图视图之间切换  
5. 数据同步
...

![test (2)](https://user-images.githubusercontent.com/18719494/124458786-fd1d9b00-ddbf-11eb-8dbc-eeefb5b7abf5.gif)

## 手动安装
1. 下载文件
2. 解压至obsidian: <vault>/.obsidian/plugins/
3. 注意: 在某些系统中 .obsidian文件夹是隐藏的，在 macos 系统上，使用 Command+Shift+Dot 显示文件夹.
4. 重启软件
5. 打开安全模式


## 计划
1. 更多的主题背景
2. 更多的布局方式
3. 导出到图片和 opml
4. 导入 opml 和 xmind 文件

## 开发者
1. 欢迎提 pull request  😀
2. 如果您会css,那么您可以自己修改思维导图节点样式

## 捐款
  您也可以通过捐款支持我<br>
<a href="https://www.buymeacoffee.com/markmind"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=markmind&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff"></a>
<br>

<img src="https://user-images.githubusercontent.com/18719494/124471790-e3844f80-ddcf-11eb-83c6-c5c16996c206.png" width="200px"/>
  





## 导出图片（定制版 beta.44）

打开思维导图，点击顶部图片图标“导出至图片”，选择 PNG 或 JPEG，以及 1×、2×、4× 分辨率。命令面板原有导出命令仍可用。

导出当前页所有可见分支（包含屏幕外节点、概括和虚拟分支），保留当前折叠状态。图片自动裁边并留白，不包含工具栏、选中边框和编辑菜单，也不改变当前平移、缩放和节点位置。过大图片会提示降低倍率或折叠分支。

文件保存到 Obsidian 配置的附件目录（需要 Obsidian 1.5.7+），多页笔记文件名包含页名；重复导出自动使用可用文件名，不覆盖已有图片。Windows / Android 的 Obsidian 客户端仍需实机验证。


### 图片导出背景修复（beta.45）

修复透明画布在 JPEG 中变成黑底、黑字和黑色连线几乎不可见的问题。导出会合成当前画布与外层窗口实际显示的背景色，白底、深色、自定义颜色及半透明背景均保留；PNG 也使用相同的不透明背景以保持观看效果。

内嵌图片沿用原显示尺寸并等待副本解码完成；图片读取或内嵌失败会提示错误，不保存缺少图片的结果。HTML 导出增强仍在独立开发分支，本版不包含。


### 0.2.6-beta.47：节点宽度与代码换行

- 选中节点后拖动左右边缘调宽（80–4000px）；松开后重新排版，一次拖拽记一次撤销。拖动中按 Escape 或切出窗口会取消。
- 右侧面板支持输入节点宽度，以及“恢复自动宽度”（恢复原来的最大 800px 自适应布局）。
- 取消“代码自动换行”可保留代码原始换行，超长行在代码块内横向滚动。
- 宽度与换行选项随节点样式保存，支持重开、子树复制粘贴、概括与虚拟分支；不改代码正文。移动端可用侧栏输入宽度。


## HTML 导出（定制版 beta.48）

顶部导出图标菜单新增“导出为 html”，原命令面板 HTML 命令也使用新实现。导出当前页的可见分支，保留当前折叠，文件保存到配置的附件目录；多页文件名带页名，重复导出不覆盖已有文件。

HTML 保留真实文字、表格、代码排版和 SVG 连线，以及当前主题的节点样式。图片和可读取的字体内嵌到文件中，可离线打开；内嵌资源读取失败会提示导出失败。它不再把整幅 PNG 包在 HTML 中，放大文字和连线仍清晰，文字可以选择复制。独立网页提供放大、缩小、恢复 100% 和适应窗口，长图可滚动；不包含节点编辑及重新展开已折叠分支的交互。

需要 Obsidian 1.5.7+。浏览器离线文件、真实文字选择、样式与图片内嵌已经模拟验证；Windows Obsidian / Android 实机仍待验收。

### 导出时选择保存位置（beta.49）

选择 PNG、JPEG 或 HTML 后，桌面版会打开系统保存对话框，可以修改文件名和保存位置。移动版弹出知识库保存对话框，可以填写已有文件夹和文件名，文件夹留空时保存到知识库根目录。取消对话框会放弃本次导出。
