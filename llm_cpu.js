// llm_cpu.js
// Local CPU-only LLM using Transformers.js + Qwen2-0.5B-Instruct
// Works on old PCs (WASM backend, no GPU/WebGPU required)

import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

// UI handles
const statusEl = document.getElementById("llm-status");
const outputEl = document.getElementById("overview-ai-explanation");
const explainBtn = document.getElementById("btn-explain-overview");

function setLLMStatus(msg) {
    console.log("[LLM]", msg);
    if (statusEl) statusEl.textContent = msg;
}

// Cache the model so it loads only once
let generatorPromise = null;

async function getGenerator() {
    if (!generatorPromise) {
        generatorPromise = (async () => {
            setLLMStatus("Downloading local AI model (one-time)…");

            const pipe = await pipeline(
                "text-generation",
                "Xenova/qwen2-0.5b-instruct",
                {
                    dtype: "q4",      // fastest stable quantization
                    device: "wasm"    // CPU-only, works everywhere
                }
            );

            setLLMStatus("Local AI is ready.");
            return pipe;
        })();
    }
    return generatorPromise;
}

/* ============================================================
   Build deterministic BI context from Overview → Terms
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
   Ultra-stable template (bullet-proof for small models)
============================================================ */
function makePromptFromContext(ctx) {
    const jsonData = JSON.stringify(ctx, null, 2);

    return `
You are an AI assistant for a School BI dashboard. Write a short analytical summary using ONLY the data provided. 

Do NOT mention the JSON.
Do NOT repeat the data itself.
Do NOT explain rules.
Do NOT add any headings outside 1–4.

DATA:
${jsonData}

Write the analysis by filling in this exact template:

1. Summary (2–3 sentences):
[Write here]

2. Positive patterns:
- [Item 1]
- [Item 2]

3. Potential issues or risks:
- [Item 1]
- [Item 2]

4. Recommendations for the school (3–5 concrete items):
- [Item 1]
- [Item 2]
- [Item 3]

Begin directly with “1. Summary”.
`.trim();
}

/* ============================================================
   Generate explanation
============================================================ */
async function explainOverviewTrend() {
    if (!outputEl) return;

    try {
        if (explainBtn) explainBtn.disabled = true;

        setLLMStatus("Preparing BI context...");
        const ctx = buildOverviewTrendContext();
        const prompt = makePromptFromContext(ctx);

        const generator = await getGenerator();

        setLLMStatus("AI analyzing trend…");
        const result = await generator(prompt, {
            max_new_tokens: 280,
            temperature: 0.25,       // low = stable + precise
            top_p: 0.9,
            repetition_penalty: 1.1
        });

        let text = result[0]?.generated_text || "";

        /* CLEAN THE OUTPUT -------------------------------------- */

        // Remove everything before "1. Summary"
        const startIndex = text.indexOf("1. Summary");
        if (startIndex >= 0) {
            text = text.slice(startIndex);
        }

        // Remove leftover placeholder markers
        text = text
            .replace(/\[Write here\]/g, "")
            .replace(/\[Item 1\]/g, "")
            .replace(/\[Item 2\]/g, "")
            .replace(/\[Item 3\]/g, "")
            .replace(/\[Item 4\]/g, "")
            .trim();

        // Optionally remove duplicated template blocks
        const endIndex = text.lastIndexOf("Recommendations");
        if (endIndex > 0) {
            text = text.slice(0, endIndex + 200);
        }

        /* END CLEANING ------------------------------------------- */

        outputEl.textContent = text;
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
   Attach button
============================================================ */
if (explainBtn) {
    explainBtn.addEventListener("click", explainOverviewTrend);
    setLLMStatus("Local AI is idle. Upload data, then click the button.");
} else {
    console.warn("btn-explain-overview not found");
}
