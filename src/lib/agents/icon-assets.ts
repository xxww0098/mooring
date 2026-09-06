import ampUrl from "@/assets/agent-icons/amp.png?url";
import anteUrl from "@/assets/agent-icons/ante.png?url";
import antigravityUrl from "@/assets/agent-icons/antigravity.png?url";
import augUrl from "@/assets/agent-icons/aug.png?url";
import autohandUrl from "@/assets/agent-icons/autohand.png?url";
import clineUrl from "@/assets/agent-icons/cline.png?url";
import codebuffUrl from "@/assets/agent-icons/codebuff.png?url";
import commandCodeUrl from "@/assets/agent-icons/command-code.png?url";
import continueUrl from "@/assets/agent-icons/continue.png?url";
import crushUrl from "@/assets/agent-icons/crush.png?url";
import cursorUrl from "@/assets/agent-icons/cursor.png?url";
import devinUrl from "@/assets/agent-icons/devin.png?url";
import geminiUrl from "@/assets/agent-icons/gemini.png?url";
import gooseUrl from "@/assets/agent-icons/goose.png?url";
import grokUrl from "@/assets/agent-icons/grok.png?url";
import hermesUrl from "@/assets/agent-icons/hermes.png?url";
import kimiUrl from "@/assets/agent-icons/kimi.png?url";
import kiroUrl from "@/assets/agent-icons/kiro.png?url";
import mimoCodeUrl from "@/assets/agent-icons/mimo-code.png?url";
import minimaxUrl from "@/assets/agent-icons/minimax-icon.svg?url";
import mistralVibeUrl from "@/assets/agent-icons/mistral-vibe.png?url";
import openclaudeUrl from "@/assets/agent-icons/openclaude-logo.png?url";
import openclawUrl from "@/assets/agent-icons/openclaw.png?url";
import primeAgentUrl from "@/assets/agent-icons/prime-agent.png?url";
import qwenCodeUrl from "@/assets/agent-icons/qwen-code.png?url";
import rovoUrl from "@/assets/agent-icons/rovo.png?url";
import traeUrl from "@/assets/agent-icons/trae.png?url";
import type { LaunchableAgentId } from "./catalog";

/** Bundled site marks for agents that do not ship a dedicated SVG glyph. */
export const AGENT_ICON_URLS: Partial<Record<LaunchableAgentId, string>> = {
  grok: grokUrl,
  "mimo-code": mimoCodeUrl,
  "minimax-code": minimaxUrl,
  ante: anteUrl,
  trae: traeUrl,
  "prime-agent": primeAgentUrl,
  gemini: geminiUrl,
  antigravity: antigravityUrl,
  goose: gooseUrl,
  amp: ampUrl,
  kiro: kiroUrl,
  crush: crushUrl,
  aug: augUrl,
  autohand: autohandUrl,
  cline: clineUrl,
  codebuff: codebuffUrl,
  "command-code": commandCodeUrl,
  continue: continueUrl,
  cursor: cursorUrl,
  kimi: kimiUrl,
  "mistral-vibe": mistralVibeUrl,
  "qwen-code": qwenCodeUrl,
  rovo: rovoUrl,
  hermes: hermesUrl,
  devin: devinUrl,
  openclaw: openclawUrl,
  openclaude: openclaudeUrl,
};

/** Site domain used with Google's favicon service when a bundled mark is missing. */
export const AGENT_FAVICON_DOMAINS: Partial<Record<LaunchableAgentId, string>> = {
  grok: "x.ai",
  "mimo-code": "mimo.xiaomi.com",
  ante: "antigma.ai",
  trae: "www.trae.cn",
  "prime-agent": "primeintellect.ai",
  gemini: "gemini.google.com",
  antigravity: "antigravity.google",
  goose: "goose-docs.ai",
  amp: "ampcode.com",
  kiro: "kiro.dev",
  crush: "charm.sh",
  aug: "augmentcode.com",
  autohand: "autohand.ai",
  cline: "cline.bot",
  codebuff: "codebuff.com",
  "command-code": "commandcode.ai",
  continue: "continue.dev",
  cursor: "cursor.com",
  kimi: "moonshot.cn",
  "mistral-vibe": "mistral.ai",
  "qwen-code": "qwenlm.github.io",
  rovo: "atlassian.com",
  hermes: "nousresearch.com",
  devin: "devin.ai",
  openclaw: "openclaw.ai",
};

export const AGENT_HOMEPAGE_URLS: Record<Exclude<LaunchableAgentId, "custom" | "terminal">, string> = {
  claude: "https://code.claude.com/docs",
  openclaude: "https://openclaude.gitlawb.com/",
  codex: "https://github.com/openai/codex",
  grok: "https://x.ai/cli",
  copilot: "https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli",
  opencode: "https://opencode.ai/docs/cli/",
  "mimo-code": "https://mimo.xiaomi.com/coder",
  ante: "https://github.com/AntigmaLabs/ante-preview",
  trae: "https://docs.trae.cn/cli_get-started-with-trae-cli",
  pi: "https://pi.dev",
  omp: "https://omp.sh",
  "prime-agent": "https://github.com/PrimeIntellect-ai/prime-agent",
  gemini: "https://github.com/google-gemini/gemini-cli",
  antigravity: "https://antigravity.google/docs/cli-overview",
  aider: "https://aider.chat/docs/",
  goose: "https://block.github.io/goose/docs/quickstart/",
  amp: "https://ampcode.com/manual#install",
  kilo: "https://kilo.ai/docs/cli",
  kiro: "https://kiro.dev/docs/cli/",
  crush: "https://github.com/charmbracelet/crush",
  aug: "https://docs.augmentcode.com/cli/overview",
  autohand: "https://github.com/autohandai/code-cli",
  cline: "https://docs.cline.bot/cline-cli/overview",
  codebuff: "https://www.codebuff.com/docs/help/quick-start",
  "command-code": "https://commandcode.ai/docs/quickstart",
  continue: "https://docs.continue.dev/guides/cli",
  cursor: "https://cursor.com/cli",
  droid: "https://docs.factory.ai/cli/getting-started/quickstart",
  kimi: "https://www.kimi.com/code/docs/en/kimi-code-cli/getting-started.html",
  "mistral-vibe": "https://github.com/mistralai/mistral-vibe",
  "qwen-code": "https://github.com/QwenLM/qwen-code",
  rovo: "https://support.atlassian.com/rovo/docs/install-and-run-rovo-dev-cli-on-your-device/",
  hermes: "https://hermes-agent.nousresearch.com/docs/",
  devin: "https://devin.ai/cli",
  openclaw: "https://github.com/openclaw/openclaw",
  "minimax-code": "https://github.com/MiniMax-AI/MiniMax-Code",
};
