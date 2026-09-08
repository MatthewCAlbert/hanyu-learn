import { describe, expect, it } from "vitest";
import {
  authorizeS3,
  awsUriEncode,
  describeError,
  isTransientError,
  objectKey,
  objectUrl,
  parseEnvText,
  type S3Target,
} from "../scripts/upload-audio.ts";

const target: S3Target = {
  bucket: "clips",
  region: "us-east-1",
  accessKey: "AKIAEXAMPLE",
  secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  endpoint: "https://s3.example.com:9000",
  addressing: "path",
  prefix: "",
};

describe("parseEnvText", () => {
  it("skips comments, unquotes, and strips unquoted inline comments", () => {
    const parsed = parseEnvText(`
# comment
AUDIO_S3_BUCKET=clips
export AUDIO_S3_REGION = auto
AUDIO_S3_PREFIX="24k-abr"
NOTE=plain # leftover
`);
    expect(parsed.AUDIO_S3_BUCKET).toBe("clips");
    expect(parsed.AUDIO_S3_REGION).toBe("auto");
    expect(parsed.AUDIO_S3_PREFIX).toBe("24k-abr");
    expect(parsed.NOTE).toBe("plain");
  });
});

describe("S3 keys and URLs", () => {
  it("encodes Hanzi in the path but keeps slashes", () => {
    expect(awsUriEncode("飞机")).toBe("%E9%A3%9E%E6%9C%BA");
    expect(awsUriEncode("hsk/cmn-飞机.mp3", false)).toBe("hsk/cmn-%E9%A3%9E%E6%9C%BA.mp3");
  });

  it("joins an optional prefix", () => {
    expect(objectKey("", "hsk/cmn-好.mp3")).toBe("hsk/cmn-好.mp3");
    expect(objectKey("/24k-abr/", "hsk/cmn-好.mp3")).toBe("24k-abr/hsk/cmn-好.mp3");
  });

  it("defaults to path-style on the given endpoint (MinIO / R2 / Garage)", () => {
    const r2 = objectUrl(
      {
        ...target,
        endpoint: "https://abc.r2.cloudflarestorage.com/",
        region: "auto",
      },
      "hsk/cmn-飞机.mp3",
    );
    expect(r2.host).toBe("abc.r2.cloudflarestorage.com");
    expect(r2.path).toBe("/clips/hsk/cmn-%E9%A3%9E%E6%9C%BA.mp3");
    expect(r2.url).toBe(
      "https://abc.r2.cloudflarestorage.com/clips/hsk/cmn-%E9%A3%9E%E6%9C%BA.mp3",
    );
  });

  it("keeps an endpoint path prefix and non-default port", () => {
    const minio = objectUrl(
      { ...target, endpoint: "http://127.0.0.1:9000/s3" },
      "syllabs/cmn-hao3.mp3",
    );
    expect(minio.host).toBe("127.0.0.1:9000");
    expect(minio.path).toBe("/s3/clips/syllabs/cmn-hao3.mp3");
    expect(minio.url).toBe("http://127.0.0.1:9000/s3/clips/syllabs/cmn-hao3.mp3");
  });

  it("uses virtual-hosted URLs when asked", () => {
    const aws = objectUrl(
      {
        ...target,
        endpoint: "https://s3.eu-west-1.amazonaws.com",
        addressing: "virtual",
      },
      "hsk/cmn-好.mp3",
    );
    expect(aws.host).toBe("clips.s3.eu-west-1.amazonaws.com");
    expect(aws.path).toBe("/hsk/cmn-%E5%A5%BD.mp3");
  });
});

describe("authorizeS3", () => {
  it("is stable for a frozen timestamp", () => {
    const now = new Date("2024-01-02T03:04:05Z");
    const a = authorizeS3({
      method: "HEAD",
      target,
      key: "syllabs/cmn-hao3.mp3",
      payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      now,
    });
    const b = authorizeS3({
      method: "HEAD",
      target,
      key: "syllabs/cmn-hao3.mp3",
      payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      now,
    });
    expect(a.headers.host).toBe("s3.example.com:9000");
    expect(a.headers["x-amz-date"]).toBe("20240102T030405Z");
    expect(a.headers.authorization).toBe(b.headers.authorization);
    expect(a.headers.authorization).toContain(
      "AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE/20240102/us-east-1/s3/aws4_request",
    );
    expect(a.url).toBe("https://s3.example.com:9000/clips/syllabs/cmn-hao3.mp3");
  });
});

describe("describeError", () => {
  it("unwraps fetch failed causes", () => {
    const cause = Object.assign(new Error("unable to get local issuer certificate"), {
      code: "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    });
    const failed = new Error("fetch failed", { cause });
    expect(describeError(failed)).toBe(
      "fetch failed\n  caused by: unable to get local issuer certificate [UNABLE_TO_GET_ISSUER_CERT_LOCALLY]",
    );
  });

  it("treats DNS misses as transient", () => {
    const dns = Object.assign(new Error("getaddrinfo ENOTFOUND example.r2.cloudflarestorage.com"), {
      code: "ENOTFOUND",
    });
    expect(isTransientError(new Error("fetch failed", { cause: dns }))).toBe(true);
    expect(isTransientError(new Error("bad signature"))).toBe(false);
  });
});
