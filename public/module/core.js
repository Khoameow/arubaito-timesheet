let workData = []; 
let currentLang = localStorage.getItem('appLang') || 'vi';

// Hàm lấy dữ liệu từ Firebase thông qua Server Node.js
async function loadData() {
    try {
        const response = await fetch('/api/workdata');
        workData = await response.json();
        
        // Tùy vào trang bạn đang đứng mà gọi hàm hiển thị tương ứng
        if (typeof renderHistory === 'function') renderHistory();
        if (typeof updateAllCharts === 'function') updateAllCharts();
    } catch (error) {
        console.error("Không thể tải dữ liệu từ Firebase:", error);
    }
}

// Gọi hàm tải dữ liệu ngay khi load file js
loadData();
// Hàm tính lương chuẩn Nhật (Tách biệt OT cho từng phiên làm việc)
function calculateSalary(start, end, breakMin, wage) {
    // 1. Tính tổng giờ làm việc thực tế của MỘT phiên này
    const totalMs = end - start - (breakMin * 60000);
    const totalHours = totalMs / 3600000;
    
    if (totalHours <= 0) return null;

    // 2. Tính Overtime (OT): Chỉ tính nếu bản thân CÔNG VIỆC NÀY kéo dài trên 8 tiếng
    // Nếu Job A (3h) và Job B (6h) nhập riêng biệt, totalHours từng lần sẽ < 8, dẫn đến otHours = 0
    let otHours = totalHours > 8 ? totalHours - 8 : 0;

    // 3. Tính lương ca đêm (Soji/Yakin - 22h đến 05h sáng)
    let nightHours = 0;
    let curr = new Date(start);
    while (curr < end) {
        const h = curr.getHours();
        // Kiểm tra xem khung giờ có nằm trong khoảng 22h - 5h sáng không
        if (h >= 22 || h < 5) {
            nightHours += 0.25; // Cộng 15 phút
        }
        curr.setTime(curr.getTime() + 15 * 60000); // Bước nhảy 15 phút
    }
    
    // Khấu trừ thời gian nghỉ vào ca đêm theo tỷ lệ (giữ nguyên logic cũ của bạn)
    if (nightHours > 0) {
        const totalDurationHours = (end - start) / 3600000;
        const ratio = (breakMin / 60) / totalDurationHours;
        nightHours -= nightHours * ratio;
    }

    // 4. Tính tổng lương
    // Lương = (Giờ làm * Lương) + (Giờ OT * 25%) + (Giờ Đêm * 25%)
    const salary = Math.round(
        (totalHours * wage) + 
        (otHours * wage * 0.25) + 
        (nightHours * wage * 0.25)
    );
    
    return {
        totalHours: totalHours.toFixed(2),
        overtimeHours: otHours.toFixed(2),
        nightHours: nightHours.toFixed(2),
        salary: salary
    };
}

// Giữ nguyên các hàm xử lý ngôn ngữ
function applyLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[currentLang][key]) el.innerText = i18n[currentLang][key];
    });
}

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('appLang', lang);
    location.reload();
}