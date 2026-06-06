import { test } from "node:test";
import { strict as assert } from "node:assert";
import { truncate, wrapTextContent, classifyFile, detectMention } from "./at-mention";

// ─── truncate ────────────────────────────────────────────────────────

test("truncate leaves short content untouched", () => {
  assert.equal(truncate("hello", 10000), "hello");
  assert.equal(truncate("", 10000), "");
});

test("truncate boundary: exactly at limit is untouched", () => {
  const s = "a".repeat(10000);
  assert.equal(truncate(s, 10000), s);
});

test("truncate boundary: one over limit gets clipped + marker", () => {
  const s = "a".repeat(10001);
  const out = truncate(s, 10000);
  assert.equal(out, "a".repeat(10000) + "\n...(truncated)");
});

// ─── wrapTextContent ─────────────────────────────────────────────────

test("wrapTextContent fences content under a File: header", () => {
  assert.equal(
    wrapTextContent("notes.md", "line1\nline2"),
    "File: notes.md\n```\nline1\nline2\n```",
  );
});

// ─── classifyFile ────────────────────────────────────────────────────

test("classifyFile detects images by mime", () => {
  assert.equal(classifyFile({ name: "p.png", mimeType: "image/png" }), "image");
  assert.equal(classifyFile({ name: "p", mimeType: "image/jpeg" }), "image");
});

test("classifyFile detects text by mime", () => {
  assert.equal(classifyFile({ name: "x", mimeType: "text/plain" }), "text");
  assert.equal(classifyFile({ name: "x", mimeType: "application/json" }), "text");
});

test("classifyFile detects text by extension when mime is empty", () => {
  assert.equal(classifyFile({ name: "README.md", mimeType: "" }), "text");
  assert.equal(classifyFile({ name: "Config.YAML", mimeType: "" }), "text");
  assert.equal(classifyFile({ name: "script.ts", mimeType: "" }), "text");
});

test("classifyFile falls back to binary", () => {
  assert.equal(classifyFile({ name: "a.bin", mimeType: "" }), "binary");
  assert.equal(classifyFile({ name: "a.pdf", mimeType: "application/pdf" }), "binary");
});

// ─── detectMention ───────────────────────────────────────────────────

test("detectMention: bare @ at start opens an empty query", () => {
  assert.deepEqual(detectMention("@", 1), { query: "", start: 0 });
});

test("detectMention: @ after whitespace yields the query", () => {
  assert.deepEqual(detectMention("hello @pro", 10), { query: "pro", start: 6 });
});

test("detectMention: @ after a newline triggers", () => {
  assert.deepEqual(detectMention("a\n@x", 4), { query: "x", start: 2 });
});

test("detectMention: query is sliced to the cursor, not end of word", () => {
  assert.deepEqual(detectMention("@foobar", 4), { query: "foo", start: 0 });
});

test("detectMention: mid-word @ (email) does not trigger", () => {
  assert.equal(detectMention("email@domain", 12), null);
});

test("detectMention: @@ is a literal escape, not a trigger", () => {
  assert.equal(detectMention("@@", 2), null);
  assert.equal(detectMention("@@foo", 5), null);
  assert.equal(detectMention("hi @@b", 6), null);
});

test("detectMention: whitespace closes the mention", () => {
  assert.equal(detectMention("@foo bar", 8), null);
  assert.deepEqual(detectMention("@foo bar", 4), { query: "foo", start: 0 });
});

test("detectMention: picks the nearest @ before the cursor", () => {
  assert.deepEqual(detectMention("hi @a @b", 8), { query: "b", start: 6 });
});

test("detectMention: cursor at 0 never triggers", () => {
  assert.equal(detectMention("@anything", 0), null);
});
