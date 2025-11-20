window.SBI_Overview = (function() {
    
    function update() {
        if (!SBI.state.isLoaded) return;
        
        const data = SBI.state.processedGrades;
        if (data.length === 0) return;

        // Init Selectors
        const sel = document.getElementById('ovTerm');
        if (sel.options.length === 0) {
            const terms = [...new Set(data.map(r => r.term_id))].sort();
            sel.innerHTML = '<option value="ALL">Весь год</option>';
            terms.forEach(t => sel.innerHTML += `<option value="${t}">${t}</option>`);
            
            sel.addEventListener('change', update);
            document.getElementById('ovMetric').addEventListener('change', update);
            document.getElementById('aiBtn').addEventListener('click', runAI);
        }

        const term = sel.value;
        const metric = document.getElementById('ovMetric').value;
        
        // Filter
        const subset = term === 'ALL' ? data : data.filter(r => r.term_id === term);
        
        // KPIs
        document.getElementById('kpi-total-students').innerText = SBI.state.students.length;
        document.getElementById('kpi-total-teachers').innerText = SBI.state.teachers.length;
        
        // School Metric
        let val = 0;
        if (metric === 'avg') {
            val = (subset.reduce((a,b)=>a+b.grade,0)/subset.length).toFixed(2);
        } else {
            const good = subset.filter(r => r.grade >= 4).length;
            val = ((good/subset.length)*100).toFixed(1) + '%';
        }
        document.getElementById('kpi-metric-val').innerText = val;

        // Table: Grades 1-11
        renderTable(term, metric);
        
        // Donut
        renderDonut(term);
    }

    function renderTable(term, metric) {
        const div = document.getElementById('ovGradeTable');
        // Logic: Rows 1-11, Cols Terms
        const terms = SBI.state.terms.map(t => t.term_id).sort();
        let html = `<table><thead><tr><th>Классы</th>`;
        terms.forEach(t => html += `<th>${t}</th>`);
        html += `</tr></thead><tbody>`;
        
        for (let i=1; i<=11; i++) {
            html += `<tr><td><b>${i} классы</b></td>`;
            terms.forEach(t => {
                // Find grades for students in classes starting with i (e.g. "1A", "11B")
                // We need robust class matching.
                // Filter rows by term
                const rows = SBI.state.processedGrades.filter(r => r.term_id === t);
                // Filter by grade level. Need to lookup class name from class_id
                const gradeRows = rows.filter(r => {
                    const cls = SBI.state.classes.find(c => c.class_id === r.class_id);
                    if (!cls) return false;
                    // Parse "11 «А»" -> 11
                    const num = parseInt(cls.class_name); 
                    return num === i;
                });
                
                let cellVal = '-';
                let bg = '';
                if (gradeRows.length > 0) {
                    if (metric === 'avg') {
                        cellVal = (gradeRows.reduce((a,b)=>a+b.grade,0)/gradeRows.length).toFixed(2);
                        bg = parseFloat(cellVal) >= 4 ? '#dff0d8' : '#f2dede';
                    } else {
                        const good = gradeRows.filter(r => r.grade >= 4).length;
                        cellVal = Math.round((good/gradeRows.length)*100) + '%';
                        bg = parseInt(cellVal) > 50 ? '#dff0d8' : '#f2dede';
                    }
                }
                html += `<td style="background:${bg}">${cellVal}</td>`;
            });
            html += `</tr>`;
        }
        html += `</tbody></table>`;
        div.innerHTML = html;
    }

    function renderDonut(term) {
        // Aggregate Statuses
        const counts = { 'Отличник':0, 'Хорошист':0, 'Троечник':0, 'Двоечник':0 };
        Object.entries(SBI.state.studentStatuses).forEach(([key, status]) => {
            const [sid, t] = key.split('|');
            if (term === 'ALL' || t === term) {
                if (counts[status] !== undefined) counts[status]++;
            }
        });

        Plotly.newPlot('ovDonut', [{
            values: [counts['Отличник'], counts['Хорошист'], counts['Троечник'], counts['Двоечник']],
            labels: ['Отличники', 'Хорошисты', 'Троечники', 'Двоечники'],
            type: 'pie',
            marker: { colors: ['#2ecc71', '#3498db', '#f1c40f', '#e74c3c'] },
            hole: 0.4
        }], { margin: {t:0, b:0, l:0, r:0} });
    }
    
    async function runAI() {
        const div = document.getElementById('aiOutput');
        div.innerText = "Генерация ответа...";
        if (window.SBI_LLM) {
            const txt = await SBI_LLM.interpret("Проанализируй успеваемость школы.");
            div.innerText = txt;
        } else {
            div.innerText = "Модуль ИИ не готов.";
        }
    }

    return { update };
})();
