import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set. AI features may not work.");
  }
  return new GoogleGenAI({ apiKey: apiKey || "" });
};

const cleanJSON = (text: string) => {
  if (!text) return "[]";
  // Remove markdown code blocks if present
  return text.replace(/```json\n?|```/g, '').trim();
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0) throw error;
    
    // If it's a rate limit error (429) or 500/503, retry
    const status = error?.status || error?.code;
    if (status === 429 || status === 500 || status === 503 || !status) {
      console.warn(`AI API error, retrying... (${retries} left)`, error);
      await sleep(delay);
      return withRetry(fn, retries - 1, delay * 1.5);
    }
    throw error;
  }
};

export const generateDescription = async (name: string, category: string) => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: `Напиши короткий, привабливий опис для товару "${name}" у категорії "${category || 'Дім'}". Опис має бути в стилі магазину затишних речей "Хатні Штучки" (затишок, тепло, естетика). Використовуй українську мову. Максимум 2-3 речення. Не використовуй лапки та вступні фрази.` }] }],
    });
    return response.text;
  });
};

export const generateStylingTip = async (name: string, category: string) => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: `Напиши коротку пораду (styling tip) як використовувати або стилізувати товар "${name}" у категорії "${category || 'Дім'}" в інтер'єрі. Стиль: затишний, надихаючий. Використовуй українську мову. Максимум 2 речення.` }] }],
    });
    return response.text;
  });
};

export const generateLifestyleImagePrompt = async (name: string) => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: `Створи детальний промпт для генерації зображення (image generation prompt) для товару "${name}". Стиль: світлий інтер'єр, мінімалізм, тепле освітлення, естетика затишного дому. Промпт має бути англійською мовою.` }] }],
    });
    return response.text;
  });
};

export const generateProductImage = async (name: string, category: string, base64Image?: string) => {
  return withRetry(async () => {
    const ai = getAI();
    
    const prompt = `Професійне рекламне фото товару "${name}" у категорії "${category || 'Дім'}". 
    Стиль: затишний, мінімалістичний, преміальний, з м'яким освітленням. 
    Фон має бути нейтральним або відповідати категорії. Без тексту на зображенні. Висока якість, реалістичність.
    ${base64Image ? 'Використовуй надане зображення як референс для форми, кольору та дизайну товару, але зроби його професійним та естетичним.' : ''}`;

    const parts: any[] = [{ text: prompt }];

    if (base64Image) {
      const match = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        });
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
    if (textPart) {
      throw new Error(`Model refused to generate image: ${textPart.text}`);
    }
    
    throw new Error("Failed to generate image: No image data in response");
  });
};

export const chatWithAI = async (message: string, productsContext: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      { 
        role: "user", 
        parts: [{ text: `Ти - Штучка-Помічник, AI асистент магазину "Хатні Штучки". 
        Твоя мета - допомагати клієнтам обирати товари для дому, відповідати на питання про асортимент та допомагати з оформленням.
        Будь привітним, використовуй емодзі. 
        Ось наш асортимент:\n${productsContext}\n\nКлієнт каже: ${message}` }] 
      }
    ],
    config: {
      systemInstruction: "Ти - Штучка-Помічник, AI асистент магазину 'Хатні Штучки'. Відповідай українською мовою."
    }
  });
  return response.text;
};

export const suggestBundleItems = async (productName: string, productCategory: string, allProducts: any[]) => {
  return withRetry(async () => {
    const ai = getAI();
    const productsList = allProducts.map(p => `- ${p.name} (ID: ${p.id}, Категорія: ${p.category})`).join('\n');
    
    const prompt = `Ти - експерт з дизайну інтер'єру та мерчандайзингу магазину "Хатні Штучки". 
    Твоє завдання - підібрати 2-4 товари з нашого асортименту, які ідеально доповнюють товар "${productName}" (категорія: ${productCategory}), щоб створити гармонійний набір (бандл).
    
    Ось список доступних товарів:
    ${productsList}
    
    Вибери товари, які логічно поєднуються за стилем, використанням або естетикою.
    Відповідь надай ТІЛЬКИ у форматі JSON масиву з ID вибраних товарів, наприклад: ["id1", "id2"].
    Не пиши ніякого тексту, окрім JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });
    
    try {
      const text = cleanJSON(response.text || "[]");
      console.log("AI Bundle Suggestion Raw:", response.text);
      console.log("AI Bundle Suggestion Cleaned:", text);
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Failed to parse AI bundle suggestion:", e);
      console.log("Raw response that failed to parse:", response.text);
      return [];
    }
  });
};
