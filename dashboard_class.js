// dashboard_class.js - Class Level Analysis
console.log("DASHBOARD_CLASS.JS: Loaded");

window.SBI_Class = (function() {
    const SBI = window.SBI;

    // DOM Elements
    let tableTermSelect, tableMetricSelect, tableHeader, tableBody;
    let donutTermSelect, donutClassSelect, chartDonut;

    function init() {
        console.log("SBI_Class: Init starting...");
        
        // Table Controls
        tableTermSelect = document.getElementById("clsTableTermSelect");
        tableMetricSelect = document.getElementById("clsTableMetricSelect");
        tableHeader = document.getElementById("class-summary-header");
        tableBody = document.getElementById("class-summary-body");

        // Donut Controls
        donutTermSelect = document.getElementById("clsDonutTermSelect");
        donutClassSelect = document.getElementById("clsDonutClassSelect");
        chartDonut = document.getElementById("chart-class-donut");

        if(!tableBody) console.error("SBI_Class: Table Body not found!");
        if(!chartDonut) console.error("SBI_Class: Donut Container not found!");

        // Events
        if(tableMetricSelect) tableMetricSelect.addEventListener("change", renderTable);
        if(tableTermSelect) tableTermSelect.addEventListener("change", renderTable);

        if(donutTermSelect) donutTermSelect.addEventListener("change", renderDonut);
        if(donutClassSelect) donutClassSelect.addEventListener("change", renderDonut);
    }

    function onDataLoaded() {
        console.log("SBI_Class: Data Loaded Triggered");
        populateSelectors();
        renderTable();
        renderDonut();
    }

    function populateSelectors() {
        const terms = SBI.state.allTerms || [];
        const classes = SBI.state.classes || []; 

        // Sort terms
        terms.sort();
        
        // Sort classes naturally
        const sortedClasses = [...classes].sort((a,b) => {
            return (a.class_id || "").localeCompare(b.class_id || "", undefined, {numeric: true});
        });

        // 1. Table Term Selector
        if(tableTermSelect) {
            tableTermSelect.innerHTML = "";
            terms.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t;
                opt.textContent = t;
                tableTermSelect.appendChild(opt);
            });
        }

        // 2. Donut Term Selector
        if(donutTermSelect) {
            donutTermSelect.innerHTML = "";
            terms.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t;
                opt.textContent = t;
                donutTermSelect.appendChild(opt);
            });
        }

        // 3. Donut Class Selector
        if(donutClassSelect) {
            donutClassSelect.innerHTML = "";
            sortedClasses.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c.class_id; 
                opt.textContent = c.class_name || c.class_id;
                donutClassSelect.appendChild(opt);
            });
            // Select first one by default
            if(sortedClasses.length > 0) donutClassSelect.value = sortedClasses[0].class_id;
        }
    }

    function renderTable() {
        if(!tableBody) return;
        tableBody.innerHTML = "";
        
        const terms = SBI.state.allTerms ? SBI.state.allTerms.sort() : [];
        const metric = tableMetricSelect ? tableMetricSelect.value : "quality"; 
        const rows = SBI.state.allRows || [];
        const classList = SBI.state.classes || []; 
        const teacherList = SBI.state.teachers || []; 

        // 1. Rebuild Header
        tableHeader.innerHTML = "<th>Класс</th><th>Кл. Руководитель</th>";
        terms.forEach(t => {
            const th = document.createElement("th");
            th.textContent = t;
            if(tableTermSelect && tableTermSelect.value === t) {
                th.style.background = "#e3f2fd";
                th.style.color = "#1565c0";
            }
            tableHeader.appendChild(th);
        });

        // 2. Build Rows
        const sortedClasses = [...classList].sort((a,b) => 
            (a.class_id||"").localeCompare(b.class_id||"", undefined, {numeric:true})
        );

        sortedClasses.forEach(cls => {
            const tr = document.createElement("tr");
            
            // Col 1: Name
            const tdName = document.createElement("td");
            tdName.textContent = cls.class_name || cls.class_id;
            tr.appendChild(tdName);

            // Col 2: Teacher
            const tdTeach = document.createElement("td");
            const teachObj = teacherList.find(t => t.teacher_id === cls.homeroom_teacher_id);
            tdTeach.textContent = teachObj ? `${teachObj.last_name} ${teachObj.first_name}` : (cls.homeroom_teacher_id || "-");
            tr.appendChild(tdTeach);

            // Col 3+: Terms
            terms.forEach(t => {
                const td = document.createElement("td");
                // Filter rows for this Class AND Term
                const cellRows = rows.filter(r => r.class_id === cls.class_id && r.term === t);

                if(cellRows.length === 0) {
                    td.textContent = "-";
                    td.style.color = "#ccc";
                } else {
                    td.textContent = calculateMetric(cellRows, metric);
                    
                    // Color coding
                    const val = parseFloat(td.textContent);
                    if (metric === 'quality') {
                        if(val >= 70) td.classList.add('grade-good');
                        if(val < 40) td.classList.add('grade-bad');
                    } else {
                        if(val >= 4.5) td.classList.add('grade-good');
                        if(val < 3.0) td.classList.add('grade-bad');
                    }
                }
                
                if(tableTermSelect && tableTermSelect.value === t) {
                    td.style.background = "#f0f8ff";
                }
                tr.appendChild(td);
            });

            tableBody.appendChild(tr);
        });
        
        if(classList.length === 0) {
             tableBody.innerHTML = "<tr><td colspan='5' style='padding:20px; color:#999;'>Данные о классах не найдены. Проверьте лист 'КЛАССЫ' в Excel.</td></tr>";
        }
    }

    function calculateMetric(rows, metric) {
        const grades = rows.map(r => r.final_5scale).filter(g => g != null);
        if(grades.length === 0) return "-";

        if (metric === 'average') {
            const avg = SBI.mean(grades);
            return avg.toFixed(2);
        } else {
            // Quality: % of 4 and 5
            const good = grades.filter(g => g >= 4).length;
            return ((good / grades.length) * 100).toFixed(1);
        }
    }

    function renderDonut() {
        if(!chartDonut) return;
        if(!donutTermSelect || !donutClassSelect) return;

        const term = donutTermSelect.value;
        const clsId = donutClassSelect.value;
        
        if(!term || !clsId) {
             chartDonut.innerHTML = "";
             return;
        }

        const rows = SBI.state.allRows || [];
        const subset = rows.filter(r => r.term === term && r.class_id === clsId);
        
        if(subset.length === 0) {
            Plotly.purge(chartDonut);
            chartDonut.innerHTML = "<div style='padding:50px; text-align:center; color:#999;'>Нет оценок для этого класса за выбранную четверть</div>";
            return;
        }

        const students = SBI.unique(subset.map(r => r.student_id));
        let counts = { '5': 0, '4': 0, '3': 0, '2': 0 };

        students.forEach(sid => {
            const sGrades = subset.filter(r => r.student_id === sid).map(r => r.final_5scale);
            if (sGrades.length === 0) return;

            const has2 = sGrades.some(g => g <= 2);
            const has3 = sGrades.some(g => g === 3);
            
            if (has2) counts['2']++;
            else if (has3) counts['3']++;
            else if (sGrades.every(g => g === 5)) counts['5']++;
            else counts['4']++;
        });

        const data = [{
            values: [counts['5'], counts['4'], counts['3'], counts['2']],
            labels: ['Отличники', 'Хорошисты', 'Троечники', 'Двоечники'],
            type: 'pie',
            hole: 0.5,
            marker: { colors: ['#2ecc71', '#3498db', '#f1c40f', '#e74c3c'] },
            textinfo: 'label+value',
            hoverinfo: 'label+percent'
        }];

        Plotly.newPlot(chartDonut, data, {
            title: `Успеваемость ${clsId} (${term})`,
            margin: { t: 40, b: 20, l: 20, r: 20 },
            showlegend: true,
            legend: { orientation: 'h', y: -0.1 }
        }, {displayModeBar: false});
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        onDataLoaded: onDataLoaded
    };
})();
