window.SBI_Class = (function() {
    function update() {
        if (!SBI.state.isLoaded) return;
        const termSel = document.getElementById('clTerm');
        const clsSel = document.getElementById('clSelect');
        
        if (termSel.options.length === 0) {
            SBI.state.terms.forEach(t => termSel.innerHTML += `<option value="${t.term_id}">${t.term_id}</option>`);
            SBI.state.classes.forEach(c => clsSel.innerHTML += `<option value="${c.class_id}">${c.class_name}</option>`);
            
            termSel.addEventListener('change', renderDonut);
            clsSel.addEventListener('change', renderDonut);
            document.getElementById('clMetric').addEventListener('change', renderTable);
        }
        renderTable();
        renderDonut();
    }

    function renderTable() {
        const metric = document.getElementById('clMetric').value;
        const terms = SBI.state.terms.map(t => t.term_id).sort();
        let html = `<table><thead><tr><th>Класс</th><th>Руководитель</th>`;
        terms.forEach(t => html += `<th>${t}</th>`);
        html += `</tr></thead><tbody>`;

        SBI.state.classes.forEach(c => {
            const tObj = SBI.state.teachers.find(t => t.teacher_id === c.homeroom_teacher_id);
            const teacher = tObj ? `${tObj.last_name} ${tObj.first_name}` : '-';
            html += `<tr><td>${c.class_name}</td><td>${teacher}</td>`;
            
            terms.forEach(t => {
                const rows = SBI.state.processedGrades.filter(r => r.class_id === c.class_id && r.term_id === t);
                let val = '-', bg = '';
                if (rows.length) {
                    if (metric === 'avg') {
                        val = (rows.reduce((a,b)=>a+b.grade,0)/rows.length).toFixed(2);
                        bg = parseFloat(val)>=4 ? '#d4edda' : '#f8d7da';
                    } else {
                        val = Math.round((rows.filter(r=>r.grade>=4).length/rows.length)*100) + '%';
                        bg = parseInt(val)>50 ? '#d4edda' : '#f8d7da';
                    }
                }
                html += `<td style="background:${bg}">${val}</td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody></table>`;
        document.getElementById('clTable').innerHTML = html;
    }

    function renderDonut() {
        const cls = document.getElementById('clSelect').value;
        const term = document.getElementById('clTerm').value;
        if(!cls) return;

        const counts = { 'Отличник':0, 'Хорошист':0, 'Троечник':0, 'Двоечник':0 };
        const enrolls = SBI.state.enrollments.filter(e => e.class_id === cls && e.term_id === term);
        
        enrolls.forEach(e => {
            const st = SBI.state.studentStatuses[`${e.student_id}|${term}`];
            if(st) counts[st]++;
        });

        Plotly.newPlot('clDonut', [{
            values: Object.values(counts), labels: Object.keys(counts), type: 'pie',
            marker: { colors: ['#2ecc71', '#3498db', '#f1c40f', '#e74c3c'] }, hole: 0.4
        }], {margin:{t:0,b:0}});
    }
    return { update };
})();
