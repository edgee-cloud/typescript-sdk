// Tool types
export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface Tool {
  type: "function";
  function: FunctionDefinition;
}

export interface ToolChoiceFunction {
  name: string;
}

export type ToolChoice =
  | "none"
  | "auto"
  | { type: "function"; function: ToolChoiceFunction };

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// Message types
export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// Full input object
export interface InputObject {
  messages: Message[];
  tools?: Tool[];
  tool_choice?: ToolChoice;
}

export interface SendOptions {
  model: string;
  input: string | InputObject;
}

export interface Choice {
  index: number;
  message: {
    role: string;
    content: string | null;
    tool_calls?: ToolCall[];
  };
  finish_reason: string | null;
}

export interface SendResponse {
  choices: Choice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface EdgeeConfig {
  apiKey?: string;
  baseUrl?: string;
}

export default class Edgee {
  private apiKey: string;
  private baseUrl: string;

  constructor(config?: string | EdgeeConfig) {
    let apiKey: string | undefined;
    let baseUrl: string | undefined;

    if (typeof config === "string") {
      // Backward compatibility: accept apiKey as string
      apiKey = config;
    } else if (config) {
      // New format: accept config object
      apiKey = config.apiKey;
      baseUrl = config.baseUrl;
    }

    this.apiKey = apiKey || process.env.EDGEE_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("EDGEE_API_KEY is not set");
    }

    this.baseUrl = baseUrl || process.env.EDGEE_BASE_URL || "https://api.edgee.ai";
  }

  async send(options: SendOptions): Promise<SendResponse> {
    const { input } = options;

    const body: Record<string, unknown> = {
      model: options.model,
      messages:
        typeof input === "string"
          ? [{ role: "user", content: input }]
          : input.messages,
    };

    if (typeof input !== "string") {
      if (input.tools) body.tools = input.tools;
      if (input.tool_choice) body.tool_choice = input.tool_choice;
    }

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as SendResponse;

    return {
      choices: data.choices,
      usage: data.usage,
    };
  }
}
