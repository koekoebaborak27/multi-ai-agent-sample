/**
 * 対象: password-reset/token createToken・hashToken
 * 目的: 作った合言葉が毎回変わること、要約値が同じ入力で同じ値になることを担保する
 */
import { describe, expect, it } from "vitest";
import { createToken, hashToken } from "@/modules/password-reset/token";

describe("password-reset/token createToken", () => {
  it("呼ぶたびに異なる文字列を作る", () => {
    expect(createToken()).not.toBe(createToken());
  });
});

describe("password-reset/token hashToken", () => {
  it("同じ入力からは同じ要約値を計算する", () => {
    const token = createToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("異なる入力からは異なる要約値を計算する", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });
});
