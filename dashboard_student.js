window.SBI_Student = (function() {
    function update() {
        if (!SBI.state.isLoaded) return;
        const clsSel = document.getElementById('stClass');
        const termSel = document.getElementById('stTerm');

        if (clsSel.options.length === 0) {
            SBI.state.classes.forEach(c => clsSel.innerHTML += `<option value="${c.class_id}">${c.class_name}</option>`);
            SBI.state.terms.forEach(t => termSel.innerHTML += `<option value="${t.term_id}">${t.term_id}</option>`);
            document.getElementById('stLoadBtn').addEventListener('click', render);
        }
    }

    function render() {
        const cls = document.getElementById('stClass').value;
        const term = document.getElementById('stTerm').value;
        const div = document.getElementById('stTable');
        
        const enrolls = SBI.state.enrollments.filter(e => e.class_id === cls && e.term_id === term);
        if (!enrolls.length) { div.innerHTML = "Нет данных."; return; }

        const assigns = SBI.state.assignments.filter(a => a.class_id === cls && a.term_id === term);
        const subIds = [...new Set(assigns.map(a => a.subject_id))];

        let html = `<table><thead><tr><th>Ученик</th><th>ID</th>`;
        subIds.forEach(s => html += `<th>${s}</th>`);
        html += `<th>Ср.Балл</th><th>Статус</th></tr></thead><tbody>`;

        enrolls.forEach(e => {
            const st = SBI.state.students.find(s => s.student_id === e.student_id);
            const name = st ? `${st.last_name} ${st.first_name}` : e.student_id;
            const status = SBI.state.studentStatuses[`${e.student_id}|${term}`] || '-';
            
            html += `<tr><td style="text-align:left">${name}</td><td>${e.student_id}</td>`;
            
            let sum=0, cnt=0;
            subIds.forEach(sid => {
                const rec = SBI.state.processedGrades.find(r => r.student_id === e.student_id && r.subject_id === sid && r.term_id === term);
                if (rec) {
                    const color = rec.grade === 5 ? 'green' : (rec.grade === 2 ? 'red' : 'black');
                    html += `<td style="color:${color}; font-weight:bold">${rec.grade}</td>`;
                    sum += rec.grade; cnt++;
                } else html += `<td>-</td>`;
            });
            
            const avg = cnt ? (sum/cnt).toFixed(2) : '-';
            html += `<td><b>${avg}</b></td><td>${status}</td></tr>`;
        });
        html += `</tbody></table>`;
        div.innerHTML = html;
    }
    return { update };
})();
