/**
 * gemini.js
 * Google Gemini Vision API integration
 * FREE tier: 15 requests/min, 1M tokens
 * Perfect for: Scene description, OCR, Currency detection
 */

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

let geminiBlockedUntil = 0;

export function getGeminiBlockedUntil() {
  return geminiBlockedUntil;
}

/**
 * Call Gemini Vision API with base64 image
 * @param {string} base64 - Image in base64 format
 * @param {string} prompt - Arabic or English prompt
 * @param {string} mediaType - 'image/jpeg' or 'image/png'
 * @returns {Promise<string|null>} - Response text or null if blocked/error
 */
export async function geminiVision(base64, prompt, mediaType = 'image/jpeg') {
  if (!GEMINI_KEY) {
    console.log('[Gemini] No API key');
    return null;
  }

  // Check rate limit (FREE tier: 15 req/min)
  if (Date.now() < geminiBlockedUntil) {
    console.log('[Gemini] Rate limited, blocked until', new Date(geminiBlockedUntil).toISOString());
    return null;
  }

  try {
    console.log('[Gemini] vision call, prompt:', prompt.slice(0, 60));

    const response = await fetch(`${GEMINI_API_BASE}?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mediaType,
                  data: base64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.7,
        },
      }),
    });

    console.log('[Gemini] response status:', response.status);

    if (!response.ok) {
      const error = await response.json();
      const msg = error?.error?.message || response.statusText;
      console.log('[Gemini] error:', msg);

      // Handle rate limit
      if (response.status === 429) {
        const quotaExceeded = /quota|billing|exceeded/i.test(msg);
        geminiBlockedUntil = Date.now() + (quotaExceeded ? 15 * 60 * 1000 : 65 * 1000);
        return null;
      }

      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!text) {
      console.log('[Gemini] empty response');
      return null;
    }

    console.log('[Gemini] result:', text.slice(0, 150));
    return text.trim();
  } catch (e) {
    console.log('[Gemini] exception:', e?.message);
    return null;
  }
}

/**
 * Gemini-based scene description (DESCRIBE mode)
 */
export async function geminiDescribeScene(base64, frameW, frameH) {
  const prompt =
    'اصف هذا المشهد بجملة أو جملتين قصيرتين باللغة العربية. ركز على أهم العناصر. لا تكرر الأشياء.';

  return geminiVision(base64, prompt);
}

/**
 * Gemini-based OCR (READ mode)
 */
export async function geminiReadText(base64) {
  const prompt =
    'اقرأ جميع النصوص المرئية في الصورة. أولاً النصوص بالعربية ثم الفرنسية. إذا لم توجد نصوص قل: لا يوجد نص';

  return geminiVision(base64, prompt);
}

/**
 * Gemini-based currency detection (CURRENCY mode)
 */
export async function geminiDetectCurrency(base64) {
  const prompt =
    'هل هذه صورة ورقة نقدية تونسية؟ إن كانت، حدد الفئة (5، 10، 20، 30، 50 دينار). أجب بصيغة: "دينار [الرقم]" أو "ليست عملة تونسية"';

  return geminiVision(base64, prompt);
}

/**
 * Gemini-based object detection (FIND mode with description)
 */
export async function geminiSearchForObject(base64, targetHint) {
  const prompt =
    `هل توجد ${targetHint} في هذه الصورة؟ إن وجدت، اذكر موقعها بدقة (يسار، يمين، أعلى، أسفل، وسط). ` +
    `إن لم توجد قل: لم أجد ${targetHint}`;

  return geminiVision(base64, prompt);
}

/**
 * Reset rate limit (for testing)
 */
export function resetGeminiRateLimit() {
  geminiBlockedUntil = 0;
}
