// llm_cpu.js
// Local CPU-only LLM using Transformers.js + T5-Small (Xenova)
// Fully anonymous, no HuggingFace login required
// Works on old PCs (WASM backend, no GPU/WebGPU)

import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

const statusEl = document.getElementById("llm-status");
const outputEl = document.getElementById("overview-ai-explanation");
const explainBtn = document.getElementById("btn-explain-overview");

function setLLMStatus(msg) {
    console.log("[LLM]", msg);
    if (statusEl) statusEl.textContent = msg;
}

let generatorPromise = null;

/* Load T5-Small (public, CPU-friendly, no 401) */
async function getGenerator() {
    if (!generatorPromise) {
        generatorPromise = (async () => {
            setLLMStatus("Downloading local AI model (one-time)…");

            const pipe = await pipeline(
                "text2text-generation",
                "Xenova/t5-small",   // <---- SAFE PUBLIC MODEL
                {
                    dtype: "q4",      // optimized quantization
                    device: "wasm"
                }
            );

            setLLMStatus("Local AI is ready.");
            return pipe;
        })();
    }
    return generatorPromise;
}

/* Build BI context */
function buildOverviewTrendContext() {
    const SBI = window.SBI;
    if (!SBI?.state?.allRows?.length) {
        throw new Error("No BI data loaded.");
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

/* T5-friendly template */
function makePromptFromContext(ctx) {
    const json = JSON.stringify(ctx);

    return `
Using the following data:
${json}

Write a structured school performance analysis:

1. Summary (2–3 sentences):
[Write here]

2. Positive patterns:
- [Point 1]
- [Point 2]

3. Potential issues or risks:
- [Risk 1]
- [Risk 2]

4. Recommendations for the school (3–5 items):
- [Item 1]
- [Item 2]
- [Item 3]

Begin directly with "1. Summary".
`.trim();
}

/* Run inference */
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
            max_new_tokens: 220,
            temperature: 0.2,
        });

        let text = result[0]?.generated_text || "";

        /* Cleanup */
        const idx = text.indexOf("1. Summary");
        if (idx > 0) text = text.slice(idx);

        text = text
            .replace(/\[Write here\]/g, "")
            .replace(/\[Point 1\]/g, "")
            .replace(/\[Point 2\]/g, "")
            .replace(/\[Risk 1\]/g, "")
            .replace(/\[Risk 2\]/g, "")
            .replace(/\[Item 1\]/g, "")
            .replace(/\[Item 2\]/g, "")
            .replace(/\[Item 3\]/g, "")
            .trim();

        outputEl.textContent = text;
        setLLMStatus("Explanation ready.");

    } catch (err) {
        outputEl.textContent = "Error: " + err.message;
        setLLMStatus("AI error.");
        console.error(err);
    } finally {
        if (explainBtn) explainBtn.disabled = false;
    }
}

/* Attach button */
if (explainBtn) {
    explainBtn.addEventListener("click", explainOverviewTrend);
    setLLMStatus("Local AI is idle. Upload data, then click the button.");
}
