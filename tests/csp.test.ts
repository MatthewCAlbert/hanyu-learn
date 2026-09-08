import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, httpsConnectOrigin } from "~/lib/csp";

describe("httpsConnectOrigin", () => {
  it("takes the origin from a directory URL", () => {
    expect(
      httpsConnectOrigin(
        "https://cdn.jsdelivr.net/gh/hugolpz/audio-cmn@ff9ed3d0c631195bd2c06f39450f3264c7124040/24k-abr/",
      ),
    ).toBe("https://cdn.jsdelivr.net");
    expect(httpsConnectOrigin("https://cdn.hanyu.qreate.id")).toBe("https://cdn.hanyu.qreate.id");
  });

  it("ignores empty, http, and invalid values", () => {
    expect(httpsConnectOrigin(undefined)).toBeNull();
    expect(httpsConnectOrigin("  ")).toBeNull();
    expect(httpsConnectOrigin("http://cdn.example.com/audio")).toBeNull();
    expect(httpsConnectOrigin("cdn.example.com/audio")).toBeNull();
  });
});

describe("contentSecurityPolicy", () => {
  it("allows OpenRouter and the audio CDN origin when set", () => {
    const csp = contentSecurityPolicy("https://cdn.example.com/24k-abr/");
    expect(csp).toContain("connect-src 'self' https://openrouter.ai https://cdn.example.com");
    expect(csp).toContain("frame-src https://www.youtube-nocookie.com");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/connect-src[^;]*http:/);
    expect(csp).not.toMatch(/frame-src[^;]*\*/);
  });

  it("omits an audio host when clips are off", () => {
    expect(contentSecurityPolicy()).toContain("connect-src 'self' https://openrouter.ai;");
    expect(contentSecurityPolicy()).not.toContain("cdn.");
  });

  it("drops frame-ancestors for the meta policy", () => {
    const csp = contentSecurityPolicy("https://cdn.example.com", { frameAncestors: false });
    expect(csp).not.toContain("frame-ancestors");
    expect(csp).toContain("connect-src 'self' https://openrouter.ai https://cdn.example.com");
  });
});
