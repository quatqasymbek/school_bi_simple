// dashboard_overview.js
// Обзор школы: фильтры, KPI, таблица по классам/четвертям, донат и локальный ИИ

window.SBI_Overview = (function () {
    const SBI = window.SBI || {};
    const state = SBI.state || {};
    const log = SBI.log || console.log;

    // --- DOM elements ---
    let termSelect;
    let metricSelect;
    let kpiStudentsEl;
    let kpiTeachersEl;
    let gradeTableEl;
    let donutEl;
    let aiBtn;
    let aiOutput;

    // metric keys
    const METRIC_KNOWLEDGE = "knowledge_quality";
    const METRIC_AVG = "avg_mark";

    // for AI
    let currentInsightData = null;

    // ------------------ UTILITIES ------------------ //

    function ensureNumber(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    function valueTo5Scale(row) {
        // final_5scale уже есть; final_percent на всякий случай
        const s5 = ensureNumber(row.final_5scale);
        if (s5 != null && s5 > 0) return s5;

        const p = ensureNumber(row.final_percent);
        if (p != null && p > 0) {
            return p / 20; // 100 -> 5
        }
        return null;
    }

    function metricFromRows(rows, metric) {
        if (!rows || !rows.length) {
            return { value: null, count: 0 };
        }

        if (metric === METRIC_AVG) {
            const vals = rows
                .map(valueTo5Scale)
                .filter(v => v != null);
            const val = SBI.mean ? SBI.mean(vals) : (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
            return { value: val, count: vals.length };
        }

        // METRIC_KNOWLEDGE: доля оценок 4–5
        const kvals = rows
            .map(r => {
                if (r.knowledge_quality != null) {
                    const q = Number(r.knowledge_quality);
                    if (!Number.isNaN(q)) return q; // уже 0/1
                }
                const s5 = valueTo5Scale(r);
                if (s5 == null) return null;
                return (s5 >= 4) ? 1 : 0;
            })
            .filter(v => v != null);

        const m = SBI.mean ? SBI.mean(kvals) : (kvals.length ? kvals.reduce((a, b) => a + b, 0) / kvals.length : null);
        return { value: m, count: kvals.length };
    }

    function formatMetricValue(metric, val) {
        if (val == null) return "—";
        if (metric === METRIC_KNOWLEDGE) {
            return (val * 100).toFixed(1) + " %";
        }
        return val.toFixed(2);
    }

    function unique(arr) {
        return SBI.unique ? SBI.unique(arr) : Array.from(new Set(arr));
    }

    // ------------------ AGGREGATION ------------------ //

    function getFilteredRowsByTerm(termValue) {
        const rows = state.allRows || [];
        if (!rows.length) return [];
        if (!termValue || termValue === "ALL") return rows;
        return rows.filter(r => String(r.term || "").trim() === String(termValue).trim());
    }

    function buildGradeTermMatrix(metricKey) {
        const rows = state.allRows || [];
        if (!rows.length) {
            return { grades: [], terms: [], matrix: {} };
        }

        const terms = unique(rows.map(r => r.term)).sort((a, b) =>
            String(a).localeCompare(String(b), "ru", { numeric: true })
        );

        // если grade уже числовой в analyticRows
        const gradeNums = rows
            .map(r => ensureNumber(r.grade))
            .filter(v => v != null);
        const gradesUnique = Array.from(new Set(gradeNums)).sort((a, b) => a - b);

        const matrix = {}; // grade -> term -> {value,count}

        gradesUnique.forEach(g => {
            matrix[g] = {};
            terms.forEach(term => {
                const subset = rows.filter(r =>
                    ensureNumber(r.grade) === g &&
                    String(r.term || "").trim() === String(term).trim()
                );
                matrix[g][term] = metricFromRows(subset, metricKey);
            });
        });

        return {
            grades: gradesUnique,
            terms: terms,
            matrix: matrix
        };
    }

    function classifyStudentsForTerm(termValue) {
        const rows = getFilteredRowsByTerm(termValue);
        if (!rows.length) {
            return {
                otlichniki: 0,
                horoshisty: 0,
                troechniki: 0,
                dvoechniki: 0,
                totalStudents: 0
            };
        }

        const perStudent = {}; // id -> flags

        rows.forEach(r => {
            const sid = String(r.student_id || "").trim();
            if (!sid) return;
            const g = valueTo5Scale(r);
            if (g == null) return;

            if (!perStudent[sid]) {
                perStudent[sid] = {
                    has2: false,
                    has3: false,
                    has4: false,
                    has5: false
                };
            }
            const s = perStudent[sid];
            if (g <= 2.49) s.has2 = true;
            else if (g <= 3.49) s.has3 = true;
            else if (g <= 4.49) s.has4 = true;
            else s.has5 = true;
        });

        let otl = 0, hor = 0, tro = 0, dvo = 0;

        Object.values(perStudent).forEach(s => {
            if (s.has2) {
                dvo++;
            } else if (s.has3) {
                tro++;
            } else if (s.has4) {
                hor++;
            } else if (s.has5) {
                otl++;
            }
        });

        const totalStudents = Object.keys(perStudent).length;
        return {
            otlichniki: otl,
            horoshisty: hor,
            troechniki: tro,
            dvoechniki: dvo,
            totalStudents
        };
    }

    function buildInsightData(metricKey, termValue) {
        const allRows = state.allRows || [];
        const rowsTerm = getFilteredRowsByTerm(termValue);

        const allMetric = metricFromRows(allRows, metricKey);
        const termMetric = metricFromRows(rowsTerm, metricKey);

        const gradeMatrix = buildGradeTermMatrix(metricKey);
        const dist = classifyStudentsForTerm(termValue);

        const totalStudents = (state.students || []).length ||
            unique(allRows.map(r => r.student_id)).length;

        const totalTeachers = (state.allTeachers || state.teachers || []).length;

        return {
            dashboard: "overview",
            metric: metricKey,
            filterTerm: termValue || "ALL",
            totalStudents,
            totalTeachers,
            overallMetricAllTerms: {
                value: allMetric.value,
                count: allMetric.count
            },
            overallMetricCurrentTerm: {
                value: termMetric.value,
                count: termMetric.count
            },
            grades: gradeMatrix.grades,
            terms: gradeMatrix.terms,
            matrix: gradeMatrix.matrix,
            distribution: dist
        };
    }

    // ------------------ RENDERERS ------------------ //

    function renderKPIs(metricKey, termValue) {
        const allRows = state.allRows || [];
        const rowsTerm = getFilteredRowsByTerm(termValue);

        const totalStudents = (state.students || []).length ||
            unique(allRows.map(r => r.student_id)).length;
        const totalTeachers = (state.allTeachers || state.teachers || []).length;

        if (kpiStudentsEl) {
            kpiStudentsEl.textContent = totalStudents.toString();
        }
        if (kpiTeachersEl) {
            kpiTeachersEl.textContent = totalTeachers.toString();
        }

        const mAll = metricFromRows(allRows, metricKey);
        const mTerm = metricFromRows(rowsTerm, metricKey);

        const container = document.getElementById("overview-summary");
        if (container) {
            const metricName = (metricKey === METRIC_KNOWLEDGE)
                ? "Качество знаний"
                : "Средняя оценка";

            container.innerHTML = `
                <p><strong>${metricName} по школе (все четверти):</strong> ${formatMetricValue(metricKey, mAll.value)}</p>
                <p><strong>${metricName} по выбранной четверти:</strong> ${formatMetricValue(metricKey, mTerm.value)}</p>
            `;
        }
    }

    function renderGradeTermTable(metricKey) {
        if (!gradeTableEl) return;

        const { grades, terms, matrix } = buildGradeTermMatrix(metricKey);

        if (!grades.length || !terms.length) {
            gradeTableEl.innerHTML = "<p>Недостаточно данных для построения таблицы.</p>";
            return;
        }

        let html = "<table class='overview-grade-table' style='border-collapse:collapse;width:100%;font-size:13px;'>";
        html += "<thead><tr>";
        html += "<th style='border:1px solid #ddd;padding:4px 6px;text-align:center;'>Класс</th>";

        terms.forEach(term => {
            html += `<th style='border:1px solid #ddd;padding:4px 6px;text-align:center;'>${term}</th>`;
        });

        html += "</tr></thead><tbody>";

        grades.forEach(g => {
            html += "<tr>";
            html += `<td style='border:1px solid #ddd;padding:4px 6px;text-align:center;'>${g}</td>`;
            terms.forEach(term => {
                const cell = matrix[g][term];
                const v = cell ? cell.value : null;
                html += `<td style='border:1px solid #ddd;padding:4px 6px;text-align:center;'>${formatMetricValue(metricKey, v)}</td>`;
            });
            html += "</tr>";
        });

        html += "</tbody></table>";

        gradeTableEl.innerHTML = html;
    }

    function renderDonut(termValue) {
        if (!donutEl || typeof Plotly === "undefined") return;

        const dist = classifyStudentsForTerm(termValue);
        const total = dist.totalStudents;

        if (!total) {
            Plotly.newPlot(donutEl, [], {
                title: "Недостаточно данных для построения диаграммы"
            });
            return;
        }

        const labels = ["Отличники", "Хорошисты", "Троечники", "Двоечники"];
        const values = [
            dist.otlichniki,
            dist.horoshisty,
            dist.troechniki,
            dist.dvoechniki
        ];

        const colors = ["#2e7d32", "#1976d2", "#ffb300", "#e53935"];

        const data = [{
            type: "pie",
            labels: labels,
            values: values,
            hole: 0.5,
            marker: { colors: colors },
            textinfo: "label+percent",
            insidetextorientation: "radial"
        }];

        const layout = {
            title: "Структура успеваемости по выбранной четверти",
            margin: { t: 40, l: 10, r: 10, b: 10 },
            showlegend: true
        };

        Plotly.newPlot(donutEl, data, layout);
    }

    // ------------------ AI HANDLER ------------------ //

    function setAILoading(isLoading, msg) {
        if (aiBtn) aiBtn.disabled = isLoading;
        if (aiOutput && msg) aiOutput.textContent = msg;
    }

    async function onAIButtonClick() {
        if (!currentInsightData) {
            if (aiOutput) {
                aiOutput.textContent = "Нет агрегированных данных для анализа. Сначала загрузите Excel-файл.";
            }
            return;
        }

        if (!window.SBI_LLM || typeof window.SBI_LLM.interpret !== "function") {
            if (aiOutput) {
                aiOutput.textContent =
                    "Локальный ИИ не инициализирован. Убедитесь, что файл llm_cpu.js подключён перед dashboard_overview.js.";
            }
            return;
        }

        try {
            setAILoading(true, "Подготовка AI-анализа…");

            const metricKey = metricSelect ? metricSelect.value : METRIC_KNOWLEDGE;

            const text = await window.SBI_LLM.interpret({
                context: "overview_dashboard",
                data: currentInsightData,
                temperature: 0.25,
                maxTokens: 850,
                onProgress: function (msg) {
                    if (aiOutput) aiOutput.textContent = msg;
                },
                userInstruction:
                    "Это общешкольный обзор успеваемости.\n" +
                    "JSON содержит:\n" +
                    "- metric: тип метрики (knowledge_quality или avg_mark),\n" +
                    "- totalStudents, totalTeachers,\n" +
                    "- overallMetricAllTerms и overallMetricCurrentTerm,\n" +
                    "- матрицу по классам и четвертям,\n" +
                    "- распределение учеников (отличники, хорошисты, троечники, двоечники) по выбранной четверти.\n\n" +
                    "Сделай интерпретацию:\n" +
                    "1) Опиши общий уровень успеваемости и динамику.\n" +
                    "2) Выдели сильные классы/параллели и четверти.\n" +
                    "3) Укажи возможные зоны риска.\n" +
                    "4) Дай 3–5 практических рекомендаций администрации и учителям.\n" +
                    "Не придумывай новые числа, которых нет в JSON, но можно описывать тенденции."
            });

            if (aiOutput) {
                aiOutput.textContent = text;
            }
        } catch (err) {
            console.error("[OverviewDashboard] AI error:", err);
            if (aiOutput) {
                aiOutput.textContent =
                    "Ошибка при AI-анализе. Попробуйте ещё раз или обновите страницу.";
            }
        } finally {
            setAILoading(false);
        }
    }

    // ------------------ UPDATE FLOW ------------------ //

    function update() {
        const metricKey = metricSelect ? metricSelect.value : METRIC_KNOWLEDGE;
        const termValue = termSelect ? termSelect.value : "ALL";

        renderKPIs(metricKey, termValue);
        renderGradeTermTable(metricKey);
        renderDonut(termValue);

        // подготовим данные для AI
        currentInsightData = buildInsightData(metricKey, termValue);

        if (aiOutput && !aiOutput.textContent) {
            aiOutput.textContent = "Локальный ИИ пока не инициализирован. Нажмите кнопку, чтобы запустить анализ.";
        }
    }

    // ------------------ INIT & PUBLIC API ------------------ //

    function initDom() {
        termSelect = document.getElementById("overview-term-select");
        metricSelect = document.getElementById("overview-metric-select");
        kpiStudentsEl = document.getElementById("overview-kpi-students");
        kpiTeachersEl = document.getElementById("overview-kpi-teachers");
        gradeTableEl = document.getElementById("overview-grade-table");
        donutEl = document.getElementById("overview-donut");
        aiBtn = document.getElementById("btn-overview-ai");
        aiOutput = document.getElementById("overview-ai-output");

        if (metricSelect) {
            // если разметка уже содержит options — оставляем их
            if (!metricSelect.options.length) {
                const opt1 = document.createElement("option");
                opt1.value = METRIC_KNOWLEDGE;
                opt1.textContent = "Качество знаний";
                metricSelect.appendChild(opt1);

                const opt2 = document.createElement("option");
                opt2.value = METRIC_AVG;
                opt2.textContent = "Средняя оценка";
                metricSelect.appendChild(opt2);
            }
            metricSelect.addEventListener("change", update);
        }

        if (aiBtn) {
            aiBtn.addEventListener("click", onAIButtonClick);
        }

        log("[OverviewDashboard] init complete");
    }

    function populateTermSelect() {
        if (!termSelect) return;

        const terms = state.allTerms || [];
        termSelect.innerHTML = "";

        const optAll = document.createElement("option");
        optAll.value = "ALL";
        optAll.textContent = "Все четверти";
        termSelect.appendChild(optAll);

        terms.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = t;
            termSelect.appendChild(opt);
        });

        termSelect.value = "ALL";
        termSelect.addEventListener("change", update);
    }

    function onDataLoaded() {
        initDom();

        const rows = state.allRows || [];
        if (!rows.length) {
            log("[OverviewDashboard] onDataLoaded: нет данных allRows");
            const root = document.getElementById("overview-summary");
            if (root) {
                root.textContent = "Данные ещё не загружены.";
            }
            return;
        }

        populateTermSelect();
        update();
    }

    // инициализация DOM сразу, если страница уже готова
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initDom);
    } else {
        initDom();
    }

    return {
        onDataLoaded: onDataLoaded
    };
})();
