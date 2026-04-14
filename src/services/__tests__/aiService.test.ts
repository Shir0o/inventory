import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseInventoryData } from '../aiService';
import { GoogleGenAI } from "@google/genai";

// Mock GoogleGenAI
vi.mock("@google/genai", () => {
  const generateContentMock = vi.fn();
  return {
    GoogleGenAI: vi.fn().mockImplementation(function() {
      return {
        models: {
          generateContent: generateContentMock,
        },
      };
    }),
    Type: {
      OBJECT: 'OBJECT',
      ARRAY: 'ARRAY',
      STRING: 'STRING',
      NUMBER: 'NUMBER',
    }
  };
});

describe('aiService - parseInventoryData', () => {
  it('successfully parses inventory data', async () => {
    const aiInstance = new GoogleGenAI({ apiKey: 'test' });
    const generateContentMock = aiInstance.models.generateContent;

    const mockResponse = [
      {
        sku: 'B001',
        title: 'NKJV Bible',
        category: 'Bibles',
        stockLevel: 500,
        status: 'Healthy'
      }
    ];

    (generateContentMock as any).mockResolvedValueOnce({
      text: JSON.stringify(mockResponse)
    });

    const result = await parseInventoryData('B001 NKJV Bible 500');
    
    expect(result).toEqual(mockResponse);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(generateContentMock).toHaveBeenCalledWith(expect.objectContaining({
      contents: expect.stringContaining('B001 NKJV Bible 500')
    }));
  });

  it('returns empty array when AI response is empty', async () => {
    const aiInstance = new GoogleGenAI({ apiKey: 'test' });
    const generateContentMock = aiInstance.models.generateContent;

    (generateContentMock as any).mockResolvedValueOnce({
      text: ''
    });

    const result = await parseInventoryData('empty');
    expect(result).toEqual([]);
  });

  it('throws error when AI parsing fails', async () => {
    const aiInstance = new GoogleGenAI({ apiKey: 'test' });
    const generateContentMock = aiInstance.models.generateContent;

    (generateContentMock as any).mockRejectedValueOnce(new Error('AI Error'));

    await expect(parseInventoryData('error')).rejects.toThrow('Failed to parse data with AI');
  });
});
