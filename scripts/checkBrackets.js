const fs = require("fs");

function check(filePath) {
  const s = fs.readFileSync(filePath, "utf8");
  const watchLine = Number(process.argv[3] || 0);
  const st = [];
  const mismatches = [];
  let braceDepth = 0;
  let maxBraceDepth = 0;
  let maxBraceAt = null;
  let line = 1;
  let col = 0;
  let mode = ""; // "", "//", "/*", "'", "\"", "`"
  let modeStart = null;
  let esc = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const nx = s[i + 1];
    col++;

    if (ch === "\n") {
      line++;
      col = 0;
      if (mode === "//") mode = "";
      continue;
    }

    if (watchLine && line === watchLine && col === 1) {
      console.log(
        "WATCH line",
        watchLine,
        "mode:",
        mode || "(none)",
        mode ? `modeStart=${modeStart ? `${modeStart.line}:${modeStart.col}` : "?"}` : "",
        "stack top:",
        st.slice(-5)
      );
    }

    if (mode === "//") continue;
    if (mode === "/*") {
      if (ch === "*" && nx === "/") {
        mode = "";
        modeStart = null;
        i++;
        col++;
      }
      continue;
    }

    if (mode === "'" || mode === "\"" || mode === "`") {
      if (!esc && ch === "\\") {
        esc = true;
        continue;
      }
      if (!esc && ch === mode) {
        mode = "";
        modeStart = null;
      }
      esc = false;
      continue;
    }

    if (ch === "/" && nx === "/") {
      mode = "//";
      modeStart = { line, col };
      i++;
      col++;
      continue;
    }
    if (ch === "/" && nx === "*") {
      mode = "/*";
      modeStart = { line, col };
      i++;
      col++;
      continue;
    }
    if (ch === "'" || ch === "\"" || ch === "`") {
      mode = ch;
      modeStart = { line, col };
      continue;
    }

    if (ch === "{" || ch === "(" || ch === "[") {
      st.push({ ch, line, col });
      if (ch === "{") {
        braceDepth++;
        if (braceDepth > maxBraceDepth) {
          maxBraceDepth = braceDepth;
          maxBraceAt = { line, col };
        }
      }
      continue;
    }
    if (ch === "}" || ch === ")" || ch === "]") {
      if (watchLine && line === watchLine && ch === "}") {
        console.log("WATCH before closing } at", `${line}:${col}`, "top of stack:", st.slice(-5));
      }
      const open = st.pop();
      if (!open) {
        mismatches.push({ type: "extra-close", close: ch, line, col });
        continue;
      }
      const want =
        open.ch === "{"
          ? "}"
          : open.ch === "("
            ? ")"
            : "]";
      if (ch !== want) {
        mismatches.push({
          type: "mismatch",
          open: open.ch,
          openAt: { line: open.line, col: open.col },
          close: ch,
          closeAt: { line, col },
          expected: want,
        });
      }
      if (ch === "}") braceDepth--;
    }
  }

  console.log(`Unclosed count: ${st.length}`);
  console.log("Last 20 unclosed openings:");
  console.log(st.slice(-20));
  console.log(`Mismatches: ${mismatches.length}`);
  if (mismatches.length) console.log(mismatches.slice(0, 20));
  console.log(`Max { } depth: ${maxBraceDepth}`, maxBraceAt ? `at ${maxBraceAt.line}:${maxBraceAt.col}` : "");
  console.log(`Final { } depth: ${braceDepth}`);
  console.log("Final mode:", mode || "(none)");
  if (mode && modeStart) console.log("Mode started at:", modeStart);
}

check(process.argv[2] || "src/frontend/pages/UniversalTransactionPage.jsx");

