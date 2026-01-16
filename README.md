# Edgee TypeScript SDK

Lightweight, type-safe TypeScript SDK for the [Edgee AI Gateway](https://www.edgee.cloud).

[![npm version](https://img.shields.io/npm/v/edgee.svg)](https://www.npmjs.com/package/edgee)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

## Installation

```bash
npm install edgee
```

## Quick Start

```typescript
import Edgee from 'edgee';

const edgee = new Edgee("your-api-key");

// Send a simple request
const response = await edgee.send({
  model: 'gpt-4o',
  input: 'What is the capital of France?',
});

console.log(response.text);
// "The capital of France is Paris."
```

## Send Method

The `send()` method makes non-streaming chat completion requests:

```typescript
const response = await edgee.send({
  model: 'gpt-4o',
  input: 'Hello, world!',
});

// Access response
console.log(response.text);           // Text content
console.log(response.finishReason);   // Finish reason
console.log(response.toolCalls);      // Tool calls (if any)
```

## Stream Method

The `stream()` method enables real-time streaming responses:

```typescript
for await (const chunk of edgee.stream('gpt-4o', 'Tell me a story')) {
  if (chunk.text) {
    process.stdout.write(chunk.text);
  }
  
  if (chunk.finishReason) {
    console.log(`\nFinished: ${chunk.finishReason}`);
  }
}
```

## Features

- ✅ **Type-safe** - Full TypeScript support with comprehensive types
- ✅ **OpenAI-compatible** - Works with any model supported by Edgee
- ✅ **Streaming** - Real-time response streaming
- ✅ **Tool calling** - Full support for function calling
- ✅ **Flexible input** - Accept strings or structured objects
- ✅ **Zero dependencies** - Lightweight and fast

## Documentation

For complete documentation, examples, and API reference, visit:

**👉 [Official TypeScript SDK Documentation](https://www.edgee.cloud/docs/sdk/typescript)**

The documentation includes:
- [Configuration guide](https://www.edgee.cloud/docs/sdk/typescript/configuration) - Multiple ways to configure the SDK
- [Send method](https://www.edgee.cloud/docs/sdk/typescript/send) - Complete guide to non-streaming requests
- [Stream method](https://www.edgee.cloud/docs/sdk/typescript/stream) - Streaming responses guide
- [Tools](https://www.edgee.cloud/docs/sdk/typescript/tools) - Function calling guide

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.
