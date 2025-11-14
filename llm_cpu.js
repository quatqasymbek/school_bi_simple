// llm_cpu.js — WebLLM Llama-3.2-3B version
// ⭐ BEST ACCURACY FOR BI INTERPRETATION ⭐

// UI handles
const statusEl = document.getElementById("llm-status");
const outputEl = document.getElementById("overview-ai-explanation");
const explainBtn = document.getElementById("btn-explain-overview");

// Status helper
function setLLMStatus(msg) {
    console.log("[LLM]", msg);
    if (statusEl) statusEl.textContent = msg;
}

let chat = null;

/* ===========================================================
   1. Initialize Llama-3.2-3B (BEST QUALITY)
=========================================================== */
async function initLLM() {
    setLLMStatus("Loading local AI model (one-time)…");

    chat = await webllm.ChatModule.createChatModule({
        model: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
        device: "wasm",      // CPU-only, works on all browsers
        tokenizer: "Default" // use built-in tokenizer
    });

    setLLMStatus("Local AI ready. Upload data and click the button.");
}

/* ===========================================================
   2. Build BI context
=========================================================== */
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

/* ===========================================================
   3. Stable prompt made for Llama (works perfectly)
=========================================================== */
function makePrompt(ctx) {
    const json = JSON.stringify(ctx);

    return `
You are an educational data analyst. Analyze the school-wide performance data.

DATA:
${json}

Write the analysis in EXACTLY the following structure:

1. Summary (2–3 sentences):
<your text>

2. Positive patterns:
- <point 1>
- <point 2>

3. Potential issues or risks:
- <risk 1>
- <risk 2>

4. Recommendations for the school (3–5 concrete items):
- <rec 1>
- <rec 2>
- <rec 3>

RULES:
• Do NOT repeat the data.
• Do NOT output anything outside the structure.
• Do NOT include explanations of rules.
• Begin DIRECTLY with "1. Summary (2–3 sentences):"
`.trim();
}

/* ===========================================================
   4. Generate explanation
=========================================================== */
async function explainOverviewTrend() {
    if (!chat) return;

    try {
        explainBtn.disabled = true;
        outputEl.textContent = "";
        setLLMStatus("Preparing BI context…");

        const ctx = buildOverviewTrendContext();
        const prompt = makePrompt(ctx);

        setLLMStatus("AI analyzing…");

        const reply = await chat.generate(prompt, {
            temperature: 0.15, // stable and precise
            max_tokens: 350
        });

        let text = reply.trim();

        // Remove unwanted prefixes
        const anchor = "1. Summary";
        const idx = text.indexOf(anchor);
        if (idx !== -1) text = text.slice(idx);

        outputEl.textContent = text;
        setLLMStatus("Explanation ready.");

    } catch (err) {
        outputEl.textContent = "Error: " + err;
        setLLMStatus("AI error.");
    } finally {
        explainBtn.disabled = false;
    }
}

/* ===========================================================
   5. Bind button
=========================================================== */
if (explainBtn) {
    explainBtn.addEventListener("click", explainOverviewTrend);
}

initLLM();
