# 血族调查手札

为 SillyTavern 角色卡“伊萨维尔·塞兰尼斯”制作的 MVU `stat_data` 可视化扩展。

当前版本：4.1.0

## 功能

- 展示伊萨维尔与塞维林的关系、身体、资源、记忆及调查状态。
- 为阿德里安、吕西安、维莱西安、瓦伦汀和赫尔曼提供独立页面。
- 展示其他实际进入变量表的动态 NPC。
- 自动读取最新消息中的 `variables[*].stat_data`。
- 面板打开时自动检测变量变化并刷新。
- 支持移动端滚动与窄屏布局。

本扩展只负责读取和展示变量，不负责生成或修复 MVU 数据。

## 依赖

- SillyTavern 1.18.0 release 或兼容版本。
- 能够提供 MVU `stat_data` 的 TavernHelper/MVU 环境。
- 对应角色卡或其他采用相同变量根结构的角色卡。

## 通过 GitHub 链接安装

1. 在 SillyTavern 中打开扩展管理。
2. 选择“安装扩展”。
3. 粘贴本仓库地址，例如：

   `https://github.com/你的账号/isaviel-blood-codex`

4. 完成安装后重启 SillyTavern，并强制刷新浏览器页面。
5. 在扩展菜单中点击“血族调查手札”。

## 手动安装

将仓库文件夹复制到：

`SillyTavern/public/scripts/extensions/third-party/isaviel-blood-codex/`

确认最终存在：

`SillyTavern/public/scripts/extensions/third-party/isaviel-blood-codex/manifest.json`

## 仓库结构

```text
isaviel-blood-codex/
├─ manifest.json
├─ index.js
├─ style.css
├─ README.md
└─ assets/
```

请保持 `manifest.json` 位于仓库根目录，不要在仓库外再多套一层文件夹。

## 排查

- 菜单中没有插件：确认仓库根目录存在 `manifest.json`，然后重启酒馆。
- 面板提示找不到 `stat_data`：先确认对应聊天已经成功初始化 MVU 变量并生成至少一条回复。
- 界面仍是旧版：强制刷新页面，必要时删除本地旧插件目录后重新安装。

