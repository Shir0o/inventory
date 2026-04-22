import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
}

export async function parseInventoryData(rawData: string): Promise<ParsedInventoryItem[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse the following inventory data into a structured JSON format. 
      The data might be from a CSV, a list, or a messy text block.
      
      Schema:
      - sku: string (required)
      - title: string (required)
      - subtitle: string (optional)
      - category: string (required, must be one of: Bibles, Tracts, Booklets)
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
                enum: ['Bibles', 'Tracts', 'Booklets']
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
    const response = await ai.models.generateContent({
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
        - sku: string (SKU of the material)
        - quantity: number (count distributed)
        - title: string (optional, title of material if mentioned)
      
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
