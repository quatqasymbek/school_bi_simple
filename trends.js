// trends.js
console.log("trends.js загружен");

window.SBI_Trends = (function () {
    const state = SBI.state;

    let chartSchool, chartClass, chartSubject;

    function init() {
        chartSchool  = document.getElementById("chart-trend-school");
        chartClass   = document.getElementById("chart-trend-class");
        chartSubject = document.getElementById("chart-trend-subject");
    }

    function renderSchoolTrend() {
        if (!chartSchool) return;
        const rows = state.allRows || [];
        if (!rows.length) {
            Plotly.newPlot(chartSchool, [], {
                title: "Нет данных по школе",
                xaxis: { title: "Четверть" },
                yaxis: { title: "Средний балл" }
            });
            return;
        }

        const byTerm = SBI.groupBy(rows, function (r) { return r.term; }, function (r) {
            return Number(r.final_percent ?? r.final_5scale ?? NaN);
        });

        const terms = state.allTerms || [];
        const avg = terms.map(function (t) {
            return SBI.mean(byTerm[t] || []);
        });

        Plotly.newPlot(chartSchool, [{
            x: terms,
            y: avg,
            mode: "lines+markers"
        }], {
            title: "Средний балл по школе (по четвертям)",
            xaxis: { title: "Четверть" },
            yaxis: { title: "Средний балл" }
        });
    }

    function renderClassHeatmap() {
        if (!chartClass) return;
        const rows = state.allRows || [];
        if (!rows.length) return;

        const classes = state.allClasses || [];
        const terms = state.allTerms || [];

        const z = [];
        classes.forEach(function (cls) {
            const rowZ = [];
            terms.forEach(function (t) {
                const subset = rows.filter(function (r) {
                    return r.class === cls && r.term === t;
                });
                const avg = SBI.mean(subset.map(function (r) {
                    return Number(r.final_percent ?? r.final_5scale ?? NaN);
                }).filter(function (v) { return !Number.isNaN(v); }));
                rowZ.push(avg != null ? avg : null);
            });
            z.push(rowZ);
        });

        Plotly.newPlot(chartClass, [{
            z: z,
            x: terms,
            y: classes,
            type: "heatmap",
            colorscale: "Blues"
        }], {
            title: "Средний балл по классам и четвертям",
            xaxis: { title: "Четверть" },
            yaxis: { title: "Класс" }
        });
    }

    function renderSubjectHeatmap() {
        if (!chartSubject) return;
        const rows = state.allRows || [];
        if (!rows.length) return;

        const subjects = state.allSubjects || [];
        const terms = state.allTerms || [];

        const z = [];
        subjects.forEach(function (subj) {
            const rowZ = [];
            terms.forEach(function (t) {
                const subset = rows.filter(function (r) {
                    return r.subject === subj && r.term === t;
                });
                const avg = SBI.mean(subset.map(function (r) {
                    return Number(r.final_percent ?? r.final_5scale ?? NaN);
                }).filter(function (v) { return !Number.isNaN(v); }));
                rowZ.push(avg != null ? avg : null);
            });
            z.push(rowZ);
        });

        Plotly.newPlot(chartSubject, [{
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

    function onDataLoaded() {
        const rows = state.allRows || [];
        if (!rows.length) {
            SBI.log("Дашборд трендов: нет данных.");
            return;
        }
        renderSchoolTrend();
        renderClassHeatmap();
        renderSubjectHeatmap();
    }

    init();

    return {
        onDataLoaded: onDataLoaded
    };
})();
