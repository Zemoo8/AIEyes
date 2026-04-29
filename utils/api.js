const BACKEND_BASE = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/+$/, '');
const YOLO_BASE = (process.env.EXPO_PUBLIC_YOLO_URL ?? '').replace(/\/+$/, '');
const ANDROID_EMULATOR_LOCAL = 'http://10.0.2.2:8000';
const DETECT_BASES = uniqueBases([YOLO_BASE, ANDROID_EMULATOR_LOCAL]);

const DETECT_TIMEOUT_MS = 15000;

function uniqueBases(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function joinUrl(base, endpoint) {
  if (!base) throw new Error('Missing API base URL');
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${normalized}`;
}

function detectionAbortError(error) {
  if (error?.name === 'AbortError') {
    return new Error('Detection timeout - backend too slow');
  }
  return error;
}

function nowMs() {
  return Date.now();
}

function logElapsed(prefix, startedAt) {
  console.log(prefix, `${nowMs() - startedAt}ms`);
}

async function post(endpoint, body) {
  const url = joinUrl(BACKEND_BASE, endpoint);
  const startedAt = nowMs();
  console.log('[Detect] endpoint:', url);
  console.log('[Detect] request start:', startedAt);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  logElapsed('[Detect] response time:', startedAt);
  if (!res.ok) throw new Error(`${endpoint} failed: ${res.status}`);
  return res.json();
}

async function postImage(endpoint, image, signal) {
  if (!image?.uri) {
    throw new Error('detectObjects requires an image with a uri');
  }

  const makeForm = () => {
    const form = new FormData();
    form.append('file', {
      uri: image.uri,
      type: image.mimeType ?? 'image/jpeg',
      name: image.fileName ?? 'frame.jpg',
    });
    return form;
  };

  const attempts = endpoint === '/detect'
    ? ['/detect', '/api/detect']
    : [endpoint, endpoint.replace(/^\/api\//, '/')];

  let lastError = null;
  const bases = DETECT_BASES;
  for (const attempt of attempts) {
    for (const base of bases) {
      if (signal?.aborted) throw new Error('Detection aborted');
      const url = joinUrl(base, attempt);
      const startedAt = nowMs();
      console.log('[Detect] endpoint:', url);
      console.log('[Detect] request start:', startedAt);
      try {
        const res = await fetch(url, {
          method: 'POST',
          body: makeForm(),
          signal,
        });
        logElapsed('[Detect] response time:', startedAt);
        if (!res.ok) {
          lastError = new Error(`${base}${attempt} failed: ${res.status}`);
          console.log('[Detect] failed:', `${base}${attempt}`, res.status);
          continue;
        }
        console.log('[Detect] success:', `${base}${attempt}`);
        return res.json();
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') {
          console.log('[Detect] abort after:', `${nowMs() - startedAt}ms`, 'endpoint:', url);
          throw detectionAbortError(error);
        }
        console.log('[Detect] exception:', `${base}${attempt}`, error?.message ?? error);
        lastError = error;
      }
    }
  }

  throw lastError ?? new Error(`${endpoint} failed`);
}

async function postBase64Detect(imageBase64, signal) {
  if (!imageBase64) {
    throw new Error('detectObjects requires base64 image data');
  }

  const attempts = ['/detect_base64', '/api/detect_base64'];
  const bases = DETECT_BASES;
  let lastError = null;

  for (const attempt of attempts) {
    for (const base of bases) {
      if (signal?.aborted) throw new Error('Detection aborted');
      const url = joinUrl(base, attempt);
      const startedAt = nowMs();
      console.log('[Detect] endpoint:', url);
      console.log('[Detect] request start:', startedAt);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageBase64 }),
          signal,
        });
        logElapsed('[Detect] response time:', startedAt);
        if (!res.ok) {
          lastError = new Error(`${base}${attempt} failed: ${res.status}`);
          console.log('[Detect] failed:', `${base}${attempt}`, res.status);
          continue;
        }
        console.log('[Detect] success:', `${base}${attempt}`);
        return res.json();
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') {
          console.log('[Detect] abort after:', `${nowMs() - startedAt}ms`, 'endpoint:', url);
          throw detectionAbortError(error);
        }
        console.log('[Detect] exception:', `${base}${attempt}`, error?.message ?? error);
        lastError = error;
      }
    }
  }

  throw lastError ?? new Error('detect_base64 failed');
}

export async function detectObjects(image) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, DETECT_TIMEOUT_MS);
  const startedAt = nowMs();
  try {
    console.log('[Detect] using base64 detect');
    try {
      const data = await postBase64Detect(image?.base64, controller.signal);
      console.log('[Detect] base64 detect success');
      return Array.isArray(data) ? data : data.objects ?? [];
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') {
        console.log('[Detect] base64 detect timed out after:', `${nowMs() - startedAt}ms`);
        throw detectionAbortError(error);
      }
      console.log('[Detect] base64 detect failed:', error?.message ?? error);
      console.log('[Detect] falling back to multipart');
      const data = await postImage('/detect', image, controller.signal);
      return Array.isArray(data) ? data : data.objects ?? [];
    }
  } finally {
    logElapsed('[Detect] total elapsed:', startedAt);
    clearTimeout(timer);
  }
}

export async function readText(base64) {
  const data = await post('/api/ocr', { image: base64 });
  return data.text ?? '';
}

export async function describeScene(base64) {
  const data = await post('/api/describe', { image: base64 });
  return data.description ?? '';
}
