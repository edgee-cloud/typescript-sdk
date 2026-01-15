/**
 * Full input object with messages
 *
 * Use the messages array for multi-turn conversations
 * and system prompts.
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
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Say hello!" },
    ],
  },
});

console.log("Content:", response.text);
