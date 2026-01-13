import Edgee, { Tool, z } from "edgee";

const edgee = new Edgee(process.env.EDGEE_API_KEY || "test-key");

// Test 1: Simple string input
console.log("Test 1: Simple string input");
const response1 = await edgee.send({
  model: "gpt-4o",
  input: "What is the capital of France?",
});
console.log("Content:", response1.choices[0].message.content);
console.log("Usage:", response1.usage);
console.log();

// Test 2: Full input object with messages
console.log("Test 2: Full input object with messages");
const response2 = await edgee.send({
  model: "gpt-4o",
  input: {
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Say hello!" },
    ],
  },
});
console.log("Content:", response2.choices[0].message.content);
console.log();

// Test 3: Advanced mode - Manual tool handling
console.log("Test 3: Advanced mode - Manual tool handling");
const response3 = await edgee.send({
  model: "gpt-4o",
  input: {
    messages: [{ role: "user", content: "What is the weather in Paris?" }],
    tools: [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get the current weather for a location",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string", description: "City name" },
            },
            required: ["location"],
          },
        },
      },
    ],
    tool_choice: "auto",
  },
});
console.log("Content:", response3.choices[0].message.content);
console.log(
  "Tool calls:",
  JSON.stringify(response3.choices[0].message.tool_calls, null, 2)
);
console.log();

// Test 4: Simple mode - Automatic tool execution with Tool class
console.log("Test 4: Simple mode - Automatic tool execution");

// Define a weather tool with Zod schema and handler
const weatherTool = new Tool({
  name: "get_weather",
  description: "Get the current weather for a location",
  schema: z.object({
    location: z.string().describe("The city name"),
  }),
  handler: async (args) => {
    // Simulated weather API response
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

const response4 = await edgee.send({
  model: "gpt-4o",
  input: "What's the weather like in Paris?",
  tools: [weatherTool],
});
console.log("Content:", response4.choices[0].message.content);
console.log("Total usage:", response4.usage);
console.log();

// Test 5: Multiple tools with automatic execution
console.log("Test 5: Multiple tools with automatic execution");

const calculatorTool = new Tool({
  name: "calculate",
  description:
    "Perform basic arithmetic operations (add, subtract, multiply, divide)",
  schema: z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    a: z.number(),
    b: z.number(),
  }),
  handler: async ({ operation, a, b }) => {
    const operations = {
      add: a + b,
      subtract: a - b,
      multiply: a * b,
      divide: b !== 0 ? a / b : "Error: division by zero",
    };
    return {
      operation,
      a,
      b,
      result: operations[operation],
    };
  },
});

const response5 = await edgee.send({
  model: "gpt-4o",
  input: "What's 25 multiplied by 4, and then what's the weather in London?",
  tools: [weatherTool, calculatorTool],
});
console.log("Content:", response5.choices[0].message.content);
console.log("Total usage:", response5.usage);
console.log();
