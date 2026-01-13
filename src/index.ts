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
          totalUsage = { ...response.usage };
        } else {
          totalUsage.prompt_tokens += response.usage.prompt_tokens;
          totalUsage.completion_tokens += response.usage.completion_tokens;
          totalUsage.total_tokens += response.usage.total_tokens;
        }
      }

      // No tool calls? We're done - return final response
      if (
        !choice.message.tool_calls ||
        choice.message.tool_calls.length === 0
      ) {
        return {
          choices: response.choices,
          usage: totalUsage,
        };
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

    const data = (await res.json()) as SendResponse;

    return {
      choices: data.choices,
      usage: data.usage,
    };
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

    return (await res.json()) as SendResponse;
  }
}

// Re-export zod for convenience
export { z } from "zod";
