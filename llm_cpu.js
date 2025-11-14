// llm_cpu.js
// Local CPU-only LLM using Transformers.js + Qwen2-0.5B-Instruct (quantized)
// Works even on old school computers (WASM backend, NO WebGPU required)
// Produces stable analytical output for School BI

import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

const statusEl = document.getElementById("llm-status");
const outputEl = document.getElementById("overview-ai-explanation");
const explainBtn = document.getElementById("btn-explain-overview");

function setLLMStatus(msg) {
    console.log("[LLM]", msg);
    if (statusEl) statusEl.textContent = msg;
}

// Cache model pipeline
let generatorPromise = null;

async function getGenerator() {
    if (!generatorPromise) {
        generatorPromise = (async () => {
            setLLMStatus("Downloading Qwen2-0.5B model (one-time)…");

            const pipe = await pipeline(
                "text-generation",
                "Xenova/qwen2-0.5b-instruct",
                {
                    dtype: "q4", // Fastest quantization
                    device: "wasm" // CPU-only, works everywhere
                }
            );

            setLLMStatus("Local AI is ready.");
            return pipe;
        })();
    }
    return generatorPromise;
}

/* ============================================================
   Build BI context → pure deterministic JSON for the LLM
============================================================ */
function buildOverviewTrendContext() {
    const SBI = window.SBI;
    if (!SBI?.state?.allRows?.length) {
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
   Ultra-stable template prompting (best for small LLMs)
============================================================ */
function makePromptFromContext(ctx) {
    const jsonData = JSON.stringify(ctx, null, 2);

    return `
You are an AI assistant for a School BI dashboard. Analyze school-wide performance using only the data provided.

DO NOT repeat the data.
DO NOT mention JSON.
DO NOT restate instructions.
DO NOT invent numbers.

Write the analysis by completing the template below clearly and concisely.

DATA:
${jsonData}

---BEGIN ANALYSIS TEMPLATE---
1. Summary (2–3 sentences):
The data shows that

2. Positive patterns:
- 

3. Potential issues or risks:
- 

4. Recommendations for the school (3–5 concrete items):
- 
---END ANALYSIS TEMPLATE---
`.trim();
}

/* ============================================================
   Main generation function
============================================================ */
async function explainOverviewTrend() {
    if (!outputEl) return;

    try {
        if (explainBtn) explainBtn.disabled = true;
        setLLMStatus("Preparing BI context…");

        const ctx = buildOverviewTrendContext();
        const prompt = makePromptFromContext(ctx);

        const generator = await getGenerator();

        setLLMStatus("AI analyzing trend…");

        const result = await generator(prompt, {
            max_new_tokens: 280,
            temperature: 0.25,     // stable and analytical
            top_p: 0.9,
            repetition_penalty: 1.1
        });

        const text = result[0]?.generated_text || "Model returned no output.";

        // Clean any leftover from prompt echo
        const cleaned = text
            .replace(prompt, "")
            .replace("---BEGIN ANALYSIS TEMPLATE---", "")
            .replace("---END ANALYSIS TEMPLATE---", "")
            .trim();

        outputEl.textContent = cleaned;
        setLLMStatus("Explanation ready.");

    } catch (err) {
        console.error(err);
        outputEl.textContent = "Error: " + err.message;
        setLLMStatus("AI error.");
    } finally {
        if (explainBtn) explainBtn.disabled = false;
    }
}

/* ============================================================
   Button event
============================================================ */
if (explainBtn) {
    explainBtn.addEventListener("click", explainOverviewTrend);
    setLLMStatus("Local AI is idle. Upload data, then click the button.");
}
else {
    console.warn("btn-explain-overview not found");
}
