let charts = {};

// 1. Logic cho trang Nhập liệu (index.ejs)
const form = document.getElementById('work-form');
if (form) {
    form.addEventListener('submit', async (e) => { // Thêm async để dùng await
        e.preventDefault();
        const date = document.getElementById('date').value;
        const start = new Date(`${date}T${document.getElementById('start-time').value}`);
        let end = new Date(`${date}T${document.getElementById('end-time').value}`);
        if (end <= start) end.setDate(end.getDate() + 1);

        const result = calculateSalary(start, end, parseInt(document.getElementById('break-time').value), parseInt(document.getElementById('hourly-wage').value));
        
        if (!result) return alert("Error!");

        const newItem = {
            id: Date.now(),
            job: document.getElementById('job-name').value,
            date,
            ...result,
            month: date.substring(0, 7)
        };

        // GỬI DỮ LIỆU LÊN SERVER (FIREBASE)
        try {
            const response = await fetch('/api/workdata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newItem)
            });

            if (response.ok) {
                alert("Đã lưu lên Firebase Cloud!");
                form.reset();
                // Cập nhật lại mảng workData toàn cục và render lại nếu cần
                await loadData(); 
            }
        } catch (error) {
            alert("Lỗi kết nối server!");
        }
    });
}

// 2. Logic cho trang Lịch sử (history.ejs)
function renderHistory() {
    const body = document.getElementById('history-body');
    if (!body) return;
    
    const filter = document.getElementById('filter-month').value;
    body.innerHTML = '';
    
    // workData lúc này đã được hàm loadData() ở core.js tải về
    const filtered = filter ? workData.filter(d => d.month === filter) : workData;
    
    filtered.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(item => {
        const otText = i18n[currentLang].ot_label;
        const nightText = i18n[currentLang].night_label;

        let detailArr = [];
        const otVal = parseFloat(item.overtimeHours || 0);
        const nightVal = parseFloat(item.nightHours || 0);

        if (otVal > 0) detailArr.push(`${otText}: ${otVal}h`);
        if (nightVal > 0) detailArr.push(`${nightText}: ${nightVal}h`);

        const detailHtml = detailArr.length > 0 
            ? `<br><small style="color: #ef4444; font-size: 0.75rem;">(${detailArr.join(' | ')})</small>` 
            : '';

        body.innerHTML += `
            <tr>
                <td>${item.date}</td>
                <td><strong>${item.job}</strong></td>
                <td>
                    <span style="font-weight: 500;">${item.totalHours}h</span>
                    ${detailHtml}
                </td>
                <td style="font-weight: bold;">${item.salary.toLocaleString()} ¥</td>
                <td>
                    <button onclick="deleteItem(${item.id})" 
                            style="color:#e74c3c; border:none; background:none; cursor:pointer; font-size: 1.2rem;">
                        &times;
                    </button>
                </td>
            </tr>`;
    });
}

// 3. Logic Xóa (Kết nối API DELETE)
async function deleteItem(id) {
    if(confirm("Bạn có chắc chắn muốn xóa ca làm này trên Firebase?")) {
        try {
            const response = await fetch(`/api/workdata/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Tải lại dữ liệu mới từ Firebase sau khi xóa
                await loadData(); 
            }
        } catch (error) {
            console.error("Lỗi khi xóa:", error);
        }
    }
}

// 4. Logic cho trang Biểu đồ (charts.ejs)
function updateAllCharts() {
    if (!document.getElementById('daysChart')) return;
    const labels = i18n[currentLang];
    
    const daily = {}; workData.forEach(d => daily[d.date] = (daily[d.date] || 0) + d.salary);
    const last5d = Object.keys(daily).sort().slice(-5);
    renderChart('daysChart', 'bar', last5d, last5d.map(k => daily[k]), labels.last5d);

    const monthly = {}; workData.forEach(d => monthly[d.month] = (monthly[d.month] || 0) + d.salary);
    const last5m = Object.keys(monthly).sort().slice(-5);
    renderChart('monthsChart', 'bar', last5m, last5m.map(k => monthly[k]), labels.last5m);
}

// Giữ nguyên handleSearchDay và renderChart vì chúng dùng workData trong bộ nhớ
function handleSearchDay() {
    const date = document.getElementById('chart-date-selector').value;
    const dayData = workData.filter(d => d.date === date);
    const summary = document.getElementById('day-summary');
    
    if (dayData.length === 0) {
        summary.innerText = i18n[currentLang].empty;
        if (charts['pie']) charts['pie'].destroy();
        return;
    }

    let total = 0; const pLabels = [], pValues = [];
    dayData.forEach(d => { pLabels.push(d.job); pValues.push(d.salary); total += d.salary; });
    summary.innerText = `${i18n[currentLang].total_day}: ${total.toLocaleString()} ¥`;
    renderChart('selectedDayPieChart', 'pie', pLabels, pValues, i18n[currentLang].job_name);
}

function renderChart(canvasId, type, labels, data, title) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (charts[canvasId]) charts[canvasId].destroy();
    charts[canvasId] = new Chart(ctx, {
        type,
        data: { labels, datasets: [{ label: title, data, backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444'] }] }
    });
}

// Khởi chạy
document.addEventListener('DOMContentLoaded', () => {
    applyLanguage();
    if (document.getElementById('lang-switch')) document.getElementById('lang-switch').value = currentLang;
    if (document.getElementById('date')) document.getElementById('date').valueAsDate = new Date();
    if (document.getElementById('chart-date-selector')) document.getElementById('chart-date-selector').valueAsDate = new Date();
});