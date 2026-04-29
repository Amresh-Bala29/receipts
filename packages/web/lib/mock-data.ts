import type { ChainedEvent, ProcessEvent, Receipt } from "@receipts/shared";
import { computeAnalyzerSignals } from "@receipts/shared";
import { appendChainedEvent, verifyChainedEvents } from "./chain";
import { mulberry32 } from "./prng";

const baseTime = Date.parse("2026-04-24T14:02:00.000Z");

type SeedOptions = {
  sessionId: string;
  seed: number;
  runPattern: Array<0 | 1>;
  snapshotCount: number;
  longIdleCount: number;
  largeExternalPasteCount: number;
  cadence: "consistent" | "variable";
};

function iso(offsetMs: number): string {
  return new Date(baseTime + offsetMs).toISOString();
}

function event(
  index: number,
  sessionId: string,
  offsetMs: number,
  partial: Record<string, unknown> & { kind: ProcessEvent["kind"] },
): ProcessEvent {
  return {
    eventId: `${sessionId}-event-${index}`,
    sessionId,
    at: iso(offsetMs),
    ...partial,
  } as ProcessEvent;
}

function chainEvents(events: ProcessEvent[]): ChainedEvent[] {
  return events.reduce<ChainedEvent[]>((chain, item) => {
    chain.push(appendChainedEvent(chain.at(-1) ?? null, item));
    return chain;
  }, []);
}

function buildSeededChain({
  sessionId,
  seed,
  runPattern,
  snapshotCount,
  longIdleCount,
  largeExternalPasteCount,
  cadence,
}: SeedOptions): ChainedEvent[] {
  const random = mulberry32(seed);
  const events: ProcessEvent[] = [];
  let index = 1;

  for (let windowIndex = 0; windowIndex < 20; windowIndex += 1) {
    const baseChars =
      cadence === "consistent"
        ? 11 + Math.floor(random() * 3)
        : windowIndex % 4 === 0
          ? 36 + Math.floor(random() * 8)
          : 3 + Math.floor(random() * 4);

    events.push(
      event(index, sessionId, windowIndex * 10_000 + 800, {
        kind: "edit",
        file: "main.py",
        rangeStart: windowIndex * 12,
        rangeEnd: windowIndex * 12,
        textInserted: "x".repeat(baseChars),
        textRemoved: "",
      }),
    );
    index += 1;
  }

  for (let pasteIndex = 0; pasteIndex < largeExternalPasteCount; pasteIndex += 1) {
    events.push(
      event(index, sessionId, 205_000 + pasteIndex * 7_000, {
        kind: "paste",
        file: "main.py",
        length: 60 + pasteIndex * 20,
        source: "external",
      }),
    );
    index += 1;
  }

  runPattern.forEach((exitCode, runIndex) => {
    events.push(
      event(index, sessionId, 240_000 + runIndex * 35_000, {
        kind: "run",
        command: "python main.py",
        exitCode,
        stdoutPreview: exitCode === 0 ? "All cases passed" : "",
        stderrPreview: exitCode === 0 ? "" : "AssertionError: edge case",
        durationMs: 410 + runIndex * 17,
      }),
    );
    index += 1;
  });

  for (let idleIndex = 0; idleIndex < longIdleCount; idleIndex += 1) {
    events.push(
      event(index, sessionId, 710_000 + idleIndex * 45_000, {
        kind: "idle",
        file: "main.py",
        idleMs: 252_000 + idleIndex * 24_000,
      }),
    );
    index += 1;
  }

  for (let snapshotIndex = 0; snapshotIndex < snapshotCount; snapshotIndex += 1) {
    events.push(
      event(index, sessionId, 820_000 + snapshotIndex * 30_000, {
        kind: "snapshot",
        file: "main.py",
        contentHash: `${sessionId}-snapshot-${snapshotIndex + 1}`,
      }),
    );
    index += 1;
  }

  return chainEvents(
    events.sort((left, right) => Date.parse(left.at) - Date.parse(right.at)),
  );
}

export function buildReceipt(
  id: string,
  sessionId: string,
  events: ChainedEvent[],
  author = { name: "Maya Chen", handle: "@maya.codes" },
): Receipt {
  const { signals, summary } = computeAnalyzerSignals(events);
  const finalHash = events.at(-1)?.hash ?? "unstarted";
  const verification = verifyChainedEvents(events);

  return {
    id,
    sessionId,
    author,
    createdAt: new Date().toISOString(),
    signatureSnippet: finalHash.slice(0, 12),
    summary,
    signals,
    languages: ["TypeScript", "Python"],
    chainOk: verification.ok,
  };
}

export function buildDemoChain(sessionId = "demo-session"): ChainedEvent[] {
  const random = mulberry32(1042);
  const events: ProcessEvent[] = [];
  const file = "demo.py";
  let index = 1;
  let content = "";

  const pushEvent = (
    offsetMs: number,
    partial: Record<string, unknown> & { kind: ProcessEvent["kind"] },
  ) => {
    events.push(event(index, sessionId, offsetMs, partial));
    index += 1;
  };

  const applyEdit = (
    offsetMs: number,
    rangeStart: number,
    rangeEnd: number,
    textInserted: string,
  ) => {
    const textRemoved = content.slice(rangeStart, rangeEnd);
    content =
      content.slice(0, rangeStart) + textInserted + content.slice(rangeEnd);
    pushEvent(offsetMs, {
      kind: "edit",
      file,
      rangeStart,
      rangeEnd,
      textInserted,
      textRemoved,
    });
  };

  const typeAt = (
    startOffsetMs: number,
    endOffsetMs: number,
    position: number,
    text: string,
  ) => {
    const chunks: string[] = [];
    let cursor = 0;
    while (cursor < text.length) {
      const size = 14 + Math.floor(random() * 5);
      chunks.push(text.slice(cursor, cursor + size));
      cursor += size;
    }

    const span = Math.max(1, endOffsetMs - startOffsetMs);
    let insertionPoint = position;
    chunks.forEach((chunk, chunkIndex) => {
      const offset =
        startOffsetMs +
        Math.floor((span * chunkIndex) / Math.max(1, chunks.length - 1));
      applyEdit(offset, insertionPoint, insertionPoint, chunk);
      insertionPoint += chunk.length;
    });
  };

  const appendText = (startOffsetMs: number, endOffsetMs: number, text: string) => {
    typeAt(startOffsetMs, endOffsetMs, content.length, text);
  };

  const replaceFirst = (
    offsetMs: number,
    search: string,
    replacement: string,
  ) => {
    const at = content.indexOf(search);
    if (at >= 0) {
      applyEdit(offsetMs, at, at + search.length, "");
      if (replacement.length > 24) {
        typeAt(offsetMs + 2_000, offsetMs + 42_000, at, replacement);
      } else {
        applyEdit(offsetMs + 2_000, at, at, replacement);
      }
    }
  };

  const replaceAll = (
    startOffsetMs: number,
    endOffsetMs: number,
    search: string,
    replacement: string,
  ) => {
    const positions: number[] = [];
    let at = content.indexOf(search);
    while (at >= 0) {
      positions.push(at);
      at = content.indexOf(search, at + search.length);
    }

    positions.reverse().forEach((position, positionIndex) => {
      const offset =
        startOffsetMs +
        Math.floor(
          ((endOffsetMs - startOffsetMs) * positionIndex) /
            Math.max(1, positions.length - 1),
        );
      applyEdit(offset, position, position + search.length, replacement);
    });
  };

  const replaceBlock = (
    startOffsetMs: number,
    endOffsetMs: number,
    search: string,
    replacement: string,
  ) => {
    const at = content.indexOf(search);
    if (at < 0) return;
    applyEdit(startOffsetMs, at, at + search.length, "");
    typeAt(startOffsetMs + 8_000, endOffsetMs, at, replacement);
  };

  appendText(
    0,
    138_000,
    "def total_score(values):\n    return sum(values)\n",
  );

  pushEvent(150_000, {
    kind: "idle",
    file,
    idleMs: 90_000,
  });

  replaceAll(240_000, 252_000, "values", "scores");
  const signatureEnd = content.indexOf("\n") + 1;
  typeAt(
    260_000,
    294_000,
    signatureEnd,
    '    """Return the total score for a mixed list."""\n',
  );
  const returnLine = "    return sum(scores)";
  const returnStart = content.indexOf(returnLine);
  typeAt(306_000, 348_000, returnStart, "    if not scores:\n        return 0\n");

  appendText(366_000, 384_000, '\nprint(total_score([7, "8", 9]))\n');
  pushEvent(396_000, {
    kind: "run",
    command: "python demo.py",
    exitCode: 1,
    stdoutPreview: "",
    stderrPreview: "TypeError: unsupported operand type(s) for +",
    durationMs: 438,
  });

  replaceBlock(
    420_000,
    474_000,
    "    return sum(scores)",
    "    try:\n        return sum(scores)\n    except TypeError:\n        return sum(float(score) for score in scores)",
  );
  pushEvent(492_000, {
    kind: "run",
    command: "python demo.py",
    exitCode: 1,
    stdoutPreview: "",
    stderrPreview: "AssertionError: expected integer output",
    durationMs: 421,
  });
  replaceFirst(
    516_000,
    "        return sum(float(score) for score in scores)",
    "        total = sum(float(score) for score in scores)\n        return int(total) if total.is_integer() else total",
  );
  pushEvent(534_000, {
    kind: "run",
    command: "python demo.py",
    exitCode: 0,
    stdoutPreview: "24\n",
    stderrPreview: "",
    durationMs: 399,
  });

  pushEvent(540_000, {
    kind: "idle",
    file,
    idleMs: 90_000,
  });

  typeAt(
    636_000,
    690_000,
    0,
    "def coerce_numeric(scores):\n    return [float(score) for score in scores]\n\n",
  );
  replaceFirst(
    714_000,
    "        total = sum(float(score) for score in scores)",
    "        total = sum(coerce_numeric(scores))",
  );
  pushEvent(738_000, {
    kind: "run",
    command: "python demo.py",
    exitCode: 1,
    stdoutPreview: "",
    stderrPreview: "ValueError: could not convert string to float: 'skip'",
    durationMs: 462,
  });
  replaceFirst(
    762_000,
    "    return [float(score) for score in scores]",
    "    cleaned = []\n    for score in scores:\n        cleaned.append(float(score))\n    return cleaned",
  );
  pushEvent(786_000, {
    kind: "run",
    command: "python demo.py",
    exitCode: 0,
    stdoutPreview: "24\n",
    stderrPreview: "",
    durationMs: 405,
  });
  replaceFirst(
    816_000,
    "        cleaned.append(float(score))",
    "        if score is None:\n            continue\n        cleaned.append(float(score))",
  );
  pushEvent(846_000, {
    kind: "run",
    command: "python demo.py",
    exitCode: 0,
    stdoutPreview: "24\n",
    stderrPreview: "",
    durationMs: 392,
  });

  replaceFirst(
    870_000,
    '\nprint(total_score([7, "8", 9]))\n',
    '\nprint(total_score([7, "8", 9, None]))\n',
  );
  appendText(900_000, 960_000, 'print(total_score(["10", 5, 2]))\n');
  pushEvent(990_000, {
    kind: "run",
    command: "python demo.py",
    exitCode: 0,
    stdoutPreview: "24\n17\n",
    stderrPreview: "",
    durationMs: 388,
  });
  pushEvent(1_029_000, {
    kind: "run",
    command: "python demo.py",
    exitCode: 0,
    stdoutPreview: "24\n17\n",
    stderrPreview: "",
    durationMs: 371,
  });

  for (let snapshotOffset = 30_000; snapshotOffset <= 1_020_000; snapshotOffset += 30_000) {
    pushEvent(snapshotOffset, {
      kind: "snapshot",
      file,
      contentHash: `${sessionId}-snapshot-${snapshotOffset}`,
    });
  }

  return chainEvents(
    events.sort((left, right) => Date.parse(left.at) - Date.parse(right.at)),
  );
}

function buildScenarioChain({
  sessionId,
  seed,
  file,
  durationMs,
  runPattern,
  pasteLengths,
  cadence,
  idleDurations,
  label,
  editWindowCount,
  snapshots = true,
}: {
  sessionId: string;
  seed: number;
  file: string;
  durationMs: number;
  runPattern: Array<0 | 1>;
  pasteLengths: number[];
  cadence: "consistent" | "variable";
  idleDurations: number[];
  label: string;
  editWindowCount?: number;
  snapshots?: boolean;
}): ChainedEvent[] {
  const random = mulberry32(seed);
  const events: ProcessEvent[] = [];
  let index = 1;
  let content = "";
  const windows = editWindowCount ?? Math.max(8, Math.floor(durationMs / 30_000));

  const pushEvent = (
    offsetMs: number,
    partial: Record<string, unknown> & { kind: ProcessEvent["kind"] },
  ) => {
    events.push(event(index, sessionId, offsetMs, partial));
    index += 1;
  };

  pushEvent(0, {
    kind: "focus",
    file,
    gained: true,
  });

  for (let windowIndex = 0; windowIndex < windows; windowIndex += 1) {
    const offsetMs = Math.floor((durationMs * (windowIndex + 0.6)) / (windows + 1));
    const baseChars =
      cadence === "consistent"
        ? 16 + Math.floor(random() * 4)
        : windowIndex % 4 === 0
          ? 24 + Math.floor(random() * 6)
          : 11 + Math.floor(random() * 4);
    const textInserted =
      windowIndex === 0
        ? `def ${label}(values):\n`
        : cadence === "variable" && windowIndex % 4 !== 0
          ? `# ${windowIndex}\n`
          : `    step_${windowIndex} = ${JSON.stringify("x".repeat(baseChars))}\n`;
    const rangeStart = content.length;
    content += textInserted;
    pushEvent(offsetMs, {
      kind: "edit",
      file,
      rangeStart,
      rangeEnd: rangeStart,
      textInserted,
      textRemoved: "",
    });
  }

  pasteLengths.forEach((length, pasteIndex) => {
    pushEvent(Math.floor(durationMs * 0.32) + pasteIndex * 5_000, {
      kind: "paste",
      file,
      length,
      source: "external",
    });
  });

  runPattern.forEach((exitCode, runIndex) => {
    pushEvent(
      Math.floor((durationMs * (runIndex + 1)) / (runPattern.length + 1)),
      {
        kind: "run",
        command: `python ${file}`,
        exitCode,
        stdoutPreview: exitCode === 0 ? "All cases passed\n" : "",
        stderrPreview: exitCode === 0 ? "" : "AssertionError: edge case\n",
        durationMs: 360 + runIndex * 19,
      },
    );
  });

  idleDurations.forEach((idleMs, idleIndex) => {
    pushEvent(Math.floor(durationMs * (0.38 + idleIndex * 0.22)), {
      kind: "idle",
      file,
      idleMs,
    });
  });

  if (snapshots) {
    for (
      let snapshotOffset = 30_000;
      snapshotOffset <= durationMs;
      snapshotOffset += 30_000
    ) {
      pushEvent(snapshotOffset, {
        kind: "snapshot",
        file,
        contentHash: `${sessionId}-snapshot-${snapshotOffset}`,
      });
    }
    if (durationMs % 30_000 !== 0) {
      pushEvent(durationMs, {
        kind: "snapshot",
        file,
        contentHash: `${sessionId}-snapshot-final`,
      });
    }
  } else {
    const rangeStart = content.length;
    const textInserted = "\n";
    pushEvent(durationMs, {
      kind: "edit",
      file,
      rangeStart,
      rangeEnd: rangeStart,
      textInserted,
      textRemoved: "",
    });
  }

  return chainEvents(
    events.sort((left, right) => Date.parse(left.at) - Date.parse(right.at)),
  );
}

export function buildSortingLabChain(
  sessionId = "session-sort",
): ChainedEvent[] {
  return buildScenarioChain({
    sessionId,
    seed: 2048,
    file: "sort.py",
    durationMs: 724_000,
    runPattern: [1, 1, 0, 0, 0, 0],
    pasteLengths: [],
    cadence: "consistent",
    idleDurations: [252_000],
    label: "merge_sort",
  });
}

export function buildApiClientChain(
  sessionId = "session-api",
): ChainedEvent[] {
  return buildScenarioChain({
    sessionId,
    seed: 4096,
    file: "api.py",
    durationMs: 1_440_000,
    runPattern: [1, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    pasteLengths: [8],
    cadence: "consistent",
    idleDurations: [252_000],
    label: "read_item",
  });
}

export function buildRegexFixChain(
  sessionId = "session-reg",
): ChainedEvent[] {
  return buildScenarioChain({
    sessionId,
    seed: 8192,
    file: "regex_fix.py",
    durationMs: 392_000,
    runPattern: [1, 0, 1],
    pasteLengths: [],
    cadence: "variable",
    idleDurations: [],
    label: "extract_usernames",
    editWindowCount: 5,
  });
}

export function buildAlgorithmChain(
  sessionId = "session-algo",
): ChainedEvent[] {
  return buildScenarioChain({
    sessionId,
    seed: 16_384,
    file: "algorithm.py",
    durationMs: 2_280_000,
    runPattern: [1, 1, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    pasteLengths: [],
    cadence: "consistent",
    idleDurations: [170_000, 190_000],
    label: "shortest_path",
  });
}

export function buildBrokenPalindromeChain(
  sessionId = "session-broken",
): ChainedEvent[] {
  const random = mulberry32(32_768);
  const events: ProcessEvent[] = [];
  const file = "palindrome.py";
  const durationMs = 842_000;
  let index = 1;
  let content = "";

  const pushEvent = (
    offsetMs: number,
    partial: Record<string, unknown> & { kind: ProcessEvent["kind"] },
  ) => {
    events.push(event(index, sessionId, offsetMs, partial));
    index += 1;
  };

  const applyEdit = (
    offsetMs: number,
    rangeStart: number,
    rangeEnd: number,
    textInserted: string,
  ) => {
    const textRemoved = content.slice(rangeStart, rangeEnd);
    content =
      content.slice(0, rangeStart) + textInserted + content.slice(rangeEnd);
    pushEvent(offsetMs, {
      kind: "edit",
      file,
      rangeStart,
      rangeEnd,
      textInserted,
      textRemoved,
    });
  };

  const typeAt = (
    startOffsetMs: number,
    endOffsetMs: number,
    position: number,
    text: string,
  ) => {
    const chunks: string[] = [];
    let cursor = 0;
    while (cursor < text.length) {
      const size = 3 + Math.floor(random() * 5);
      chunks.push(text.slice(cursor, cursor + size));
      cursor += size;
    }

    const span = Math.max(1, endOffsetMs - startOffsetMs);
    let insertionPoint = position;
    chunks.forEach((chunk, chunkIndex) => {
      const offset =
        startOffsetMs +
        Math.floor((span * chunkIndex) / Math.max(1, chunks.length - 1));
      applyEdit(offset, insertionPoint, insertionPoint, chunk);
      insertionPoint += chunk.length;
    });
  };

  const appendText = (startOffsetMs: number, endOffsetMs: number, text: string) => {
    typeAt(startOffsetMs, endOffsetMs, content.length, text);
  };

  const replaceFirst = (
    offsetMs: number,
    search: string,
    replacement: string,
  ) => {
    const at = content.indexOf(search);
    if (at >= 0) {
      applyEdit(offsetMs, at, at + search.length, "");
      typeAt(offsetMs + 2_000, offsetMs + 32_000, at, replacement);
    }
  };

  pushEvent(0, {
    kind: "focus",
    file,
    gained: true,
  });

  appendText(
    4_000,
    126_000,
    "def is_palindrome(s):\n    cleaned = s.strip()\n    return cleaned == cleaned[::-1]\n\nprint(is_palindrome(\"level\"))\nprint(is_palindrome(\"\"))\n",
  );
  pushEvent(136_000, {
    kind: "run",
    command: "python palindrome.py",
    exitCode: 1,
    stdoutPreview: "True\n",
    stderrPreview: "AssertionError: empty string edge case",
    durationMs: 382,
  });

  pushEvent(150_000, {
    kind: "idle",
    file,
    idleMs: 304_000,
  });

  const guardAt = content.indexOf("    return cleaned");
  typeAt(
    460_000,
    514_000,
    guardAt,
    "    if cleaned == \"\":\n        return True\n",
  );
  pushEvent(526_000, {
    kind: "run",
    command: "python palindrome.py",
    exitCode: 0,
    stdoutPreview: "True\nTrue\n",
    stderrPreview: "",
    durationMs: 341,
  });

  replaceFirst(548_000, "s.strip()", "\"\".join(ch.lower() for ch in s if ch.isalnum())");
  pushEvent(592_000, {
    kind: "run",
    command: "python palindrome.py",
    exitCode: 1,
    stdoutPreview: "",
    stderrPreview: "NameError: name 'ch' is not defined",
    durationMs: 404,
  });
  replaceFirst(
    614_000,
    "\"\".join(ch.lower() for ch in s if ch.isalnum())",
    "\"\".join(char.lower() for char in s if char.isalnum())",
  );
  pushEvent(654_000, {
    kind: "run",
    command: "python palindrome.py",
    exitCode: 0,
    stdoutPreview: "True\nTrue\n",
    stderrPreview: "",
    durationMs: 357,
  });

  appendText(
    674_000,
    724_000,
    "print(is_palindrome(\"Never odd or even\"))\n",
  );
  pushEvent(738_000, {
    kind: "run",
    command: "python palindrome.py",
    exitCode: 0,
    stdoutPreview: "True\nTrue\nTrue\n",
    stderrPreview: "",
    durationMs: 366,
  });

  appendText(760_000, 806_000, "# Keep punctuation out of the comparison.\n");
  pushEvent(814_000, {
    kind: "run",
    command: "python palindrome.py",
    exitCode: 0,
    stdoutPreview: "True\nTrue\nTrue\n",
    stderrPreview: "",
    durationMs: 352,
  });
  pushEvent(842_000, {
    kind: "run",
    command: "python palindrome.py",
    exitCode: 0,
    stdoutPreview: "True\nTrue\nTrue\n",
    stderrPreview: "",
    durationMs: 349,
  });

  for (let snapshotOffset = 30_000; snapshotOffset <= durationMs; snapshotOffset += 30_000) {
    pushEvent(snapshotOffset, {
      kind: "snapshot",
      file,
      contentHash: `${sessionId}-snapshot-${snapshotOffset}`,
    });
  }

  const chain = chainEvents(
    events.sort((left, right) => Date.parse(left.at) - Date.parse(right.at)),
  );
  const target =
    chain.find(
      (item) =>
        item.kind === "edit" &&
        item.seq >= 30 &&
        item.seq <= 40 &&
        item.textInserted.length > 0 &&
        item.textInserted.length <= 7,
    ) ??
    chain.find(
      (item) =>
        item.kind === "edit" &&
        item.textInserted.length > 0 &&
        item.textInserted.length <= 5,
    );

  if (!target || target.kind !== "edit") {
    throw new Error("Unable to seed broken receipt without an edit event");
  }

  // broken receipt, chain_ok = false, intentional. This is the demo's chain-failure case.
  return chain.map((item) =>
    item.seq === target.seq && item.kind === "edit"
      ? {
          ...item,
          textInserted: "  return True  # always true, debug bypass",
        }
      : item,
  );
}

export const buildPortfolioTaskChain = buildRegexFixChain;

export const dashboardReceipts: Receipt[] = [
  {
    ...buildReceipt("demo", "demo-session", buildDemoChain()),
    createdAt: "2026-04-24T16:20:00.000Z",
  },
  {
    ...buildReceipt(
      "sort",
      "session-sort",
      buildSortingLabChain("session-sort"),
    ),
    createdAt: "2026-04-21T19:12:00.000Z",
  },
  {
    ...buildReceipt(
      "api",
      "session-api",
      buildApiClientChain("session-api"),
    ),
    createdAt: "2026-04-18T13:44:00.000Z",
  },
  {
    ...buildReceipt(
      "reg",
      "session-reg",
      buildRegexFixChain("session-reg"),
    ),
    createdAt: "2026-04-15T15:20:00.000Z",
  },
  {
    ...buildReceipt(
      "algo",
      "session-algo",
      buildAlgorithmChain("session-algo"),
    ),
    createdAt: "2026-04-12T21:05:00.000Z",
  },
];
