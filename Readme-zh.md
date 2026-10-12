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

本 fork 由 [OBSB 项目](https://github.com/zfyu222/OBSB)维护。
通过 BRAT 添加 `zfyu222/obsidian-enhancing-mindmap`，选择最新 Release 或指定测试版安装。
插件 ID 保持不变，同一知识库中会替换原版 Enhancing Mindmap。
发布时同步 `manifest.json`、`package.json`、`versions.json` 的版本，推送同名 tag（不加 `v`），
GitHub Actions 会校验版本、测试、构建并上传 BRAT 需要的三个文件；测试版 tag 自动标记为预发布。

## 功能

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
  



