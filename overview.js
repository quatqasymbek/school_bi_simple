// overview.js
// Overview (school-wide) dashboard + AI interpretation

window.SBI_Overview = (function () {
    const state = window.SBI.state;
    const log = window.SBI.log || console.log;

    // DOM
    let chartByTermEl = null;
    let chartByClassEl = null;
    let aiButton = null;
    let aiOutput = null;

    // Cached aggregated data for AI
    let currentInsightData = null;

    function init() {
        chartByTermEl = document.getElementById("chart-overview-by-term");
        chartByClassEl = document.getElementById("chart-overview-by-class");
        aiButton = document.getElementById("btn-overview-ai");
        aiOutput = document.getElementById("overview-ai-output");

        if (aiButton) {
            aiButton.addEventListener("click", onAIButtonClick);
        }

        log("[OverviewDashboard] init complete");
    }

    // -------- basic math helpers using existing SBI utilities --------
    function valueTo5Scale(row) {
        const s5 = Number(row.final_5scale);
        if (!isNaN(s5) && s5 > 0) return s5;
        const p = Number(row.final_percent);
        if (!isNaN(p) && p > 0) return p / 20; // rough 0–5 mapping
        return null;
    }

    function buildOverviewInsight(rows) {
        const totalRecords = rows.length;

        const allVals = rows
            .map(valueTo5Scale)
            .filter(function (v) { return v !== null; });

        const overallAverage = allVals.length ? window.SBI.mean(allVals) : null;

        // by term
        const byTerm = {};
        const groupedT = window.SBI.groupBy(rows, function (r) {
            return r.term || "";
        });

        Object.keys(groupedT).forEach(function (term) {
            const group = groupedT[term];
            const vals = group
                .map(valueTo5Scale)
                .filter(function (v) { return v !== null; });

            byTerm[term] = {
                count: group.length,
                average: vals.length ? window.SBI.mean(vals) : null,
                min: vals.length ? Math.min.apply(null, vals) : null,
                max: vals.length ? Math.max.apply(null, vals) : null
            };
        });

        // by class
        const byClass = {};
        const groupedC = window.SBI.groupBy(rows, function (r) {
            return String(r.class || r.class_name || "").trim();
        });

        Object.keys(groupedC).forEach(function (cls) {
            if (!cls) return;
            const group = groupedC[cls];
            const vals = group
                .map(valueTo5Scale)
                .filter(function (v) { return v !== null; });

            byClass[cls] = {
                count: group.length,
                average: vals.length ? window.SBI.mean(vals) : null
            };
        });

        return {
            dashboard: "overview",
            totalRecords: totalRecords,
            overallAverage: overallAverage,
            byTerm: byTerm,
            byClass: byClass
        };
    }

    // -------- chart renderers --------
    function renderByTerm(rows) {
        if (!chartByTermEl) return;

        if (!rows.length) {
            Plotly.newPlot(chartByTermEl, [], {
                title: "Нет данных для отображения по четвертям"
            });
            return;
        }

        const groupedT = window.SBI.groupBy(rows, function (r) {
            return r.term || "";
        });

        const terms = Object.keys(groupedT).sort(function (a, b) {
            return a.localeCompare(b, "ru", { numeric: true });
        });

        const avgVals = terms.map(function (term) {
            const group = groupedT[term];
            const vals = group
                .map(valueTo5Scale)
                .filter(function (v) { return v !== null; });
            return window.SBI.mean(vals);
        });

        const trace = {
            type: "bar",
            x: terms,
            y: avgVals,
            marker: { color: "#4a6cf7" }
        };

        const layout = {
            title: "Средний балл по четвертям (общешкольный)",
            xaxis: { title: "Четверть" },
            yaxis: { title: "Средний балл (5-балльная шкала)" },
            margin: { t: 40, l: 40, r: 10, b: 50 }
        };

        Plotly.newPlot(chartByTermEl, [trace], layout);
    }

    function renderByClass(rows) {
        if (!chartByClassEl) return;

        if (!rows.length) {
            Plotly.newPlot(chartByClassEl, [], {
                title: "Нет данных для отображения по классам"
            });
            return;
        }

        const groupedC = window.SBI.groupBy(rows, function (r) {
            return String(r.class || r.class_name || "").trim();
        });

        const classes = Object.keys(groupedC).filter(Boolean).sort();
        const averages = classes.map(function (cls) {
            const group = groupedC[cls];
            const vals = group
                .map(valueTo5Scale)
                .filter(function (v) { return v !== null; });
            return window.SBI.mean(vals);
        });

        const trace = {
            type: "bar",
            x: classes,
            y: averages,
            marker: { color: "#26a69a" }
        };

        const layout = {
            title: "Средний балл по классам (общешкольный)",
            xaxis: { title: "Класс" },
            yaxis: { title: "Средний балл (5-балльная шкала)" },
            margin: { t: 40, l: 40, r: 10, b: 80 }
        };

        Plotly.newPlot(chartByClassEl, [trace], layout);
    }

    // -------- AI integration --------
    function setAILoading(isLoading, msg) {
        if (aiButton) {
            aiButton.disabled = isLoading;
        }
        if (aiOutput && msg) {
            aiOutput.textContent = msg;
        }
    }

    async function onAIButtonClick() {
        if (!currentInsightData || !currentInsightData.totalRecords) {
            if (aiOutput) {
                aiOutput.textContent =
                    "Нет агрегированных данных для анализа. Проверьте, что успеваемость загружена.";
            }
            return;
        }

        try {
            setAILoading(true, "Подготовка AI-анализа…");

            const text = await window.SBI_LLM.interpret({
                context: "overview_dashboard",
                data: currentInsightData,
                temperature: 0.25,
                maxTokens: 700,
                onProgress: function (msg) {
                    if (aiOutput) {
                        aiOutput.textContent = msg;
                    }
                },
                userInstruction:
                    "Это общешкольный дашборд успеваемости.\n" +
                    "JSON содержит:\n" +
                    "- overallAverage: средний балл по школе,\n" +
                    "- byTerm: статистика по четвертям (count, average, min, max),\n" +
                    "- byClass: статистика по классам (count, average).\n\n" +
                    "Сделай интерпретацию:\n" +
                    "1) Опиши общий уровень успеваемости и стабильность по четвертям.\n" +
                    "2) Выдели классы и четверти со сравнительно высокими результатами.\n" +
                    "3) Отметь потенциальные зоны риска: классы/четверти с низким средним баллом или сильным падением.\n" +
                    "4) Предложи 3–5 практических рекомендаций администрации школы,\n" +
                    "   как использовать эти данные для планирования методической работы.\n" +
                    "Не придумывай конкретные проценты, которых нет в JSON, но можешь описывать тенденции."
            });

            if (aiOutput) {
                aiOutput.textContent = text;
            }
        } catch (err) {
            console.error("[OverviewDashboard] AI error", err);
            if (aiOutput) {
                aiOutput.textContent =
                    "Ошибка при выполнении AI-анализа. Попробуйте обновить страницу или перезапустить анализ.";
            }
        } finally {
            setAILoading(false);
        }
    }

    // -------- public lifecycle --------
    function onDataLoaded() {
        const rows = state.allRows || [];
        if (!rows.length) {
            log("[OverviewDashboard] onDataLoaded: нет данных allRows");
            if (aiOutput) {
                aiOutput.textContent =
                    "Пока нет данных для анализа. Загрузите успеваемость (например, из Excel).";
            }
            return;
        }

        log("[OverviewDashboard] onDataLoaded rows =", rows.length);

        renderByTerm(rows);
        renderByClass(rows);

        currentInsightData = buildOverviewInsight(rows);

        if (aiOutput) {
            aiOutput.textContent =
                "Нажмите кнопку ниже, чтобы получить AI-интерпретацию общешкольных данных.";
        }
    }

    // Initialize immediately (DOM is already ready because scripts are at bottom of body)
    init();

    return {
        onDataLoaded: onDataLoaded
    };
})();
