// llm_cpu.js
console.log("llm_cpu.js загружен (модуль LLM)");

let chat = null;
let llmReady = false;
let llmInitStarted = false;

async function initLLM() {
    if (llmReady || llmInitStarted) return;
    llmInitStarted = true;

    if (typeof window.webllm === "undefined") {
        console.warn("[LLM] webllm не найден. Локальный ИИ отключён.");
        const status = document.getElementById("llm-status");
        const btn = document.getElementById("btn-explain-overview");
        if (status) status.textContent = "Локальный ИИ недоступен в этой сборке.";
        if (btn) btn.disabled = true;
        return;
    }

    const status = document.getElementById("llm-status");
    if (status) status.textContent = "Загрузка локальной модели ИИ (однократно)…";

    chat = await window.webllm.ChatModule.createChatModule({
        model: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
        device: "wasm",
        tokenizer: "Default"
    });

    llmReady = true;
    if (status) status.textContent = "Локальный ИИ готов к работе.";
}

function buildOverviewTrendContext() {
    const state = window.SBI ? SBI.state : { allRows: [] };
    const rows = state.allRows || [];
    const byTerm = SBI.groupBy(rows, function (r) {
        return r.term;
    }, function (r) {
        return Number(r.final_percent ?? r.final_5scale ?? NaN);
    });

    const terms = state.allTerms || [];
    const trend = terms.map(function (t) {
        return {
            term: t,
            avg: SBI.mean(byTerm[t] || [])
        };
    });

    return { trend: trend };
}

async function explainOverviewTrend() {
    const btn = document.getElementById("btn-explain-overview");
    const status = document.getElementById("llm-status");
    const out = document.getElementById("overview-ai-explanation");

    if (!btn || !status || !out) return;

    await initLLM();
    if (!llmReady || !chat) {
        // webllm отсутствует – уже показали сообщение
        return;
    }

    btn.disabled = true;
    status.textContent = "ИИ анализирует данные…";
    out.textContent = "";

    const context = buildOverviewTrendContext();
    const json = JSON.stringify(context);

    const prompt =
        "Ты — помощник завуча школы. На входе у тебя JSON с трендом среднего балла по четвертям.\n" +
        "Нужно кратко и понятным языком описать ситуацию.\n\n" +
        "Данные:\n" + json + "\n\n" +
        "Сформируй ответ в формате:\n" +
        "1. Краткий вывод\n" +
        "2. Положительные моменты\n" +
        "3. Риски и проблемные зоны\n" +
        "4. Рекомендации для школы\n\n" +
        "Пиши по-русски, без сложной терминологии.";

    try {
        const reply = await chat.generate(prompt, {
            temperature: 0.15,
            max_tokens: 512,
            top_p: 0.9
        });

        let text = reply.trim();
        const idx = text.indexOf("1.");
        if (idx > 0) {
            text = text.substring(idx);
        }

        out.textContent = text;
        status.textContent = "Готово. Можно обновить анализ после изменения данных.";
    } catch (e) {
        console.error("Ошибка LLM:", e);
        status.textContent = "Ошибка при работе локального ИИ.";
        out.textContent = "";
    } finally {
        btn.disabled = false;
    }
}

window.addEventListener("DOMContentLoaded", function () {
    const btn = document.getElementById("btn-explain-overview");
    if (btn) {
        btn.addEventListener("click", function () {
            explainOverviewTrend();
        });
    }
});
