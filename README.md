# Mooring

笔记窗口 + 宿主机 Agent。左边写笔记，右边跑本机已经安装的 CLI 智能体。工作目录就是当前笔记库。

## 用 BRAT 安装（Obsidian 桌面）

1. 在社区插件里安装并启用 [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. BRAT → **Add Beta plugin** → 填 `xxww0098/mooring`
3. 启用 **Mooring**（仅桌面；会 spawn 本机 CLI）
4. 点左侧功能区机器人图标，右侧打开 Agent 坞

当前笔记库就是智能体的工作目录。未探测到的运行时不会出现在新建菜单里。

## 本地开发网页版

需要 Node 22+。

```bash
npm install
npm run dev
```

默认 `http://localhost:8080`。

## 构建插件

```bash
npm install
npm run build:plugin
```

产物：`main.js`、`styles.css`（和仓库根目录的 `manifest.json` 一起打进 GitHub Release）。

## License

MIT
