# 发布与插件市场

## GitHub 发布

1. 当前发布仓库为 [chnuuh/dsh-browser-annotation](https://github.com/chnuuh/dsh-browser-annotation)；包元数据和 README 已配置该地址。
2. 当前代码可作为 alpha 测试版发布。正式发布稳定版及申请市场收录前，完成 Desktop 现场验收并更新兼容范围和验证记录。
3. 运行 `npm run check` 和 `npm pack --ignore-scripts`，检查包内仅含运行文件、展示资源、说明和许可证。
4. 提交源码、生成的 `client.js` 和说明到独立 Git 仓库，推送后创建 `v0.1.0-alpha.1` tag 与 GitHub Release，附 npm 生成的 `.tgz`。GitHub 用户可直接指定仓库和 tag 安装，无需先发布 npm。
5. 在一个干净 profile 中按 README 的 GitHub 地址安装，验证停用、重启和卸载，然后公布安装地址。

本仓库 CI 只执行检查和打包，不自动发布，不需要 npm token。包不含 `prepare`、`postinstall` 等安装脚本，构建产物必须提交到 Git。

## DSH 插件市场

安装来源和市场收录是两件事。当前核对的 DSH 索引格式是 format 1，可引用固定 commit 的 Git 仓库，或已发布的 npm 精确版本。

先推送可安装的代码，再用真实 commit 和发布时间生成自定义索引：

```sh
node scripts/market-index.mjs \
  --repo chnuuh/dsh-browser-annotation \
  --commit FULL_40_CHARACTER_COMMIT_SHA \
  --published-at 2026-11-15T22:00:00+08:00 \
  --output market-index.json
```

示例中的 commit 与时间必须替换为实际发布信息。索引必须指向包源码的既有 commit，不要用分支名或伪造 SHA。将生成的 JSON 托管在可访问的 HTTPS 地址，用户可在支持自定义索引的 DSH 发现页添加该地址。

## 提交到当前 Desktop 使用的社区市场

已核对本机 Desktop 的市场入口指向 [dsh-market](https://github.com/dsh-market/dsh-market)，该项目明确要求向 [awesome-dsh-plugin 目录](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)提交收录 PR，而不是向市场 App 仓库提交插件条目。

按 2026-11-15 查询到的规则：

- 仓库必须公开、创建满 1 天，并有实际可用代码与 `dsh.bundle` 清单。
- 为仓库添加 `dsh-plugin` topic。
- 向目录仓库新增一个 `data/plugins/chnuuh__dsh-browser-annotation.yml`，分类使用 `browser`；中英文描述必须与实际功能一致。
- 不手改目录仓库自动生成的 README。维护者审核合并后，由目录和市场同步。
- 不强制发布 npm；可以使用 GitHub 源码或 GitHub Release 上预构建的 `.tgz`。

待填写的条目模板见 [catalog-entry.example.yml](catalog-entry.example.yml)。本插件未完成 Desktop 现场验收，当前不提交收录 PR。发布时需再次核对目录规则。

“添加自定义索引”不等于“已进入默认市场”。国内用户的访问速度取决于仓库和索引托管地址，GitHub 来源不能保证国内下载可达。

若后续选择 npm，可先确认包名可用、填写作者和仓库信息，再发布经过验收的版本。不要把本地私有记录、补丁备份、账户信息或开发环境目录放进发行包。
