console.log("attendance.js loaded");

function renderAttendanceDashboard(rows, attendanceRows, classList, termList) {
    console.log("Attendance → rendering… rows:", rows.length);

    const containerTotal = document.getElementById("chart-attendance-total");
    const containerClass = document.getElementById("chart-attendance-class");
    const containerTrend = document.getElementById("chart-attendance-trend");

    if (!attendanceRows || attendanceRows.length === 0) {
        containerTotal.innerHTML = "<p>No attendance data available.</p>";
        containerClass.innerHTML = "";
        containerTrend.innerHTML = "";
        return;
    }

    // Normalize class names
    attendanceRows = attendanceRows.map(r => ({
        class: String(r.class).trim(),
        term: r.term,
        abs_total: Number(r.abs_total ?? 0)
    }));

    // Compute total absences
    const totalAbs = attendanceRows.reduce((s, r) => s + r.abs_total, 0);

    containerTotal.innerHTML = "";
    Plotly.newPlot(containerTotal, [{
        type: "indicator",
        mode: "number",
        value: totalAbs,
        title: { text: "Total Absences (All Terms)" }
    }]);

    // Absence by class
    const absByClass = {};
    attendanceRows.forEach(r => {
        if (!(r.class in absByClass)) absByClass[r.class] = 0;
        absByClass[r.class] += r.abs_total;
    });

    Plotly.newPlot(containerClass, [{
        x: Object.keys(absByClass),
        y: Object.values(absByClass),
        type: "bar"
    }], {
        title: "Absences by Class"
    });

    // Trend by term
    const absByTerm = {};
    attendanceRows.forEach(r => {
        if (!(r.term in absByTerm)) absByTerm[r.term] = 0;
        absByTerm[r.term] += r.abs_total;
    });

    Plotly.newPlot(containerTrend, [{
        x: Object.keys(absByTerm),
        y: Object.values(absByTerm),
        type: "scatter",
        mode: "lines+markers"
    }], {
        title: "Absence Trend by Term"
    });
}
