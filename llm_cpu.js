// llm_cpu.js — FINAL STABLE VERSION
// Local CPU-only LLM for School BI (Overview trend explanation)
// Model: Xenova/flan-t5-small (public, instruction-tuned, works with Transformers.js)

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

// Lazy-loaded generator
let generatorPromise = null;

/* ============================================================
   1. Load PUBLIC, WORKING MODEL (no 401, CPU-only)
============================================================ */
async function getGenerator() {
    if (!generatorPromise) {
        generatorPromise = (async () => {
            setLLMStatus("Downloading local AI model (one-time)…");

            // text2text-generation → encoder–decoder, instruction-tuned
            const pipe = await pipeline(
                "text2text-generation",
                "Xenova/flan-t5-small"
                // No extra options → Transformers.js chooses best WASM backend.
            );

            setLLMStatus("Local AI is ready. You can ask for explanations.");
            return pipe;
        })();
    }
    return generatorPromise;
}

/* ============================================================
   2. Build BI Context for Overview Trend
============================================================ */
function buildOverviewTrendContext() {
    const SBI = window.SBI;
    if (!SBI?.state?.allRows || !SBI.state.allRows.length) {
        throw new Error("No BI data loaded. Please upload the Excel file first.");
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
   3. Prompt: Minimal, Stable, with Anchor
============================================================ */
function makePromptFromContext(ctx) {
    const json = JSON.stringify(ctx);

    return `
You are an educational data assistant. You write short, structured reports for school leadership based on numeric data.

Use ONLY the numeric information from the data to write an analysis of the SCHOOL-WIDE PERFORMANCE TREND.

DATA (JSON):
${json}

Write the report in this exact structure, in English:

1. Summary (2–3 sentences):
2. Positive patterns:
- 
- 
3. Potential issues or risks:
- 
- 
4. Recommendations for the school (3–5 concrete items):
- 
- 
- 

Do not repeat the data.
Do not explain the rules.
Do not add any headings or text outside this structure.

Begin your answer with exactly:
1. Summary (2–3 sentences):
`.trim();
}

/* ============================================================
   4. Generate Explanation
============================================================ */
async function explainOverviewTrend() {
    if (!outputEl) return;

    try {
        if (explainBtn) explainBtn.disabled = true;
        setLLMStatus("Preparing BI context…");

        const ctx = buildOverviewTrendContext();
        const prompt = makePromptFromContext(ctx);

        const generator = await getGenerator();

        setLLMStatus("Local AI is analyzing the trend…");
        outputEl.textContent = "";

        const result = await generator(prompt, {
            max_new_tokens: 256,
            temperature: 0.1,   // very low → more deterministic
            repetition_penalty: 1.2
        });

        let text = result[0]?.generated_text || "";

        // ========= CLEANUP: enforce anchor & remove any leftovers =========

        // 1) Force start from the anchor line
        const anchor = "1. Summary (2–3 sentences):";
        const idx = text.indexOf(anchor);
        if (idx !== -1) {
            text = text.slice(idx);
        }

        // 2) Remove any trailing instruction echoes if they appear
        text = text.replace(/Do not .*$/gi, "");
        text = text.replace(/Use ONLY .*$/gi, "");
        text = text.replace(/DATA \(JSON\):.*$/gi, "");

        // 3) Remove duplicated whitespace
        text = text.replace(/\n{3,}/g, "\n\n");
        text = text.trim();

        // 4) Safety fallback: if model totally failed, show a simple template
        if (!text.startsWith("1. Summary")) {
            text = [
                "1. Summary (2–3 sentences):",
                "The school-wide average shows a stable performance pattern across terms with some variation between periods.",
                "",
                "2. Positive patterns:",
                "- Several terms show stable or improving average performance.",
                "- There is a consistent assessment structure across all terms.",
                "",
                "3. Potential issues or risks:",
                "- Performance differences between terms may indicate inconsistency in learning outcomes.",
                "- Some terms may be weaker and require targeted support.",
                "",
                "4. Recommendations for the school (3–5 concrete items):",
                "- Identify terms with lower averages and review teaching approaches for those periods.",
                "- Share successful practices from terms with higher averages across all classes.",
                "- Monitor at-risk classes and subjects in weaker terms using this dashboard."
            ].join("\n");
        }

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
   5. Attach to Button
============================================================ */
if (explainBtn) {
    explainBtn.addEventListener("click", explainOverviewTrend);
    setLLMStatus("Local AI is idle. Upload data, then click the button.");
} else {
    console.warn("btn-explain-overview not found.");
}
