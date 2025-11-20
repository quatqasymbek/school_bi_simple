window.SBI_Attendance = (function() {
    function update() {
        if (!SBI.state.isLoaded) return;
        const termSel = document.getElementById('atTerm');
        const clsSel = document.getElementById('atClassSel');
        if (termSel.options.length === 0) {
            SBI.state.terms.forEach(t => termSel.innerHTML += `<option value="${t.term_id}">${t.term_id}</option>`);
            SBI.state.classes.forEach(c => clsSel.innerHTML += `<option value="${c.class_id}">${c.class_name}</option>`);
            
            termSel.addEventListener('change', renderClassTable);
            clsSel.addEventListener('change', renderStudentTable);
        }
        renderClassTable();
    }

    function renderClassTable() {
        const term = document.getElementById('atTerm').value;
        const raw = SBI.state.attendanceRaw.filter(r => r.term_id === term);
        let html = `<table><thead><tr><th>Класс</th><th>% Присутствия</th><th>Опоздания</th></tr></thead><tbody>`;
        
        SBI.state.classes.forEach(c => {
            const rows = raw.filter(r => r.class_id === c.class_id);
            if(rows.length) {
                const total = rows.reduce((a,b)=>a+(parseInt(b.total_classes)||0),0);
                const pres = rows.reduce((a,b)=>a+(parseInt(b.present_classes)||0),0);
                const late = rows.reduce((a,b)=>a+(parseInt(b.late_classes)||0),0);
                const pct = total ? ((pres/total)*100).toFixed(1) : 0;
                html += `<tr><td>${c.class_name}</td><td><b>${pct}%</b></td><td>${late}</td></tr>`;
            }
        });
        html += `</tbody></table>`;
        document.getElementById('atClassTable').innerHTML = html;
    }

    function renderStudentTable() {
        const term = document.getElementById('atTerm').value;
        const cls = document.getElementById('atClassSel').value;
        const enrolls = SBI.state.enrollments.filter(e => e.class_id === cls && e.term_id === term);
        
        let html = `<table><thead><tr><th>Ученик</th><th>Всего</th><th>Присутствие</th></tr></thead><tbody>`;
        enrolls.forEach(e => {
            const rows = SBI.state.attendanceRaw.filter(r => r.student_id === e.student_id && r.term_id === term);
            const st = SBI.state.students.find(s => s.student_id === e.student_id);
            const name = st ? `${st.last_name} ${st.first_name}` : e.student_id;
            
            const total = rows.reduce((a,b)=>a+(parseInt(b.total_classes)||0),0);
            const pres = rows.reduce((a,b)=>a+(parseInt(b.present_classes)||0),0);
            const pct = total ? ((pres/total)*100).toFixed(1) : 0;
            html += `<tr><td>${name}</td><td>${total}</td><td><b>${pct}%</b></td></tr>`;
        });
        html += `</tbody></table>`;
        document.getElementById('atStudentTable').innerHTML = html;
    }
    return { update };
})();
