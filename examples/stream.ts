/**
 * Simple streaming without tools
 *
 * Stream responses token by token for real-time output.
 */
import "dotenv/config";
import Edgee from "edgee";

const edgee = new Edgee({
  apiKey: process.env.EDGEE_API_KEY,
  baseUrl: process.env.EDGEE_BASE_URL,
});

process.stdout.write("Response: ");

for await (const chunk of edgee.stream("devstral2", "Say hello in 10 words!")) {
  process.stdout.write(chunk.text ?? "");
}

console.log();
