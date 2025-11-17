// dashboard_subject.js
console.log("dashboard_subject.js загружен");

window.SBI_Subject = (function () {
    const state = SBI.state;

    let subjectSelect, termSelect;
    let chartClass, chartDist, chartTrend, chartHeatmap;

    function init() {
        subjectSelect = document.getElementById("subjectSubjectSelect");
        termSelect    = document.getElementById("subjectTermSelect");

        chartClass    = document.getElementById("chart-subject-class");
        chartDist     = document.getElementById("chart-subject-dist");
        chartTrend    = document.getElementById("chart-subject-trend");
        chartHeatmap  = document.getElementById("chart-subject-heatmap");

        if (subjectSelect) subjectSelect.onchange = update;
        if (termSelect)    termSelect.onchange    = update;
    }

    function populateFilters() {
        const rows = state.allRows || [];
        if (!rows.length) return;

        if (subjectSelect) {
            subjectSelect.innerHTML = "";
            const optAll = document.createElement("option");
            optAll.value = "";
            optAll.textContent = "Все предметы";
            subjectSelect.appendChild(optAll);
            (state.allSubjects || []).forEach(function (s) {
                const opt = document.createElement("option");
                opt.value = s;
                opt.textContent = s;
                subjectSelect.appendChild(opt);
            });
        }

        if (termSelect) {
            termSelect.innerHTML = "";
            const optAll = document.createElement("option");
            optAll.value = "";
            optAll.textContent = "Все четверти";
            termSelect.appendChild(optAll);
            (state.allTerms || []).forEach(function (t) {
                const opt = document.createElement("option");
                opt.value = t;
                opt.textContent = t;
                termSelect.appendChild(opt);
            });
        }
    }

    function filterRows() {
        const rows = state.allRows || [];
        if (!rows.length) return [];

        const subjectVal = subjectSelect ? subjectSelect.value : "";
        const termVal    = termSelect ? termSelect.value : "";

        return rows.filter(function (r) {
            if (subjectVal && r.subject !== subjectVal) return false;
            if (termVal && r.term !== termVal) return false;
            return true;
        });
    }

    function renderByClass(filtered) {
        if (!chartClass) return;

        if (!filtered.length) {
            Plotly.newPlot(chartClass, [], {
                title: "Нет данных для выбранных фильтров",
                xaxis: { title: "Класс" },
                yaxis: { title: "Средний балл" }
            });
            return;
        }

        const grouped = SBI.groupBy(filtered, function (r) { return r.class; }, function (r) { return r; });

        const classes = [];
        const avg = [];
        const quality = [];

        Object.keys(grouped).forEach(function (cls) {
            const rows = grouped[cls];
            classes.push(cls);
            avg.push(SBI.mean(rows.map(function (r) {
                return Number(r.final_percent ?? r.final_5scale ?? NaN);
            }).filter(function (v) { return !Number.isNaN(v); })));
            quality.push(SBI.knowledgeRatio(rows) || 0);
        });

        Plotly.newPlot(chartClass, [{
            x: classes,
            y: avg,
            type: "bar",
            customdata: quality,
            hovertemplate:
                "Класс: %{x}<br>" +
                "Средний балл: %{y:.2f}<br>" +
                "Качество знаний: %{customdata:.0%}<extra></extra>"
        }], {
            title: "Средний балл по классам (для выбранного предмета)",
            xaxis: { title: "Класс" },
            yaxis: { title: "Средний балл" }
        });
    }

    function renderDistribution(filtered) {
        if (!chartDist) return;

        if (!filtered.length) {
            Plotly.newPlot(chartDist, [], {
                title: "Нет данных для распределения",
                xaxis: { title: "Итоговая оценка" },
                yaxis: { title: "Количество" }
            });
            return;
        }

        const values = filtered.map(function (r) {
            return Number(r.final_percent ?? r.final_5scale ?? NaN);
        }).filter(function (v) { return !Number.isNaN(v); });

        Plotly.newPlot(chartDist, [{
            x: values,
            type: "histogram",
            nbinsx: 20
        }], {
            title: "Распределение оценок по выбранному предмету",
            xaxis: { title: "Процент / балл" },
            yaxis: { title: "Количество" }
        });
    }

    function renderTrend() {
        if (!chartTrend) return;

        const subjectVal = subjectSelect ? subjectSelect.value : "";
        if (!subjectVal) {
            Plotly.newPlot(chartTrend, [], {
                title: "Выберите предмет для просмотра динамики",
                xaxis: { title: "Четверть" },
                yaxis: { title: "Средний балл" }
            });
            return;
        }

        const rows = (state.allRows || []).filter(function (r) {
            return r.subject === subjectVal;
        });

        const byTerm = SBI.groupBy(rows, function (r) { return r.term; }, function (r) {
            return Number(r.final_percent ?? r.final_5scale ?? NaN);
        });

        const terms = (state.allTerms || []).slice();
        const avg = terms.map(function (t) {
            return SBI.mean(byTerm[t] || []);
        });

        Plotly.newPlot(chartTrend, [{
            x: terms,
            y: avg,
            mode: "lines+markers"
        }], {
            title: "Динамика по предмету: " + subjectVal,
            xaxis: { title: "Четверть" },
            yaxis: { title: "Средний балл" }
        });
    }

    function renderHeatmap() {
        if (!chartHeatmap) return;

        const rows = state.allRows || [];
        if (!rows.length) {
            Plotly.newPlot(chartHeatmap, [], {
                title: "Нет данных для отображения",
                xaxis: { title: "Четверть" },
                yaxis: { title: "Предмет" }
            });
            return;
        }

        const terms = state.allTerms || [];
        const subjects = state.allSubjects || [];

        const z = [];
        for (let si = 0; si < subjects.length; si++) {
            const subj = subjects[si];
            const rowZ = [];
            for (let ti = 0; ti < terms.length; ti++) {
                const t = terms[ti];
                const subset = rows.filter(function (r) {
                    return r.subject === subj && r.term === t;
                });
                const avg = SBI.mean(subset.map(function (r) {
                    return Number(r.final_percent ?? r.final_5scale ?? NaN);
                }).filter(function (v) { return !Number.isNaN(v); }));
                rowZ.push(avg != null ? avg : null);
            }
            z.push(rowZ);
        }

        Plotly.newPlot(chartHeatmap, [{
            z: z,
            x: terms,
            y: subjects,
            type: "heatmap",
            colorscale: "RdYlGn"
        }], {
            title: "Средний балл по предметам и четвертям",
            xaxis: { title: "Четверть" },
            yaxis: { title: "Предмет" }
        });
    }

    function update() {
        const filtered = filterRows();
        SBI.log("По предметам → отфильтровано строк: " + filtered.length);
        renderByClass(filtered);
        renderDistribution(filtered);
        renderTrend();
        renderHeatmap();
    }

    function onDataLoaded() {
        const rows = state.allRows || [];
        if (!rows.length) {
            SBI.log("Дашборд по предметам: нет данных.");
            return;
        }
        populateFilters();
        update();
    }

    init();

    return {
        onDataLoaded: onDataLoaded
    };
})();
