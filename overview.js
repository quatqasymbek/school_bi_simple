// overview.js
console.log("overview.js загружен");

window.SBI_Overview = (function () {
    const state = SBI.state;

    let termSelect;
    let metricSelect;
    let cardsEl;
    let gradeBarEl;
    let heatmapEl;
    let pieEl;

    function init() {
        termSelect   = document.getElementById("overviewTermSelect");
        metricSelect = document.getElementById("overviewMetricSelect");
        cardsEl      = document.getElementById("overview-cards");
        gradeBarEl   = document.getElementById("chart-overview-grade-bar");
        heatmapEl    = document.getElementById("chart-overview-quality-heatmap");
        pieEl        = document.getElementById("chart-overview-categories");

        if (termSelect)   termSelect.onchange   = renderAll;
        if (metricSelect) metricSelect.onchange = renderAll;
    }

    function getRowsForTerm(term) {
        const rows = state.allRows || [];
        if (!term) return rows;
        return rows.filter(r => r.term === term);
    }

    // категоризация учеников по четверти
    function computeStudentCategories(rowsForTerm) {
        const byStudent = SBI.groupBy(
            rowsForTerm,
            r => r.student_id,
            r => Number(r.final_5scale)
        );

        let countA = 0; // отличники
        let countB = 0; // хорошисты
        let countC = 0; // троечники

        Object.keys(byStudent).forEach(key => {
            const grades = byStudent[key].filter(g => !Number.isNaN(g));
            if (!grades.length) return;

            const has2 = grades.some(g => g === 2);
            const has3 = grades.some(g => g === 3);
            const has4 = grades.some(g => g === 4);
            const has5 = grades.some(g => g === 5);
            const all5 = grades.every(g => g === 5);

            if (all5) {
                countA++;
            } else if (!has2 && !has3 && (has4 || has5)) {
                // хорошие: есть 4/5, но нет 3–2 и не все 5
                countB++;
            } else if (has3) {
                // троечники: есть хотя бы одна 3
                countC++;
            }
        });

        return { countA, countB, countC };
    }

    function renderCards() {
        if (!cardsEl) return;

        const defaultTerm = state.allTerms.length ? state.allTerms[0] : null;
        const term = termSelect && termSelect.value ? termSelect.value : defaultTerm;
        const metric = metricSelect ? metricSelect.value : "quality";

        const rowsTerm = getRowsForTerm(term);

        const uniqueStudents = SBI.unique(rowsTerm.map(r => r.student_id)).length;

        // учителей считаем из назначений за выбранную четверть
        const assignments = state.assignments || state.teacherAssignments || [];
        const teacherIds = SBI.unique(
            assignments
                .filter(a => String(a.term_id || "").trim() === String(term).trim())
                .map(a => a.teacher_id)
        );
        const uniqueTeachers = teacherIds.length || (state.allTeachers || []).length;

        let metricLabel;
        let metricValue;
        let metricSub;

        if (metric === "quality") {
            const q = SBI.knowledgeRatio(rowsTerm);
            metricLabel = "Качество знаний";
            metricValue = q != null ? Math.round(q * 100) + "%" : "—";
            metricSub   = "Доля оценок 4–5 за выбранную четверть";
        } else {
            const vals = rowsTerm.map(r =>
                Number(r.final_5scale)
            ).filter(v => !Number.isNaN(v));
            const m = SBI.mean(vals);
            metricLabel = "Средний балл";
            metricValue = m != null ? m.toFixed(2) + " из 5" : "—";
            metricSub   = "Средний итоговый балл по 5-балльной шкале";
        }

        cardsEl.innerHTML = `
            <div class="overview-card">
                <div class="overview-card-title">Учащиеся (в четверти ${term})</div>
                <div class="overview-card-value">${uniqueStudents}</div>
            </div>
            <div class="overview-card">
                <div class="overview-card-title">Учителя (в четверти ${term})</div>
                <div class="overview-card-value">${uniqueTeachers}</div>
            </div>
            <div class="overview-card">
                <div class="overview-card-title">${metricLabel} (школа, ${term})</div>
                <div class="overview-card-value">${metricValue}</div>
                <div class="overview-card-sub">${metricSub}</div>
            </div>
        `;
    }

    function renderGradeBar() {
        if (!gradeBarEl) return;

        const defaultTerm = state.allTerms.length ? state.allTerms[0] : null;
        const term = termSelect && termSelect.value ? termSelect.value : defaultTerm;
        const metric = metricSelect ? metricSelect.value : "quality";

        const rowsTerm = getRowsForTerm(term);

        const byGrade = SBI.groupBy(
            rowsTerm.filter(r => r.grade != null),
            r => r.grade,
            r => r
        );

        const grades = Object.keys(byGrade)
            .map(g => Number(g))
            .filter(g => !Number.isNaN(g))
            .sort((a, b) => a - b);

        const x = [];
        const y = [];

        grades.forEach(g => {
            const list = byGrade[g];

            if (metric === "quality") {
                const q = SBI.knowledgeRatio(list);
                x.push(g + " класс");
                y.push(q != null ? Math.round(q * 100) : null);
            } else {
                const vals = list.map(r =>
                    Number(r.final_5scale)
                ).filter(v => !Number.isNaN(v));
                const m = SBI.mean(vals);
                x.push(g + " класс");
                y.push(m != null ? m : null);
            }
        });

        const title = metric === "quality"
            ? "Качество знаний по классам (1–11) за четверть " + term
            : "Средний балл по классам (1–11) за четверть " + term;

        const yTitle = metric === "quality" ? "% 4–5" : "Средний балл (1–5)";

        Plotly.newPlot(gradeBarEl, [{
            x,
            y,
            type: "bar",
            text: metric === "quality"
                ? y.map(v => (v != null ? v.toFixed(1) + "%" : ""))
                : y.map(v => (v != null ? v.toFixed(2) : "")),
            textposition: "auto"
        }], {
            title,
            xaxis: { title: "Класс" },
            yaxis: { title: yTitle }
        });
    }

    function renderHeatmap() {
        if (!heatmapEl) return;
        const rows = state.allRows || [];
        if (!rows.length) return;

        const terms = state.allTerms || [];
        const grades = SBI.unique(
            rows.map(r => r.grade).filter(g => g != null)
        ).sort((a, b) => a - b);

        const z = [];
        const yLabels = grades.map(g => g + " класс");

        grades.forEach(g => {
            const rowZ = [];
            terms.forEach(t => {
                const subset = rows.filter(r => r.grade === g && r.term === t);
                const q = SBI.knowledgeRatio(subset);
                rowZ.push(q != null ? Math.round(q * 100) : null);
            });
            z.push(rowZ);
        });

        Plotly.newPlot(heatmapEl, [{
            z,
            x: terms,
            y: yLabels,
            type: "heatmap",
            colorscale: "YlGn",
            colorbar: { title: "% 4–5" }
        }], {
            title: "Качество знаний по четвертям и классам (1–11)",
            xaxis: { title: "Четверть" },
            yaxis: { title: "Класс" },
            margin: { l: 80, r: 20, t: 40, b: 40 }
        });
    }

    function renderPie() {
        if (!pieEl) return;

        const defaultTerm = state.allTerms.length ? state.allTerms[0] : null;
        const term = termSelect && termSelect.value ? termSelect.value : defaultTerm;
        const rowsTerm = getRowsForTerm(term);

        const { countA, countB, countC } = computeStudentCategories(rowsTerm);

        const labels = [
            "Отличники (только 5)",
            "Хорошисты (4–5, без 2–3)",
            "Троечники (есть 3)"
        ];
        const values = [countA, countB, countC];

        Plotly.newPlot(pieEl, [{
            labels,
            values,
            type: "pie",
            textinfo: "label+percent",
            hole: 0.35
        }], {
            title: "Структура успеваемости за четверть " + term,
            legend: { orientation: "h", y: -0.1 }
        });
    }

    function renderAll() {
        const rows = state.allRows || [];
        if (!rows.length) return;

        renderCards();
        renderGradeBar();
        renderHeatmap();
        renderPie();
    }

    function onDataLoaded() {
        const rows = state.allRows || [];
        if (!rows.length) {
            SBI.log("Обзор: нет данных.");
            return;
        }

        // заполнение селектора четвертей
        if (termSelect) {
            termSelect.innerHTML = "";
            (state.allTerms || []).forEach(t => {
                const opt = document.createElement("option");
                opt.value = t;
                opt.textContent = t;
                termSelect.appendChild(opt);
            });
            if (state.allTerms.length) {
                // по умолчанию последняя четверть
                termSelect.value = state.allTerms[state.allTerms.length - 1];
            }
        }

        renderAll();
    }

    init();

    return {
        onDataLoaded
    };
})();
