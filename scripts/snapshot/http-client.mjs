// ========================================
// Cookie 管理付き HTTP クライアント
// ========================================

import { CONFIG } from "./config.mjs";

export class HttpClient {
  constructor() {
    this.cookies = new Map();
    this.baseUrl = CONFIG.baseUrl;
  }

  /** Set-Cookie ヘッダーからクッキーを保存 */
  parseCookies(response) {
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    for (const header of setCookieHeaders) {
      const [pair] = header.split(";");
      const [name, ...valueParts] = pair.split("=");
      if (name && valueParts.length > 0) {
        this.cookies.set(name.trim(), valueParts.join("=").trim());
      }
    }
    // raw ヘッダーからも取得 (Node.js 互換)
    const raw = response.headers.raw?.();
    if (raw?.["set-cookie"]) {
      for (const header of raw["set-cookie"]) {
        const [pair] = header.split(";");
        const [name, ...valueParts] = pair.split("=");
        if (name && valueParts.length > 0) {
          this.cookies.set(name.trim(), valueParts.join("=").trim());
        }
      }
    }
  }

  /** クッキーを Cookie ヘッダー文字列に変換 */
  getCookieString() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  /** URL を構築 */
  buildUrl(path) {
    if (path.startsWith("http")) return path;
    return `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  /** GET リクエスト */
  async get(path, options = {}) {
    return this.request("GET", path, options);
  }

  /** POST リクエスト */
  async post(path, body, options = {}) {
    return this.request("POST", path, { ...options, body });
  }

  /** 汎用リクエスト (リトライ付き) */
  async request(method, path, options = {}) {
    const url = this.buildUrl(path);
    const headers = {
      "User-Agent": CONFIG.userAgent,
      Cookie: this.getCookieString(),
      ...(options.headers || {}),
    };

    if (options.body && typeof options.body === "object") {
      if (options.contentType === "form") {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        options.body = new URLSearchParams(options.body).toString();
      } else {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(options.body);
      }
    }

    let lastError;
    for (let attempt = 0; attempt < CONFIG.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: options.body,
          redirect: options.followRedirect === false ? "manual" : "follow",
          signal: AbortSignal.timeout(CONFIG.timeout),
        });

        this.parseCookies(response);

        const text = await response.text();
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          location: response.headers.get("location"),
          body: text,
          url: response.url,
          ok: response.ok || (response.status >= 300 && response.status < 400),
        };
      } catch (err) {
        lastError = err;
        console.error(
          `  [リトライ ${attempt + 1}/${CONFIG.maxRetries}] ${method} ${url}: ${err.message}`
        );
        if (attempt < CONFIG.maxRetries - 1) {
          await sleep(2000 * (attempt + 1));
        }
      }
    }
    throw lastError;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
