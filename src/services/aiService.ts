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
      - category: string (required, must be one of: Bibles, Tracts, Study Guides, Magazines, Other)
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
                enum: ['Bibles', 'Tracts', 'Study Guides', 'Magazines', 'Other']
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
    throw new Error("Failed to parse data with AI. Please check your format.");
  }
}
