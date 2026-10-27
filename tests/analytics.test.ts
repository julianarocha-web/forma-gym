import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeAnalyticsEvent } from "../src/analytics";

test("analytics strips query parameters and auth fragments on all public paths", () => {
  for (const path of [
    "/",
    "/ingresar",
    "/crear-cuenta",
    "/recuperar",
    "/restablecer",
    "/auth/callback",
  ]) {
    assert.deepEqual(
      sanitizeAnalyticsEvent({
        type: "pageview",
        url: `https://forma.example${path}?email=private%40example.com&weight=80#access_token=secret`,
      }),
      { type: "pageview", url: `https://forma.example${path}` },
    );
  }
});

test("analytics rejects custom events, private paths and invalid URLs", () => {
  assert.equal(
    sanitizeAnalyticsEvent({ type: "event", url: "https://forma.example/" }),
    null,
  );
  for (const url of [
    "https://forma.example/users/private-id",
    "https://forma.example/private@example.com",
    "invalid",
  ]) {
    assert.equal(sanitizeAnalyticsEvent({ type: "pageview", url }), null);
  }
});
