import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateProductDescription(productName: string, category: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Напиши емоційний та затишний опис для товару "${productName}" у категорії "${category}" для магазину "Хатні Штучки". Стиль: IKEA + Zara Home + українська душевність. Опис має бути коротким (2-3 речення) та підкреслювати естетику та практичність.`,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating description:", error);
    return "Чудовий вибір для вашого дому, що додасть затишку та комфорту кожному дню.";
  }
}

export async function generateLifestyleImagePrompt(productName: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Створи детальний промпт для генерації зображення (image generation prompt) для товару "${productName}". Стиль: світлий інтер'єр, мінімалізм, тепле освітлення, естетика затишного дому.`,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating prompt:", error);
    return `A cozy home setting with ${productName}, minimalist aesthetic, warm lighting.`;
  }
}
