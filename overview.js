// dashboard_overview.js
// Обзор школы: фильтры, KPI, таблица по классам/четвертям, донат и локальный ИИ

window.SBI_Overview = (function () {
    const SBI = window.SBI || {};
    const state = SBI.state || {};
    const log = SBI.log || console.log;

    // --- DOM elements ---
    let termSelect;
    let metricSelect;
    let kpiStudentsEl;
    let kpiTeachersEl;
    let gradeTableEl;
    let donutEl; // Chart container ID is 'chart-overview-donut' based on index.html
    let aiBtn;
    let aiOutput;

    // metric keys
    const METRIC_KNOWLEDGE = "knowledge_quality";
    const METRIC_AVG = "avg_mark";

    // for AI
    let currentInsightData = null;

    // ------------------ UTILITIES ------------------ //

    function ensureNumber(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    function valueTo5Scale(row) {
        // final_5scale уже есть; final_percent на всякий случай
        const s5 = ensureNumber(row.final_5scale);
        if (s5 != null && s5 > 0) return s5;

        const p = ensureNumber(row.final_percent);
        if (p != null && p > 0) {
            return p / 20; // 100 -> 5
        }
        return null;
    }

    function metricFromRows(rows, metric) {
        if (!rows || !rows.length) {
            return { value: 0, percent: 0 };
        }
        
        if (metric === METRIC_AVG) {
            const sum = rows.reduce((acc, row) => acc + (valueTo5Scale(row) || 0), 0);
            const value = rows.length > 0 ? sum / rows.length : 0;
            return {
                value: value.toFixed(2),
                percent: (value / 5 * 100).toFixed(1)
            };
        }
        
        if (metric === METRIC_KNOWLEDGE) {
            // Simplified pass rate (grade >= 3) for knowledge quality
            const passed = rows.filter(row => (valueTo5Scale(row) || 0) >= 3).length;
            const value = rows.length > 0 ? passed / rows.length : 0;
            return {
                value: value.toFixed(2),
                percent: (value * 100).toFixed(1)
            };
        }

        return { value: 0, percent: 0 };
    }

    // ------------------ RENDERING ------------------ //

    function renderKPI(filteredRows) {
        // Update student/teacher count
        if (kpiStudentsEl && state.students) {
            kpiStudentsEl.textContent = state.students.length;
        }
        if (kpiTeachersEl && state.teachers) {
            kpiTeachersEl.textContent = state.teachers.length;
        }
        
        // Calculate the average mark across all filtered rows
        const avgMetric = metricFromRows(filteredRows, METRIC_AVG);
        const knowledgeMetric = metricFromRows(filteredRows, METRIC_KNOWLEDGE);

        // This assumes there are elements with IDs like 'kpi-avg-mark' and 'kpi-knowledge-quality'
        const avgEl = document.getElementById('kpi-avg-mark');
        const knowledgeEl = document.getElementById('kpi-knowledge-quality');
        
        if(avgEl) avgEl.innerHTML = `<div class="kpi-value">${avgMetric.value}</div><div class="kpi-label">Средний балл (5-балльная шкала)</div>`;
        if(knowledgeEl) knowledgeEl.innerHTML = `<div class="kpi-value">${knowledgeMetric.percent}%</div><div class="kpi-label">Качество знаний (Доля оценок 3-5)</div>`;
    }


    /**
     * Renders the Donut chart showing distribution of student performance categories
     * (Excellent, Good, Satisfactory, Unsatisfactory) across all classes.
     * @param {Array} rows Filtered grade rows (Student x Subject x Term)
     */
    function renderDonut(rows) {
        if (!donutEl) {
            log("[OverviewDashboard] renderDonut: Donut container not found.");
            return;
        }
        
        // CRITICAL CHECK: Clear the chart and return gracefully if no data
        if (!rows.length) {
            donutEl.innerHTML = "<div style='text-align:center; color:#999; padding:20px;'>Нет оценок для анализа в выбранной четверти.</div>";
            Plotly.purge(donutEl);
            currentInsightData = null; // Clear AI data
            return;
        }

        // 1. Group by Student and Term to find the final result for each student for that term
        // We need a unique list of students who have final grades in this filtered set.
        const studentTerms = SBI.unique(rows.map(r => r.student_id + '|' + r.term));
        let studentResults = [];

        studentTerms.forEach(key => {
            const [sid, term] = key.split('|');
            const sGrades = rows.filter(r => r.student_id === sid && r.term === term);
            
            if (sGrades.length === 0) return;

            // Find the final performance category for this student in this term:
            const finalGrades = sGrades.map(r => ensureNumber(r.final_5scale) || 0).filter(g => g > 0);

            if (finalGrades.length === 0) return;
            
            const has2 = finalGrades.some(g => g <= 2);
            const has3 = finalGrades.some(g => g === 3);
            const has4 = finalGrades.some(g => g === 4);
            const all5 = finalGrades.every(g => g === 5);
            
            let category;
            if (has2) category = '2'; // Двоечник (Unsatisfactory)
            else if (has3) category = '3'; // Троечник (Satisfactory)
            else if (all5) category = '5'; // Отличник (Excellent)
            else if (has4) category = '4'; // Хорошист (Good)
            else category = '4'; 

            studentResults.push({ sid, term, category });
        });
        
        // 2. Aggregate the counts
        let counts = { '5': 0, '4': 0, '3': 0, '2': 0 };
        studentResults.forEach(r => {
            counts[r.category]++;
        });

        // 3. Prepare data for Plotly
        const data = [{
            values: [counts['5'], counts['4'], counts['3'], counts['2']],
            labels: ['Отличники', 'Хорошисты', 'Троечники', 'Двоечники'],
            type: 'pie',
            hole: 0.5,
            marker: { colors: ['#2ecc71', '#3498db', '#f1c40f', '#e74c3c'] },
            textinfo: 'label+percent',
            hoverinfo: 'label+value+percent'
        }];
        
        // Store data for AI analysis
        currentInsightData = {
            counts: counts,
            totalStudents: studentResults.length
        };

        Plotly.newPlot(donutEl, data, {
            title: 'Распределение успеваемости по всей школе',
            height: 350,
            margin: { t: 40, b: 0, l: 0, r: 0 },
            showlegend: true,
            legend: { orientation: 'h', y: -0.1 }
        }, {
            responsive: true,
            displayModeBar: false
        });
    }

    /**
     * Main update function called on filter change or data load.
     */
    function update() {
        const rows = state.allRows || [];
        if (!rows.length) {
            log("[OverviewDashboard] update: Нет данных allRows.");
            renderKPI([]);
            renderDonut([]);
            return;
        }

        const selectedTerm = termSelect ? termSelect.value : 'ALL';

        let filteredRows = rows;
        if (selectedTerm !== 'ALL') {
            filteredRows = rows.filter(r => r.term === selectedTerm);
        }
        
        log(`[OverviewDashboard] update: Отфильтровано строк: ${filteredRows.length}. Термин: ${selectedTerm}`);
        
        // 1. Render Key Performance Indicators (KPI)
        renderKPI(filteredRows);
        
        // 2. Render Donut Chart (The fix)
        renderDonut(filteredRows);
        
        // 3. Render Grade Table (Table logic is assumed to be working or in another file)
        
        // Ensure AI insight is reset when data changes
        const aiOutputEl = document.getElementById('ai-output');
        if (aiOutputEl && aiBtn) {
            if (aiOutputEl.innerHTML.includes('AI анализирует данные')) {
                aiOutputEl.innerHTML = '';
                aiBtn.textContent = '💡 Получить аналитику от AI';
                aiBtn.disabled = false;
            }
        }
    }


    function initDom() {
        termSelect = document.getElementById("overviewTermSelect");
        metricSelect = document.getElementById("overviewMetricSelect");
        kpiStudentsEl = document.getElementById("kpi-students-count");
        kpiTeachersEl = document.getElementById("kpi-teachers-count");
        gradeTableEl = document.getElementById("overview-grade-table");
        donutEl = document.getElementById("chart-overview-donut");
        aiBtn = document.getElementById("ai-insight-btn");
        aiOutput = document.getElementById("ai-output");

        if (termSelect) {
            termSelect.addEventListener("change", update);
        }
        // Assuming metricSelect is used for another part of the overview table/KPIs
        // if (metricSelect) { metricSelect.addEventListener("change", update); } 

        if (aiBtn) {
            aiBtn.addEventListener("click", onAIButtonClick);
        }

        log("[OverviewDashboard] init complete");
    }

    function populateTermSelect() {
        if (!termSelect) return;

        const terms = state.allTerms || [];
        termSelect.innerHTML = "";

        const optAll = document.createElement("option");
        optAll.value = "ALL";
        optAll.textContent = "Все четверти";
        termSelect.appendChild(optAll);

        terms.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = t;
            termSelect.appendChild(opt);
        });

        termSelect.value = "ALL";
    }

    function onDataLoaded() {
        initDom();

        const rows = state.allRows || [];
        if (!rows.length) {
            log("[OverviewDashboard] onDataLoaded: нет данных allRows");
            const root = document.getElementById("overview-summary");
            if (root) {
                root.textContent = "Данные ещё не загружены.";
            }
            // Clear or update KPIs/Donut even if no rows
            renderKPI([]); 
            renderDonut([]);
            return;
        }

        populateTermSelect();
        update();
    }

    // инициализация DOM сразу, если страница уже готова
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initDom);
    } else {
        initDom();
    }

    return {
        onDataLoaded: onDataLoaded
    };
})();
