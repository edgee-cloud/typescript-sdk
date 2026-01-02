import { describe, it, expect, beforeEach, vi } from 'vitest';
import Edgee, { type SendOptions, type SendResponse } from '../src/index.js';

describe('Edgee', () => {
  const mockApiKey = 'test-api-key-12345';
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    // Clear environment variables
    delete process.env.EDGEE_API_KEY;
    delete process.env.EDGEE_BASE_URL;
  });

  describe('constructor', () => {
    describe('with string API key (backward compatibility)', () => {
      it('should use provided API key', () => {
        const client = new Edgee(mockApiKey);
        expect(client).toBeInstanceOf(Edgee);
      });

      it('should throw error when empty string is provided as API key', () => {
        expect(() => new Edgee('')).toThrow('EDGEE_API_KEY is not set');
      });
    });

    describe('with config object', () => {
      it('should use provided API key and baseUrl', () => {
        const customBaseUrl = 'https://custom-api.example.com';
        const client = new Edgee({ apiKey: mockApiKey, baseUrl: customBaseUrl });
        expect(client).toBeInstanceOf(Edgee);
      });

      it('should use provided API key with default baseUrl when baseUrl not provided', () => {
        const client = new Edgee({ apiKey: mockApiKey });
        expect(client).toBeInstanceOf(Edgee);
      });

      it('should use EDGEE_API_KEY environment variable when apiKey not provided in config', () => {
        process.env.EDGEE_API_KEY = 'env-api-key';
        const customBaseUrl = 'https://custom-api.example.com';
        const client = new Edgee({ baseUrl: customBaseUrl });
        expect(client).toBeInstanceOf(Edgee);
      });

      it('should use EDGEE_BASE_URL environment variable when baseUrl not provided in config', () => {
        process.env.EDGEE_API_KEY = 'env-api-key';
        process.env.EDGEE_BASE_URL = 'https://env-base-url.example.com';
        const client = new Edgee({ apiKey: mockApiKey });
        expect(client).toBeInstanceOf(Edgee);
      });

      it('should use both environment variables when config object is empty', () => {
        process.env.EDGEE_API_KEY = 'env-api-key';
        process.env.EDGEE_BASE_URL = 'https://env-base-url.example.com';
        const client = new Edgee({});
        expect(client).toBeInstanceOf(Edgee);
      });

      it('should throw error when no API key is provided in config and EDGEE_API_KEY is not set', () => {
        expect(() => new Edgee({})).toThrow('EDGEE_API_KEY is not set');
      });

      it('should throw error when empty string is provided as apiKey in config', () => {
        expect(() => new Edgee({ apiKey: '' })).toThrow('EDGEE_API_KEY is not set');
      });
    });

    describe('without arguments', () => {
      it('should use EDGEE_API_KEY environment variable when no API key provided', () => {
        process.env.EDGEE_API_KEY = 'env-api-key';
        const client = new Edgee();
        expect(client).toBeInstanceOf(Edgee);
      });

      it('should throw error when no API key is provided and EDGEE_API_KEY is not set', () => {
        expect(() => new Edgee()).toThrow('EDGEE_API_KEY is not set');
      });
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

    it('should use custom baseUrl when provided in constructor', async () => {
      const customBaseUrl = 'https://custom-api.example.com';
      const customClient = new Edgee({ apiKey: mockApiKey, baseUrl: customBaseUrl });

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

      await customClient.send({
        model: 'gpt-4',
        input: 'Test',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${customBaseUrl}/v1/chat/completions`,
        expect.any(Object)
      );
    });

    it('should use EDGEE_BASE_URL environment variable when baseUrl not provided', async () => {
      const envBaseUrl = 'https://env-base-url.example.com';
      process.env.EDGEE_BASE_URL = envBaseUrl;
      const envClient = new Edgee(mockApiKey);

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

      await envClient.send({
        model: 'gpt-4',
        input: 'Test',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${envBaseUrl}/v1/chat/completions`,
        expect.any(Object)
      );
    });

    it('should use default baseUrl when neither custom baseUrl nor EDGEE_BASE_URL is provided', async () => {
      const defaultClient = new Edgee(mockApiKey);

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

      await defaultClient.send({
        model: 'gpt-4',
        input: 'Test',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.edgee.ai/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('should prioritize config baseUrl over EDGEE_BASE_URL environment variable', async () => {
      const configBaseUrl = 'https://config-base-url.example.com';
      process.env.EDGEE_BASE_URL = 'https://env-base-url.example.com';
      const configClient = new Edgee({ apiKey: mockApiKey, baseUrl: configBaseUrl });

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

      await configClient.send({
        model: 'gpt-4',
        input: 'Test',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${configBaseUrl}/v1/chat/completions`,
        expect.any(Object)
      );
    });
  });
});

