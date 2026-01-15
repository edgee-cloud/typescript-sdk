/**
 * Multiple tools with automatic execution
 *
 * Pass multiple tools and the model will decide
 * which ones to call based on the user's request.
 */
import "dotenv/config";
import Edgee, { Tool, z } from "edgee";

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

const response = await edgee.send({
  model: "devstral2",
  input: "What's 25 multiplied by 4, and then what's the weather in London?",
  tools: [weatherTool, calculatorTool],
});

console.log("Content:", response.text);
console.log("Total usage:", response.usage);
