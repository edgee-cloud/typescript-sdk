/**
 * Automatic tool execution (Simple mode)
 *
 * Define tools with Zod schemas and handlers.
 * The SDK automatically executes tools and loops
 * until the model produces a final response.
 */
import "dotenv/config";
import Edgee, { Tool, z } from "edgee";

const edgee = new Edgee({
  apiKey: process.env.EDGEE_API_KEY,
  baseUrl: process.env.EDGEE_BASE_URL,
});

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

const response = await edgee.send({
  model: "devstral2",
  input: "What's the weather like in Paris?",
  tools: [weatherTool],
});

console.log("Content:", response.text);
console.log("Total usage:", response.usage);
