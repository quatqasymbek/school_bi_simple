// dashboard_class.js
console.log("dashboard_class.js загружен");

window.SBI_Class = (function () {
    const state = SBI.state;

    let termSelect, subjectSelect, classSelect;
    let chartAvg, chartDist, chartTrend, chartHeatmap;

    function init() {
        termSelect    = document.getElementById("classTermSelect");
        subjectSelect = document.getElementById("classSubjectSelect");
        classSelect   = document.getElementById("classClassSelect");

        chartAvg      = document.getElementById("chart-class-avg");
        chartDist     = document.getElementById("chart-class-dist");
        chartTrend    = document.getElementById("chart-class-trend");
        chartHeatmap  = document.getElementById("chart-class-heatmap");

        if (termSelect)    termSelect.onchange    = update;
        if (subjectSelect) subjectSelect.onchange = update;
        if (classSelect)   classSelect.onchange   = update;
    }

    function populateFilters() {
        const rows = state.allRows || [];
        if (!rows.length) return;

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

        if (classSelect) {
            classSelect.innerHTML = "";
            const optAll = document.createElement("option");
            optAll.value = "";
            optAll.textContent = "Все классы";
            classSelect.appendChild(optAll);
            (state.allClasses || []).forEach(function (c) {
                const opt = document.createElement("option");
                opt.value = c;
                opt.textContent = c;
                classSelect.appendChild(opt);
            });
        }
    }

    function filterRows() {
        const rows = state.allRows || [];
        if (!rows.length) return [];

        const termVal    = termSelect ? termSelect.value : "";
        const subjectVal = subjectSelect ? subjectSelect.value : "";
        const classVal   = classSelect ? classSelect.value : "";

        return rows.filter(function (r) {
            if (termVal && r.term !== termVal) return false;
            if (subjectVal && r.subject !== subjectVal) return false;
            if (classVal && r.class !== classVal) return false;
            return true;
        });
    }

    function computeClassStats(rowsForRanking) {
        const grouped = SBI.groupBy(rowsForRanking, function (r) { return r.class; }, function (r) { return r; });

        const stats = Object.keys(grouped).map(function (cls) {
            const clsRows = grouped[cls];
            const grades = clsRows.map(function (r) {
                return Number(r.final_percent ?? r.final_5scale ?? NaN);
            }).filter(function (v) { return !Number.isNaN(v); });

            const avg = SBI.mean(grades);
            const std = SBI.std(grades);
            const n   = clsRows.length;
            const quality = SBI.knowledgeRatio(clsRows);

            return { class: cls, avg: avg, std: std, n: n, quality: quality };
        }).filter(function (s) {
            return s.avg != null;
        }).sort(function (a, b) {
            return b.avg - a.avg;
        });

        return stats;
    }

    function renderClassRanking(allFilteredRows) {
        if (!chartAvg) return;

        // Для рейтинга классов не ограничиваем выбранным "классом"
        const termVal    = termSelect ? termSelect.value : "";
        const subjectVal = subjectSelect ? subjectSelect.value : "";

        const rows = (state.allRows || []).filter(function (r) {
            if (termVal && r.term !== termVal) return false;
            if (subjectVal && r.subject !== subjectVal) return false;
            return true;
        });

        const stats = computeClassStats(rows);
        SBI.log("По классам → строк для рейтинга: " + rows.length + ", классов: " + stats.length);

        if (!stats.length) {
            Plotly.newPlot(chartAvg, [], {
                title: "Нет данных для выбранных фильтров",
                xaxis: { title: "Класс" },
                yaxis: { title: "Средний балл" }
            });
            return;
        }

        const x = stats.map(function (s) { return s.class; });
        const y = stats.map(function (s) { return s.avg; });
        const q = stats.map(function (s) { return s.quality != null ? s.quality : 0; });
        const n = stats.map(function (s) { return s.n; });

        Plotly.newPlot(chartAvg, [{
            x: x,
            y: y,
            type: "bar",
            customdata: q,
            text: n,
            hovertemplate:
                "Класс: %{x}<br>" +
                "Средний балл: %{y:.2f}<br>" +
                "Качество знаний: %{customdata:.0%}<br>" +
                "Количество записей: %{text}<extra></extra>"
        }], {
            title: "Рейтинг классов по среднему баллу",
            xaxis: { title: "Класс" },
            yaxis: { title: "Средний балл", rangemode: "tozero" },
            margin: { l: 50, r: 10, t: 40, b: 60 }
        });
    }

    function renderDistribution(filteredRows) {
        if (!chartDist) return;

        if (!filteredRows.length) {
            Plotly.newPlot(chartDist, [], {
                title: "Нет данных для распределения оценок",
                xaxis: { title: "Итоговая оценка" },
                yaxis: { title: "Количество" }
            });
            return;
        }

        const values = filteredRows.map(function (r) {
            return Number(r.final_percent ?? r.final_5scale ?? NaN);
        }).filter(function (v) { return !Number.isNaN(v); });

        Plotly.newPlot(chartDist, [{
            x: values,
            type: "histogram",
            nbinsx: 20
        }], {
            title: "Распределение итоговых оценок (после фильтров)",
            xaxis: { title: "Процент / балл" },
            yaxis: { title: "Количество" }
        });
    }

    function renderTrend(filteredRows) {
        if (!chartTrend) return;

        const cls = classSelect ? classSelect.value : "";
        if (!cls) {
            Plotly.newPlot(chartTrend, [], {
                title: "Выберите конкретный класс, чтобы увидеть его динамику",
                xaxis: { title: "Четверть" },
                yaxis: { title: "Средний балл" }
            });
            return;
        }

        const rows = (state.allRows || []).filter(function (r) {
            if (r.class !== cls) return false;
            const subjectVal = subjectSelect ? subjectSelect.value : "";
            if (subjectVal && r.subject !== subjectVal) return false;
            return true;
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
            title: "Динамика по классу " + cls,
            xaxis: { title: "Четверть" },
            yaxis: { title: "Средний балл" }
        });
    }

    function renderHeatmap() {
        if (!chartHeatmap) return;

        const termVal    = termSelect ? termSelect.value : "";
        const subjectVal = subjectSelect ? subjectSelect.value : "";

        const rows = (state.allRows || []).filter(function (r) {
            if (termVal && r.term !== termVal) return false;
            if (subjectVal && r.subject !== subjectVal) return false;
            return true;
        });

        const classes = SBI.unique(rows.map(function (r) { return r.class; })).sort();
        const terms = SBI.unique(rows.map(function (r) { return r.term; })).sort();

        const z = [];
        for (let ci = 0; ci < classes.length; ci++) {
            const cls = classes[ci];
            const rowZ = [];
            for (let ti = 0; ti < terms.length; ti++) {
                const t = terms[ti];
                const sub = rows.filter(function (r) {
                    return r.class === cls && r.term === t;
                });
                const avg = SBI.mean(sub.map(function (r) {
                    return Number(r.final_percent ?? r.final_5scale ?? NaN);
                }).filter(function (v) { return !Number.isNaN(v); }));
                rowZ.push(avg != null ? avg : null);
            }
            z.push(rowZ);
        }

        Plotly.newPlot(chartHeatmap, [{
            z: z,
            x: terms,
            y: classes,
            type: "heatmap",
            colorscale: "Blues"
        }], {
            title: "Тепловая карта: средний балл по классам и четвертям",
            xaxis: { title: "Четверть" },
            yaxis: { title: "Класс" }
        });
    }

    function update() {
        const filtered = filterRows();
        renderClassRanking(filtered);
        renderDistribution(filtered);
        renderTrend(filtered);
        renderHeatmap();
    }

    function onDataLoaded() {
        const rows = state.allRows || [];
        if (!rows.length) {
            SBI.log("Дашборд по классам: данных нет.");
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
