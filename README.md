# Receipts

**Proof of how you wrote it.**

Receipts is a tamper-evident record of your coding process. Not a polygraph, just the truth about your keystrokes.

Live: https://receipts-codex.vercel.app/

---

## What it is

Write code in the Receipts editor. Every edit, run, paste, and pause is captured as a timestamped event in a hash chain. When you mint a receipt, the chain is sealed and a public URL is generated. Anyone can open that URL, replay your session keystroke by keystroke, and re-verify the chain themselves.

The product takes a deliberate position on AI detection. Rather than guessing whether code was written by a human or a model, a problem nobody has solved reliably, Receipts records how the code was made and lets readers draw their own conclusions.

## What it proves

- Event ordering integrity from start to mint
- No insertions, deletions, or rewrites after mint
- Paste lengths and sources, never paste contents
- Run history with timing and exit codes
- Idle periods longer than 30 seconds

## What it does not prove

- Whether the thinking was the author's
- Whether a separate device was used
- Whether the author understood the code
- Whether help was received verbally
- Whether the work is original to the world

This honesty is part of the product.

## How it works

1. **Capture.** The editor records process events in your browser as you type. Edits, runs, pastes, idle periods, and periodic file snapshots. The full text of pastes is never recorded, only their length and source.
2. **Hash.** Each event references the SHA-256 hash of the event before it. Any later tampering breaks the chain visibly at the modified seq.
3. **Mint.** When you click Mint, the chain is sealed and persisted. A public, verifiable URL is generated. Share it.

## See the chain catch a forgery

Open `/r/demo` and click Verify chain. The modal reports "Chain verified" with the total event count.

Now open `/r/broken`. The receipt looks normal at first glance, with the same analyzer signals showing all-good. The only hint something is off is "Failed" in the Chain field of the header. Click Verify chain. The modal reports "Chain failed at seq N" and the timeline highlights the exact bucket where the forgery sits. The analyzer signals never caught the tampering, by design. The cryptographic chain did. Both layers exist deliberately, and they sometimes disagree, which is part of the honest framing.

## Analyzer signals

Each receipt computes five deterministic signals from its event chain.

- No external pastes longer than 40 chars
- Consistent typing cadence, measured as coefficient of variation across 10 second windows
- Iterative debugging pattern, with run count and error rate trend
- Long idle periods, counted above 4 minutes
- All snapshots verified

Signals are pure functions of the captured events. No language model is consulted at runtime. The absence of LLM-based judgment is intentional and is a credibility property of the product.

## Tech stack

- **Frontend:** Next.js 14 with the App Router, TypeScript, Tailwind CSS
- **Editor:** Monaco
- **Sandbox:** Pyodide. Python code runs in the browser. There is no server-side execution.
- **Database:** SQLite via better-sqlite3, file-backed, survives restarts
- **OG images:** next/og at the edge runtime
- **Fonts:** Inter, Instrument Serif, JetBrains Mono, loaded via next/font
- **Identity:** localStorage-stored handle. No accounts, no OAuth, no email. Anyone can pick a handle and start minting receipts.

## Built for the OpenAI x Handshake Codex Creator Challenge

Receipts was built between March and April 2026 for the OpenAI x Handshake Codex Creator Challenge. Every line of code in this repo was written through Codex, prompt by prompt, scoped one feature at a time. The decision-making behind the product, including what to build, what to deliberately not build, and what tone to write in, is documented through the prompts themselves. The pitch the project responds to is documented in the Why now section of the landing page.

## Local development

```bash
pnpm install
pnpm --filter web dev
```

The app starts on `http://localhost:3000`. The SQLite database is created at `packages/web/data/receipts.db` on first run and seeded with several demo receipts under the handle `maya.codes`, including `/r/demo` (a clean, verified session) and `/r/broken` (a tampered session that fails chain verification).

## Project structure

```text
receipts/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── packages/
│   ├── shared/
│   │   └── src/
│   │       ├── events.ts
│   │       ├── chain.ts
│   │       ├── analyzer.ts
│   │       └── replay.ts
│   └── web/
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── data/
```

`packages/shared` contains the zod-validated event types, hash chain helpers, deterministic analyzer, and replay reconstruction engine.

`packages/web` contains the Next.js app, the Monaco editor, the dashboard, public receipt pages, SQLite repository, Pyodide runner, and seeded demo receipts.

## License

MIT
