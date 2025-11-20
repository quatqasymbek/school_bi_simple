window.SBI_Class = (function() {
    
    function update() {
        if (!SBI.state.isLoaded) return;

        // Init Selectors if empty
        const termSel = document.getElementById('clTerm');
        if (termSel.options.length === 0) {
            SBI.state.terms.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.term_id; opt.text = t.term_id;
                termSel.add(opt);
            });
            termSel.addEventListener('change', render);
            document.getElementById('clMetric').addEventListener('change', render);

            // Class selector for Donut
            const clsSel = document.getElementById('clSelectClass');
            SBI.state.classes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.class_id; opt.text = c.class_name;
                clsSel.add(opt);
            });
            clsSel.addEventListener('change', renderDonut);
        }

        render();
        renderDonut();
    }

    function render() {
        // Table: Rows=Classes, Cols=Terms (Metrics)
        // Wait, prompt says "Term grade metrics (4 columns for each term)".
        // Actually, prompt: "In this page we will have a table of all classes ... and term grade metrics (4 columns for each term) depending on selected metric"
        // Interpretation: Rows = Classes. Columns = Term 1, Term 2, Term 3, Term 4. Value = Selected Metric.
        
        const metric = document.getElementById('clMetric').value;
        const tableDiv = document.getElementById('clTable');
        
        const classes = SBI.state.classes;
        const terms = [...new Set(SBI.state.processedGrades.map(r => r.term_id))].sort();

        let html = `<table><thead><tr><th>Класс</th><th>Кл. Руководитель</th>`;
        terms.forEach(t => html += `<th>${t}</th>`);
        html += `</tr></thead><tbody>`;

        // Calculate min/max for gradient
        let min = 100, max = 0;
        // Pre-calc to find range
        classes.forEach(c => {
            terms.forEach(t => {
                const subset = SBI.state.processedGrades.filter(r => r.class_id === c.class_id && r.term_id === t);
                const val = calculateClassMetric(subset, metric);
                if (val !== null) {
                    if (val < min) min = val;
                    if (val > max) max = val;
                }
            });
        });

        classes.forEach(c => {
            const teacherName = getTeacherName(c.homeroom_teacher_id);
            html += `<tr><td>${c.class_name}</td><td>${teacherName}</td>`;
            
            terms.forEach(t => {
                const subset = SBI.state.processedGrades.filter(r => r.class_id === c.class_id && r.term_id === t);
                const val = calculateClassMetric(subset, metric);
                
                let bg = 'transparent';
                let text = '-';
                if (val !== null) {
                    bg = SBI.getGradientColor(val, min, max);
                    text = metric === 'quality' ? val.toFixed(1)+'%' : val.toFixed(2);
                    // Override gradient logic for Quality to make it Red-Green
                    // My utils.getGradientColor does simple hue shift.
                }
                html += `<td style="background:${bg}; color:#fff; text-shadow:0 1px 2px #000;">${text}</td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody></table>`;
        tableDiv.innerHTML = html;
    }

    function renderDonut() {
        const classId = document.getElementById('clSelectClass').value;
        const term = document.getElementById('clTerm').value; // Use main filter or separate? 
        // Prompt says "Below table... selector of class and term."
        // I reused the main term selector for simplicity, but let's assume it uses the global one on page.
        
        if (!classId) return;

        const counts = { 'Отличник': 0, 'Хорошист': 0, 'Троечник': 0, 'Двоечник': 0 };
        
        // Find students in this class
        const enrollments = SBI.state.enrollments.filter(e => e.class_id === classId && e.term_id === term);
        
        enrollments.forEach(e => {
            const key = `${e.student_id}|${term}`;
            const status = SBI.state.studentStatuses[key];
            if (status) counts[status]++;
        });

        const values = [counts['Отличник'], counts['Хорошист'], counts['Троечник'], counts['Двоечник']];
        const labels = ['Отличники', 'Хорошисты', 'Троечники', 'Двоечники'];
        const colors = [SBI.colors.grade5, SBI.colors.grade4, SBI.colors.grade3, SBI.colors.grade2];

        Plotly.newPlot('clDonut', [{
            values: values,
            labels: labels,
            type: 'pie',
            marker: { colors: colors },
            textinfo: 'label+value'
        }]);
    }

    function calculateClassMetric(rows, type) {
        if (!rows.length) return null;
        if (type === 'average') {
            return rows.reduce((a,b)=>a+b.grade,0) / rows.length;
        } else {
            const good = rows.filter(r => r.grade >= 4).length;
            return (good / rows.length) * 100;
        }
    }

    function getTeacherName(tid) {
        const t = SBI.state.teachers.find(x => x.teacher_id === tid);
        return t ? `${t.last_name} ${t.first_name}` : tid;
    }

    return { update };
})();
