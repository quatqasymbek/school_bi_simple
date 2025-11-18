// llm_cpu.js
// Shared in-browser LLM helper using WebLLM + Llama-3.2-3B-Instruct

(function (global) {
    const MODEL_ID = "Llama-3.2-3B-Instruct-q4f16_1-MLC";

    let webllmModule = null;
    let engine = null;
    let loading = false;
    let lastProgressText = "";

    function defaultLog() {
        if (console && console.log) {
            console.log.apply(console, arguments);
        }
    }

    /**
     * Ensure WebLLM engine is loaded for the Llama-3.2-3B-Instruct model.
     * Returns a Promise<engine>.
     */
    async function ensureEngine(onProgress) {
        if (engine) return engine;

        if (loading) {
            // Wait until existing load finishes
            while (loading && !engine) {
                await new Promise(function (resolve) { setTimeout(resolve, 300); });
            }
            return engine;
        }

        loading = true;
        try {
            if (typeof onProgress !== "function") {
                onProgress = function (msg) {
                    lastProgressText = msg;
                    defaultLog("[LLM]", msg);
                };
            }

            onProgress("Инициализация WebLLM…");

            // Load WebLLM from CDN (ESM)
            // Pin to a known version for stability
            // See docs: https://webllm.mlc.ai :contentReference[oaicite:2]{index=2}
            webllmModule = await import("https://esm.run/@mlc-ai/web-llm@0.2.79");

            onProgress("Загружается модель: " + MODEL_ID);

            const initProgressCallback = function (progress) {
                const msg = "Загрузка модели: " +
                    Math.round((progress.progress || 0) * 100) + "% (" +
                    (progress.text || "") + ")";
                lastProgressText = msg;
                onProgress(msg);
            };

            engine = await webllmModule.CreateMLCEngine(
                MODEL_ID,
                { initProgressCallback: initProgressCallback }
            );

            onProgress("Модель Llama 3.2 3B Instruct загружена и готова к работе.");
            return engine;
        } catch (err) {
            defaultLog("[LLM] error during init:", err);
            lastProgressText = "Ошибка инициализации модели.";
            throw err;
        } finally {
            loading = false;
        }
    }

    /**
     * High-level helper to get an interpretation.
     * options: {
     *   context: string,          // e.g. "overview_dashboard"
     *   data: object,             // aggregated JSON ONLY
     *   userInstruction?: string, // extra text for the LLM
     *   temperature?: number,
     *   maxTokens?: number,
     *   onProgress?: (msg:string) => void
     * }
     */
    async function interpret(options) {
        const context = options.context || "generic_dashboard";
        const data = options.data || {};
        const userInstruction = options.userInstruction || "";
        const temperature = typeof options.temperature === "number" ? options.temperature : 0.3;
        const maxTokens = typeof options.maxTokens === "number" ? options.maxTokens : 700;
        const onProgress = typeof options.onProgress === "function" ? options.onProgress : defaultLog;

        const engineInstance = await ensureEngine(onProgress);
        if (!engineInstance) {
            throw new Error("LLM engine is not available.");
        }

        const jsonData = JSON.stringify(data, null, 2);

        const systemPrompt = [
            "Ты — аналитик данных школьной успеваемости.",
            "Тебе даются только агрегированные данные из дашборда в виде JSON.",
            "Используй ТОЛЬКО эти числа и структуры.",
            "Не придумывай новые точные проценты или значения, которых нет в JSON.",
            "Можно описывать тенденции (выше/ниже, растёт/падает), но без фиктивных цифр."
        ].join(" ");

        const userPrompt =
            "Контекст дашборда: " + context + "\n\n" +
            "Агрегированные данные в формате JSON:\n" +
            jsonData + "\n\n" +
            (userInstruction || (
                "Сделай, пожалуйста, интерпретацию этих данных:\n" +
                "1) Кратко опиши общую картину успеваемости.\n" +
                "2) Выдели сильные стороны.\n" +
                "3) Укажи возможные зоны риска.\n" +
                "4) Дай 3–5 практических рекомендаций для педагогов и администрации.\n" +
                "Пиши по-русски, структурировано, читабельно, но без чрезмерной длины."
            ));

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ];

        onProgress("AI анализирует данные…");

        const reply = await engineInstance.chat.completions.create({
            messages: messages,
            temperature: temperature,
            max_tokens: maxTokens
        });

        let text = "";

        try {
            const choice = reply.choices && reply.choices[0];
            if (choice && choice.message) {
                if (typeof choice.message.content === "string") {
                    text = choice.message.content;
                } else if (Array.isArray(choice.message.content)) {
                    text = choice.message.content.map(function (c) {
                        return (typeof c === "string") ? c : (c.text || "");
                    }).join("");
                }
            }
        } catch (e) {
            defaultLog("[LLM] parsing reply error:", e);
        }

        if (!text) {
            text = "AI не вернул читаемый текст. Сырой ответ:\n" +
                JSON.stringify(reply, null, 2);
        }

        return text.trim();
    }

    global.SBI_LLM = {
        ensureEngine: ensureEngine,
        interpret: interpret,
        getModelId: function () { return MODEL_ID; },
        getLastProgressText: function () { return lastProgressText; }
    };

})(window);
