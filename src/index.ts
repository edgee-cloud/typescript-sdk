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

export class SendResponse {
  choices: Choice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };

  constructor(
    choices: Choice[],
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    }
  ) {
    this.choices = choices;
    this.usage = usage;
  }

  get text(): string | null {
    if (this.choices[0]?.message?.content) {
      return this.choices[0].message.content;
    }
    return null;
  }

  get message() {
    return this.choices[0]?.message ?? null;
  }

  get finishReason(): string | null {
    return this.choices[0]?.finish_reason ?? null;
  }

  get toolCalls(): ToolCall[] | null {
    return this.choices[0]?.message?.tool_calls ?? null;
  }
}

// Streaming types
export interface StreamDelta {
  role?: string;
  content?: string;
  tool_calls?: ToolCall[];
}

export interface StreamChoice {
  index: number;
  delta: StreamDelta;
  finish_reason?: string | null;
}

export class StreamChunk {
  choices: StreamChoice[];

  constructor(choices: StreamChoice[]) {
    this.choices = choices;
  }

  get text(): string | null {
    if (this.choices[0]?.delta?.content) {
      return this.choices[0].delta.content;
    }
    return null;
  }

  get role(): string | null {
    if (this.choices[0]?.delta?.role) {
      return this.choices[0].delta.role;
    }
    return null;
  }

  get finishReason(): string | null {
    if (this.choices[0]?.finish_reason) {
      return this.choices[0].finish_reason;
    }
    return null;
  }
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

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`API error ${res.status}: ${errorBody}`);
    }

    const data = await res.json() as {
      choices: Choice[];
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      }
    };

    return new SendResponse(data.choices, data.usage);
  }

  private async *_handleStreamingResponse(
    url: string,
    body: Record<string, unknown>
  ): AsyncGenerator<StreamChunk> {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`API error ${res.status}: ${errorBody}`);
    }

    if (!res.body) {
      throw new Error("Response body is null");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "" || !trimmed.startsWith("data: ")) {
          continue;
        }

        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          return;
        }

        try {
          const parsed = JSON.parse(data);
          yield new StreamChunk(parsed.choices);
        } catch {
          // Skip malformed JSON
          continue;
        }
      }
    }
  }

  async *stream(
    model: string,
    input: string | InputObject
  ): AsyncGenerator<StreamChunk> {
    const body: Record<string, unknown> = {
      model,
      messages:
        typeof input === "string"
          ? [{ role: "user", content: input }]
          : input.messages,
      stream: true,
    };

    if (typeof input !== "string") {
      if (input.tools) body.tools = input.tools;
      if (input.tool_choice) body.tool_choice = input.tool_choice;
    }

    yield* this._handleStreamingResponse(
      `${this.baseUrl}/v1/chat/completions`,
      body
    );
  }

  async *streamText(
    model: string,
    input: string | InputObject
  ): AsyncGenerator<string> {
    for await (const chunk of this.stream(model, input)) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  }
}
