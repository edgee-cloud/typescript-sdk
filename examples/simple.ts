/**
 * Simple string input example
 *
 * The most basic way to use the SDK - just pass a string prompt.
 */
import "dotenv/config";
import Edgee from "edgee";

const edgee = new Edgee({
  apiKey: process.env.EDGEE_API_KEY,
  baseUrl: process.env.EDGEE_BASE_URL,
});

const response = await edgee.send({
  model: "devstral2",
  input: "What is the capital of France?",
});

console.log("Content:", response.text);
console.log("Usage:", response.usage);
