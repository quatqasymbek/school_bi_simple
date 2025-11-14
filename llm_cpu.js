// llm_cpu.js — FINAL PATCHED VERSION
// Local CPU-only LLM for School BI
// Uses T5-Small (public, anonymous, WASM)
// Ultra-stable "Anchor Template" output

import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

// UI handles
const statusEl = document.getElementById("llm-status");
const outputEl = document.getElementById("overview-ai-explanation");
const explainBtn = document.getElementById("btn-explain-overview");

// Status helper
function setLLMStatus(msg) {
    console.log("[LLM]", msg);
    if (statusEl) statusEl.textContent = msg;
}

let generatorPromise = null;

/* ============================================================
   Load SAFE PUBLIC MODEL (NO 401 ERRORS)
============================================================ */
async function getGenerator() {
    if (!generatorPromise) {
        generatorPromise = (async () => {
            setLLMStatus("Downloading local AI model (one-time)…");

            const pipe = await pipeline(
                "text2text-generation",
                "Xenova/t5-small",  // ✔ SAFE, PUBLIC, FAST
                {
                    dtype: "q4",
                    device: "wasm"  // ✔ CPU-only
                }
            );

            setLLMStatus("Local AI is ready.");
            return pipe;
        })();
    }
    return generatorPromise;
}

/* ============================================================
   Build BI Context for Overview Trend
============================================================ */
function buildOverviewTrendContext() {
    const SBI = window.SBI;
    if (!SBI?.state?.allRows) {
        throw new Error("No BI data loaded. Upload Excel first.");
    }

    const rows = SBI.state.allRows;
    const terms = SBI.state.allTerms;

    const byTerm = SBI.groupBy(
        rows,
        r => r.term,
        r => Number(r.final_percent ?? r.final_5scale ?? NaN)
    );

    const trend = terms.map(t => ({
        term: t,
        avg: SBI.mean(byTerm[t] || [])
    }));

    return { trend };
}

/* ============================================================
   Stable Anchor Template (small-model proof)
============================================================ */
function makePromptFromContext(ctx) {
    const json = JSON.stringify(ctx);

    return `
Analyze the following school performance data and complete the report.

DATA:
${json}

Write the analysis in this EXACT structure.
Do NOT repeat the data.
Do NOT add explanations of the rules.
Do NOT include anything outside the required format.

### Summary:
[2–3 sentences]

### Positive patterns:
- 

### Risks:
- 

### Recommendations:
- 
- 
- 

Begin directly with "### Summary:".
`.trim();
}

/* ============================================================
   Generate Explanation
============================================================ */
async function explainOverviewTrend() {
    if (!outputEl) return;

    try {
        explainBtn.disabled = true;
        setLLMStatus("Preparing BI context…");

        const ctx = buildOverviewTrendContext();
        const prompt = makePromptFromContext(ctx);

        const generator = await getGenerator();

        setLLMStatus("AI analyzing trend…");

        const result = await generator(prompt, {
            max_new_tokens: 250,
            temperature: 0.1   // ✔ ultra-stable output
        });

        let text = result[0]?.generated_text || "";

        /* ========================================================
           CLEANUP (remove echoes & placeholders)
        ======================================================== */

        // Ensure output always starts at Summary
        const idx = text.indexOf("### Summary:");
        if (idx !== -1) text = text.slice(idx);

        // Remove placeholder markers like [2–3 sentences]
        text = text.replace(/\[.*?\]/g, "");

        // Remove echoed instructions
        text = text.replace(/Begin.*/gi, "");

        text = text.trim();

        outputEl.textContent = text;
        setLLMStatus("Explanation ready.");

    } catch (err) {
        console.error(err);
        outputEl.textContent = "Error: " + err.message;
        setLLMStatus("AI error.");
    } finally {
        explainBtn.disabled = false;
    }
}

/* ============================================================
   Attach to Button
============================================================ */
if (explainBtn) {
    explainBtn.addEventListener("click", explainOverviewTrend);
    setLLMStatus("Local AI is idle. Upload data, then click the button.");
} else {
    console.warn("btn-explain-overview not found.");
}
