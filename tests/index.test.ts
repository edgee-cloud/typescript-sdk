import { describe, it, expect, beforeEach, vi } from 'vitest';
import Edgee, { type SendOptions, type SendResponse } from '../src/index.js';

describe('Edgee', () => {
  const mockApiKey = 'test-api-key-12345';
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    // Clear environment variable
    delete process.env.EDGEE_API_KEY;
  });

  describe('constructor', () => {
    it('should use provided API key', () => {
      const client = new Edgee(mockApiKey);
      expect(client).toBeInstanceOf(Edgee);
    });

    it('should use EDGEE_API_KEY environment variable when no API key provided', () => {
      process.env.EDGEE_API_KEY = 'env-api-key';
      const client = new Edgee();
      expect(client).toBeInstanceOf(Edgee);
    });

    it('should throw error when no API key is provided and EDGEE_API_KEY is not set', () => {
      expect(() => new Edgee()).toThrow('EDGEE_API_KEY is not set');
    });

    it('should throw error when empty string is provided as API key', () => {
      expect(() => new Edgee('')).toThrow('EDGEE_API_KEY is not set');
    });
  });

  describe('send', () => {
    let client: Edgee;

    beforeEach(() => {
      client = new Edgee(mockApiKey);
    });

    it('should send a request with string input', async () => {
      const mockResponse: SendResponse = {
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello, world!',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const options: SendOptions = {
        model: 'gpt-4',
        input: 'Hello',
      };

      const result = await client.send(options);

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.edgee.ai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
          }),
        }
      );

      expect(result).toEqual(mockResponse);
      expect(result.choices).toHaveLength(1);
      expect(result.choices[0].message.content).toBe('Hello, world!');
    });

    it('should send a request with InputObject', async () => {
      const mockResponse: SendResponse = {
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response',
            },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const options: SendOptions = {
        model: 'gpt-4',
        input: {
          messages: [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'Hello' },
          ],
        },
      };

      const result = await client.send(options);

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.edgee.ai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [
              { role: 'system', content: 'You are a helpful assistant' },
              { role: 'user', content: 'Hello' },
            ],
          }),
        }
      );

      expect(result).toEqual(mockResponse);
    });

    it('should include tools when provided in InputObject', async () => {
      const mockResponse: SendResponse = {
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location": "San Francisco"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'get_weather',
            description: 'Get the weather for a location',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
            },
          },
        },
      ];

      const options: SendOptions = {
        model: 'gpt-4',
        input: {
          messages: [{ role: 'user', content: 'What is the weather?' }],
          tools,
          tool_choice: 'auto',
        },
      };

      const result = await client.send(options);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.tools).toEqual(tools);
      expect(callBody.tool_choice).toBe('auto');
      expect(result.choices[0].message.tool_calls).toBeDefined();
    });

    it('should include tool_choice when provided', async () => {
      const mockResponse: SendResponse = {
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
            },
            finish_reason: 'tool_calls',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const options: SendOptions = {
        model: 'gpt-4',
        input: {
          messages: [{ role: 'user', content: 'Test' }],
          tool_choice: {
            type: 'function',
            function: { name: 'specific_function' },
          },
        },
      };

      await client.send(options);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.tool_choice).toEqual({
        type: 'function',
        function: { name: 'specific_function' },
      });
    });

    it('should handle response without usage field', async () => {
      const mockResponse: SendResponse = {
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response',
            },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.send({
        model: 'gpt-4',
        input: 'Test',
      });

      expect(result.usage).toBeUndefined();
      expect(result.choices).toHaveLength(1);
    });

    it('should handle multiple choices in response', async () => {
      const mockResponse: SendResponse = {
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'First response',
            },
            finish_reason: 'stop',
          },
          {
            index: 1,
            message: {
              role: 'assistant',
              content: 'Second response',
            },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.send({
        model: 'gpt-4',
        input: 'Test',
      });

      expect(result.choices).toHaveLength(2);
      expect(result.choices[0].message.content).toBe('First response');
      expect(result.choices[1].message.content).toBe('Second response');
    });
  });
});

