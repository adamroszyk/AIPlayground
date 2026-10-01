import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSiteUrl, workersSubdomain } from "./cf.mjs";

const reply = (body, status = 200) => async (url, init) => { reply.last = { url, init }; return { status, json: async () => body }; };
const creds = { CLOUDFLARE_API_TOKEN: "tok", CLOUDFLARE_ACCOUNT_ID: "acc123" };

test("builds the product URL from the account's subdomain", async () => {
  const f = reply({ success: true, result: { subdomain: "adam-roszyk" } });
  assert.equal(await resolveSiteUrl({ envName: "ROOMWISE_URL", workerName: "roomwise", env: creds, fetchImpl: f }), "https://roomwise.adam-roszyk.workers.dev");
  assert.equal(reply.last.url, "https://api.cloudflare.com/client/v4/accounts/acc123/workers/subdomain");
  assert.equal(reply.last.init.headers.authorization, "Bearer tok");
});
test("an explicit URL always wins and makes no network call", async () => {
  const f = async () => { throw new Error("must not be called"); };
  assert.equal(await resolveSiteUrl({ envName: "AISLE_URL", workerName: "aisle", env: { ...creds, AISLE_URL: "https://aisle.mine.dev/" }, fetchImpl: f }), "https://aisle.mine.dev");
});
test("returns null without credentials, instead of guessing", async () => {
  assert.equal(await resolveSiteUrl({ envName: "AISLE_URL", workerName: "aisle", env: {}, fetchImpl: reply({}) }), null);
});
test("explains an account with no subdomain, and API errors", async () => {
  await assert.rejects(() => resolveSiteUrl({ envName: "X", workerName: "w", env: creds, fetchImpl: reply({ success: true, result: { subdomain: null } }) }), /no workers.dev subdomain/);
  await assert.rejects(() => workersSubdomain({ token: "t", account: "a", fetchImpl: reply({ success: false, errors: [{ message: "Authentication error" }] }, 403) }), /HTTP 403.*Authentication error/);
  await assert.rejects(() => workersSubdomain({ token: "t", account: "a", fetchImpl: async () => ({ status: 502, json: async () => { throw new Error("html"); } }) }), /non-JSON/);
});
