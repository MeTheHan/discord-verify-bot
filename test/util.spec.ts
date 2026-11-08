import { describe, it, expect } from "vitest";
import { isSnowflake, signHex, verifyHex, b64urlEncode, b64urlDecode } from "../src/util";

const SECRET = "test-secret-value-that-is-long-enough";

describe("isSnowflake", () => {
  it("accepts valid Discord IDs", () => {
    expect(isSnowflake("1568336029264388186")).toBe(true);
    expect(isSnowflake("12345678901234567")).toBe(true);
  });

  it("rejects malformed values", () => {
    expect(isSnowflake("")).toBe(false);
    expect(isSnowflake("123")).toBe(false);
    expect(isSnowflake("1234567890123456789012")).toBe(false);
    expect(isSnowflake("12345678901234567a")).toBe(false);
    expect(isSnowflake(undefined)).toBe(false);
    expect(isSnowflake(123456789012345678)).toBe(false);
  });
});

describe("HMAC signing", () => {
  it("verifies a signature made with the same key and message", async () => {
    const sig = await signHex(SECRET, "guild.role.");
    expect(await verifyHex(SECRET, "guild.role.", sig)).toBe(true);
  });

  it("rejects a signature when the message is changed", async () => {
    const sig = await signHex(SECRET, "guild.role.");
    expect(await verifyHex(SECRET, "guild.other.", sig)).toBe(false);
  });

  it("rejects a signature made with a different key", async () => {
    const sig = await signHex("another-secret-value-long-enough", "guild.role.");
    expect(await verifyHex(SECRET, "guild.role.", sig)).toBe(false);
  });

  it("rejects malformed hex without throwing", async () => {
    expect(await verifyHex(SECRET, "guild.role.", "not-hex")).toBe(false);
    expect(await verifyHex(SECRET, "guild.role.", "abc")).toBe(false);
    expect(await verifyHex(SECRET, "guild.role.", "")).toBe(false);
  });
});

describe("base64url", () => {
  it("round-trips ASCII JSON", () => {
    const input = JSON.stringify({ g: "1568336029264388186", exp: 1700000000, n: "abc" });
    expect(b64urlDecode(b64urlEncode(input))).toBe(input);
  });

  it("produces URL-safe output without padding", () => {
    const encoded = b64urlEncode("??>>");
    expect(encoded).not.toMatch(/[+/=]/);
  });
});