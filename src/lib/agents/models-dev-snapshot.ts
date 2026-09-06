export const modelsDevSnapshot = {
  "xai": {
    "id": "xai",
    "models": {
      "grok-4.3": {
        "id": "grok-4.3",
        "name": "Grok 4.3",
        "reasoning": true,
        "tool_call": true,
        "efforts": [
          "none",
          "low",
          "medium",
          "high"
        ],
        "output": [
          "text"
        ]
      },
      "grok-4.20-0309-reasoning": {
        "id": "grok-4.20-0309-reasoning",
        "name": "Grok 4.20 (Reasoning)",
        "reasoning": true,
        "tool_call": true,
        "efforts": [],
        "output": [
          "text"
        ]
      },
      "grok-4.20-multi-agent-0309": {
        "id": "grok-4.20-multi-agent-0309",
        "name": "Grok 4.20 Multi-Agent",
        "reasoning": true,
        "tool_call": false,
        "efforts": [
          "low",
          "medium",
          "high",
          "xhigh"
        ],
        "output": [
          "text"
        ]
      },
      "grok-4.5": {
        "id": "grok-4.5",
        "name": "Grok 4.5",
        "reasoning": true,
        "tool_call": true,
        "efforts": [
          "low",
          "medium",
          "high"
        ],
        "output": [
          "text"
        ]
      },
      "grok-build-0.1": {
        "id": "grok-build-0.1",
        "name": "Grok Build 0.1",
        "reasoning": true,
        "tool_call": true,
        "efforts": [],
        "output": [
          "text"
        ]
      },
      "grok-4.6": {
        "id": "grok-4.6",
        "name": "Grok 4.6",
        "reasoning": true,
        "tool_call": true,
        "efforts": [
          "low",
          "medium",
          "high",
          "xhigh"
        ],
        "output": [
          "text"
        ]
      },
      "grok-4.20-0309-non-reasoning": {
        "id": "grok-4.20-0309-non-reasoning",
        "name": "Grok 4.20 (Non-Reasoning)",
        "reasoning": false,
        "tool_call": true,
        "efforts": [],
        "output": [
          "text"
        ]
      }
    }
  },
  "anthropic": {
    "id": "anthropic",
    "models": {
      "claude-opus-5": {
        "id": "claude-opus-5",
        "name": "Claude Opus 5",
        "reasoning": true,
        "tool_call": true,
        "efforts": [
          "low",
          "medium",
          "high",
          "xhigh",
          "max"
        ],
        "output": [
          "text"
        ]
      },
      "claude-fable-5-1": {
        "id": "claude-fable-5-1",
        "name": "Claude Fable 5.1",
        "reasoning": true,
        "tool_call": true,
        "efforts": [
          "low",
          "medium",
          "high",
          "xhigh",
          "max"
        ],
        "output": [
          "text"
        ]
      },
      "claude-fable-5": {
        "id": "claude-fable-5",
        "name": "Claude Fable 5",
        "reasoning": true,
        "tool_call": true,
        "efforts": [
          "low",
          "medium",
          "high",
          "xhigh",
          "max"
        ],
        "output": [
          "text"
        ]
      },
      "claude-haiku-4-5": {
        "id": "claude-haiku-4-5",
        "name": "Claude Haiku 4.5 (latest)",
        "reasoning": true,
        "tool_call": true,
        "efforts": [],
        "output": [
          "text"
        ]
      },
      "claude-sonnet-5": {
        "id": "claude-sonnet-5",
        "name": "Claude Sonnet 5",
        "reasoning": true,
        "tool_call": true,
        "efforts": [
          "low",
          "medium",
          "high",
          "xhigh",
          "max"
        ],
        "output": [
          "text"
        ]
      }
    }
  },
  "openai": {
    "id": "openai",
    "models": {
      "gpt-5.3-codex-spark": {
        "id": "gpt-5.3-codex-spark",
        "name": "GPT-5.3 Codex Spark",
        "reasoning": true,
        "tool_call": true,
        "efforts": [
          "none",
          "low",
          "medium",
          "high",
          "xhigh"
        ],
        "output": [
          "text"
        ]
      },
      "gpt-5.4": {
        "id": "gpt-5.4",
        "name": "GPT-5.4",
        "reasoning": true,
        "tool_call": true,
        "efforts": [
          "none",
          "low",
          "medium",
          "high",
          "xhigh"
        ],
        "output": [
          "text"
        ]
      },
      "gpt-5.3-codex": {
        "id": "gpt-5.3-codex",
        "name": "GPT-5.3 Codex",
        "reasoning": true,
        "tool_call": true,
        "efforts": [
          "none",
          "low",
          "medium",
          "high",
          "xhigh"
        ],
        "output": [
          "text"
        ]
      },
      "gpt-5.4-mini": {
        "id": "gpt-5.4-mini",
        "name": "GPT-5.4 mini",
        "reasoning": true,
        "tool_call": true,
        "efforts": [
          "none",
          "low",
          "medium",
          "high",
          "xhigh"
        ],
        "output": [
          "text"
        ]
      },
      "gpt-5.4-pro": {
        "id": "gpt-5.4-pro",
        "name": "GPT-5.4 Pro",
        "reasoning": true,
        "tool_call": true,
        "efforts": [
          "medium",
          "high",
          "xhigh"
        ],
        "output": [
          "text"
        ]
      },
      "gpt-5.5": {
        "id": "gpt-5.5",
        "name": "GPT-5.5",
        "reasoning": true,
        "tool_call": true,
        "efforts": [
          "none",
          "low",
          "medium",
          "high",
          "xhigh"
        ],
        "output": [
          "text"
        ]
      }
    }
  },
  "google": {
    "id": "google",
    "models": {
      "gemini-3.1-pro-preview": {
        "id": "gemini-3.1-pro-preview",
        "name": "Gemini 3.1 Pro Preview",
        "reasoning": true,
        "tool_call": true,
        "efforts": [
          "low",
          "medium",
          "high"
        ],
        "output": [
          "text"
        ]
      },
      "gemini-3.8-flash": {
        "id": "gemini-3.8-flash",
        "name": "Gemini 3.8 Flash",
        "reasoning": true,
        "tool_call": true,
        "efforts": [
          "low",
          "medium",
          "high"
        ],
        "output": [
          "text"
        ]
      },
      "gemini-2.5-pro": {
        "id": "gemini-2.5-pro",
        "name": "Gemini 2.5 Pro",
        "reasoning": true,
        "tool_call": true,
        "efforts": [],
        "output": [
          "text"
        ]
      },
      "gemini-2.5-flash": {
        "id": "gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "reasoning": true,
        "tool_call": true,
        "efforts": [],
        "output": [
          "text"
        ]
      }
    }
  }
} as const;
