import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface InventoryNeed {
  itemId: string;
  sku: string;
  title: string;
  currentStock: number;
  predictedNeed: number;
  confidence: number;
  reasoning: string;
  priority: 'High' | 'Medium' | 'Low';
}

export async function getInventoryPredictions(
  inventory: any[],
  events: any[],
  auditLogs: any[]
): Promise<InventoryNeed[]> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is not set. Predictive analysis will not work.");
    return [];
  }

  // Prepare data for the prompt
  const inventoryData = inventory.map(item => ({
    id: item.id,
    sku: item.sku,
    title: item.title,
    category: item.category,
    language: item.language,
    stockLevel: item.stockLevel,
    status: item.status
  }));

  const eventData = events.map(event => ({
    name: event.name,
    date: event.date,
    materialsDistributed: event.materialsDistributed,
    status: event.status
  }));

  // Filter logs for distribution actions to see trends
  const trendLogs = auditLogs
    .filter(log => log.action === 'DISTRIBUTION')
    .slice(0, 50) // Last 50 relevant logs
    .map(log => ({
      action: log.action,
      details: log.details,
      timestamp: log.timestamp,
      metadata: log.metadata
    }));

  const prompt = `
    You are an expert inventory analyst for a literature distribution organization.
    Your goal is to predict future inventory procurement needs based on current stock levels, upcoming events, and historical distribution trends.

    Current Inventory:
    ${JSON.stringify(inventoryData, null, 2)}

    Upcoming/Recent Events:
    ${JSON.stringify(eventData, null, 2)}

    Recent Distribution Trends (Audit Logs):
    ${JSON.stringify(trendLogs, null, 2)}

    Analyze this data and identify which items are likely to run out soon or need replenishment to support upcoming events.
    Consider:
    1. Items with low stock levels.
    2. Items that are frequently distributed in large quantities.
    3. Upcoming events that might require specific categories of literature.
    4. Seasonal trends if apparent.

    Return a list of predictions. For each prediction, provide:
    - itemId: The unique ID of the item.
    - sku: The SKU of the item.
    - title: The title of the item.
    - currentStock: Current stock level.
    - predictedNeed: Estimated number of units needed for the next 30 days.
    - confidence: A value between 0 and 1 representing your confidence in this prediction.
    - reasoning: A brief explanation of why this item needs to be replenished.
    - priority: 'High', 'Medium', or 'Low' based on urgency.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              itemId: { type: Type.STRING },
              sku: { type: Type.STRING },
              title: { type: Type.STRING },
              currentStock: { type: Type.NUMBER },
              predictedNeed: { type: Type.NUMBER },
              confidence: { type: Type.NUMBER },
              reasoning: { type: Type.STRING },
              priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
            },
            required: ["itemId", "sku", "title", "currentStock", "predictedNeed", "confidence", "reasoning", "priority"]
          }
        }
      }
    });

    const result = JSON.parse(response.text || "[]");
    return result;
  } catch (error) {
    console.error("Error getting inventory predictions:", error);
    return [];
  }
}
