/**
 * Streaming with automatic tool execution
 *
 * Combine streaming with auto tool execution.
 * You receive events for chunks, tool starts, and tool results.
 */
import "dotenv/config";
import Edgee, { StreamEvent, Tool, z } from "edgee";

const edgee = new Edgee({
  apiKey: process.env.EDGEE_API_KEY,
  baseUrl: process.env.EDGEE_BASE_URL,
});

// Weather tool
const weatherTool = new Tool({
  name: "get_weather",
  description: "Get the current weather for a location",
  schema: z.object({
    location: z.string().describe("The city name"),
  }),
  handler: async (args) => {
    const weatherData: Record<
      string,
      { temperature: number; condition: string }
    > = {
      Paris: { temperature: 18, condition: "partly cloudy" },
      London: { temperature: 12, condition: "rainy" },
      "New York": { temperature: 22, condition: "sunny" },
    };
    const data = weatherData[args.location] || {
      temperature: 20,
      condition: "unknown",
    };
    return {
      location: args.location,
      temperature: data.temperature,
      condition: data.condition,
    };
  },
});

// Calculator tool
const calculatorTool = new Tool({
  name: "calculate",
  description: "Perform basic arithmetic operations",
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
    return { operation, a, b, result: ops[operation] };
  },
});

console.log("Streaming with tools...\n");
process.stdout.write("Response: ");

const stream: AsyncGenerator<StreamEvent> = edgee.stream({
  model: "devstral2",
  input: "What's 15 multiplied by 7, and what's the weather in Paris?",
  tools: [weatherTool, calculatorTool],
});

for await (const event of stream) {
  switch (event.type) {
    case "chunk":
      // Stream content as it arrives
      process.stdout.write(event.chunk.text ?? "");
      break;

    case "tool_start":
      // Tool is about to be executed
      console.log(`\n  [Tool starting: ${event.toolCall.function.name}]`);
      break;

    case "tool_result":
      // Tool finished executing
      console.log(
        `  [Tool result: ${event.toolName} -> ${JSON.stringify(event.result)}]`
      );
      process.stdout.write("Response: ");
      break;

    case "iteration_complete":
      // One iteration of the tool loop completed
      console.log(`  [Iteration ${event.iteration} complete, continuing...]`);
      break;
  }
}

console.log();
