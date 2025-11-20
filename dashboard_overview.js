window.SBI_Overview = (function() {
    function update() {
        if (!SBI.state.isLoaded) return;
        const data = SBI.state.processedGrades;
        if (!data.length) return;

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
        const subset = term === 'ALL' ? data : data.filter(r => r.term_id === term);

        // KPIs
        document.getElementById('kpi-total-students').innerText = SBI.state.students.length;
        document.getElementById('kpi-total-teachers').innerText = SBI.state.teachers.length;
        
        let val = 0;
        if (metric === 'avg') {
            val = (subset.reduce((a,b)=>a+b.grade,0)/subset.length).toFixed(2);
        } else {
            const good = subset.filter(r => r.grade >= 4).length;
            val = ((good/subset.length)*100).toFixed(1) + '%';
        }
        document.getElementById('kpi-metric-val').innerText = val || '-';

        // Components
        renderTable(term, metric);
        renderDonut(term);
    }

    function renderTable(term, metric) {
        const terms = SBI.state.terms.map(t => t.term_id).sort();
        let html = `<table><thead><tr><th>Класс</th>`;
        terms.forEach(t => html += `<th>${t}</th>`);
        html += `</tr></thead><tbody>`;
        
        for (let i=1; i<=11; i++) {
            html += `<tr><td><b>${i} классы</b></td>`;
            terms.forEach(t => {
                const rows = SBI.state.processedGrades.filter(r => r.term_id === t);
                const gradeRows = rows.filter(r => {
                    const cls = SBI.state.classes.find(c => c.class_id === r.class_id);
                    return cls && parseInt(cls.class_name) === i;
                });
                
                let cell = '-', bg = '';
                if (gradeRows.length) {
                    if (metric === 'avg') {
                        cell = (gradeRows.reduce((a,b)=>a+b.grade,0)/gradeRows.length).toFixed(2);
                        bg = parseFloat(cell)>=4 ? '#d4edda' : '#f8d7da';
                    } else {
                        const good = gradeRows.filter(r => r.grade >= 4).length;
                        cell = Math.round((good/gradeRows.length)*100) + '%';
                        bg = parseInt(cell)>50 ? '#d4edda' : '#f8d7da';
                    }
                }
                html += `<td style="background:${bg}">${cell}</td>`;
            });
            html += `</tr>`;
        }
        html += `</tbody></table>`;
        document.getElementById('ovGradeTable').innerHTML = html;
    }

    function renderDonut(term) {
        const counts = { 'Отличник':0, 'Хорошист':0, 'Троечник':0, 'Двоечник':0 };
        Object.entries(SBI.state.studentStatuses).forEach(([key, status]) => {
            if (term === 'ALL' || key.includes(term)) {
                if(counts[status] !== undefined) counts[status]++;
            }
        });
        
        Plotly.newPlot('ovDonut', [{
            values: Object.values(counts),
            labels: Object.keys(counts),
            type: 'pie',
            marker: { colors: ['#2ecc71', '#3498db', '#f1c40f', '#e74c3c'] },
            hole: 0.4
        }], {margin:{t:0,b:0,l:0,r:0}});
    }

    async function runAI() {
        const out = document.getElementById('aiOutput');
        out.style.display = 'block';
        out.innerText = "Анализ данных...";
        if(window.SBI_LLM) {
            const res = await SBI_LLM.interpret("Сделай обзор успеваемости.");
            out.innerText = res;
        } else {
            out.innerText = "Модуль ИИ не загружен.";
        }
    }

    return { update };
})();
