// trends.js
window.SBI_Trends = (function () {
    const state = SBI.state;

    let chartClass, chartSubject, chartSchool;

    function init() {
        chartClass = document.getElementById("chart-trend-class");
        chartSubject = document.getElementById("chart-trend-subject");
        chartSchool = document.getElementById("chart-trend-school");
    }

    function computeSchoolTrend() {
        const rows = state.allRows;
        const terms = state.allTerms;

        const byTerm = SBI.groupBy(
            rows,
            r => r.term,
            r => Number(r.final_percent ?? r.final_5scale ?? NaN)
        );

        return terms.map(t => ({
            term: t,
            avg: SBI.mean(byTerm[t] || [])
        }));
    }

    function renderSchoolTrend() {
        if (!chartSchool) return;

        const trend = computeSchoolTrend();
        const valid = trend.filter(p => p.avg !== null);

        if (!valid.length) {
            Plotly.newPlot(chartSchool, [], {
                title: "No data for school trend",
                xaxis: { title: "Term" },
                yaxis: { title: "Average grade" }
            });
            return;
        }

        Plotly.newPlot(chartSchool, [{
            x: trend.map(p => p.term),
            y: trend.map(p => p.avg),
            mode: "lines+markers"
        }], {
            title: "School-wide average grade by term",
            xaxis: { title: "Term" },
            yaxis: { title: "Average grade" }
        });
    }

    function renderClassTrendHeatmap() {
        if (!chartClass) return;

        const rows = state.allRows;
        const terms = state.allTerms;
        const classes = state.allClasses;

        const matrix = classes.map(cls => {
            return terms.map(term => {
                const vals = rows
                    .filter(r => r.class === cls && r.term === term)
                    .map(r => Number(r.final_percent ?? r.final_5scale ?? NaN))
                    .filter(v => !Number.isNaN(v));
                return SBI.mean(vals);
            });
        });

        Plotly.newPlot(chartClass, [{
            z: matrix,
            x: terms,
            y: classes,
            type: "heatmap",
            colorscale: "Viridis"
        }], {
            title: "Trend heatmap: Class × Term",
            xaxis: { title: "Term" },
            yaxis: { title: "Class" }
        });
    }

    function renderSubjectTrendHeatmap() {
        if (!chartSubject) return;

        const rows = state.allRows;
        const terms = state.allTerms;
        const subjects = state.allSubjects;

        const matrix = subjects.map(subj => {
            return terms.map(term => {
                const vals = rows
                    .filter(r => r.subject === subj && r.term === term)
                    .map(r => Number(r.final_percent ?? r.final_5scale ?? NaN))
                    .filter(v => !Number.isNaN(v));
                return SBI.mean(vals);
            });
        });

        Plotly.newPlot(chartSubject, [{
            z: matrix,
            x: terms,
            y: subjects,
            type: "heatmap",
            colorscale: "Viridis"
        }], {
            title: "Trend heatmap: Subject × Term",
            xaxis: { title: "Term" },
            yaxis: { title: "Subject" }
        });
    }

    function onDataLoaded() {
        if (!state.allRows.length) {
            SBI.log("Trends dashboard: no data.");
            return;
        }
        renderSchoolTrend();
        renderClassTrendHeatmap();
        renderSubjectTrendHeatmap();
    }

    return {
        init,
        onDataLoaded
    };
})();

SBI_Trends.init();
