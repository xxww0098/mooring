# Mooring

笔记窗口 + 宿主机 Agent。左边写笔记，右边跑本机已经安装的 CLI 智能体。工作目录就是当前笔记库。

Notes on the left. Local CLI agents on the right. The vault is the working directory.

## 做什么

- 三栏：文件树、Markdown 编辑、Agent 坞
- 只启动本机探测到的运行时（Grok、Claude、Codex、OpenCode 等）
- 对话叠在伪终端上：聊天输入，底层仍是该 CLI
- 模型与思考深度来自 [models.dev](https://models.dev) + 本机 `grok models` 一类的列表
- `@` 引用笔记（芯片在输入框上方），`/` 写进输入框

## 运行

需要 Node 22+，以及你想用的 CLI（例如 `grok`）在 `PATH` 里。

```bash
npm install
npm run dev
```

默认 `http://localhost:8080`。

```bash
npm test
npm run typecheck
```

## 设置

右侧 **智能体设置** 里刷新探测、启用/禁用运行时、选默认智能体、选 yolo 或需确认启动。

新建会话标签用智能体名（`Grok`、`Grok 2`、`终端`）。

## 文档

更完整的产品约定见 [DESIGN.md](./DESIGN.md)。

## License

MIT
