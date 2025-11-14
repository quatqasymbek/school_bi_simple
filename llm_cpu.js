import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

const statusEl = document.getElementById("llm-status");
const outputEl = document.getElementById("overview-ai-explanation");
const explainBtn = document.getElementById("btn-explain-overview");

function setLLMStatus(msg) {
    console.log("[LLM]", msg);
    if (statusEl) statusEl.textContent = msg;
}

let generatorPromise = null;

/* Load SAFE PUBLIC MODEL */
async function getGenerator() {
    if (!generatorPromise) {
        generatorPromise = (async () => {
            setLLMStatus("Downloading local AI model (one-time)…");

            // SAFE, PUBLIC, AUTH-FREE MODEL
            const pipe = await pipeline(
                "text2text-generation",
                "Xenova/t5-small",    // <----- FIXED
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

/* BI context */
function buildOverviewTrendContext() {
    const SBI = window.SBI;
    if (!SBI?.state?.allRows) throw new Error("No BI data loaded.");

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

/* T5-friendly prompt */
function makePromptFromContext(ctx) {
    const jsonData = JSON.stringify(ctx);

    return `
Using the following data:
${jsonData}

Write the school trend analysis in this exact format:

1. Summary (2–3 sentences):
[Write here]

2. Positive patterns:
- [Item 1]
- [Item 2]

3. Potential issues or risks:
- [Risk 1]
- [Risk 2]

4. Recommendations for the school (3–5 items):
- [Item 1]
- [Item 2]
- [Item 3]

Begin with "1. Summary".
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
            max_new_tokens: 200,
            temperature: 0.2
        });

        let text = result[0]?.generated_text || "";

        // Clean: always start from "1. Summary"
        const idx = text.indexOf("1. Summary");
        if (idx > 0) text = text.slice(idx);

        text = text
            .replace(/\[Write here\]/g, "")
            .replace(/\[Item \d\]/g, "")
            .replace(/\[Risk \d\]/g, "")
            .trim();

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

if (explainBtn) {
    explainBtn.addEventListener("click", explainOverviewTrend);
    setLLMStatus("Local AI is idle. Upload data, then click the button.");
}
