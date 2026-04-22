import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please set GEMINI_API_KEY or VITE_GEMINI_API_KEY.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export interface ParsedInventoryItem {
  sku: string;
  title: string;
  subtitle?: string;
  category: string;
  language?: string;
  stockLevel: number;
  status: 'Healthy' | 'Low' | 'Out';
}

export interface ParsedEventMaterial {
  sku: string;
  quantity: number;
  title?: string; // AI might infer title from context if possible, but SKU is primary
}

export interface ParsedEvent {
  name: string;
  date: string; // ISO format or clear date string
  location: string;
  status: 'Scheduled' | 'Stock Alert' | 'Completed';
  materials: ParsedEventMaterial[];
  stats?: {
    bibles: number;
    tracts: number;
    booklets: number;
    total: number;
  };
}

export async function parseInventoryData(rawData: string, categories: string[] = ['Bibles', 'Tracts', 'Booklets']): Promise<ParsedInventoryItem[]> {
  try {
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse the following inventory data into a structured JSON format. 
      The data might be from a CSV, a list, or a messy text block.
      
      Schema:
      - sku: string (required). 
        IMPORTANT SKU RULES:
        1. If language is English, the SKU must end with "-001".
        2. If language is Spanish, the SKU must end with "-002".
        3. If your base SKU is "TR-001", for English use "TR-001-001", for Spanish use "TR-001-002".
        4. Apply this suffix logic even if the raw data provides a different SKU, to ensure consistency between languages for the same material title.
      - title: string (required)
      - subtitle: string (optional)
      - category: string (required, must be one of: ${categories.join(', ')})
      - language: string (optional)
      - stockLevel: number (required)
      - status: string (required, must be one of: Healthy, Low, Out. Logic: Healthy > 250, Low <= 250, Out = 0)
      
      Data to parse:
      ${rawData}
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sku: { type: Type.STRING },
              title: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              category: { 
                type: Type.STRING,
                enum: categories
              },
              language: { type: Type.STRING },
              stockLevel: { type: Type.NUMBER },
              status: { 
                type: Type.STRING,
                enum: ['Healthy', 'Low', 'Out']
              }
            },
            required: ['sku', 'title', 'category', 'stockLevel', 'status']
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Parsing failed:", error);
    throw new Error("Failed to parse inventory data with AI.");
  }
}

export async function parseEventData(rawData: string): Promise<ParsedEvent[]> {
  try {
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse the following event distribution data into a structured JSON format. 
      The data might contain multiple rows for the same event showing different materials distributed. 
      Group materials by event.
      
      Schema:
      - name: string (Event name)
      - date: string (ISO date string YYYY-MM-DD)
      - location: string
      - status: string (Scheduled, Stock Alert, or Completed)
      - materials: array of objects
        - sku: string (Rules: 
            1. If a specific item SKU is mentioned (e.g. "TR-001-001"), use it. 
            2. If a generic category total is mentioned, use uppercase categorical SKUs with language suffixes if specified:
               - 'BIBLES', 'BIBLES_EN', 'BIBLES_ES'
               - 'TRACTS', 'TRACTS_EN', 'TRACTS_ES'
               - 'BOOKLETS', 'BOOKLETS_EN', 'BOOKLETS_ES'
               - Examples: "50 Spanish Bibles" -> 'BIBLES_ES', "100 Tracts" -> 'TRACTS', "20 English Booklets" -> 'BOOKLETS_EN'.
            3. If it's just a raw number with no category, use 'GENERAL'.)
        - quantity: number
        - title: string (descriptive title e.g. "Total Spanish Bibles", "Steps to Christ - English")
      
      CRITICAL: Use the language-specific SKUs ('_EN', '_ES') whenever language is mentioned in bulk counts.
      
      Data to parse:
      ${rawData}
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              date: { type: Type.STRING },
              location: { type: Type.STRING },
              status: { 
                type: Type.STRING,
                enum: ['Scheduled', 'Stock Alert', 'Completed']
              },
              materials: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sku: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    title: { type: Type.STRING }
                  },
                  required: ['sku', 'quantity']
                }
              }
            },
            required: ['name', 'date', 'location', 'status', 'materials']
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Event Parsing failed:", error);
    throw new Error("Failed to parse event data with AI.");
  }
}
