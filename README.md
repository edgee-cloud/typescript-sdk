# Edgee Gateway SDK

Lightweight TypeScript SDK for Edgee AI Gateway with built-in tool execution support.

## Installation

```bash
npm install edgee
```

## Usage

```typescript
import Edgee from "edgee";

const edgee = new Edgee(process.env.EDGEE_API_KEY);
```

### Simple Input

```typescript
const response = await edgee.send({
  model: "gpt-4o",
  input: "What is the capital of France?",
});

console.log(response.choices[0].message.content);
```

### Full Input with Messages

```typescript
const response = await edgee.send({
  model: "gpt-4o",
  input: {
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello!" },
    ],
  },
});
```

## Tools

The SDK supports two modes for working with tools:

### Simple Mode: Automatic Tool Execution

Use the `Tool` class with Zod schemas for automatic tool execution. The SDK will handle the entire agentic loop for you:

```typescript
import Edgee, { Tool, z } from "edgee";

const edgee = new Edgee(process.env.EDGEE_API_KEY);

// Define a tool with Zod schema and handler
const weatherTool = new Tool({
  name: "get_weather",
  description: "Get the current weather for a location",
  schema: z.object({
    location: z.string().describe("The city name"),
  }),
  handler: async (args) => {
    // Your implementation here
    return { temperature: 22, condition: "sunny", location: args.location };
  },
});

// The SDK automatically:
// 1. Sends the request with tools
// 2. Executes tools when the model requests them
// 3. Sends results back to the model
// 4. Returns the final response
const response = await edgee.send({
  model: "gpt-4o",
  input: "What's the weather in Paris?",
  tools: [weatherTool],
});

console.log(response.choices[0].message.content);
// "The weather in Paris is sunny with a temperature of 22°C."
```

#### Multiple Tools

```typescript
const calculatorTool = new Tool({
  name: "calculate",
  description: "Perform arithmetic operations",
  schema: z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    a: z.number(),
    b: z.number(),
  }),
  handler: async ({ operation, a, b }) => {
    const ops = {
      add: a + b,
      subtract: a - b,
      multiply: a * b,
      divide: b !== 0 ? a / b : "Error: division by zero",
    };
    return { result: ops[operation] };
  },
});

const response = await edgee.send({
  model: "gpt-4o",
  input: "What's 25 * 4, and what's the weather in London?",
  tools: [weatherTool, calculatorTool],
});
```

#### Configuration Options

```typescript
const response = await edgee.send({
  model: "gpt-4o",
  input: "Complex query requiring multiple tool calls",
  tools: [tool1, tool2],
  maxToolIterations: 15, // Default: 10
});
```

### Advanced Mode: Manual Tool Handling

For full control over tool execution, use the advanced mode with raw tool definitions:

```typescript
const response = await edgee.send({
  model: "gpt-4o",
  input: {
    messages: [{ role: "user", content: "What's the weather in Paris?" }],
    tools: [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather for a location",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string" },
            },
          },
        },
      },
    ],
    tool_choice: "auto",
  },
});

// Handle tool calls manually
if (response.choices[0].message.tool_calls) {
  console.log(response.choices[0].message.tool_calls);
  // Execute tools and send results back...
}
```

## Response

```typescript
interface SendResponse {
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

## API Reference

### `Tool` Class

```typescript
import { Tool, z } from "edgee";

const tool = new Tool({
  name: string;           // Unique tool name
  description?: string;   // Tool description for the model
  schema: z.ZodType;      // Zod schema for parameters
  handler: (args) => any; // Function to execute (sync or async)
});

// Methods
tool.toJSON();           // Convert to OpenAI tool format
tool.execute(args);      // Validate and execute handler
```

### `createTool` Helper

```typescript
import { createTool, z } from "edgee";

const tool = createTool({
  name: "my_tool",
  schema: z.object({ ... }),
  handler: (args) => { ... },
});
```

