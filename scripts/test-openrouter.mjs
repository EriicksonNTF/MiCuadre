// scripts/test-openrouter.mjs
//
// Smoke test for the MIA LLM provider (defaults to OpenRouter :free).
// Validates that the configured LLM_API_KEY reaches the provider,
// the chosen model responds, and the response is valid JSON.
//
// Usage:
//   LLM_API_KEY=sk-or-... node scripts/test-openrouter.mjs
//   LLM_API_BASE=https://openrouter.ai/api/v1 \
//   LLM_MODEL=meta-llama/llama-3.3-70b-instruct:free \
//   LLM_API_KEY=sk-or-... node scripts/test-openrouter.mjs
//
// Exit codes:
//   0  OK (response is valid JSON with `message`)
//   1  bad env / network / provider error / non-JSON response

import process from "node:process"

const API_BASE = process.env.LLM_API_BASE || "https://openrouter.ai/api/v1"
const MODEL = process.env.LLM_MODEL || "meta-llama/llama-3.3-70b-instruct:free"
const API_KEY = process.env.LLM_API_KEY || ""

function fail(msg, extra) {
  console.error(`\n[FAIL] ${msg}`)
  if (extra) console.error(extra)
  process.exit(1)
}

if (!API_KEY) {
  fail("LLM_API_KEY is not set. Export it before running this script.")
}

const url = `${API_BASE.replace(/\/$/, "")}/chat/completions`

const body = {
  model: MODEL,
  messages: [
    {
      role: "system",
      content:
        'Responde SOLO con un objeto JSON con la forma {"type":"answer","message":"<texto>","action":null}.',
    },
    { role: "user", content: "¿En qué estoy gastando más este mes?" },
  ],
  response_format: { type: "json_object" },
  temperature: 0.2,
  max_tokens: 1500,
}

console.log(`[info] POST ${url}`)
console.log(`[info] model=${MODEL}`)

let res
try {
  res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  })
} catch (err) {
  fail("network error reaching provider", err?.message || String(err))
}

if (!res.ok) {
  const text = await res.text().catch(() => "")
  fail(`provider returned ${res.status}`, text.slice(0, 500))
}

const data = await res.json().catch(() => null)
const content = data?.choices?.[0]?.message?.content

if (!content) {
  fail("provider returned an empty choices[0].message.content", JSON.stringify(data).slice(0, 500))
}

let parsed
try {
  parsed = JSON.parse(content)
} catch (err) {
  fail("response was not valid JSON", content.slice(0, 500))
}

if (typeof parsed.message !== "string" || parsed.message.length === 0) {
  fail("response parsed but has no `message` string", JSON.stringify(parsed).slice(0, 500))
}

console.log("\n[OK] provider responded with valid JSON")
console.log(`[OK] finish_reason=${data.choices?.[0]?.finish_reason || "n/a"}`)
console.log(`[OK] message preview: ${parsed.message.slice(0, 160)}${parsed.message.length > 160 ? "..." : ""}`)
console.log(`[OK] action=${JSON.stringify(parsed.action)}`)
