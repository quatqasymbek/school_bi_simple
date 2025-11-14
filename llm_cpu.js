// llm_cpu.js — FINAL ANTI-COLLAPSE VERSION
// Local CPU-only LLM for School BI using T5-small

import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

const statusEl = document.getElementById("llm-status");
const outputEl = document.getElementById("overview-ai-explanation");
const explainBtn = document.getElementById("btn-explain-overview");

function setLLMStatus(msg) {
    console.log("[LLM]", msg);
    if (statusEl) statusEl.textContent = msg;
}

let generatorPromise = null;

/* Load safe public model */
async function getGenerator() {
    if (!generatorPromise) {
        generatorPromise = (async () => {
            setLLMStatus("Downloading local AI model…");

            const pipe = await pipeline(
                "text2text-generation",
                "Xenova/t5-small",
                {
                    dtype: "q4",
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
    if (!SBI?.state?.allRows) throw new Error("No BI data loaded.");

    const rows = SBI.state.allRows;
    const terms = SBI.state.allTerms;

    const byTerm = SBI.groupBy(rows,
        r => r.term,
        r => Number(r.final_percent ?? r.final_5scale ?? NaN)
    );

    const trend = terms.map(t => ({
        term: t,
        avg: SBI.mean(byTerm[t] || [])
    }));

    return { trend };
}

/* ---- SUPER-STABLE PROMPT FOR T5 ---- */
function makePromptFromContext(ctx) {
    const json = JSON.stringify(ctx);

    return `
Analyze the following school performance data and write a structured report.

DATA:
${json}

Write the report in EXACTLY this structure:

### Summary
(2–3 sentences)

### Strengths
- 

### Risks
- 

### Recommendations
- 
- 
- 

Do NOT repeat the data.
Do NOT modify the section names.
Begin directly with "### Summary".
`.trim();
}

/* Generate explanation */
async function explainOverviewTrend() {
    try {
        explainBtn.disabled = true;
        setLLMStatus("Preparing BI context…");

        const ctx = buildOverviewTrendContext();
        const prompt = makePromptFromContext(ctx);

        const generator = await getGenerator();

        setLLMStatus("AI analyzing trend…");

        const result = await generator(prompt, {
            max_new_tokens: 250,
            temperature: 0.1
        });

        let text = result[0]?.generated_text || "";

        // Start at ### Summary (anchor forcing)
        const idx = text.indexOf("### Summary");
        if (idx !== -1) text = text.slice(idx);

        // Remove placeholders like "(2–3 sentences)" or "-"
        text = text.replace(/\(.*?\)/g, "");
        text = text.replace(/\[.*?\]/g, "");

        // Remove repeated instructions
        text = text.replace(/Begin.*/gi, "");

        // Final cleanup
        text = text.trim();

        outputEl.textContent = text;
        setLLMStatus("Explanation ready.");

    } catch (err) {
        outputEl.textContent = "Error: " + err.message;
        setLLMStatus("AI error.");
        console.error(err);
    } finally {
        explainBtn.disabled = false;
    }
}

/* Button binding */
if (explainBtn) {
    explainBtn.addEventListener("click", explainOverviewTrend);
    setLLMStatus("Local AI is idle. Upload data, then click the button.");
}
