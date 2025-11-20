window.SBI_Class = (function() {
    function update() {
        if (!SBI.state.isLoaded) return;

        const selTerm = document.getElementById('clTerm');
        const selCls = document.getElementById('clSelect');
        
        if (selTerm.options.length === 0) {
            SBI.state.terms.forEach(t => selTerm.innerHTML += `<option value="${t.term_id}">${t.term_id}</option>`);
            SBI.state.classes.forEach(c => selCls.innerHTML += `<option value="${c.class_id}">${c.class_name}</option>`);
            
            selTerm.addEventListener('change', update);
            selCls.addEventListener('change', renderDonut);
            document.getElementById('clMetric').addEventListener('change', renderTable);
        }
        
        renderTable();
        renderDonut();
    }

    function renderTable() {
        const metric = document.getElementById('clMetric').value;
        const div = document.getElementById('clTable');
        const terms = SBI.state.terms.map(t => t.term_id).sort();
        
        let html = `<table><thead><tr><th>Класс</th><th>Руководитель</th>`;
        terms.forEach(t => html += `<th>${t}</th>`);
        html += `</tr></thead><tbody>`;
        
        SBI.state.classes.forEach(c => {
            const tName = SBI.state.teachers.find(t => t.teacher_id === c.homeroom_teacher_id);
            const teacher = tName ? `${tName.last_name} ${tName.first_name}` : '-';
            
            html += `<tr><td>${c.class_name}</td><td>${teacher}</td>`;
            terms.forEach(t => {
                const rows = SBI.state.processedGrades.filter(r => r.class_id === c.class_id && r.term_id === t);
                let val = '-';
                let bg = '';
                if (rows.length) {
                    if (metric === 'avg') {
                        val = (rows.reduce((a,b)=>a+b.grade,0)/rows.length).toFixed(2);
                        bg = parseFloat(val) >= 4 ? '#dff0d8' : '#fcf8e3';
                    } else {
                        val = Math.round((rows.filter(r=>r.grade>=4).length/rows.length)*100) + '%';
                        bg = parseInt(val) > 50 ? '#dff0d8' : '#fcf8e3';
                    }
                }
                html += `<td style="background:${bg}">${val}</td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody></table>`;
        div.innerHTML = html;
    }

    function renderDonut() {
        const cls = document.getElementById('clSelect').value;
        const term = document.getElementById('clTerm').value;
        if (!cls) return;
        
        const counts = { 'Отличник':0, 'Хорошист':0, 'Троечник':0, 'Двоечник':0 };
        // Need students in this class
        const enrolls = SBI.state.enrollments.filter(e => e.class_id === cls && e.term_id === term);
        enrolls.forEach(e => {
            const status = SBI.state.studentStatuses[`${e.student_id}|${term}`];
            if (status) counts[status]++;
        });

        Plotly.newPlot('clDonut', [{
            values: Object.values(counts),
            labels: Object.keys(counts),
            type: 'pie',
            hole: 0.4,
            marker: { colors: ['#2ecc71', '#3498db', '#f1c40f', '#e74c3c'] }
        }], {margin: {t:0,b:0}});
    }

    return { update };
})();
