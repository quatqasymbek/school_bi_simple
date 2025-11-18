// llm_cpu.js
// Общий помощник для локального LLM (Llama 3.2 3B Instruct) через WebLLM
// Работает целиком в браузере, без сервера и без ключей API.

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
     * Загружает WebLLM и инициализирует движок c моделью Llama 3.2 3B Instruct.
     * Возвращает Promise<engine>.
     */
    async function ensureEngine(onProgress) {
        if (engine) return engine;

        if (loading) {
            // Если уже идёт загрузка — просто ждём её завершения
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

            // Динамический импорт WebLLM (ESM) с CDN
            webllmModule = await import("https://esm.run/@mlc-ai/web-llm@0.2.79");

            onProgress("Загружается модель: " + MODEL_ID);

            const initProgressCallback = function (progress) {
                // progress.progress от 0 до 1
                const percent = progress && typeof progress.progress === "number"
                    ? Math.round(progress.progress * 100)
                    : 0;
                const msg = "Загрузка модели: " +
                    percent + "% " +
                    (progress && progress.text ? "(" + progress.text + ")" : "");
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
            defaultLog("[LLM] Ошибка инициализации:", err);
            lastProgressText = "Ошибка инициализации модели.";
            throw err;
        } finally {
            loading = false;
        }
    }

    /**
     * Универсальная функция интерпретации агрегированных данных дашбордов.
     *
     * options: {
     *   context: string,          // например "overview_dashboard"
     *   data: object,             // только агрегированные данные
     *   userInstruction?: string, // дополнительные указания
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
            "Тебе даются только агрегированные (уже посчитанные) данные в формате JSON.",
            "Используй ТОЛЬКО эти числа и структуры.",
            "Не придумывай новые точные проценты или значения, которых нет в JSON.",
            "Можно описывать тенденции (выше/ниже, растёт/падает), но без вымышленных цифр."
        ].join(" ");

        const userPrompt =
            "Контекст дашборда: " + context + "\n\n" +
            "Агрегированные данные (JSON):\n" +
            jsonData + "\n\n" +
            (userInstruction || (
                "Сделай, пожалуйста, интерпретацию этих данных:\n" +
                "1) Кратко опиши общую картину успеваемости.\n" +
                "2) Выдели сильные стороны.\n" +
                "3) Укажи возможные зоны риска.\n" +
                "4) Дай 3–5 практических рекомендаций для педагогов/администрации.\n" +
                "Пиши по-русски, структурированно, читабельно, но без лишней воды."
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
            defaultLog("[LLM] Ошибка парсинга ответа:", e);
        }

        if (!text) {
            text = "AI не вернул читаемый текст. Сырой ответ:\n" +
                JSON.stringify(reply, null, 2);
        }

        return text.trim();
    }

    // Экспортируем в глобальный объект
    global.SBI_LLM = {
        ensureEngine: ensureEngine,
        interpret: interpret,
        getModelId: function () { return MODEL_ID; },
        getLastProgressText: function () { return lastProgressText; }
    };

})(window);
