// overview_ai.js
// Локальный ИИ для вкладки "Обзор". НЕ трогаем существующие диаграммы и KPI.

(function (global) {
    const SBI = global.SBI || {};
    const state = SBI.state || {};

    let btn, output;

    function valueTo5Scale(row) {
        const toNumber = SBI.toNumber || (x => {
            const n = Number(String(x).replace(",", "."));
            return isNaN(n) ? null : n;
        });

        const s5 = toNumber(row.final_5scale);
        if (s5 != null && s5 > 0) return s5;

        const p = toNumber(row.final_percent);
        if (p != null && p > 0) return p / 20; // грубое приведение к 5-балльной
        return null;
    }

    function buildOverviewInsight(rows) {
        const groupBy = SBI.groupBy || function (arr, keyFn) {
            const res = {};
            if (!Array.isArray(arr)) return res;
            arr.forEach(item => {
                const k = keyFn(item);
                (res[k] = res[k] || []).push(item);
            });
            return res;
        };
        const mean = SBI.mean || function (arr) {
            const nums = arr.filter(v => typeof v === "number" && !isNaN(v));
            if (!nums.length) return null;
            return nums.reduce((a, b) => a + b, 0) / nums.length;
        };

        const totalRecords = rows.length;
        const allVals = rows.map(valueTo5Scale).filter(v => v != null);
        const overallAverage = allVals.length ? mean(allVals) : null;

        // по четвертям
        const byTerm = {};
        const groupedT = groupBy(rows, r => r.term || "");
        Object.keys(groupedT).forEach(term => {
            const group = groupedT[term];
            const vals = group.map(valueTo5Scale).filter(v => v != null);
            byTerm[term] = {
                count: group.length,
                average: vals.length ? mean(vals) : null,
                min: vals.length ? Math.min.apply(null, vals) : null,
                max: vals.length ? Math.max.apply(null, vals) : null
            };
        });

        // по классам
        const byClass = {};
        const groupedC = groupBy(rows, r => String(r.class || r.class_name || "").trim());
        Object.keys(groupedC).forEach(cls => {
            if (!cls) return;
            const group = groupedC[cls];
            const vals = group.map(valueTo5Scale).filter(v => v != null);
            byClass[cls] = {
                count: group.length,
                average: vals.length ? mean(vals) : null
            };
        });

        return {
            dashboard: "overview",
            totalRecords,
            overallAverage,
            byTerm,
            byClass
        };
    }

    function setAILoading(isLoading, msg) {
        if (btn) btn.disabled = isLoading;
        if (output && msg) output.textContent = msg;
    }

    async function onClick() {
        const rows = (state && state.allRows) || [];
        if (!rows.length) {
            if (output) {
                output.textContent = "Данные ещё не загружены. Сначала загрузите Excel-файл.";
            }
            return;
        }

        if (!global.SBI_LLM || typeof global.SBI_LLM.interpret !== "function") {
            if (output) {
                output.textContent =
                    "Локальный ИИ не инициализирован. " +
                    "Убедитесь, что файл llm_cpu.js подключён в index.html перед overview_ai.js.";
            }
            return;
        }

        const insight = buildOverviewInsight(rows);

        try {
            setAILoading(true, "Подготовка AI-анализа…");

            const text = await global.SBI_LLM.interpret({
                context: "overview_dashboard",
                data: insight,
                temperature: 0.25,
                maxTokens: 700,
                onProgress: function (msg) {
                    if (output) output.textContent = msg;
                },
                userInstruction:
                    "Это общешкольный обзор (overview). JSON содержит:\n" +
                    "- overallAverage: средний балл по школе,\n" +
                    "- byTerm: статистика по четвертям (count, average, min, max),\n" +
                    "- byClass: статистика по классам (count, average).\n\n" +
                    "Сделай интерпретацию:\n" +
                    "1) Общая картина успеваемости и её динамика по четвертям.\n" +
                    "2) Классы и четверти с относительно высокими результатами.\n" +
                    "3) Потенциальные зоны риска.\n" +
                    "4) 3–5 конкретных рекомендаций администрации.\n" +
                    "Не выдумывай новые числа, которых нет в JSON, но можно описывать тенденции."
            });

            if (output) {
                output.textContent = text;
            }
        } catch (e) {
            console.error("[overview_ai] error:", e);
            if (output) {
                output.textContent =
                    "Ошибка при AI-аналізе. Попробуйте ещё раз или обновите страницу.";
            }
        } finally {
            setAILoading(false);
        }
    }

    function init() {
        btn = document.getElementById("btn-overview-ai");
        output = document.getElementById("overview-ai-output");

        if (!btn) {
            console.log("[overview_ai] Кнопка btn-overview-ai не найдена — AI-блок не активирован.");
            return;
        }

        btn.addEventListener("click", onClick);

        if (output) {
            output.textContent = "Локальный ИИ пока не инициализирован. Нажмите кнопку, чтобы запустить анализ.";
        }

        if (global.SBI_LLM && typeof global.SBI_LLM.getModelId === "function") {
            console.log("[overview_ai] LLM найден:", global.SBI_LLM.getModelId());
        } else {
            console.log("[overview_ai] LLM пока не найден. Он подключится после загрузки llm_cpu.js.");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})(window);
