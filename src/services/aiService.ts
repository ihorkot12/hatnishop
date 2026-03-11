import { GoogleGenAI } from "@google/genai";

const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
      contents: [{ role: "user", parts: [{ text: `Напиши короткий, привабливий опис для товару "${name}" у категорії "${category || 'Дім'}". Опис має бути в стилі магазину затишних речей "Хатні Штучки". Використовуй українську мову. Максимум 2-3 речення. Не використовуй лапки.` }] }],
    });
    return response.text;
  });
};

export const generateProductImage = async (name: string, category: string) => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            text: `Професійне рекламне фото товару "${name}" у категорії "${category || 'Дім'}". Стиль: затишний, мінімалістичний, преміальний, з м'яким освітленням. Фон має бути нейтральним або відповідати категорії. Без тексту на зображенні. Висока якість, реалістичність.`,
          },
        ],
      },
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
    
    // If we get here, check if there's text (maybe a refusal)
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
