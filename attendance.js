// attendance.js
window.SBI_Attendance = (function () {
    const state = SBI.state;

    let chartTotal, chartClass, chartTrend;

    function init() {
        chartTotal = document.getElementById("chart-attendance-total");
        chartClass = document.getElementById("chart-attendance-class");
        chartTrend = document.getElementById("chart-attendance-trend");
    }

    function computeRates() {
        const rows = state.attendanceRows;
        if (!rows.length) return { totalRate: null, byClass: {}, byTerm: {} };

        const byClass = {};
        const byTerm = {};
        let presentCount = 0;
        let totalCount = 0;

        rows.forEach(r => {
            const present = r.present !== null ? r.present : (r.absent !== null ? 1 - r.absent : null);
            if (present === null) return;

            presentCount += present;
            totalCount += 1;

            if (!byClass[r.class]) byClass[r.class] = { present: 0, total: 0 };
            byClass[r.class].present += present;
            byClass[r.class].total += 1;

            if (!byTerm[r.term]) byTerm[r.term] = { present: 0, total: 0 };
            byTerm[r.term].present += present;
            byTerm[r.term].total += 1;
        });

        const totalRate = totalCount ? (presentCount / totalCount) * 100 : null;

        const byClassRate = {};
        Object.entries(byClass).forEach(([cls, v]) => {
            byClassRate[cls] = v.total ? (v.present / v.total) * 100 : null;
        });

        const byTermRate = {};
        Object.entries(byTerm).forEach(([term, v]) => {
            byTermRate[term] = v.total ? (v.present / v.total) * 100 : null;
        });

        return { totalRate, byClassRate, byTermRate };
    }

    function renderTotal(totalRate) {
        if (!chartTotal) return;

        if (totalRate === null) {
            Plotly.newPlot(chartTotal, [], { title: "No attendance data" });
            return;
        }

        Plotly.newPlot(chartTotal, [{
            type: "indicator",
            mode: "gauge+number",
            value: totalRate,
            title: { text: "Overall attendance (%)" },
            gauge: { axis: { range: [0, 100] } }
        }], {});
    }

    function renderByClass(byClassRate) {
        if (!chartClass) return;

        const classes = Object.keys(byClassRate);
        if (!classes.length) {
            Plotly.newPlot(chartClass, [], { title: "No attendance data by class" });
            return;
        }

        Plotly.newPlot(chartClass, [{
            x: classes,
            y: classes.map(c => byClassRate[c]),
            type: "bar"
        }], {
            title: "Attendance by class (%)",
            xaxis: { title: "Class" },
            yaxis: { title: "Attendance %" }
        });
    }

    function renderTrend(byTermRate) {
        if (!chartTrend) return;

        const terms = state.attendanceTerms;
        if (!terms.length) {
            Plotly.newPlot(chartTrend, [], { title: "No attendance data by term" });
            return;
        }

        Plotly.newPlot(chartTrend, [{
            x: terms,
            y: terms.map(t => byTermRate[t] ?? null),
            mode: "lines+markers"
        }], {
            title: "Attendance trend by term (%)",
            xaxis: { title: "Term" },
            yaxis: { title: "Attendance %"}
        });
    }

    function onDataLoaded() {
        if (!state.attendanceRows.length) {
            SBI.log("Attendance dashboard: no data.");
            if (chartTotal) Plotly.newPlot(chartTotal, [], { title: "No attendance sheet in Excel" });
            return;
        }

        const { totalRate, byClassRate, byTermRate } = computeRates();
        SBI.log(`Attendance → totalRate=${totalRate?.toFixed(1) ?? "NA"}`);

        renderTotal(totalRate);
        renderByClass(byClassRate);
        renderTrend(byTermRate);
    }

    return {
        init,
        onDataLoaded
    };
})();

SBI_Attendance.init();
