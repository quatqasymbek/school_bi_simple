// overview.js - Overview Dashboard Logic
console.log("OVERVIEW.JS: Loaded");

window.SBI_Overview = (function() {
    const SBI = window.SBI;
    
    // DOM Elements
    let termSelect, metricSelect, refreshBtn;
    let kpiStudents, kpiTeachers;
    let chartDonut, chartGrades;

    function init() {
        termSelect = document.getElementById("ovTermSelect");
        metricSelect = document.getElementById("ovMetricSelect");
        refreshBtn = document.getElementById("btn-overview-refresh");
        
        kpiStudents = document.getElementById("ovKpiStudents");
        kpiTeachers = document.getElementById("ovKpiTeachers");
        
        chartDonut = document.getElementById("chart-overview-donut");
        chartGrades = document.getElementById("chart-overview-grades");

        if(termSelect) termSelect.addEventListener("change", update);
        if(metricSelect) metricSelect.addEventListener("change", update);
        if(refreshBtn) refreshBtn.addEventListener("click", update);
    }

    function update() {
        const rows = SBI.state.allRows;
        if (!rows || rows.length === 0) return;

        const selectedTerm = termSelect.value;
        const selectedMetric = metricSelect.value; // 'quality' or 'average'

        // 1. Filter Data
        const termRows = rows.filter(r => r.term === selectedTerm);
        
        // 2. Update KPIs
        const uniqStudents = SBI.unique(termRows.map(r => r.student_id));
        // Teachers extraction is tricky from analytic rows unless we map back to classes or assignments.
        // We'll rely on the global teacher list, but filtered by activity if possible.
        // For simplicity, show Total Teachers in system.
        const uniqTeachers = SBI.state.teachers.length; // Or filter by assignments if data allows
        
        if(kpiStudents) kpiStudents.textContent = uniqStudents.length;
        if(kpiTeachers) kpiTeachers.textContent = uniqTeachers;

        // 3. Render Donut Chart (Student Categories)
        renderStudentCategories(termRows, uniqStudents);

        // 4. Render Grade Level Analysis
        renderGradeLevelAnalysis(termRows, selectedMetric);
        
        // 5. Prepare Data for AI
        if (window.SBI_Overview_AI) {
            window.SBI_Overview_AI.setContext(termRows, selectedTerm);
        }
    }

    function populateSelectors() {
        if (!SBI.state.allTerms.length) return;
        
        // Populate Terms
        const current = termSelect.value;
        termSelect.innerHTML = "";
        SBI.state.allTerms.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = t;
            termSelect.appendChild(opt);
        });
        if (current && SBI.state.allTerms.includes(current)) termSelect.value = current;
    }

    // ===========================================
    // CHARTS
    // ===========================================

    function renderStudentCategories(rows, studentIds) {
        // Logic: Group by student. 
        // Otlichnik: All 5
        // Khoroshist: 4 or 5 (no 3, no 2)
        // Troechnik: Has 3, no 2
        // Dvoechnik: Has 2
        
        let counts = { '5': 0, '4': 0, '3': 0, '2': 0 };

        studentIds.forEach(sid => {
            const sGrades = rows.filter(r => r.student_id === sid).map(r => r.final_5scale);
            
            if (sGrades.length === 0) return;

            const has2 = sGrades.some(g => g <= 2); // 2 or lower (0,1,2)
            const has3 = sGrades.some(g => g === 3);
            const has4 = sGrades.some(g => g === 4);
            
            // Categorization Priority: Dvoechnik -> Troechnik -> Khoroshist -> Otlichnik
            if (has2) {
                counts['2']++;
            } else if (has3) {
                counts['3']++;
            } else if (has4 || sGrades.every(g => g===5)) { 
                // If mixed 4 and 5, or only 4.
                // Check strictly for Otlichnik (Only 5s)
                if (sGrades.every(g => g === 5)) {
                    counts['5']++;
                } else {
                    counts['4']++;
                }
            } else {
                // Edge case (maybe only nulls?), treat as 2 or ignore
                counts['2']++;
            }
        });

        const data = [{
            values: [counts['5'], counts['4'], counts['3'], counts['2']],
            labels: ['Отличники', 'Хорошисты', 'Троечники', 'Двоечники'],
            type: 'pie',
            hole: 0.4,
            marker: {
                colors: ['#2ecc71', '#3498db', '#f1c40f', '#e74c3c']
            },
            textinfo: 'label+percent',
            hoverinfo: 'label+value'
        }];

        const layout = {
            margin: { t: 20, b: 20, l: 20, r: 20 },
            showlegend: false
        };

        Plotly.newPlot(chartDonut, data, layout, {displayModeBar: false});
    }

    function renderGradeLevelAnalysis(rows, metric) {
        // Metric: 'quality' (Ratio of 4&5) or 'average' (Mean 1-5)
        // Group by Grade Level (extracted from class_id like "K-10A" -> 10)
        
        // Helper to extract grade number
        const getGradeNum = (clsId) => {
            if(!clsId) return 'Unknown';
            // Regex to find number in string (e.g. "11B" -> 11)
            const match = clsId.match(/(\d+)/);
            return match ? parseInt(match[0]) : 0;
        };

        const gradeGroups = {};
        
        rows.forEach(r => {
            const gNum = getGradeNum(r.class_id);
            if (gNum === 0) return;
            
            if (!gradeGroups[gNum]) gradeGroups[gNum] = [];
            gradeGroups[gNum].push(r.final_5scale);
        });

        // Sort grades 1-11
        const labels = Object.keys(gradeGroups).sort((a,b) => a-b).map(g => g + " Класс");
        const values = [];

        Object.keys(gradeGroups).sort((a,b) => a-b).forEach(g => {
            const scores = gradeGroups[g];
            if (metric === 'quality') {
                const high = scores.filter(s => s >= 4).length;
                const ratio = (high / scores.length) * 100;
                values.push(ratio);
            } else {
                const avg = scores.reduce((a,b) => a+b, 0) / scores.length;
                values.push(avg);
            }
        });

        const trace = {
            x: labels,
            y: values,
            type: 'bar',
            marker: {
                color: metric === 'quality' ? '#3498db' : '#9b59b6'
            }
        };

        const layout = {
            title: metric === 'quality' ? 'Качество знаний по параллелям (%)' : 'Средняя оценка по параллелям',
            margin: { t: 40, b: 60, l: 40, r: 20 },
            xaxis: { title: 'Класс' },
            yaxis: { title: metric === 'quality' ? '%' : 'Балл' }
        };

        Plotly.newPlot(chartGrades, [trace], layout, {displayModeBar: false});
    }

    // Init immediately
    document.addEventListener('DOMContentLoaded', init);

    return {
        update: () => { populateSelectors(); update(); }
    };
})();
