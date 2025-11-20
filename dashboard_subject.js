window.SBI_Subject = (function() {
    function update() {
        if (!SBI.state.isLoaded) return;
        const selTerm = document.getElementById('sbTerm');
        if (selTerm.options.length === 0) {
            SBI.state.terms.forEach(t => selTerm.innerHTML += `<option value="${t.term_id}">${t.term_id}</option>`);
            selTerm.addEventListener('change', render);
            document.getElementById('sbMetric').addEventListener('change', render);
        }
        render();
    }
    function render() {
        const term = document.getElementById('sbTerm').value;
        const metric = document.getElementById('sbMetric').value;
        
        // 1. Bar Chart
        const subjects = SBI.state.subjects;
        const data = [];
        
        subjects.forEach(s => {
            const rows = SBI.state.processedGrades.filter(r => r.subject_id === s.subject_id && r.term_id === term);
            if (rows.length) {
                let val = 0;
                if (metric === 'avg') val = SBI.mean(rows.map(r=>r.grade));
                else val = (rows.filter(r=>r.grade>=4).length/rows.length)*100;
                data.push({ name: s.subject_name, val });
            }
        });
        data.sort((a,b)=>b.val - a.val);
        
        Plotly.newPlot('sbChart', [{
            x: data.map(d=>d.name), y: data.map(d=>d.val), type: 'bar', marker: {color:'#3498db'}
        }], {margin:{b:100}});

        // 2. Heatmap (Sub x Class)
        const classes = SBI.state.classes.slice().sort((a,b)=>a.class_name.localeCompare(b.class_name));
        const z = [];
        subjects.forEach(s => {
            const row = [];
            classes.forEach(c => {
                const rows = SBI.state.processedGrades.filter(r => r.subject_id === s.subject_id && r.term_id === term && r.class_id === c.class_id);
                let val = null;
                if (rows.length) {
                    if (metric === 'avg') val = SBI.mean(rows.map(r=>r.grade));
                    else val = (rows.filter(r=>r.grade>=4).length/rows.length)*100;
                }
                row.push(val);
            });
            z.push(row);
        });

        Plotly.newPlot('sbHeatmap', [{
            z: z, x: classes.map(c=>c.class_name), y: subjects.map(s=>s.subject_name), type: 'heatmap', colorscale: 'RdYlGn'
        }], {margin:{l:150}});
    }
    return { update };
})();
