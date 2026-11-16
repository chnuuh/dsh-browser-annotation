# DSH browser annotation

在 DSH Desktop 内嵌网页上右键，把具体元素与修改备注加入当前聊天草稿。

**状态：0.1.0-alpha.1，GitHub 测试版，待 Desktop 现场验收，尚未收录到插件市场。**

这是独立的 DSH client 插件，不覆盖 DS Bot 文件，不包含 Finder 菜单或 CLI 续跑补丁。可以独立安装、停用和卸载。DS Bot 更新不会直接覆盖本插件；DSH 的接口或浏览器实现变化时仍需验证兼容性。

## 功能

- **Quick annotation**：引用右键点中的元素，立即加入当前聊天草稿。
- **Annotation**：逐个点选元素、填写备注，最后统一加入草稿，每批最多 20 条。
- 保留已有草稿与选区内容；不会自动提交聊天消息。
- 引用包含页面地址、标题、selector、可见文字摘要和视口坐标。
- 白色页面右键菜单；Shift + 右键保留原生行为。
- 输入框旁的“网页标注”按钮可暂停或恢复；悬停查看接入状态。

暂停、停用、刷新或关闭网页会清除尚未交付的页面标注。切换聊天不会把旧聊天的标注交给新聊天；需要切回原聊天完成或退出。

## 兼容范围

| 环境 | 当前范围 |
|---|---|
| DSH Desktop 0.14.0 内嵌浏览器 | 已依据安装源码适配 Electron webview，待实际安装验收 |
| DS Bot 0.3.6 在 DSH Desktop 内的 webview 浏览器 | 同上；聊天输入通过 DSH 公共 slot 接入 |
| DS Bot 独立 App 的原生 BrowserView | 本版不支持 |
| 浏览器访问 DSH Web，网页位于 iframe 中 | 本版不支持跨站 iframe |
| Chrome / Edge 浏览器扩展 | 不是浏览器扩展，不安装到扩展商店 |

同时存在多个可见网页时，插件不会猜测目标。菜单只处理顶层文档及开放的 Shadow DOM；iframe、canvas 可引用容器，不能点选其内部元素。

实现通过 `conversation.input.right` slot 获得 `sessionId` 与 `inputActions`，用 `captureInsertion` / `insertText` 写草稿；浏览器发现使用独立适配器识别 Desktop 的 webview 标记。这部分仍依赖 Desktop 的浏览器实现，不宣称所有未来版本都兼容。

## 安装

在 DSH **插件 → 添加插件**中填写：

```text
github:chnuuh/dsh-browser-annotation#v0.1.0-alpha.1
```

这是供测试使用的 alpha tag。也可指定经过验证的 commit，避免分支变化。包中提交了构建好的 `client.js`，不需要安装脚本、Python 或额外服务。

本地测试时，将本仓库绝对路径交给 DSH 插件管理器的“安装组合包”操作。以管理器返回的应用状态为准；如果提示需要重启，保存工作后完全退出再打开 DSH。不要手工编辑 profile 配置或拷贝本插件到 DS Bot 安装目录。

**安装前若用过旧 Annotation 补丁，请先阅读 [迁移说明](docs/MIGRATION.md)。** 本插件检测到旧补丁会暂停注入，不会替换旧菜单。迁移与首次安装仍待在当前 Desktop 上验证。

## 隐私与权限

仅在本地处理用户主动选择的页面元素，不运行服务器，不调用模型，不直接发送消息。不会读取表单输入值；URL 中常见 token、密码等参数会隐藏，但页面正文仍可能包含敏感内容，发送前请检查草稿。网页内容作为引用数据传入，不应被当作可信指令。

插件拥有 DSH client 插件的能力，并会向匹配的内嵌网页注入脚本。恶意网页可能干扰或伪造页面侧标注数据；本插件会校验输入大小、会话归属并只写草稿，不把页面侧数据当作权限授权。

## 开发与校验

Node.js 22.19 或以上，无第三方构建依赖：

```sh
npm run build
npm run check
npm pack --ignore-scripts
```

修改 `src/` 后重建并提交 `client.js`；`check` 会拒绝过期产物。测试覆盖页面菜单与批量备注、草稿保护、跨会话隔离、重复交付、卸载清理、旧补丁冲突、安装包清单及市场索引格式。浏览器自动检查与 Desktop 现场验收分开记录，见 [验证记录](docs/VERIFICATION.md)。

发布流程见 [发布说明](docs/PUBLISHING.md)。采用 Apache-2.0 许可证。
