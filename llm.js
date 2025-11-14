// llm.js
// Local LLM integration using WebLLM + Qwen2-0.5B
// Provides safe, deterministic, structured explanations for BI charts.

import { CreateMLCEngine } from "https://esm.run/@mlc-ai/web-llm";

let engine = null;
let isLoading = false;

// UI Elements
const statusEl = document.getElementById("llm-status");
const explainBtn = document.getElementById("btn-explain-overview");
const outputEl = document.getElementById("overview-ai-explanation");

// Log helper
function uiLog(msg) {
    console.log("[LLM]", msg);
    if (statusEl) statusEl.textContent = msg;
}

/* ============================================================
   ENGINE LOADER — loads Qwen2-0.5B for WebGPU inference
============================================================ */
async function getEngine() {
    if (engine) return engine;

    if (isLoading) {
        uiLog("Model is still loading...");
        throw new Error("Model not loaded yet");
    }

    isLoading = true;
    uiLog("Loading Qwen2-0.5B model...");

    const progressCallback = (p) => {
        try {
            const percent = typeof p === "number"
                ? p * 100
                : (p.progress * 100 || 0);
            uiLog("Loading model: " + percent.toFixed(0) + "%");
        } catch {
            console.log("Progress:", p);
        }
    };

    // Official WebLLM model name (Qwen2-0.5B)
    const MODEL_NAME = "Qwen2-0.5B-Instruct-q4f16_1-MLC";

    engine = await CreateMLCEngine(MODEL_NAME, {
        initProgressCallback: progressCallback
    });

    uiLog("Model loaded. Ready for interpretation.");
    isLoading = false;
    return engine;
}

/* ============================================================
   BUILD STRICT JSON CONTEXT FROM OVERVIEW TREND
============================================================ */
function buildOverviewTrendContext() {
    const state = window.SBI?.state;
    if (!state || !state.allRows.length) {
        throw new Error("No BI data loaded.");
    }

    const rows = state.allRows;
    const terms = state.allTerms;

    const byTerm = window.SBI.groupBy(
        rows,
        r => r.term,
        r => Number(r.final_percent ?? r.final_5scale ?? NaN)
    );

    const trend = terms.map(t => ({
        term: t,
        avg: window.SBI.mean(byTerm[t] || [])
    }));

    return {
        metric: "final_percent",
        school: "Current School",
        trend: trend
    };
}

/* ============================================================
   PROMPT TEMPLATE — STRICT, SAFE, NON-HALLUCINATING
============================================================ */
function makePromptFromContext(ctx) {
    const jsonData = JSON.stringify(ctx, null, 2);

    return `
You are an analytical assistant for a School BI Dashboard.

You must follow ALL RULES:

RULE 1 — Use ONLY the numbers inside <DATA>.  
RULE 2 — Do NOT guess, estimate, invent, or calculate any new values.  
RULE 3 — If some conclusion cannot be made from the provided data, say: "Not enough data to determine this."  
RULE 4 — Do NOT add any statistics that are not directly present in <DATA>.  
RULE 5 — Be concise, factual, and avoid speculation.  
RULE 6 — Output must be deterministic and consistent.

Your output MUST follow this format:

1. Summary  
2. Positive patterns  
3. Potential issues  
4. Recommendations

<DATA>
${jsonData}
</DATA>

Now provide a precise, safe, evidence-based interpretation.
`.trim();
}

/* ============================================================
   MAIN FUNCTION — EXPLAIN OVERVIEW CHART
============================================================ */
async function explainOverviewChart() {
    try {
        explainBtn.disabled = true;
        uiLog("Preparing context...");

        const ctx = buildOverviewTrendContext();
        const prompt = makePromptFromContext(ctx);

        const eng = await getEngine();
        uiLog("Generating explanation...");

        const messages = [
            { role: "system", content: "You are a precise, rule-following data interpreter." },
            { role: "user", content: prompt }
        ];

        const reply = await eng.chat.completions.create({
            messages,
            temperature: 0.1,
            top_p: 0.8,
            max_tokens: 400
        });

        const text = reply.choices?.[0]?.message?.content || "LLM returned no output.";
        outputEl.textContent = text;
        uiLog("Explanation ready.");

    } catch (err) {
        console.error(err);
        outputEl.textContent = "Error: " + err.message;
        uiLog("Error: " + err.message);

    } finally {
        explainBtn.disabled = false;
    }
}

/* ============================================================
   BIND BUTTON
============================================================ */
if (explainBtn) {
    explainBtn.addEventListener("click", explainOverviewChart);
}
