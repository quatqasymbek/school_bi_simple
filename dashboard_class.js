// dashboard_class.js - Class Level Analysis
console.log("DASHBOARD_CLASS.JS: Loaded");

window.SBI_Class = (function() {
    const SBI = window.SBI;

    // DOM Elements
    let tableTermSelect, tableMetricSelect, tableHeader, tableBody;
    let donutTermSelect, donutClassSelect, chartDonut;

    function init() {
        // Table Controls
        tableTermSelect = document.getElementById("clsTableTermSelect");
        tableMetricSelect = document.getElementById("clsTableMetricSelect");
        tableHeader = document.getElementById("class-summary-header");
        tableBody = document.getElementById("class-summary-body");

        // Donut Controls
        donutTermSelect = document.getElementById("clsDonutTermSelect");
        donutClassSelect = document.getElementById("clsDonutClassSelect");
        chartDonut = document.getElementById("chart-class-donut");

        // Events
        if(tableMetricSelect) tableMetricSelect.addEventListener("change", renderTable);
        // We re-render table on term select just to highlight the column, but data is static rows
        if(tableTermSelect) tableTermSelect.addEventListener("change", renderTable);

        if(donutTermSelect) donutTermSelect.addEventListener("change", renderDonut);
        if(donutClassSelect) donutClassSelect.addEventListener("change", renderDonut);
    }

    function onDataLoaded() {
        populateSelectors();
        renderTable();
        renderDonut();
    }

    function populateSelectors() {
        const terms = SBI.state.allTerms || [];
        const classes = SBI.state.classes || []; // Array of class objects

        // Sort terms
        terms.sort();
        
        // Sort classes naturally (1A, 1B, 2A...)
        const sortedClasses = classes.sort((a,b) => {
            return (a.class_id || "").localeCompare(b.class_id || "", undefined, {numeric: true});
        });

        // Fill Table Selectors
        if(tableTermSelect) {
            tableTermSelect.innerHTML = "";
            terms.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t;
                opt.textContent = t;
                tableTermSelect.appendChild(opt);
            });
        }

        // Fill Donut Selectors
        if(donutTermSelect) {
            donutTermSelect.innerHTML = "";
            terms.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t;
                opt.textContent = t;
                donutTermSelect.appendChild(opt);
            });
        }

        if(donutClassSelect) {
            donutClassSelect.innerHTML = "";
            sortedClasses.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c.class_id; // Using ID as value
                opt.textContent = c.class_name || c.class_id;
                donutClassSelect.appendChild(opt);
            });
        }
    }

    // ==========================================
    // 1. CLASS MATRIX TABLE
    // ==========================================
    function renderTable() {
        if(!tableBody) return;
        tableBody.innerHTML = "";
        
        const terms = SBI.state.allTerms.sort();
        const metric = tableMetricSelect ? tableMetricSelect.value : "quality"; // 'quality' | 'average'
        const rows = SBI.state.allRows;
        const classList = SBI.state.classes; // Metadata about classes
        const teacherList = SBI.state.teachers; // Metadata about teachers

        // 1. Rebuild Header (Class | Teacher | Term 1 | Term 2 ...)
        tableHeader.innerHTML = "<th>Класс</th><th>Кл. Руководитель</th>";
        terms.forEach(t => {
            const th = document.createElement("th");
            th.textContent = t;
            // Highlight selected term
            if(tableTermSelect && tableTermSelect.value === t) {
                th.style.background = "#e3f2fd";
                th.style.color = "#1565c0";
            }
            tableHeader.appendChild(th);
        });

        // 2. Build Rows
        // Sort classes for display
        const sortedClasses = [...classList].sort((a,b) => 
            (a.class_id||"").localeCompare(b.class_id||"", undefined, {numeric:true})
        );

        sortedClasses.forEach(cls => {
            const tr = document.createElement("tr");
            
            // Col 1: Class Name
            const tdName = document.createElement("td");
            tdName.textContent = cls.class_name || cls.class_id;
            tr.appendChild(tdName);

            // Col 2: Teacher Name
            const tdTeach = document.createElement("td");
            const teachObj = teacherList.find(t => t.teacher_id === cls.homeroom_teacher_id);
            tdTeach.textContent = teachObj ? `${teachObj.last_name} ${teachObj.first_name}` : (cls.homeroom_teacher_id || "-");
            tr.appendChild(tdTeach);

            // Col 3+: Terms
            terms.forEach(t => {
                const td = document.createElement("td");
                
                // Filter rows for this Class AND this Term
                // Note: analytic rows have 'class_id'.
                const cellRows = rows.filter(r => r.class_id === cls.class_id && r.term === t);

                if(cellRows.length === 0) {
                    td.textContent = "-";
                    td.style.color = "#ccc";
                } else {
                    const val = calculateMetric(cellRows, metric);
                    td.textContent = val;
                    
                    // Visual Coding
                    if(metric === 'quality') {
                        // val is string "XX.X"
                        const n = parseFloat(val);
                        if(n >= 70) td.classList.add('grade-good');
                        if(n < 40) td.classList.add('grade-bad');
                    } else {
                        // Average
                        const n = parseFloat(val);
                        if(n >= 4.5) td.classList.add('grade-good');
                        if(n < 3.0) td.classList.add('grade-bad');
                    }
                }

                // Highlight cell if term selected
                if(tableTermSelect && tableTermSelect.value === t) {
                    td.style.background = "#f0f8ff";
                }

                tr.appendChild(td);
            });

            tableBody.appendChild(tr);
        });
    }

    function calculateMetric(rows, metric) {
        // rows = analytic rows (student x subject x term)
        // We need to aggregate by student first? 
        // "Quality of Knowledge" usually means: % of students who have NO 3s and NO 2s (i.e. only 4 and 5) 
        // OR just ratio of (4 and 5) marks in the total set.
        // Standard definition: % of students with "Good" or "Excellent" performance.
        // But here we have rows for SUBJECTS. 
        // Let's calculate based on SUBJECT grades for simplicity unless "Student Quality" is strictly required.
        // PROMPT says: "aggregated term grades of classes students" -> "Качество знаний"
        
        // Method A: Average of Subject Grades (Simplest for Heatmaps)
        // Method B: % of Grades that are 4 or 5.
        
        if (metric === 'average') {
            const grades = rows.map(r => r.final_5scale).filter(g => g != null);
            const avg = SBI.mean(grades);
            return avg.toFixed(2);
        } else {
            // Quality (% of 4 and 5s)
            const grades = rows.map(r => r.final_5scale).filter(g => g != null);
            if(grades.length === 0) return "-";
            const good = grades.filter(g => g >= 4).length;
            return ((good / grades.length) * 100).toFixed(1);
        }
    }

    // ==========================================
    // 2. CLASS DETAIL DONUT
    // ==========================================
    function renderDonut() {
        if(!donutTermSelect || !donutClassSelect) return;

        const term = donutTermSelect.value;
        const clsId = donutClassSelect.value;
        const rows = SBI.state.allRows;

        // Filter data
        const subset = rows.filter(r => r.term === term && r.class_id === clsId);
        
        if(subset.length === 0) {
            Plotly.purge(chartDonut);
            chartDonut.innerHTML = "<div style='padding:50px; text-align:center; color:#999;'>Нет данных для выбранного класса и четверти</div>";
            return;
        }

        // Get unique students in this subset
        const students = SBI.unique(subset.map(r => r.student_id));

        // Categorize students
        let counts = { '5': 0, '4': 0, '3': 0, '2': 0 };

        students.forEach(sid => {
            const sGrades = subset.filter(r => r.student_id === sid).map(r => r.final_5scale);
            
            if (sGrades.length === 0) return;

            const has2 = sGrades.some(g => g <= 2);
            const has3 = sGrades.some(g => g === 3);
            const has4 = sGrades.some(g => g === 4);
            
            if (has2) {
                counts['2']++;
            } else if (has3) {
                counts['3']++;
            } else if (has4 || sGrades.every(g => g===5)) { 
                if (sGrades.every(g => g === 5)) {
                    counts['5']++;
                } else {
                    counts['4']++;
                }
            } else {
                counts['2']++; // Fallback
            }
        });

        const data = [{
            values: [counts['5'], counts['4'], counts['3'], counts['2']],
            labels: ['Отличники (5)', 'Хорошисты (4-5)', 'Троечники (3)', 'Двоечники (2)'],
            type: 'pie',
            hole: 0.5,
            marker: {
                colors: ['#2ecc71', '#3498db', '#f1c40f', '#e74c3c']
            },
            textinfo: 'label+value+percent',
            hoverinfo: 'label+value'
        }];

        const layout = {
            title: `Успеваемость ${clsId} (${term})`,
            margin: { t: 40, b: 20, l: 20, r: 20 },
            showlegend: true,
            legend: { orientation: 'h', y: -0.1 }
        };

        Plotly.newPlot(chartDonut, data, layout, {displayModeBar: false});
    }

    // Init
    document.addEventListener('DOMContentLoaded', init);

    return {
        onDataLoaded: onDataLoaded
    };
})();
