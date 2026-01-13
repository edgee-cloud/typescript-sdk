import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// OpenAI API tool types
export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface OpenAITool {
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

// Tool class for easy declaration
export interface ToolConfig<T extends z.ZodType = z.ZodType> {
  name: string;
  description?: string;
  schema: T;
  handler: (args: z.infer<T>) => unknown | Promise<unknown>;
}

export class Tool<T extends z.ZodType = z.ZodType> {
  readonly name: string;
  readonly description?: string;
  readonly schema: T;
  readonly handler: (args: z.infer<T>) => unknown | Promise<unknown>;

  constructor(config: ToolConfig<T>) {
    this.name = config.name;
    this.description = config.description;
    this.schema = config.schema;
    this.handler = config.handler;
  }

  // Convert to JSON format for API
  toJSON(): OpenAITool {
    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
        parameters: zodToJsonSchema(this.schema, {
          $refStrategy: "none",
          target: "openAi",
        }) as Record<string, unknown>,
      },
    };
  }

  // Execute the tool with validation
  async execute(args: Record<string, unknown>): Promise<unknown> {
    const parsedArgs = this.schema.parse(args);
    return this.handler(parsedArgs);
  }
}

// Helper function to create a tool (alternative to class)
export function createTool<T extends z.ZodType>(
  config: ToolConfig<T>
): Tool<T> {
  return new Tool(config);
}

// Message types
export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// Full input object (for advanced/manual mode)
export interface InputObject {
  messages: Message[];
  tools?: OpenAITool[];
  tool_choice?: ToolChoice;
}

// Simple mode: string input with optional auto-handled tools
export interface SimpleSendOptions {
  model: string;
  input: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Tool<any>[];
  maxToolIterations?: number;
}

// Advanced mode: full InputObject (tools defined inside, manually handled)
export interface AdvancedSendOptions {
  model: string;
  input: InputObject;
}

// Union type - one or the other, never mixed
export type SendOptions = SimpleSendOptions | AdvancedSendOptions;

export interface Choice {
  index: number;
  message: {
    role: string;
    content: string | null;
    tool_calls?: ToolCall[];
  };
  finish_reason: string | null;
}

export interface InputTokenDetails {
  cached_tokens: number;
}

export interface OutputTokenDetails {
  reasoning_tokens: number;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  input_tokens_details: InputTokenDetails;
  output_tokens_details: OutputTokenDetails;
}

export class SendResponse {
  choices: Choice[];
  usage?: Usage;

  constructor(choices: Choice[], usage?: Usage) {
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

    this.baseUrl =
      baseUrl || process.env.EDGEE_BASE_URL || "https://api.edgee.ai";
  }

  async send(options: SendOptions): Promise<SendResponse> {
    // String input = Simple mode (auto-handled tools)
    // Object input = Advanced mode (manual control)
    if (typeof options.input === "string") {
      return this.sendSimple(options as SimpleSendOptions);
    } else {
      return this.sendAdvanced(options as AdvancedSendOptions);
    }
  }

  private async sendSimple(options: SimpleSendOptions): Promise<SendResponse> {
    const { model, input, tools, maxToolIterations = 10 } = options;

    // Build initial messages
    const messages: Message[] = [{ role: "user", content: input }];

    // Convert Tool instances to JSON format
    const openAiTools: OpenAITool[] | undefined = tools?.map((tool) =>
      tool.toJSON()
    );

    // Create a map for quick tool lookup by name
    const toolMap = new Map<string, Tool>(
      tools?.map((tool) => [tool.name, tool])
    );

    let iterations = 0;
    let totalUsage: SendResponse["usage"] | undefined;

    // The agentic loop
    while (iterations < maxToolIterations) {
      iterations++;

      // Call the API
      const response = await this.callApi(model, messages, openAiTools);
      const choice = response.choices[0];

      // Accumulate usage
      if (response.usage) {
        if (!totalUsage) {
          totalUsage = structuredClone(response.usage);
        } else {
          totalUsage.prompt_tokens += response.usage.prompt_tokens;
          totalUsage.completion_tokens += response.usage.completion_tokens;
          totalUsage.total_tokens += response.usage.total_tokens;
          totalUsage.input_tokens_details.cached_tokens += response.usage.input_tokens_details.cached_tokens;
          totalUsage.output_tokens_details.reasoning_tokens += response.usage.output_tokens_details.reasoning_tokens;
        }
      }

      // No choice or no tool calls? We're done - return final response
      if (
        !choice?.message?.tool_calls ||
        choice.message.tool_calls.length === 0
      ) {
        return new SendResponse(response.choices, totalUsage);
      }

      // Add assistant's response (with tool_calls) to messages
      messages.push({
        role: "assistant",
        content: choice.message.content ?? undefined,
        tool_calls: choice.message.tool_calls,
      });

      // Execute each tool call and add results
      for (const toolCall of choice.message.tool_calls) {
        const toolName = toolCall.function.name;
        const tool = toolMap.get(toolName);

        let result: unknown;
        if (tool) {
          try {
            // Parse arguments and execute with validation
            const rawArgs = JSON.parse(toolCall.function.arguments);
            result = await tool.execute(rawArgs);
          } catch (err) {
            if (err instanceof z.ZodError) {
              result = { error: `Invalid arguments: ${err.message}` };
            } else if (err instanceof Error) {
              result = { error: `Tool execution failed: ${err.message}` };
            } else {
              result = { error: "Tool execution failed" };
            }
          }
        } else {
          result = { error: `Unknown tool: ${toolName}` };
        }

        // Add tool result to messages
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: typeof result === "string" ? result : JSON.stringify(result),
        });
      }

      // Loop continues - model will process tool results
    }

    // Max iterations reached
    throw new Error(`Max tool iterations (${maxToolIterations}) reached`);
  }

  private async sendAdvanced(
    options: AdvancedSendOptions
  ): Promise<SendResponse> {
    const { model, input } = options;

    const body: Record<string, unknown> = {
      model,
      messages: input.messages,
    };

    if (input.tools) body.tools = input.tools;
    if (input.tool_choice) body.tool_choice = input.tool_choice;

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

    const data = (await res.json()) as {
      choices: Choice[];
      usage?: Usage;
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

  private async callApi(
    model: string,
    messages: Message[],
    tools?: OpenAITool[]
  ): Promise<SendResponse> {
    const body: Record<string, unknown> = { model, messages };
    if (tools) body.tools = tools;

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

    const data = (await res.json()) as {
      choices: Choice[];
      usage?: Usage;
    };

    return new SendResponse(data.choices, data.usage);
  }
}

// Re-export zod for convenience
export { z } from "zod";
