# <img src="docs/images/icon.png" width="40" height="40" align="absmiddle" alt=""> DSH browser annotation

在 DSH Desktop 的内嵌浏览器里给网页元素添加标注，点 **完成并加入对话**，元素信息和你的备注就会直接填入**当前对话的输入框**。你可以继续编辑草稿，确认后再发送。

## 安装

在 DSH Desktop 的插件市场搜索 `dsh-browser-annotation` ，选择作者 **chnuuh** 的条目。也可以在「添加插件」中指定 `github:chnuuh/dsh-browser-annotation#v0.1.1`。如果以前安装过旧版 Annotation 补丁，请先查看[迁移说明](docs/MIGRATION.md)。

## 从网页标注到当前对话

1. 在网页上右键点击要引用的元素，例如演示页面里的“保存设置”按钮。选 **Quick annotation** 可直接把元素加入草稿。需要写备注时，选 **Annotation**，移动十字光标预览选框，再点击要标注的元素。

   ![“保存设置”按钮的右键标注菜单](docs/images/context-menu.png)

2. 在右下角填写备注。若还要标注其他元素，点 **保存，继续标注**，再用十字光标点选下一个。面板上方每行显示一个已保存的元素和备注摘要，每批最多 20 条。

   ![为“保存设置”按钮填写修改备注](docs/images/annotation-note.png)

3. 点 **完成并加入对话** 即可结束选取。当前对话的草稿会保留原有内容，并插入网页地址、元素信息和备注。下图用演示数据展示输入框的效果。

   ![当前对话草稿显示“保存设置”按钮的信息，以及将按钮改成蓝色并更名为“保存并应用”的备注](docs/images/annotation-draft.png)

## 使用提示

- 安装并启用插件后，直接在网页上右键即可开始标注。刷新或关闭网页、停用插件前，请先将要保留的标注加入草稿。
- 使用时保持一个内嵌网页可见。需要打开网页原有的右键菜单时，按住 **Shift** 再右键点击。
- 标注跟随开始标注时的对话。如果中途切换了对话，请切回原对话完成标注。
