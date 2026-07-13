import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { GoogleGenAI, Type } from "@google/genai";
import { db } from "./db/index.js";

import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE = process.env.VERCEL
  ? path.join("/tmp", "db_cache.json")
  : path.join(__dirname, "db_cache.json");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && (process.env.NODE_ENV === "production" || process.env.VERCEL)) {
  throw new Error("JWT_SECRET is required in production");
}
const jwtSecret = JWT_SECRET || "dev-secret-change-me";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" || !!process.env.VERCEL,
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60 * 1000
};

const clearCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" || !!process.env.VERCEL,
  sameSite: "lax" as const
};

const requireAdmin = (req: any, res: any) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
};

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
};

const getOpenAIKey = () => process.env.OPENAI_API_KEY || "";
const getOpenAIImageKey = getOpenAIKey;
const getOpenAIImageModel = () => process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const getOpenAITextModel = () => process.env.OPENAI_TEXT_MODEL || "gpt-5.4-mini";

const buildProductImagePrompt = (name: string, category?: string, shotDirection?: string) => [
  `Professional ecommerce product photo for "${name}" in category "${category || "home"}".`,
  "Realistic studio product photography, premium Ukrainian home goods shop aesthetic.",
  "Soft natural light, clean neutral background, accurate object shape and material, no text, no logos, no watermark.",
  "Square composition, product centered, suitable for a catalog card.",
  shotDirection ? `Shot direction: ${shotDirection}` : ""
].filter(Boolean).join(" ");

const extractDataUrlImage = (value: any) => {
  const match = String(value || "").match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i);
  if (!match) return null;
  const mimeType = match[1].toLowerCase().replace("image/jpg", "image/jpeg");
  const extension = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  return {
    mimeType,
    extension,
    buffer: Buffer.from(match[2], "base64")
  };
};

const parseOpenAIImageResponse = (data: any) => {
  const b64 = data?.data?.[0]?.b64_json;
  if (typeof b64 !== "string" || !b64) {
    throw Object.assign(new Error("OpenAI image generation returned no image"), { status: 502 });
  }
  return `data:image/png;base64,${b64}`;
};

const parseProviderErrorMessage = (error: any) => {
  const raw = String(error?.message || error?.sourceError || error || "");
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || parsed?.message || raw;
  } catch {
    return raw;
  }
};

const openAIImageError = (status: number, data: any, rawText: string) => {
  const providerMessage = data?.error?.message || data?.message || rawText || "OpenAI image request failed";
  const isBillingLimit = /billing hard limit/i.test(providerMessage);
  const message = isBillingLimit
    ? "OpenAI image generation billing hard limit has been reached"
    : status === 429
    ? "OpenAI image generation quota or rate limit exceeded"
    : `OpenAI image generation failed (${status}): ${providerMessage}`;
  return Object.assign(new Error(message), {
    status: isBillingLimit ? 402 : status,
    sourceError: providerMessage
  });
};

const requestOpenAIImage = async (name: string, category?: string, base64Image?: string, shotDirection?: string) => {
  const apiKey = getOpenAIImageKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const model = getOpenAIImageModel();
  const prompt = buildProductImagePrompt(name, category, shotDirection);
  const referenceImage = extractDataUrlImage(base64Image);
  const endpoint = referenceImage
    ? "https://api.openai.com/v1/images/edits"
    : "https://api.openai.com/v1/images/generations";

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`
  };
  let body: BodyInit;

  if (referenceImage) {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", `${prompt} Use the provided image as the product reference and improve it into a clean catalog photo.`);
    form.append("size", "1024x1024");
    form.append(
      "image",
      new Blob([referenceImage.buffer], { type: referenceImage.mimeType }),
      `reference.${referenceImage.extension}`
    );
    body = form;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({
      model,
      prompt,
      size: "1024x1024",
      n: 1
    });
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body
  });
  const rawText = await response.text();
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw openAIImageError(response.status, data, rawText);
  }

  return parseOpenAIImageResponse(data);
};

const openAITextError = (status: number, data: any, rawText: string) => {
  const providerMessage = data?.error?.message || data?.message || rawText || "OpenAI text request failed";
  const isBillingLimit = /billing hard limit/i.test(providerMessage);
  const message = isBillingLimit
    ? "OpenAI text generation billing hard limit has been reached"
    : status === 429
    ? "OpenAI text generation quota or rate limit exceeded"
    : `OpenAI text generation failed (${status}): ${providerMessage}`;
  return Object.assign(new Error(message), {
    status: isBillingLimit ? 402 : status,
    sourceError: providerMessage
  });
};

const parseOpenAITextResponse = (data: any) => {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const text = Array.isArray(data?.output)
    ? data.output
        .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
        .map((content: any) => content?.text || content?.output_text || "")
        .filter(Boolean)
        .join("\n")
        .trim()
    : "";

  if (!text) {
    throw Object.assign(new Error("OpenAI text generation returned no text"), { status: 502 });
  }

  return text;
};

const requestOpenAIText = async (input: string, instructions?: string) => {
  const apiKey = getOpenAIKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: getOpenAITextModel(),
      input,
      ...(instructions ? { instructions } : {}),
      store: false
    })
  });

  const rawText = await response.text();
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw openAITextError(response.status, data, rawText);
  }

  return parseOpenAITextResponse(data);
};

const cleanJSON = (text: string) => text.replace(/```json\n?|```/g, "").trim();

const getWebImageSearchConfig = () => ({
  provider: "google-custom-search",
  apiKey: process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_CSE_API_KEY || "",
  cx: process.env.GOOGLE_SEARCH_ENGINE_ID || process.env.GOOGLE_CSE_ID || process.env.GOOGLE_CX || ""
});

const buildProductImageSearchQuery = (name: string, category?: string) => [
  String(name || "").trim(),
  category ? String(category).trim() : "",
  "фото товару купити Україна"
].filter(Boolean).join(" ");

const buildGoogleImageSearchUrl = (query: string) =>
  `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;

const searchWebImageCandidates = async (name: string, category?: string, limit = 8) => {
  const query = buildProductImageSearchQuery(name, category);
  const openSearchUrl = buildGoogleImageSearchUrl(query);
  const config = getWebImageSearchConfig();

  if (!config.apiKey || !config.cx) {
    return {
      configured: false,
      provider: config.provider,
      query,
      openSearchUrl,
      candidates: [] as Array<{ url: string; title: string; source: string }>
    };
  }

  const searchUrl = new URL("https://www.googleapis.com/customsearch/v1");
  searchUrl.searchParams.set("key", config.apiKey);
  searchUrl.searchParams.set("cx", config.cx);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("searchType", "image");
  searchUrl.searchParams.set("num", String(Math.max(1, Math.min(10, limit))));
  searchUrl.searchParams.set("safe", "active");
  searchUrl.searchParams.set("imgSize", "large");

  const response = await fetch(searchUrl);
  const rawText = await response.text();
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.error?.message || rawText || "Image search failed";
    throw Object.assign(new Error(`Google image search failed (${response.status}): ${message}`), {
      status: response.status,
      provider: config.provider
    });
  }

  const candidates = (Array.isArray(data?.items) ? data.items : [])
    .map((item: any) => ({
      url: String(item?.link || ""),
      title: String(item?.title || item?.displayLink || ""),
      source: String(item?.image?.contextLink || item?.displayLink || "")
    }))
    .filter((item: any) => /^https?:\/\//i.test(item.url));

  return {
    configured: true,
    provider: config.provider,
    query,
    openSearchUrl,
    candidates
  };
};

const requestGeminiProductImage = async (name: string, category?: string, base64Image?: string, shotDirection?: string) => {
  const prompt = buildProductImagePrompt(name, category, shotDirection);
  const parts: any[] = [{ text: prompt }];

  if (base64Image) {
    const match = String(base64Image).match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }
  }

  let response: any;
  try {
    response = await getAI().models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
  } catch (error: any) {
    const providerMessage = parseProviderErrorMessage(error);
    const isQuota = /quota|rate limit|limit exceeded/i.test(providerMessage);
    throw Object.assign(new Error(
      isQuota
        ? "Gemini image generation quota or rate limit exceeded"
        : `Gemini image generation failed: ${providerMessage}`
    ), {
      status: isQuota ? 429 : (error?.status || 500),
      sourceError: providerMessage
    });
  }

  const imagePart = response.candidates?.[0]?.content?.parts?.find((part: any) => part.inlineData);
  if (!imagePart?.inlineData?.data) {
    throw Object.assign(new Error("AI image generation returned no image"), { status: 502 });
  }

  return `data:image/png;base64,${imagePart.inlineData.data}`;
};

const requestConfiguredProductImage = async (name: string, category?: string, base64Image?: string, shotDirection?: string) => {
  if (getOpenAIImageKey()) {
    try {
      return {
        image: await requestOpenAIImage(name, category, base64Image, shotDirection),
        provider: "openai",
        model: getOpenAIImageModel()
      };
    } catch (error: any) {
      const canFallbackToGemini = Boolean(process.env.GEMINI_API_KEY)
        && /billing hard limit|quota|rate limit/i.test(String(error?.message || error?.sourceError || ""));
      if (!canFallbackToGemini) throw error;
    }
  }

  return {
    image: await requestGeminiProductImage(name, category, base64Image, shotDirection),
    provider: "gemini",
    model: "gemini-2.5-flash-image"
  };
};

export const app = express();
const PORT = 3000;
const IS_PRODUCTION = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
const SITE_URL = (process.env.SITE_URL || process.env.PUBLIC_SITE_URL || "https://hatni.shop").replace(/\/+$/, "");
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_LIMIT = 8;
const ORDER_STATUSES = new Set(["pending", "processing", "paid", "shipped", "completed", "cancelled"]);
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "очікує обробки",
  processing: "в обробці",
  paid: "оплачено",
  shipped: "відправлено",
  completed: "виконано",
  cancelled: "скасовано"
};
const BONUS_SPEND_LIMIT_RATE = 0.3;
const PAYMENT_METHODS = new Set(["cash", "mono", "liqpay", "card", "bank"]);
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();

// Helper to handle async errors
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const setNoStore = (res: any) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
};

const setPublicApiCache = (res: any, seconds = 60) => {
  res.set("Cache-Control", `public, max-age=${seconds}, s-maxage=${Math.max(seconds, 300)}, stale-while-revalidate=600`);
};

const setImageCache = (res: any) => {
  res.set("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
};

const xmlEscape = (value: string) =>
  value.replace(/[<>&'"]/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  }[char] || char));

const toFiniteNumber = (value: any, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeString = (value: any, maxLength = 500) =>
  String(value || "").trim().slice(0, maxLength);

const novaPoshtaRequest = async (modelName: string, calledMethod: string, methodProperties: Record<string, any> = {}) => {
  const response = await fetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: process.env.NOVA_POSHTA_API_KEY || "",
      modelName,
      calledMethod,
      methodProperties,
    }),
  });

  if (!response.ok) {
    throw new Error(`Nova Poshta API HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.success) {
    const message = Array.isArray(data.errors) && data.errors.length
      ? data.errors.join(", ")
      : "Nova Poshta API request failed";
    throw new Error(message);
  }

  return data.data || [];
};

const mapNovaPoshtaCity = (city: any) => ({
  ref: city.Ref,
  name: city.Description,
  area: city.AreaDescription || city.Area || "",
  settlementType: city.SettlementTypeDescription || "",
});

const mapNovaPoshtaWarehouse = (warehouse: any) => ({
  ref: warehouse.Ref,
  name: warehouse.Description,
  number: warehouse.Number,
  type: warehouse.TypeOfWarehouse || "",
});

const normalizePaymentMethod = (value: any) => {
  const method = normalizeString(value, 40).toLowerCase();
  if (method === "monopay" || method === "mono-pay") return "mono";
  if (method === "liq-pay") return "liqpay";
  return PAYMENT_METHODS.has(method) ? method : "cash";
};

const getCashbackRate = (totalSpent: number) => {
  if (totalSpent >= 15000) return 0.1;
  if (totalSpent >= 5000) return 0.07;
  return 0.05;
};

const calculateBonusSpendLimit = (subtotalAfterPromo: number) =>
  Math.max(0, Math.floor(subtotalAfterPromo * BONUS_SPEND_LIMIT_RATE));

const getOptionalUser = (req: any) => {
  const token = req.cookies?.token;
  if (!token) return null;
  try {
    return jwt.verify(token, jwtSecret) as any;
  } catch {
    return null;
  }
};

const getClientKey = (req: any, email = "") => {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.ip || req.socket?.remoteAddress || "unknown";
  return `${ip}:${email.toLowerCase()}`;
};

const canAttemptLogin = (req: any, email: string) => {
  const key = getClientKey(req, email);
  const now = Date.now();
  const attempt = loginAttempts.get(key);
  if (!attempt || now - attempt.firstAttempt > LOGIN_ATTEMPT_WINDOW_MS) {
    loginAttempts.set(key, { count: 0, firstAttempt: now });
    return true;
  }
  return attempt.count < LOGIN_ATTEMPT_LIMIT;
};

const recordLoginFailure = (req: any, email: string) => {
  const key = getClientKey(req, email);
  const now = Date.now();
  const attempt = loginAttempts.get(key);
  if (!attempt || now - attempt.firstAttempt > LOGIN_ATTEMPT_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
    return;
  }
  loginAttempts.set(key, { count: attempt.count + 1, firstAttempt: attempt.firstAttempt });
};

const clearLoginFailures = (req: any, email: string) => {
  loginAttempts.delete(getClientKey(req, email));
};

const notifyUser = async (userId: string | undefined, title: string, message: string, type: string) => {
  if (!userId) return;
  try {
    await db.createNotification({
      id: Math.random().toString(36).slice(2, 11),
      user_id: userId,
      title,
      message,
      type
    });
  } catch (error: any) {
    console.warn("Notification skipped:", error?.message || error);
  }
};

const notifyAdmins = async (title: string, message: string, type: string) => {
  try {
    const users = await db.getAllUsers();
    const admins = users.filter((user) => user.role === "admin");
    await Promise.all(admins.map((admin) => notifyUser(admin.id, title, message, type)));
  } catch (error: any) {
    console.warn("Admin notification skipped:", error?.message || error);
  }
};

const sendTelegramOrderNotification = async (order: any, items: any[]) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const text = [
      `Нове замовлення ${order.id}`,
      `Клієнт: ${order.customer_name}`,
      `Телефон: ${order.customer_phone}`,
      `Сума: ${order.final_total} грн`,
      `Товарів: ${items.reduce((sum, item) => sum + item.quantity, 0)}`
    ].join("\n");

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: controller.signal
    });
  } catch (error: any) {
    console.warn("Telegram order notification skipped:", error?.message || error);
  } finally {
    clearTimeout(timeout);
  }
};

// --- Caching Logic ---
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
let lastDbErrorTimestamp = 0;
const DB_RETRY_AFTER = 5 * 60 * 1000; // 5 minutes
let isDegradedLogEmitted = false;

function isDbInDegradedMode() {
  if (lastDbErrorTimestamp === 0) return false;
  const timeSinceError = Date.now() - lastDbErrorTimestamp;
  const inDegraded = timeSinceError < DB_RETRY_AFTER;
  if (!inDegraded && isDegradedLogEmitted) {
    isDegradedLogEmitted = false;
    console.log("Database degraded mode expired. Retrying connection...");
  }
  return inDegraded;
}

function recordDbError(error: any) {
  const message = error?.message || "";
  const isQuota = message.includes("402") || message.toLowerCase().includes("quota");
  
  if (isQuota) {
    if (!isDegradedLogEmitted) {
      lastDbErrorTimestamp = Date.now();
      isDegradedLogEmitted = true;
      console.warn(`Database quota exceeded. Entering degraded mode for 5 minutes. Next retry at: ${new Date(lastDbErrorTimestamp + DB_RETRY_AFTER).toISOString()}`);
      return { isQuota: true, isFirst: true };
    }
    return { isQuota: true, isFirst: false };
  } else {
    // For non-quota errors, we don't necessarily want to enter degraded mode for 5 mins, 
    // but we should still log them.
    console.error("Database Error:", message);
    return { isQuota: false, isFirst: true };
  }
}

let productsCache: { data: any, timestamp: number } | null = null;
let categoriesCache: { data: any, timestamp: number } | null = null;
let productsSummaryCache: { data: any, timestamp: number } | null = null;
let siteSettingsCache: { data: any, timestamp: number } | null = null;
const PRODUCT_IMAGE_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
const PRODUCT_IMAGE_MISS_TTL = 30 * 60 * 1000; // 30 minutes
const PRODUCT_IMAGE_CACHE_LIMIT = 120;
const productImageCache = new Map<string, { data: any | null, timestamp: number }>();

// Load persistent cache from file on startup
try {
  if (fs.existsSync(CACHE_FILE)) {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    productsCache = data.productsCache || null;
    categoriesCache = data.categoriesCache || null;
    productsSummaryCache = data.productsSummaryCache || null;
    siteSettingsCache = data.siteSettingsCache || null;
    console.log("Persistent cache loaded from file");
  }
} catch (e) {
  console.error("Failed to load persistent cache:", e);
}

function savePersistentCache() {
  try {
    const data = {
      productsCache,
      categoriesCache,
      productsSummaryCache,
      siteSettingsCache,
      lastSaved: Date.now()
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to save persistent cache:", e);
  }
}

const DEFAULT_SITE_SETTINGS = {
  id: 'default',
  free_delivery_min: 1500,
  return_days: 14,
  cashback_percent: 5,
  hero_title: 'Естетичний посуд та декор для дому',
  hero_subtitle: 'Інтернет-магазин "Хатні Штучки" — ваш провідник у світ затишку. Купуйте кераміку, текстиль та аксесуари, які перетворюють оселю на місце сили.',
  hero_featured_product_id: 'p1',
  hero_badge: 'Бестселер сезону',
  bestsellers_badge: 'Наші бестселери',
  bestsellers_title: 'Популярні товари для вашого затишку',
  bestsellers_subtitle: 'Обирайте найкращий посуд та декор, який став фаворитом наших покупців. Кожна річ у каталозі "Хатні Штучки" — це поєднання естетики та функціональності.'
};

Object.assign(DEFAULT_SITE_SETTINGS, {
  hero_title: 'Естетичний посуд та декор для дому',
  hero_subtitle: 'Інтернет-магазин "Хатні Штучки" - добірка кераміки, текстилю та домашніх аксесуарів, які додають оселі тепла.',
  hero_badge: 'Бестселер сезону',
  bestsellers_badge: 'Наші бестселери',
  bestsellers_title: 'Популярні товари для вашого затишку',
  bestsellers_subtitle: 'Обирайте посуд і декор, який покупці додають у свої домівки найчастіше.'
});

const FALLBACK_CATEGORIES = [
  { id: 'cat-1', name: 'Посуд', slug: 'posud', image: 'https://picsum.photos/seed/dishes/800/600' },
  { id: 'cat-2', name: 'Декор', slug: 'dekor', image: 'https://picsum.photos/seed/decor/800/600' },
  { id: 'cat-3', name: 'Текстиль', slug: 'tekstyl', image: 'https://picsum.photos/seed/textile/800/600' }
];

const FALLBACK_PRODUCTS = [
  {
    id: 'p1',
    name: 'Керамічна чашка "Затишок"',
    category: 'posud',
    price: 450,
    image: 'https://picsum.photos/seed/cup/800/800',
    images: ['https://picsum.photos/seed/cup/800/800'],
    description: 'Ручна робота, унікальний дизайн.',
    material: 'Кераміка',
    brand: 'Хатні Штучки',
    isPopular: true,
    stock: 10,
    rating: 5,
    review_count: 12
  }
];

const clearCache = () => {
  productsCache = null;
  categoriesCache = null;
  productsSummaryCache = null;
  siteSettingsCache = null;
  productImageCache.clear();
  if (fs.existsSync(CACHE_FILE)) {
    try {
      fs.unlinkSync(CACHE_FILE);
    } catch (e) {}
  }
  console.log("Cache cleared");
};

const parseJsonArrayField = (value: any) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const firstDefined = (source: any, keys: string[]) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) return source[key];
  }
  return undefined;
};

const toBooleanFlag = (value: any) => (
  value === true || value === 1 || value === "1" || value === "true"
);

const toNumberField = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const STALE_PRODUCT_IMAGE_PATTERNS = [
  /images\.unsplash\.com/i,
  /placeholder|placehold\.co|picsum\.photos/i,
  /data:image\/svg/i,
];

const isStaleProductImage = (value: any) => {
  const image = String(value || "").trim();
  return !image || STALE_PRODUCT_IMAGE_PATTERNS.some(pattern => pattern.test(image));
};

const normalizeProductForApi = (product: any) => {
  const isBundle = toBooleanFlag(firstDefined(product, ["isBundle", "isbundle", "is_bundle"]));
  const isPopular = toBooleanFlag(firstDefined(product, ["isPopular", "ispopular", "is_popular"]));
  const bundleItems = parseJsonArrayField(firstDefined(product, ["bundle_items", "bundleItems"]));

  return {
    ...product,
    isBundle,
    isPopular,
    images: parseJsonArrayField(product.images).filter((image) => !isStaleProductImage(image)),
    bundle_items: bundleItems,
    bundleItems,
    bonusPoints: toNumberField(firstDefined(product, ["bonusPoints", "bonus_points"])),
    reviewCount: toNumberField(firstDefined(product, ["reviewCount", "review_count"]))
  };
};

const productImageUrl = (id: string, slot: string | number = "main") =>
  `/api/product-images/${encodeURIComponent(id)}/${encodeURIComponent(String(slot))}`;

const categoryImageUrl = (id: string) => `/api/category-images/${encodeURIComponent(id)}/main`;

const buildPublicProduct = (product: any, options: { includeGallery?: boolean } = {}) => {
  const normalized = normalizeProductForApi(product);
  const hasProductId = typeof normalized.id === "string" && normalized.id.length > 0;
  const rawMainImage = String(normalized.image || "");
  const hasStoredImage = toBooleanFlag(firstDefined(normalized, ["hasImage", "has_image"]));
  const imageIsPlaceholder = toBooleanFlag(firstDefined(normalized, ["imageIsPlaceholder", "image_is_placeholder"]));
  const mainImage = rawMainImage && !isStaleProductImage(rawMainImage) ? rawMainImage : "";
  const gallery = mergeImageList(normalized.images).filter((image) => image !== mainImage);
  const shouldProxyStoredMain = hasProductId && !rawMainImage && hasStoredImage && !imageIsPlaceholder;
  const shouldProxyMainImage = hasProductId && (mainImage.startsWith("data:image/") || shouldProxyStoredMain);

  return {
    ...normalized,
    image: shouldProxyMainImage ? productImageUrl(normalized.id, "main") : mainImage,
    images: options.includeGallery && hasProductId
      ? gallery.map((image, index) => String(image).startsWith("data:image/") ? productImageUrl(normalized.id, index) : image).slice(0, 8)
      : []
  };
};

const buildAdminProductSummary = (product: any) => {
  const normalized = normalizeProductForApi(product);
  const rawImage = String(normalized.image || "");
  const hasImage = toBooleanFlag(firstDefined(normalized, ["hasImage", "has_image"])) || rawImage.length > 0;
  const imageIsGenerated = toBooleanFlag(firstDefined(normalized, ["imageIsGenerated", "image_is_generated"]))
    || rawImage.startsWith("data:image/jpeg")
    || rawImage.startsWith("data:image/png")
    || rawImage.startsWith("data:image/webp");
  const imageIsPlaceholder = toBooleanFlag(firstDefined(normalized, ["imageIsPlaceholder", "image_is_placeholder"]))
    || !hasImage
    || rawImage.startsWith("data:image/svg")
    || (rawImage.length > 0 && isStaleProductImage(rawImage));
  const preview = buildPublicProduct(normalized);
  return {
    ...normalized,
    image: preview.image,
    images: [],
    hasImage,
    imageIsGenerated,
    imageIsPlaceholder,
    needsAiImage: !imageIsGenerated,
    imageStatus: imageIsGenerated ? "generated" : imageIsPlaceholder ? "missing" : "external"
  };
};

const buildPublicCategory = (category: any) => ({
  ...category,
  image: typeof category?.id === "string" && category.id.length > 0 && String(category?.image || "").startsWith("data:image/")
    ? categoryImageUrl(category.id)
    : category?.image
});

const mergeImageList = (...lists: any[]) => {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const list of lists) {
    const values = Array.isArray(list) ? list : parseJsonArrayField(list);
    for (const value of values) {
      const image = String(value || "").trim();
      if (!image || seen.has(image) || isStaleProductImage(image)) continue;
      seen.add(image);
      merged.push(image);
    }
  }

  return merged;
};

const rememberProductImageData = (id: string, data: any | null) => {
  productImageCache.set(id, { data, timestamp: Date.now() });
  while (productImageCache.size > PRODUCT_IMAGE_CACHE_LIMIT) {
    const oldestKey = productImageCache.keys().next().value;
    if (!oldestKey) break;
    productImageCache.delete(oldestKey);
  }
};

const getProductImageData = async (id: string) => {
  const now = Date.now();
  const cached = productImageCache.get(id);
  if (cached) {
    const ttl = cached.data ? PRODUCT_IMAGE_CACHE_TTL : PRODUCT_IMAGE_MISS_TTL;
    if (now - cached.timestamp < ttl) return cached.data;
  }

  try {
    const product = await db.getProductImageById(id);
    rememberProductImageData(id, product || null);
    return product || null;
  } catch (error) {
    if (cached) return cached.data;
    throw error;
  }
};

const getCachedProductSummaries = () => productsSummaryCache?.data || productsCache?.data || FALLBACK_PRODUCTS;

const buildProductUpdatePayload = (product: any, overrides: any = {}) => {
  const normalized = normalizeProductForApi(product);
  return {
    name: normalized.name,
    category: normalized.category,
    price: normalized.price,
    image: normalized.image,
    description: normalized.description || "",
    material: normalized.material,
    brand: normalized.brand,
    isPopular: normalized.isPopular,
    isBundle: normalized.isBundle,
    stock: normalized.stock || 0,
    images: JSON.stringify(normalized.images || []),
    bonusPoints: normalized.bonusPoints || 0,
    bundle_items: JSON.stringify(normalized.bundle_items || []),
    cost_price: normalized.cost_price,
    ...overrides
  };
};

const saveProductImages = async (product: any, mainImage: string, extraImages: string[] = []) => {
  const normalized = normalizeProductForApi(product);
  const gallery = mergeImageList(extraImages)
    .filter((image) => image !== mainImage)
    .slice(0, 12);
  await db.updateProduct(product.id, buildProductUpdatePayload(normalized, {
    image: mainImage,
    images: JSON.stringify(gallery)
  }));
  clearCache();
  return {
    ...normalized,
    image: mainImage,
    images: gallery
  };
};

const cleanProductImageFields = (product: any) => {
  const currentMain = String(product?.image || "").trim();
  const rawGallery = parseJsonArrayField(product?.images);
  const mainWasStale = currentMain.length > 0 && isStaleProductImage(currentMain);
  const galleryHadStale = rawGallery.some((image) => isStaleProductImage(image));
  const seen = new Set<string>();
  let gallery = rawGallery
    .map((image) => String(image || "").trim())
    .filter((image) => {
      if (!image || isStaleProductImage(image) || seen.has(image)) return false;
      seen.add(image);
      return true;
    });

  let mainImage = currentMain;
  let promotedFromGallery = false;
  let clearedMain = false;

  if (mainWasStale) {
    const promotedImage = gallery.shift();
    if (promotedImage) {
      mainImage = promotedImage;
      promotedFromGallery = true;
    } else {
      mainImage = "";
      clearedMain = true;
    }
  }

  gallery = gallery.filter((image) => image !== mainImage).slice(0, 12);

  return {
    changed: mainImage !== currentMain || JSON.stringify(gallery) !== JSON.stringify(rawGallery),
    mainImage,
    images: gallery,
    mainWasStale,
    galleryHadStale,
    promotedFromGallery,
    clearedMain,
    galleryBefore: rawGallery.length,
    galleryAfter: gallery.length
  };
};

// --- Database Initialization & Seeding ---
let dbInitialized = false;
let isInitializing = false;

async function ensureDb() {
  if (dbInitialized) return;
  if (isInitializing) {
    for (let i = 0; i < 100 && isInitializing; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }
  isInitializing = true;

  try {
    console.log("Initializing database...");
    // Initialize DB Schema
    await db.init();

    // Seed Admin — credentials come from environment, never hardcoded.
    const seedEmail = process.env.ADMIN_EMAIL?.trim();
    const seedPass = process.env.ADMIN_PASSWORD;
    const admins = seedEmail && seedPass
      ? [{ email: seedEmail, pass: seedPass, name: process.env.ADMIN_NAME?.trim() || "Administrator", id: "admin-1" }]
      : [];
    if (admins.length === 0) {
      console.warn("Admin seeding skipped: set ADMIN_EMAIL and ADMIN_PASSWORD to create the initial admin.");
    }

    for (const admin of admins) {
      try {
        const exists = await db.getUserByEmail(admin.email);
        if (!exists) {
          const hashed = await bcrypt.hash(admin.pass, 10);
          await db.createUser({
            id: admin.id,
            email: admin.email,
            password: hashed,
            name: admin.name,
            role: "admin"
          });
        }
      } catch (err: any) {
        const { isQuota, isFirst } = recordDbError(err);
        if (isFirst && !isQuota) {
          console.error(`Error seeding admin ${admin.email}:`, err.message);
        }
      }
    }

    dbInitialized = true;
    console.log("Database initialized successfully.");
  } catch (err: any) {
    const { isQuota, isFirst } = recordDbError(err);
    if (isFirst && !isQuota) {
      console.error("Database initialization failed (likely quota exceeded):", err.message);
    }
    // Do not throw, allow server to start with fallbacks
  } finally {
    isInitializing = false;
  }
}

app.disable("x-powered-by");

app.use((req, res, next) => {
  const cspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    IS_PRODUCTION ? "connect-src 'self' https://*.vercel-insights.com" : "connect-src 'self' http: https: ws:",
    "form-action 'self'",
    IS_PRODUCTION ? "upgrade-insecure-requests" : ""
  ].filter(Boolean);

  res.setHeader("Content-Security-Policy", cspDirectives.join("; "));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

app.use(express.json({ limit: '15mb', strict: true }));
app.use(express.urlencoded({ limit: '15mb', extended: true, parameterLimit: 200 }));
app.use(cookieParser());

app.use((req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return next();
  }

  const fetchSite = req.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return res.status(403).json({ error: "Cross-site request blocked" });
  }

  const origin = req.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      const requestHost = req.get("host");
      if (requestHost && originHost !== requestHost) {
        return res.status(403).json({ error: "Invalid request origin" });
      }
    } catch {
      return res.status(403).json({ error: "Invalid request origin" });
    }
  }

  next();
});

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Manual DB Init Trigger (for debugging)
app.get("/api/admin/db-init", authenticate, asyncHandler(async (req: any, res: any) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
  dbInitialized = false; // Force re-init
  await ensureDb();
  res.json({ success: true, message: "Database initialization triggered" });
}));

// --- API Routes ---
// Health Check
app.get("/api/health", asyncHandler(async (req, res) => {
  if (!dbInitialized && !isDbInDegradedMode()) {
    await ensureDb();
  }
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    dbInitialized,
    degraded: isDbInDegradedMode(),
    env: process.env.NODE_ENV || "development"
  });
}));

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send([
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /login",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    ""
  ].join("\n"));
});

app.get("/sitemap.xml", asyncHandler(async (req, res) => {
  let products: any[] = [];
  try {
    if (!isDbInDegradedMode()) {
      products = await db.getProductsSummary();
    }
  } catch (error: any) {
    const { isQuota, isFirst } = recordDbError(error);
    if (isFirst && !isQuota) {
      console.warn("Error building sitemap from database:", error.message);
    }
  }

  if (!products.length) {
    products = productsSummaryCache?.data || FALLBACK_PRODUCTS;
  }

  const now = new Date().toISOString();
  const staticUrls = ["/", "/catalog", "/about", "/faq"];
  const productUrls = products
    .filter((product) => product?.id)
    .map((product) => `/product/${encodeURIComponent(product.id)}`);
  const urls = [...staticUrls, ...productUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((url) => [
      "  <url>",
      `    <loc>${xmlEscape(`${SITE_URL}${url}`)}</loc>`,
      `    <lastmod>${now}</lastmod>`,
      url.startsWith("/product/") ? "    <changefreq>weekly</changefreq>" : "    <changefreq>daily</changefreq>",
      url === "/" ? "    <priority>1.0</priority>" : "    <priority>0.8</priority>",
      "  </url>"
    ].join("\n")).join("\n") +
    "\n</urlset>\n";

  res.type("application/xml").send(xml);
}));

// Auth Routes
app.post("/api/auth/register", asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const { email, password, name } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      const id = Math.random().toString(36).substr(2, 9);
      await db.createUser({ id, email, password: hashedPassword, name });
      const token = jwt.sign({ id, email, name, role: 'user' }, jwtSecret);
      res.cookie("token", token, cookieOptions);
      res.json({ user: { id, email, name, bonuses: 0, total_spent: 0, role: 'user', avatar: null } });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.error("Registration error:", err.message);
      }
      res.status(isQuota ? 503 : 400).json({ 
        error: isQuota ? "Сервіс тимчасово недоступний" : "Email already exists" 
      });
    }
  }));

  app.post("/api/auth/login", asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const email = normalizeString(req.body?.email, 254).toLowerCase();
      const password = normalizeString(req.body?.password, 200);
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      if (!canAttemptLogin(req, email)) {
        return res.status(429).json({ error: "Too many login attempts. Try again in 15 minutes." });
      }
      console.log(`Login attempt for: ${email}`);
      
      const user = await db.getUserByEmail(email);
      
      if (!user) {
        console.log(`User not found: ${email}`);
        recordLoginFailure(req, email);
        return res.status(401).json({ error: "Користувача не знайдено" });
      }

      const isMatch = await bcrypt.compare(password, user.password || "");
      if (isMatch) {
        clearLoginFailures(req, email);
        console.log(`Login successful for: ${email}`);
        const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, jwtSecret);
        res.cookie("token", token, cookieOptions);
        res.json({ 
          user: { 
            id: user.id, 
            email: user.email, 
            name: user.name, 
            bonuses: user.bonuses, 
            total_spent: user.total_spent,
            role: user.role,
            avatar: user.avatar
          } 
        });
      } else {
        console.log(`Invalid password for: ${email}`);
        recordLoginFailure(req, email);
        res.status(401).json({ error: "Невірний пароль" });
      }
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.error("Login error:", err.message);
      }
      res.status(isQuota ? 503 : 401).json({ 
        error: isQuota ? "Сервіс тимчасово недоступний" : "Помилка авторизації" 
      });
    }
  }));

  app.get("/api/auth/me", asyncHandler(async (req: any, res: any) => {
    const token = req.cookies.token;
    if (!token) return res.json({ user: null });
    
    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret) as any;
    } catch (jwtErr) {
      return res.json({ user: null });
    }

    try {
      // Check circuit breaker
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const user = await db.getUserById(decoded.id);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
      } else {
        res.json({ user: null });
      }
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      
      // Return basic info from JWT so the user stays logged in during quota issues
      res.json({ 
        user: { 
          id: decoded.id, 
          email: decoded.email, 
          name: decoded.name, 
          role: decoded.role,
          bonuses: 0,
          total_spent: 0,
          isDegraded: true
        } 
      });
    }
  }));

  app.post("/api/auth/logout", asyncHandler(async (req: any, res: any) => {
    res.clearCookie("token", clearCookieOptions);
    res.json({ success: true });
  }));

  // Review Routes
  app.get("/api/reviews/:productId", asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const reviews = await db.getReviews(req.params.productId);
      res.json(reviews);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching reviews:", error.message);
      }
      res.json([]);
    }
  }));

  app.post("/api/reviews", authenticate, asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const { productId, rating, comment } = req.body;
      
      // Check if user has purchased the product and order is completed
      const orders = await (db as any).getUserOrders(req.user.id);
      const hasPurchased = orders.some((order: any) => 
        (order.status === 'completed' || order.status === 'shipped') && 
        // We need to check if the product is in the order items
        // For now, let's assume if they have any completed order, they can review
        // Ideally we should check specific product_id in order_items
        true 
      );

      // More accurate check would involve fetching order items
      // But for simplicity and based on user request "after order delivered"
      const completedOrders = orders.filter((o: any) => o.status === 'completed' || o.status === 'shipped');
      if (completedOrders.length === 0) {
        return res.status(403).json({ error: "Ви можете залишити відгук тільки після отримання замовлення" });
      }

      const id = Math.random().toString(36).substr(2, 9);
      await db.createReview({
        id,
        product_id: productId,
        user_id: req.user.id,
        user_name: req.user.name,
        rating,
        comment,
        is_approved: 0 // Default to unapproved
      });
      res.json({ success: true, message: "Відгук надіслано на модерацію" });
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error creating review:", error.message);
      }
      res.status(isQuota ? 503 : 400).json({ error: isQuota ? "Сервіс тимчасово недоступний через обмеження бази даних" : "Помилка при створенні відгуку" });
    }
  }));

  app.post("/api/products/:id/ai-description", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    const { aiDescription } = req.body;
    await db.updateProductAiDescription(req.params.id, aiDescription);
    res.json({ success: true });
  }));

  app.post("/api/admin/ai/description", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    const { name, category } = req.body;
    const prompt = `Write a short warm Ukrainian product description for "${name}" in category "${category || "home"}". Use 2-3 sentences, no quotes, no intro.`;
    if (getOpenAIKey()) {
      try {
        const text = await requestOpenAIText(prompt);
        return res.json({ text, provider: "openai", model: getOpenAITextModel() });
      } catch (error: any) {
        console.warn("OpenAI description failed, falling back to Gemini:", error?.message || error);
      }
    }

    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }]
    });
    res.json({ text: response.text || "", provider: "gemini" });
  }));

  app.post("/api/admin/ai/styling-tip", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    const { name, category } = req.body;
    const prompt = `Write a concise Ukrainian styling tip for using "${name}" from category "${category || "home"}" in a cozy home interior. Max 2 sentences.`;
    if (getOpenAIKey()) {
      try {
        const text = await requestOpenAIText(prompt);
        return res.json({ text, provider: "openai", model: getOpenAITextModel() });
      } catch (error: any) {
        console.warn("OpenAI styling tip failed, falling back to Gemini:", error?.message || error);
      }
    }

    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }]
    });
    res.json({ text: response.text || "", provider: "gemini" });
  }));

  app.post("/api/admin/ai/product-image", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    const { name, category, base64Image } = req.body;
    const result = await requestConfiguredProductImage(name, category, base64Image);
    res.json(result);
  }));

  app.post("/api/admin/ai/product-gallery", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    const { name, category, base64Image } = req.body;
    const count = Math.max(1, Math.min(3, Number(req.body.count) || 3));
    const shotDirections = [
      "front hero shot, product fully visible, crisp glass and material details",
      "three-quarter angle, editorial catalog lighting, subtle shadow under product",
      "close detail crop that still clearly shows the item, premium product photography"
    ];
    const images: string[] = [];
    let provider = "";
    let model = "";

    for (let index = 0; index < count; index += 1) {
      const result = await requestConfiguredProductImage(
        name,
        category,
        index === 0 ? base64Image : undefined,
        shotDirections[index] || shotDirections[0]
      );
      images.push(result.image);
      provider = result.provider;
      model = result.model;
    }

    res.json({ images, provider, model });
  }));

  app.post("/api/admin/images/search-web", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    const { name, category } = req.body;
    if (!String(name || "").trim()) {
      return res.status(400).json({ error: "Product name is required" });
    }

    const result = await searchWebImageCandidates(name, category, Number(req.body.limit) || 8);
    res.json(result);
  }));

  app.post("/api/admin/ai/bundle-items", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    const { productName, productCategory, allProducts } = req.body;
    const products = Array.isArray(allProducts)
      ? allProducts
          .filter((p: any) => !toBooleanFlag(firstDefined(p, ["isBundle", "isbundle", "is_bundle"])))
          .filter((p: any) => Number(p?.stock || 0) > 0)
          .slice(0, 120)
      : [];
    const productsList = products.map((p: any) => `- ${p.name} (ID: ${p.id}, category: ${p.category}, price: ${p.price})`).join("\n");
    const prompt = `Pick 2-4 real standalone complementary products for "${productName}" (${productCategory}). Do not choose existing bundles or sets as bundle items. Prefer products that make sense together by use case, material, serving scenario, color/style, and price balance. Return only JSON array of product IDs from this list:\n${productsList}`;
    if (getOpenAIKey()) {
      try {
        const text = await requestOpenAIText(prompt, "Return valid JSON only. The response must be an array of product ID strings and nothing else.");
        const items = JSON.parse(cleanJSON(text || "[]"));
        return res.json({ items: Array.isArray(items) ? items : [], provider: "openai", model: getOpenAITextModel() });
      } catch (error: any) {
        console.warn("OpenAI bundle item suggestion failed, falling back to Gemini:", error?.message || error);
      }
    }

    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });

    try {
      const items = JSON.parse(cleanJSON(response.text || "[]"));
      res.json({ items: Array.isArray(items) ? items : [], provider: "gemini" });
    } catch {
      res.json({ items: [] });
    }
  }));

  // Batch AI enrichment: up to 10 raw products per single model call.
  app.post("/api/admin/ai/enrich-batch", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    const rawItems = Array.isArray(req.body?.items) ? req.body.items.slice(0, 10) : [];
    const categories = Array.isArray(req.body?.categories) ? req.body.categories.slice(0, 40) : [];
    if (!rawItems.length) return res.status(400).json({ error: "items is required" });

    const catList = categories.length
      ? categories.map((c: any) => `${c.slug} — ${c.name}`).join("\n")
      : "kitchen — Кухня\ntableware — Посуд\ntextile — Текстиль\ndecor — Декор\norganization — Організація";
    const itemsList = rawItems
      .map((it: any, i: number) => `${i}. "${String(it?.name || "").slice(0, 160)}"${it?.hint ? ` (підказка: ${String(it.hint).slice(0, 120)})` : ""}${Number(it?.price) > 0 ? `, ціна ${Number(it.price)} грн` : ""}`)
      .join("\n");
    const prompt = `Ти — мерчандайзер українського магазину естетичних товарів для дому "Хатні Штучки". Для КОЖНОГО товару з нумерованого списку сформуй картку:
- index: номер зі списку (число)
- cleanName: охайна українська назва з великої літери, без артикулів, штрихкодів, розмірів у мм, зайвих лапок і КАПСУ
- category: РІВНО один slug зі списку категорій нижче, найдоречніший
- description: 2-3 теплих конкретних речення українською про користь і матеріал, без кліше "ідеальний вибір"
- material: основний матеріал одним-двома словами українською (або порожній рядок)
- brand: бренд, якщо очевидний з назви, інакше "Хатні Штучки"

КАТЕГОРІЇ:
${catList}

ТОВАРИ:
${itemsList}

Поверни JSON-масив з обʼєктом для кожного товару.`;

    const enrichSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: { type: Type.NUMBER },
          cleanName: { type: Type.STRING },
          category: { type: Type.STRING },
          description: { type: Type.STRING },
          material: { type: Type.STRING },
          brand: { type: Type.STRING }
        },
        required: ["index", "cleanName", "category", "description"]
      }
    };

    if (getOpenAIKey()) {
      try {
        const text = await requestOpenAIText(prompt, "Return only a valid JSON array matching the requested fields, nothing else.");
        const items = JSON.parse(cleanJSON(text || "[]"));
        if (Array.isArray(items) && items.length) {
          return res.json({ items, provider: "openai", model: getOpenAITextModel() });
        }
      } catch (error: any) {
        console.warn("OpenAI enrich-batch failed, falling back to Gemini:", error?.message || error);
      }
    }

    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", responseSchema: enrichSchema }
    });
    try {
      const items = JSON.parse(cleanJSON(response.text || "[]"));
      res.json({ items: Array.isArray(items) ? items : [], provider: "gemini" });
    } catch {
      res.json({ items: [] });
    }
  }));

  // Identify a product from a photo (Gemini vision): returns draft card fields.
  app.post("/api/admin/ai/photo-identify", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    const image = String(req.body?.image || "");
    const categories = Array.isArray(req.body?.categories) ? req.body.categories.slice(0, 40) : [];
    const parsed = extractDataUrlImage(image);
    if (!parsed) return res.status(400).json({ error: "image must be a data URL (png/jpeg/webp)" });

    const catList = categories.length
      ? categories.map((c: any) => `${c.slug} — ${c.name}`).join("\n")
      : "kitchen — Кухня\ntableware — Посуд\ntextile — Текстиль\ndecor — Декор\norganization — Організація";
    const prompt = `На фото — товар для дому з асортименту українського магазину "Хатні Штучки". Визнач і поверни JSON:
- name: охайна українська назва товару з великої літери
- category: РІВНО один slug зі списку нижче
- description: 2-3 теплих конкретних речення українською
- material: основний матеріал (або порожній рядок)
- priceEstimate: орієнтовна роздрібна ціна в грн (число, 0 якщо не впевнений)

КАТЕГОРІЇ:
${catList}`;

    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: parsed.mimeType, data: image.split(",")[1] } },
          { text: prompt }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            category: { type: Type.STRING },
            description: { type: Type.STRING },
            material: { type: Type.STRING },
            priceEstimate: { type: Type.NUMBER }
          },
          required: ["name", "category", "description"]
        }
      }
    });
    try {
      const item = JSON.parse(cleanJSON(response.text || "{}"));
      res.json({ item, provider: "gemini" });
    } catch {
      res.status(502).json({ error: "AI не зміг розпізнати товар на фото" });
    }
  }));

  // Extract a product list from a supplier category page URL.
  app.post("/api/admin/import/scrape", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    let target: URL;
    try {
      target = new URL(String(req.body?.url || ""));
    } catch {
      return res.status(400).json({ error: "Некоректний URL" });
    }
    if (!/^https?:$/.test(target.protocol)) return res.status(400).json({ error: "Дозволено лише http/https" });
    const host = target.hostname.toLowerCase();
    if (
      host === "localhost" || host === "0.0.0.0" || host === "[::1]" ||
      /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return res.status(400).json({ error: "Внутрішні адреси заборонені" });
    }

    let html = "";
    try {
      const pageResponse = await fetch(target.toString(), {
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) HatniImport/1.0" }
      });
      if (!pageResponse.ok) return res.status(502).json({ error: `Сторінка недоступна (${pageResponse.status})` });
      html = (await pageResponse.text()).slice(0, 500_000);
    } catch (error: any) {
      return res.status(502).json({ error: `Не вдалося завантажити сторінку: ${error?.message || "network error"}` });
    }

    const imageSources: string[] = [];
    html.replace(/<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/gi, (_m, src) => {
      if (imageSources.length < 200 && !/\.svg|sprite|logo|icon/i.test(src)) imageSources.push(src);
      return "";
    });
    const textOnly = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, "\n")
      .replace(/&nbsp;/g, " ")
      .replace(/\n{2,}/g, "\n")
      .slice(0, 60_000);

    const prompt = `Нижче — текст сторінки категорії інтернет-магазину постачальника і список URL зображень з неї. Витягни СПИСОК ТОВАРІВ (до 60). Для кожного:
- name: назва товару як на сторінці
- price: ціна в грн (число, 0 якщо не знайдено)
- imageUrl: найімовірніший URL фото цього товару зі списку зображень (або порожній рядок)

Ігноруй меню, банери, футер, супутні блоки. Поверни JSON-масив.

ЗОБРАЖЕННЯ:
${imageSources.slice(0, 120).join("\n")}

ТЕКСТ СТОРІНКИ:
${textOnly}`;

    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              price: { type: Type.NUMBER },
              imageUrl: { type: Type.STRING }
            },
            required: ["name"]
          }
        }
      }
    });
    try {
      const rawList = JSON.parse(cleanJSON(response.text || "[]"));
      const items = (Array.isArray(rawList) ? rawList : [])
        .filter((it: any) => it?.name)
        .slice(0, 60)
        .map((it: any) => {
          let imageUrl = String(it.imageUrl || "");
          if (imageUrl) {
            try { imageUrl = new URL(imageUrl, target).toString(); } catch { imageUrl = ""; }
          }
          return { name: String(it.name).slice(0, 200), price: Math.max(0, Number(it.price) || 0), imageUrl };
        });
      res.json({ items, provider: "gemini", source: target.toString() });
    } catch {
      res.json({ items: [] });
    }
  }));

  app.post("/api/admin/ai/director-report", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    const { products = [], orders = [], stats = {}, siteSettings = {}, reviews = [] } = req.body;
    const reportPrompt = `Analyze this Hatni Shtuchky ecommerce data and write a specific Ukrainian markdown director report with quick wins, UX/CRO advice, product/pricing advice, and next actions.\n\nPRODUCTS:\n${JSON.stringify(products.slice(0, 50), null, 2)}\n\nORDERS:\n${JSON.stringify(orders.slice(0, 30), null, 2)}\n\nREVIEWS:\n${JSON.stringify(reviews.slice(0, 20), null, 2)}\n\nSTATS:\n${JSON.stringify(stats, null, 2)}\n\nSITE SETTINGS:\n${JSON.stringify(siteSettings, null, 2)}`;
    const reportInstructions = "You are a senior ecommerce, UX, CRO and merchandising advisor. Be practical, concrete, and write in Ukrainian.";
    if (getOpenAIKey()) {
      try {
        const report = await requestOpenAIText(reportPrompt, reportInstructions);
        return res.json({ report, provider: "openai", model: getOpenAITextModel() });
      } catch (error: any) {
        console.warn("OpenAI director report failed, falling back to Gemini:", error?.message || error);
      }
    }

    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: reportPrompt,
      config: {
        systemInstruction: reportInstructions,
        temperature: 0.7
      }
    });
    res.json({ report: response.text || "", provider: "gemini" });
  }));

  // Price Subscriptions
  app.post("/api/subscriptions/price-drop", authenticate, asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const { productId, currentPrice } = req.body;
      const id = Math.random().toString(36).substr(2, 9);
      await db.addPriceSubscription({
        id,
        user_id: req.user.id,
        product_id: productId,
        initial_price: currentPrice
      });
      res.json({ success: true });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error adding price subscription:", err.message);
      }
      res.status(isQuota ? 503 : 400).json({ error: isQuota ? "Сервіс тимчасово недоступний" : "Already subscribed or database unavailable" });
    }
  }));

  app.get("/api/subscriptions/price-drop", authenticate, asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const subs = await db.getPriceSubscriptions(req.user.id);
      res.json(subs);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching subscriptions:", error.message);
      }
      res.json([]);
    }
  }));

  app.delete("/api/subscriptions/price-drop/:productId", authenticate, asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      await db.removePriceSubscription(req.user.id, req.params.productId);
      res.json({ success: true });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error removing price subscription:", err.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: "Service unavailable" });
    }
  }));

  // Notifications
  app.get("/api/notifications", authenticate, asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const notifications = await db.getNotifications(req.user.id);
      res.json(notifications);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching notifications:", error.message);
      }
      res.json([]);
    }
  }));

  app.post("/api/notifications/:id/read", authenticate, asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      await db.markNotificationRead(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error marking notification as read:", err.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: "Service unavailable" });
    }
  }));

  app.delete("/api/notifications", authenticate, asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      await db.clearNotifications(req.user.id);
      res.json({ success: true });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error clearing notifications:", err.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: "Service unavailable" });
    }
  }));

  app.delete("/api/admin/notifications", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      await db.clearAllNotifications();
      res.json({ success: true });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error clearing all notifications:", err.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: "Service unavailable" });
    }
  }));

  // Admin: Update Price (triggers notifications)
  app.post("/api/admin/products/:id/price", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const { newPrice } = req.body;
      const product = await db.getProductById(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });

      const oldPrice = product.price;
      await db.updateProductPrice(req.params.id, newPrice);

      if (newPrice < oldPrice) {
        const subscriptions = await db.getSubscriptionsByProductId(req.params.id);
        for (const sub of subscriptions) {
          await db.createNotification({
            id: Math.random().toString(36).substr(2, 9),
            user_id: sub.user_id,
            title: "Зниження ціни! 📉",
            message: `Ціна на "${product.name}" знизилася з ${oldPrice} грн до ${newPrice} грн!`,
            type: "price_drop"
          });
        }
      }
      res.json({ success: true });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error updating product price:", err.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: "Service unavailable" });
    }
  }));

  // API Routes
  app.get("/api/product-images/:id/:slot", asyncHandler(async (req: any, res: any) => {
    setImageCache(res);
    try {
      const product = await getProductImageData(req.params.id);
      if (!product) return res.status(404).send("Image not found");

      const normalized = normalizeProductForApi(product);
      const mainImage = isStaleProductImage(normalized.image) ? "" : normalized.image;
      const gallery = mergeImageList(normalized.images).filter((image) => image !== mainImage);
      const slot = String(req.params.slot || "main");
      const galleryIndex = Number(slot);
      const rawImage = slot === "main"
        ? mainImage || gallery[0]
        : Number.isInteger(galleryIndex) && galleryIndex >= 0
          ? gallery[galleryIndex]
          : "";

      if (!rawImage || isStaleProductImage(rawImage)) return res.status(404).send("Image not found");

      const dataImage = extractDataUrlImage(rawImage);
      if (dataImage) {
        res.type(dataImage.mimeType);
        return res.send(dataImage.buffer);
      }

      if (/^https?:\/\//i.test(rawImage)) {
        return res.redirect(302, rawImage);
      }

      res.status(404).send("Image not found");
    } catch (error: any) {
      const { isFirst } = recordDbError(error);
      if (isFirst) console.warn("Error fetching product image:", error.message);
      res.status(404).send("Image not found");
    }
  }));

  app.get("/api/category-images/:id/main", asyncHandler(async (req: any, res: any) => {
    setImageCache(res);
    try {
      const now = Date.now();
      let categories = categoriesCache && (now - categoriesCache.timestamp < CACHE_TTL)
        ? categoriesCache.data
        : null;
      if (!categories) {
        categories = await db.getCategories();
        categoriesCache = { data: categories, timestamp: now };
        savePersistentCache();
      }
      const category = categories.find((item: any) => item.id === req.params.id);
      if (!category?.image) return res.status(404).send("Image not found");

      const rawImage = String(category.image || "");
      const dataImage = extractDataUrlImage(rawImage);
      if (dataImage) {
        res.type(dataImage.mimeType);
        return res.send(dataImage.buffer);
      }

      if (/^https?:\/\//i.test(rawImage)) {
        return res.redirect(302, rawImage);
      }

      res.status(404).send("Image not found");
    } catch (error: any) {
      const { isFirst } = recordDbError(error);
      if (isFirst) console.warn("Error fetching category image:", error.message);
      res.status(404).send("Image not found");
    }
  }));

  app.get("/api/categories/catalog", asyncHandler(async (req: any, res: any) => {
    setNoStore(res);
    const now = Date.now();
    if (categoriesCache && (now - categoriesCache.timestamp < CACHE_TTL)) {
      return res.json(categoriesCache.data.map(buildPublicCategory));
    }
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const categories = await db.getCategories();
      categoriesCache = { data: categories, timestamp: now };
      savePersistentCache();
      res.json(categories.map(buildPublicCategory));
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      const errMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      if (isFirst && !isQuota) {
        console.warn("Error fetching public categories, using cache or fallback:", errMsg);
      }
      if (categoriesCache) return res.json(categoriesCache.data.map(buildPublicCategory));
      res.json(FALLBACK_CATEGORIES.map(buildPublicCategory));
    }
  }));

  app.get("/api/products/catalog", asyncHandler(async (req: any, res: any) => {
    setPublicApiCache(res, 60);
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const products = await db.getProductsSummary();
      productsSummaryCache = { data: products, timestamp: Date.now() };
      savePersistentCache();
      res.json(products.map((product) => buildPublicProduct(product)));
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      const errMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      if (isFirst && !isQuota) {
        console.warn("Error fetching products summary, using cache or fallback:", errMsg);
      }
      if (productsSummaryCache) {
        return res.json(productsSummaryCache.data.map((product: any) => buildPublicProduct(product)));
      }
      res.json(FALLBACK_PRODUCTS.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        image: p.image,
        material: p.material,
        brand: p.brand,
        isPopular: p.isPopular,
        stock: p.stock,
        rating: p.rating,
        review_count: p.review_count
      })));
    }
  }));

  app.get("/api/products", asyncHandler(async (req: any, res: any) => {
    setNoStore(res);
    const includeFullPayload = req.query?.full === "1";
    try {
      const products = includeFullPayload
        ? await db.getProducts()
        : await db.getProductsSummary();
      const formattedProducts = includeFullPayload
        ? products.map(normalizeProductForApi)
        : products.map((product) => buildPublicProduct(product));
      if (includeFullPayload) {
        productsCache = { data: formattedProducts, timestamp: Date.now() };
      } else {
        productsSummaryCache = { data: products, timestamp: Date.now() };
      }
      savePersistentCache();
      res.json(formattedProducts);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      const errMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      if (isFirst && !isQuota) {
        console.warn("Error fetching products, using cache or fallback:", errMsg);
      }
      if (includeFullPayload && productsCache) return res.json(productsCache.data);
      if (productsSummaryCache) {
        return res.json(productsSummaryCache.data.map((product: any) => buildPublicProduct(product)));
      }
      res.json(FALLBACK_PRODUCTS.map((product) => buildPublicProduct(product)));
    }
  }));

  app.get("/api/products/:id", asyncHandler(async (req: any, res: any) => {
    setPublicApiCache(res, 60);
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const product = await db.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      const formatted = buildPublicProduct(product, { includeGallery: true });
      res.json(formatted);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching product by id, using fallback if available:", error.message);
      }
      // If it's the fallback product ID, return it
      const fallback = FALLBACK_PRODUCTS.find(p => p.id === req.params.id);
      if (fallback) return res.json(fallback);
      res.status(503).json({ error: "Service temporarily unavailable due to database quota" });
    }
  }));

  app.get("/api/admin/products", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    setNoStore(res);
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const products = await db.getProductsSummary();
      productsSummaryCache = { data: products, timestamp: Date.now() };
      savePersistentCache();
      res.json(products.map(buildAdminProductSummary));
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching admin products, using cache or fallback:", error.message);
      }
      const fallbackProducts = getCachedProductSummaries();
      res.json(fallbackProducts.map((product: any) => buildAdminProductSummary(product)));
    }
  }));

  app.get("/api/admin/products/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    setNoStore(res);
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const product = await db.getProductById(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json(normalizeProductForApi(product));
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching admin product:", error.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: "Service unavailable" });
    }
  }));

  app.post("/api/admin/products/:id/web-image", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const product = await db.getProductById(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });

      const normalized = normalizeProductForApi(product);
      const result = await searchWebImageCandidates(normalized.name, normalized.category, Number(req.body.limit) || 8);
      if (!result.configured) {
        return res.status(428).json({
          error: "Google image search is not configured",
          query: result.query,
          openSearchUrl: result.openSearchUrl,
          provider: result.provider
        });
      }

      const candidate = result.candidates[0];
      if (!candidate) {
        return res.status(404).json({
          error: "No image candidates found",
          query: result.query,
          openSearchUrl: result.openSearchUrl
        });
      }

      const updated = await saveProductImages(normalized, candidate.url);
      res.json({ success: true, product: updated, candidate, query: result.query, provider: result.provider });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error saving web image:", err.message);
      }
      res.status(isQuota ? 503 : (err.status || 500)).json({ error: err.message || "Service unavailable" });
    }
  }));

  app.post("/api/admin/products/:id/ai-main-image", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const product = await db.getProductById(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });

      const normalized = normalizeProductForApi(product);
      const reference = String(req.body.base64Image || normalized.image || "").startsWith("data:image/")
        ? String(req.body.base64Image || normalized.image)
        : undefined;
      const result = await requestConfiguredProductImage(
        normalized.name,
        normalized.category,
        reference,
        "front hero shot, professional camera, exact ecommerce catalog framing"
      );
      const updated = await saveProductImages(normalized, result.image);
      res.json({ success: true, product: updated, image: result.image, provider: result.provider, model: result.model });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error saving AI main image:", err.message);
      }
      res.status(isQuota ? 503 : (err.status || 500)).json({ error: err.message || "Service unavailable" });
    }
  }));

  app.post("/api/admin/products/:id/ai-gallery", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const product = await db.getProductById(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });

      const normalized = normalizeProductForApi(product);
      const count = Math.max(1, Math.min(3, Number(req.body.count) || 3));
      const shotDirections = [
        "front hero shot, product fully visible, crisp details, premium ecommerce catalog",
        "three-quarter camera angle, realistic shadow, clean studio surface",
        "detail lifestyle-adjacent shot, still product-first, no text and no props hiding the item"
      ];
      const images: string[] = [];
      let provider = "";
      let model = "";

      for (let index = 0; index < count; index += 1) {
        const reference = index === 0 && String(normalized.image || "").startsWith("data:image/")
          ? normalized.image
          : undefined;
        const result = await requestConfiguredProductImage(normalized.name, normalized.category, reference, shotDirections[index]);
        images.push(result.image);
        provider = result.provider;
        model = result.model;
      }

      const mainImage = normalized.image || images[0];
      const updated = await saveProductImages(normalized, mainImage, images);
      res.json({ success: true, product: updated, images, provider, model });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error saving AI gallery:", err.message);
      }
      res.status(isQuota ? 503 : (err.status || 500)).json({ error: err.message || "Service unavailable" });
    }
  }));

  app.post("/api/admin/products/cleanup-images", authenticate, asyncHandler(async (req: any, res: any) => {
    if (!requireAdmin(req, res)) return;
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const requestedIds = Array.isArray(req.body?.ids)
        ? req.body.ids.map((id: any) => String(id || "").trim()).filter(Boolean)
        : (req.body?.id ? [String(req.body.id).trim()].filter(Boolean) : []);
      const productRefs = requestedIds.length > 0
        ? requestedIds.map((id: string) => ({ id }))
        : await db.getProductsSummary();
      const result = {
        total: productRefs.length,
        checked: 0,
        updated: 0,
        staleMain: 0,
        staleGallery: 0,
        promotedFromGallery: 0,
        clearedMain: 0,
        failed: 0,
        examples: [] as any[],
        failures: [] as any[]
      };

      for (const productRef of productRefs) {
        try {
          const product = await db.getProductById(String(productRef.id));
          if (!product) continue;
          result.checked += 1;
          const clean = cleanProductImageFields(product);
          if (clean.mainWasStale) result.staleMain += 1;
          if (clean.galleryHadStale) result.staleGallery += 1;
          if (clean.promotedFromGallery) result.promotedFromGallery += 1;
          if (clean.clearedMain) result.clearedMain += 1;
          if (!clean.changed) continue;

          await db.updateProduct(product.id, buildProductUpdatePayload(product, {
            image: clean.mainImage,
            images: JSON.stringify(clean.images)
          }));
          result.updated += 1;

          if (result.examples.length < 20) {
            result.examples.push({
              id: product.id,
              name: product.name,
              mainWasStale: clean.mainWasStale,
              galleryHadStale: clean.galleryHadStale,
              promotedFromGallery: clean.promotedFromGallery,
              clearedMain: clean.clearedMain,
              galleryBefore: clean.galleryBefore,
              galleryAfter: clean.galleryAfter
            });
          }
        } catch (error: any) {
          result.failed += 1;
          if (result.failures.length < 10) {
            result.failures.push({
              id: productRef.id,
              name: (productRef as any).name || "",
              error: error?.message || String(error)
            });
          }
        }
      }

      if (result.updated > 0) clearCache();
      res.json(result);
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error cleaning product images:", err.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: "Service unavailable" });
    }
  }));

  app.post("/api/admin/products", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const product = { ...req.body };

      // Check for duplicates by name
      const existingProducts = await db.getProductsSummary();
      const isDuplicate = existingProducts.some(p => p.name.toLowerCase() === product.name.toLowerCase());
      if (isDuplicate) {
        return res.status(400).json({ error: `Товар з назвою "${product.name}" вже існує в базі даних` });
      }

      if (product.images && Array.isArray(product.images)) {
        product.images = JSON.stringify(product.images);
      }
      if (product.bundle_items && Array.isArray(product.bundle_items)) {
        product.bundle_items = JSON.stringify(product.bundle_items);
      }
      if (!product.id) product.id = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).substr(2, 9));
      await db.createProduct(product);
      clearCache();
      res.json({ success: true, product });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error creating product:", err.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: "Service unavailable" });
    }
  }));

  // Bulk create/upsert: up to 50 products per request, single-pass dedup by normalized name.
  app.post("/api/admin/products/bulk", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    if (isDbInDegradedMode()) {
      return res.status(503).json({ error: "База даних у обмеженому режимі, спробуйте за кілька хвилин" });
    }
    const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 50) : [];
    const mode = req.body?.mode === "upsert" ? "upsert" : "create";
    if (!items.length) return res.status(400).json({ error: "items is required" });

    const normalizeName = (value: any) => String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
    let existingIndex: Map<string, any>;
    try {
      const existingProducts = await db.getProductsSummary();
      existingIndex = new Map(existingProducts.map((p: any) => [normalizeName(p.name), p]));
    } catch (err: any) {
      recordDbError(err);
      return res.status(503).json({ error: "Service unavailable" });
    }

    const results: any[] = [];
    for (const raw of items) {
      const name = String(raw?.name || "").trim();
      try {
        if (!name || !(Number(raw?.price) > 0)) {
          results.push({ name, status: "error", error: "Порожня назва або ціна" });
          continue;
        }
        const product: any = { ...raw, name };
        if (Array.isArray(product.images)) product.images = JSON.stringify(product.images);
        if (Array.isArray(product.bundle_items)) product.bundle_items = JSON.stringify(product.bundle_items);

        const match = existingIndex.get(normalizeName(name));
        if (match) {
          if (mode === "upsert") {
            delete product.id;
            await db.updateProduct(match.id, product);
            results.push({ id: match.id, name, status: "updated" });
          } else {
            results.push({ id: match.id, name, status: "skipped" });
          }
          continue;
        }

        if (!product.id) product.id = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).substr(2, 9));
        await db.createProduct(product);
        existingIndex.set(normalizeName(name), { id: product.id, name });
        results.push({ id: product.id, name, status: "created" });
      } catch (err: any) {
        const { isQuota } = recordDbError(err);
        results.push({ name, status: "error", error: isQuota ? "Ліміт БД вичерпано" : (err?.message || "DB error") });
        if (isQuota) break;
      }
    }

    clearCache();
    const summary = {
      created: results.filter(r => r.status === "created").length,
      updated: results.filter(r => r.status === "updated").length,
      skipped: results.filter(r => r.status === "skipped").length,
      errors: results.filter(r => r.status === "error").length
    };
    res.json({ results, summary, mode });
  }));

  app.put("/api/admin/products/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const product = { ...req.body };
      if (product.images && Array.isArray(product.images)) {
        product.images = JSON.stringify(product.images);
      }
      if (product.bundle_items && Array.isArray(product.bundle_items)) {
        product.bundle_items = JSON.stringify(product.bundle_items);
      }
      await db.updateProduct(req.params.id, product);
      clearCache();
      res.json({ success: true });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error updating product:", err.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: "Service unavailable" });
    }
  }));

  app.delete("/api/admin/products/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      await db.deleteProduct(req.params.id);
      clearCache();
      res.json({ success: true });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error deleting product:", err.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: "Service unavailable" });
    }
  }));

  app.get("/api/admin/orders", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    setNoStore(res);
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const orders = await db.getAllOrders();
      res.json(orders);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching admin orders:", error.message);
      }
      res.json([]);
    }
  }));

  app.post("/api/admin/orders/:id/status", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { trackingNumber } = req.body;
    const status = normalizeString(req.body?.status, 40);
    if (!ORDER_STATUSES.has(status)) {
      return res.status(400).json({ error: "Invalid order status" });
    }
    const orderId = req.params.id;
    
    // Get order details to check if bonuses should be credited
    const orders = await db.getAllOrders();
    const order = orders.find(o => o.id === orderId);
    
    if (!order) return res.status(404).json({ error: "Order not found" });

    await db.updateOrderStatus(orderId, status);
    
    // Update tracking number if provided
    if (trackingNumber && (db as any).updateOrderTrackingNumber) {
      await (db as any).updateOrderTrackingNumber(orderId, trackingNumber);
    }

    const orderUserId = order.user_id;
    const orderFinalTotal = Math.max(0, Math.floor(toFiniteNumber(order.finalTotal)));
    const orderBonusUsed = Math.max(0, Math.floor(toFiniteNumber(order.bonusUsed)));

    // Credit cashback once, after the order is paid or completed.
    if ((status === 'paid' || status === 'completed') && !order.bonusesCredited && !order.bonusesRestored && orderUserId) {
      const user = await db.getUserById(orderUserId);
      if (user) {
        const earnedBonuses = Math.floor(orderFinalTotal * getCashbackRate(toFiniteNumber(user.total_spent)));
        await db.updateUserBonuses(orderUserId, Math.max(0, Math.floor(toFiniteNumber(user.bonuses)) + earnedBonuses));
        await db.addUserTotalSpent(orderUserId, orderFinalTotal);
        if ((db as any).markOrderBonusesCredited) {
          await (db as any).markOrderBonusesCredited(orderId);
        }
        await notifyUser(
          orderUserId,
          "Бонуси нараховано",
          `За замовлення ${orderId} нараховано ${earnedBonuses} бонусів.`,
          "bonus_credit"
        );
      }
    }

    // Once the order is completed, invite the buyer to leave a review.
    if (status === 'completed' && orderUserId) {
      await notifyUser(
        orderUserId,
        "Як вам покупка?",
        `Замовлення ${orderId} виконано. Поділіться відгуком на сторінці товару — це допомагає іншим обирати.`,
        "review_request"
      );
    }

    // Return stock, spent bonuses, and cashback if an order is cancelled.
    if (status === 'cancelled' && !order.bonusesRestored) {
      for (const item of order.items || []) {
        const quantity = Math.max(0, Math.floor(toFiniteNumber(item.quantity)));
        if (item.id && quantity > 0) {
          await db.updateProductStock(item.id, -quantity);
        }
      }

      if (orderUserId && (orderBonusUsed > 0 || order.bonusesCredited)) {
        const user = await db.getUserById(orderUserId);
        if (user) {
          let nextBonuses = Math.max(0, Math.floor(toFiniteNumber(user.bonuses)));
          if (orderBonusUsed > 0) {
            nextBonuses += orderBonusUsed;
          }

          if (order.bonusesCredited) {
            const spentBeforeOrder = Math.max(0, toFiniteNumber(user.total_spent) - orderFinalTotal);
            const creditedBonuses = Math.floor(orderFinalTotal * getCashbackRate(spentBeforeOrder));
            nextBonuses = Math.max(0, nextBonuses - creditedBonuses);
            await db.addUserTotalSpent(orderUserId, -orderFinalTotal);
          }

          await db.updateUserBonuses(orderUserId, nextBonuses);
          if (orderBonusUsed > 0) {
            await notifyUser(
              orderUserId,
              "Бонуси повернено",
              `За скасоване замовлення ${orderId} повернено ${orderBonusUsed} бонусів.`,
              "bonus_refund"
            );
          }
        }
      }

      if ((db as any).markOrderBonusesRestored) {
        await (db as any).markOrderBonusesRestored(orderId);
      }
    }

    const label = ORDER_STATUS_LABELS[status] || status;
    await notifyUser(
      order.user_id,
      "Статус замовлення оновлено",
      `Замовлення ${orderId}: ${label}${trackingNumber ? `. ТТН: ${trackingNumber}` : ""}.`,
      "order_status"
    );
    await notifyAdmins(
      "Статус замовлення оновлено",
      `${req.user.email || "Адмін"} змінив ${orderId}: ${label}.`,
      "order_status"
    );

    res.json({ success: true });
  }));

  app.get("/api/categories", asyncHandler(async (req: any, res: any) => {
    setNoStore(res);
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const categories = await db.getCategories();
      categoriesCache = { data: categories, timestamp: Date.now() };
      savePersistentCache();
      res.json(categories);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      const errMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      if (isFirst && !isQuota) {
        console.warn("Error fetching categories, using cache or fallback:", errMsg);
      }
      if (categoriesCache) return res.json(categoriesCache.data);
      res.json(FALLBACK_CATEGORIES);
    }
  }));

  app.get("/api/delivery/nova-poshta/cities", asyncHandler(async (req: any, res: any) => {
    const query = normalizeString(req.query?.q, 80);
    if (query.length < 2) {
      return res.json([]);
    }

    try {
      const cities = await novaPoshtaRequest("Address", "getCities", {
        FindByString: query,
        Limit: "20",
        Page: "1",
      });
      res.json(cities.slice(0, 20).map(mapNovaPoshtaCity));
    } catch (error: any) {
      console.warn("Nova Poshta city lookup failed:", error?.message || error);
      res.status(503).json({ error: "Не вдалося отримати міста Нової пошти" });
    }
  }));

  app.get("/api/delivery/nova-poshta/warehouses", asyncHandler(async (req: any, res: any) => {
    const cityRef = normalizeString(req.query?.cityRef, 80);
    const query = normalizeString(req.query?.q, 80);
    if (!cityRef) {
      return res.json([]);
    }

    try {
      const warehouses = await novaPoshtaRequest("Address", "getWarehouses", {
        CityRef: cityRef,
        FindByString: query,
        Limit: "50",
        Page: "1",
        Language: "UA",
      });
      res.json(warehouses.slice(0, 50).map(mapNovaPoshtaWarehouse));
    } catch (error: any) {
      console.warn("Nova Poshta warehouse lookup failed:", error?.message || error);
      res.status(503).json({ error: "Не вдалося отримати відділення Нової пошти" });
    }
  }));

  app.post("/api/admin/categories", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const category = req.body;
    if (!category.id) category.id = Math.random().toString(36).substr(2, 9);
    await db.createCategory(category);
    clearCache();
    res.json({ success: true, category });
  }));

  app.put("/api/admin/categories/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    await db.updateCategory(req.params.id, req.body);
    clearCache();
    res.json({ success: true });
  }));

  app.delete("/api/admin/categories/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    await db.deleteCategory(req.params.id);
    clearCache();
    res.json({ success: true });
  }));

// Admin & Order Routes
app.get("/api/admin/users", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const users = await db.getAllUsers();
      res.json(users);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching admin users:", error.message);
      }
      res.json([]);
    }
  }));

  app.put("/api/admin/users/:id/role", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { role } = req.body;
    await db.updateUserRole(req.params.id, role);
    res.json({ success: true });
  }));

  app.get("/api/admin/stats", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const stats = await db.getAdminStats();
      res.json(stats);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching admin stats:", error.message);
      }
      res.json({
        totalRevenue: 0,
        orderCount: 0,
        userCount: 0,
        productCount: 0,
        recentOrders: [],
        topProducts: [],
        revenueByDay: []
      });
    }
  }));

  app.put("/api/admin/users/:id/bonuses", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { bonuses } = req.body;
    await db.updateUserBonuses(req.params.id, bonuses);
    res.json({ success: true });
  }));

  app.post("/api/admin/stats/reset", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    await db.resetStats();
    res.json({ success: true });
  }));

  app.post("/api/admin/db/reset-degraded", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    lastDbErrorTimestamp = 0;
    isDegradedLogEmitted = false;
    console.log("Database degraded mode manually reset by admin");
    res.json({ success: true, message: "Database circuit breaker reset. Retrying connection on next request." });
  }));

  app.get("/api/admin/db/status", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    res.json({ 
      isDegraded: isDbInDegradedMode(),
      lastError: lastDbErrorTimestamp ? new Date(lastDbErrorTimestamp).toISOString() : null,
      retryAt: lastDbErrorTimestamp ? new Date(lastDbErrorTimestamp + DB_RETRY_AFTER).toISOString() : null
    });
  }));

  app.get("/api/site-settings", asyncHandler(async (req: any, res: any) => {
    setPublicApiCache(res, 120);
    const now = Date.now();
    if (siteSettingsCache && (now - siteSettingsCache.timestamp < CACHE_TTL)) {
      return res.json(siteSettingsCache.data);
    }
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const settings = await db.getSiteSettings();
      siteSettingsCache = { data: settings || DEFAULT_SITE_SETTINGS, timestamp: now };
      savePersistentCache();
      res.json(settings || DEFAULT_SITE_SETTINGS);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      const errMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      if (isFirst && !isQuota) {
        console.warn("Error fetching site settings, using cache or fallback:", errMsg);
      }
      if (siteSettingsCache) return res.json(siteSettingsCache.data);
      res.json(DEFAULT_SITE_SETTINGS);
    }
  }));

  app.put("/api/admin/site-settings", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    await db.updateSiteSettings(req.body);
    res.json({ success: true });
  }));

  app.get("/api/bonus-codes", asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const codes = await db.getBonusCodes();
      res.json(codes || []);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching bonus codes, returning empty array:", error.message);
      }
      res.json([]);
    }
  }));

  app.get("/api/user/orders", authenticate, asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }

      const orders = await db.getAllOrders();
      const userOrders = orders.filter(o => o.user_id === req.user.id);
      res.json(userOrders);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching user orders, returning empty array:", error.message);
      }
      res.json([]);
    }
  }));

  app.post("/api/orders", asyncHandler(async (req: any, res: any) => {
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const { customer = {}, items = [] } = req.body || {};
      const orderId = normalizeString(req.body?.id, 64) || `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const authUser = getOptionalUser(req);
      const customerName = normalizeString(customer.name, 120);
      const customerPhone = normalizeString(customer.phone, 40);
      const customerEmail = normalizeString(customer.email, 160);
      const customerCity = normalizeString(customer.city, 120);
      const warehouse = normalizeString(customer.warehouse, 180);
      const rawDeliveryMethod = normalizeString(customer.deliveryMethod, 60);
      const isQuickOrder = req.body?.isQuickOrder === true;
      const deliveryMethod = isQuickOrder
        ? "quick-order"
        : (["nova-poshta", "ukr-poshta"].includes(rawDeliveryMethod) ? rawDeliveryMethod : "nova-poshta");
      const comment = normalizeString(req.body?.comment, 700);
      const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod);

      if (!customerName || !customerPhone || (!isQuickOrder && !customerCity)) {
        return res.status(400).json({
          error: isQuickOrder
            ? "Заповніть ім'я і телефон"
            : "Заповніть ім'я, телефон і місто доставки"
        });
      }
      if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
        return res.status(400).json({ error: "Некоректний email" });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Кошик порожній" });
      }

      const orderItems: any[] = [];
      let serverTotal = 0;
      for (const rawItem of items) {
        const productId = normalizeString(rawItem?.id, 120);
        const quantity = Math.floor(toFiniteNumber(rawItem?.quantity, 0));
        if (!productId || quantity < 1) {
          return res.status(400).json({ error: "Некоректний товар у кошику" });
        }

        const product = await db.getProductById(productId);
        if (!product) {
          return res.status(404).json({ error: `Товар ${productId} не знайдено` });
        }
        if (Number(product.stock || 0) < quantity) {
          return res.status(409).json({ error: `Недостатньо товару "${product.name}" на складі` });
        }

        const price = toFiniteNumber(product.price);
        serverTotal += price * quantity;
        orderItems.push({
          order_id: orderId,
          product_id: productId,
          quantity,
          price
        });
      }

      const promoCode = normalizeString(req.body?.promoCode, 80).toUpperCase();
      let promoDiscount = 0;
      if (promoCode) {
        const bonusCodes = await db.getBonusCodes();
        const promo = bonusCodes.find((code: any) =>
          String(code.code || "").toUpperCase() === promoCode &&
          code.is_active &&
          code.type === "promo"
        );
        if (!promo) {
          return res.status(400).json({ error: "Промокод неактивний або не існує" });
        }
        if (serverTotal < toFiniteNumber(promo.min_order_amount)) {
          return res.status(400).json({ error: "Сума замовлення менша за мінімум промокоду" });
        }
        promoDiscount = promo.discount_type === "percent"
          ? Math.floor(serverTotal * (toFiniteNumber(promo.discount_amount) / 100))
          : toFiniteNumber(promo.discount_amount);
        promoDiscount = Math.min(Math.max(promoDiscount, 0), serverTotal);
      }

      const bundleOffer = req.body?.bundleOffer || null;
      let bundleDiscount = 0;
      if (bundleOffer && Array.isArray(bundleOffer.productIds)) {
        const offerIds = Array.from(new Set<string>(
          bundleOffer.productIds
            .map((id: any) => normalizeString(id, 120))
            .filter(Boolean)
        )).slice(0, 8) as string[];
        const orderedIds = new Set(orderItems.map(item => item.product_id));

        if (offerIds.length >= 2 && offerIds.every(id => orderedIds.has(id))) {
          const bundleRate = Math.min(0.18, Math.max(0.05, toFiniteNumber(bundleOffer.discountRate, 0.12)));
          const bundleBase = offerIds.reduce((sum: number, id: string) => {
            const item = orderItems.find(orderItem => orderItem.product_id === id);
            return sum + toFiniteNumber(item?.price);
          }, 0);
          bundleDiscount = Math.min(Math.round(bundleBase * bundleRate), Math.max(0, serverTotal - promoDiscount));
        }
      }

      const totalDiscount = Math.min(serverTotal, promoDiscount + bundleDiscount);
      const bonusBase = Math.max(0, serverTotal - totalDiscount);
      const bonusSpendLimit = calculateBonusSpendLimit(bonusBase);
      const loyaltyUser = authUser?.id ? await db.getUserById(authUser.id) : null;
      let safeBonusUsed = 0;
      if (authUser?.id) {
        const requestedBonus = Math.max(0, Math.floor(toFiniteNumber(req.body?.bonusUsed)));
        if (requestedBonus > 0) {
          safeBonusUsed = Math.min(requestedBonus, Math.floor(toFiniteNumber(loyaltyUser?.bonuses)), bonusSpendLimit);
        }
      }
      const safeFinalTotal = Math.max(0, bonusBase - safeBonusUsed);
      const cashbackPending = loyaltyUser
        ? Math.floor(safeFinalTotal * getCashbackRate(toFiniteNumber(loyaltyUser.total_spent)))
        : 0;

      await db.createOrder({
        id: orderId,
        user_id: authUser?.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        customer_city: customerCity || "Швидке замовлення",
        customer_address: customerCity ? customerCity + (warehouse ? ", " + warehouse : "") : "Уточнити з клієнтом",
        delivery_method: deliveryMethod,
        warehouse,
        total: serverTotal,
        payment_method: paymentMethod,
        comment: [
          comment,
          promoCode ? `Промокод: ${promoCode}` : "",
          bundleDiscount > 0 ? `Конструктор набору: -${bundleDiscount} грн` : ""
        ].filter(Boolean).join("\n") || undefined
      }, orderItems, safeBonusUsed, safeFinalTotal);

      const orderSummary = {
        id: orderId,
        customer_name: customerName,
        customer_phone: customerPhone,
        final_total: safeFinalTotal
      };
      await notifyAdmins(
        "Нове замовлення",
        `Замовлення ${orderId} на ${safeFinalTotal} грн очікує обробки.`,
        "order_created"
      );
      await notifyUser(
        authUser?.id,
        "Замовлення прийнято",
        `Ми отримали замовлення ${orderId} на ${safeFinalTotal} грн.`,
        "order_created"
      );
      await sendTelegramOrderNotification(orderSummary, orderItems);

      res.json({
        success: true,
        orderId,
        total: serverTotal,
        bonusUsed: safeBonusUsed,
        bonusLimit: bonusSpendLimit,
        discount: totalDiscount,
        promoDiscount,
        bundleDiscount,
        finalTotal: safeFinalTotal,
        cashbackPending
      });
    } catch (err: any) {
      const { isQuota, isFirst } = recordDbError(err);
      if (isFirst && !isQuota) {
        console.warn("Error creating order:", err.message);
      }
      res.status(isQuota ? 503 : 500).json({ error: isQuota ? "Сервіс тимчасово недоступний через обмеження бази даних" : "Помилка при створенні замовлення" });
    }
  }));

  // Bonus Codes
  app.get("/api/bonus-codes/validate/:code", asyncHandler(async (req: any, res: any) => {
    const { code } = req.params;
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const bonusCodes = await (db as any).getBonusCodes();
      const bonusCode = bonusCodes.find((bc: any) => 
        bc.code.toLowerCase() === code.toLowerCase() && 
        bc.is_active && 
        bc.type === 'promo'
      );
      
      if (!bonusCode) {
        return res.status(404).json({ error: "Промокод не знайдено або він неактивний" });
      }
      
      res.json(bonusCode);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error validating bonus code:", error.message);
      }
      res.status(503).json({ error: "Сервіс тимчасово недоступний" });
    }
  }));

  app.get("/api/admin/bonus-codes", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const bonusCodes = await (db as any).getBonusCodes();
      res.json(bonusCodes);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching admin bonus codes:", error.message);
      }
      res.json([]);
    }
  }));

  app.post("/api/admin/bonus-codes", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const bonusCode = req.body;
    if (!bonusCode.id) bonusCode.id = Math.random().toString(36).substr(2, 9);
    if (!bonusCode.type) bonusCode.type = 'promo';
    await (db as any).createBonusCode(bonusCode);
    res.json({ success: true, bonusCode });
  }));

  app.delete("/api/admin/bonus-codes/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    await (db as any).deleteBonusCode(id);
    res.json({ success: true });
  }));

  app.put("/api/admin/bonus-codes/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    const bonusCode = req.body;
    await (db as any).updateBonusCode(id, bonusCode);
    res.json({ success: true });
  }));

  // Admin Review Routes
  app.get("/api/admin/reviews", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      if (isDbInDegradedMode()) {
        throw new Error("Database is in degraded mode (quota exceeded)");
      }
      const reviews = await (db as any).getAllReviews();
      res.json(reviews);
    } catch (error: any) {
      const { isQuota, isFirst } = recordDbError(error);
      if (isFirst && !isQuota) {
        console.warn("Error fetching admin reviews:", error.message);
      }
      res.json([]);
    }
  }));

  app.put("/api/admin/reviews/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    const review = req.body;
    await (db as any).updateReview(id, review);
    res.json({ success: true });
  }));

  app.delete("/api/admin/reviews/:id", authenticate, asyncHandler(async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    await (db as any).deleteReview(id);
    res.json({ success: true });
  }));

  // Catch-all for API routes to prevent HTML responses
  app.all(/^\/api\/.*/, (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

async function startViteAndListen() {
  // Ensure DB is initialized at startup
  try {
    await ensureDb();
    console.log("Database initialized at startup");
  } catch (e) {
    const { isQuota, isFirst } = recordDbError(e);
    if (isFirst && !isQuota) {
      console.error("Failed to initialize database at startup:", e);
    }
  }

  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "dist"), {
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
        }
      }
    }));
    app.get(/.*/, (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Server Error:", err);
    const status = err.status || 500;
    
    // Improved message extraction
    let message = "Internal Server Error";
    let sourceError = "Unknown Error";

    if (err instanceof Error) {
      message = err.message;
      sourceError = (err as any).cause || (err as any).sourceError || err.message;
    } else if (typeof err === 'string') {
      message = err;
      sourceError = err;
    } else if (err && typeof err === 'object') {
      message = err.message || err.error || JSON.stringify(err);
      sourceError = err.cause || err.sourceError || message;
    }
    
    const stack = err.stack || "No stack trace available";
    
    const isAiRequest = String(req.path || "").startsWith("/api/admin/ai/");

    // Handle provider quota errors separately from Neon database quota errors
    const isQuotaError = message.toLowerCase().includes("quota") || 
                        sourceError.toString().toLowerCase().includes("quota") ||
                        message.includes("402") || 
                        (err.code && (err.code === "402" || err.code === "57014"));

    if (isQuotaError) {
      if (isAiRequest) {
        return res.status(503).json({
          error: "AI Quota Exceeded",
          message: "Ліміт AI-генерації вичерпано або тимчасово недоступний. Оновіть кредити/ключ AI і повторіть спробу.",
          ...(!IS_PRODUCTION ? { sourceError, stack } : {})
        });
      }

      return res.status(503).json({
        error: "Database Quota Exceeded",
        message: "Ваш проект перевищив квоту передачі даних бази даних Neon. Будь ласка, зачекайте або оновіть план.",
        ...(!IS_PRODUCTION ? { sourceError, stack } : {})
      });
    }

    res.status(status).json({
      error: IS_PRODUCTION && status >= 500 ? "Internal Server Error" : message,
      ...(!IS_PRODUCTION ? { sourceError, stack } : {})
    });
  });
}

startViteAndListen();
