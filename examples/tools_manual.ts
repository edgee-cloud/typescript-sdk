/**
 * Manual tool handling (Advanced mode)
 *
 * Define tools using raw OpenAI format and handle
 * tool calls manually in your code.
 */
import "dotenv/config";
import Edgee from "edgee";

const edgee = new Edgee({
  apiKey: process.env.EDGEE_API_KEY,
  baseUrl: process.env.EDGEE_BASE_URL,
});

const response = await edgee.send({
  model: "devstral2",
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

console.log("Content:", response.text);
console.log("Tool calls:", JSON.stringify(response.toolCalls, null, 2));

// In manual mode, you would:
// 1. Check if response.toolCalls exists
// 2. Execute the tool yourself
// 3. Send another request with the tool result
