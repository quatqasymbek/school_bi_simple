// llm_cpu.js
// CPU-only local LLM using Transformers.js + LaMini-Flan-T5-77M
// Works on older machines: no WebGPU, no DX12, no GPU required.

import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

const statusEl = document.getElementById("llm-status");
const outputEl = document.getElementById("overview-ai-explanation");
const explainBtn = document.getElementById("btn-explain-overview");

// Small helper for UI status
function setLLMStatus(msg) {
    console.log("[LLM]", msg);
    if (statusEl) statusEl.textContent = msg;
}

// Keep a single shared pipeline instance (model is large, we don't want to reload)
let generatorPromise = null;

// Lazy-load and cache the text2text model
async function getGenerator() {
    if (!generatorPromise) {
        generatorPromise = (async () => {
            setLLMStatus("Downloading local AI model (one-time)...");

            // text2text-generation = encoder-decoder (T5-style) generation
            // Model is quantized ONNX, optimized for transformers.js
            const pipe = await pipeline(
                "text2text-generation",
                "Xenova/LaMini-Flan-T5-77M"
            );

            setLLMStatus("Local AI is ready. You can ask for explanations.");
            return pipe;
        })();
    }
    return generatorPromise;
}

/* ============================================================
   Build strict numeric context from your BI state
   → Uses ONLY SBI.state (AS IN YOUR EXISTING CODE)
============================================================ */
function buildOverviewTrendContext() {
    const SBI = window.SBI;
    if (!SBI || !SBI.state || !Array.isArray(SBI.state.allRows) || SBI.state.allRows.length === 0) {
        throw new Error("No BI data loaded. Please upload the Excel file first.");
    }

    const rows = SBI.state.allRows;
    const terms = SBI.state.allTerms;

    // Group values by term
    const byTerm = SBI.groupBy(
        rows,
        r => r.term,
        r => Number(r.final_percent ?? r.final_5scale ?? NaN)
    );

    const trend = terms.map(t => ({
        term: t,
        avg: SBI.mean(byTerm[t] || [])
    }));

    return {
        metric: "final_percent_or_5scale",
        school_name: "Current school",
        trend: trend
    };
}

/* ============================================================
   Prompt template: deterministic, low hallucination risk
============================================================ */
function makePromptFromContext(ctx) {
    const jsonData = JSON.stringify(ctx, null, 2);

    return `
You are an assistant for a School BI dashboard. You must analyze school-wide performance trends.

Follow these rules:
- Use ONLY the numbers and terms from the data block.
- Do NOT invent or guess any new numeric values.
- Do NOT repeat or mention the words "RULES", "DATA", or any JSON.
- Do NOT copy the data itself in your answer.
- If a conclusion cannot be supported directly, say: "Not enough data to determine this."
- Be concise and structured.

Data:
${jsonData}

Now write the analysis in plain English using EXACTLY this format:

1. Summary (2–3 sentences)

2. Positive patterns
- ...

3. Potential issues or risks
- ...

4. Recommendations for the school (very concrete, 3–5 short items)
- ...

Write ONLY the analysis in this format. Do NOT explain the rules, do NOT show the data, and do NOT add any extra headings.
`.trim();
}


/* ============================================================
   Main action: explain overview trend
============================================================ */
async function explainOverviewTrend() {
    if (!outputEl) return;

    try {
        if (explainBtn) explainBtn.disabled = true;
        setLLMStatus("Preparing BI context...");

        const ctx = buildOverviewTrendContext();
        const prompt = makePromptFromContext(ctx);

        const generator = await getGenerator();
        setLLMStatus("Local AI is analyzing the trend...");

        // LaMini-Flan-T5-77M is text2text → returns array with generated_text
        const result = await generator(prompt, {
            max_new_tokens: 220,
            temperature: 0.2,       // low for stability
            top_k: 40,
            repetition_penalty: 1.05
        });

        const text = (result && result[0] && result[0].generated_text)
            ? result[0].generated_text
            : "Model returned no output.";

        outputEl.textContent = text;
        setLLMStatus("Explanation ready.");

    } catch (err) {
        console.error(err);
        outputEl.textContent = "Error: " + err.message;
        setLLMStatus("Error during AI analysis.");
    } finally {
        if (explainBtn) explainBtn.disabled = false;
    }
}

/* ============================================================
   Wire button click
============================================================ */
if (explainBtn) {
    explainBtn.addEventListener("click", explainOverviewTrend);
    setLLMStatus("Local AI is idle. Upload data, then click the button.");
} else {
    console.warn("btn-explain-overview not found in DOM.");
}
