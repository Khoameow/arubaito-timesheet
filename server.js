const express = require('express');
const admin = require('firebase-admin');
const path = require('path');
const useragent = require('useragent');
const app = express();

// 1. Khởi tạo Firebase Admin
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const workCollection = db.collection('workData');
const logCollection = db.collection('logs'); // Collection riêng cho nhật ký

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// --- HÀM GHI LOG LÊN FIREBASE (CHỈ DÀNH CHO THÊM/XÓA) ---
async function writeLog(action, req, details = {}) {
    const agent = useragent.parse(req.headers['user-agent']);
    const device = agent.toString();
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const logData = {
        action: action,
        device: device,
        ip: ip,
        details: details, // Lưu thêm thông tin như tên Job hoặc ngày làm
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        timeStr: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Tokyo' })
    };

    try {
        await logCollection.add(logData);
    } catch (error) {
        console.error("Lỗi ghi log Firebase:", error);
    }
}

// --- API FIREBASE ---

// Lấy dữ liệu hiển thị
app.get('/api/workdata', async (req, res) => {
    try {
        const snapshot = await workCollection.orderBy('date', 'desc').get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(data);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Lưu ca làm mới + Ghi Log
app.post('/api/workdata', async (req, res) => {
    try {
        const newItem = req.body;
        await workCollection.add(newItem);
        
        // GHI LOG KHI THÊM
        await writeLog("THÊM_CA_LÀM", req, { job: newItem.job, date: newItem.date });
        
        res.status(201).json({ message: "Đã lưu thành công!" });
    } catch (error) {
        res.status(500).send(error);
    }
});

// Xóa ca làm + Ghi Log
app.delete('/api/workdata/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const query = workCollection.where('id', '==', parseInt(id));
        const snapshot = await query.get();
        
        if (snapshot.empty) return res.status(404).json({ message: "Không tìm thấy" });

        for (const doc of snapshot.docs) {
            const data = doc.data();
            // GHI LOG KHI XÓA
            await writeLog("XÓA_CA_LÀM", req, { job: data.job, date: data.date });
            await doc.ref.delete();
        }
        
        res.json({ message: "Đã xóa!" });
    } catch (error) {
        res.status(500).send(error);
    }
});

// Các Route giao diện (Không ghi log để tiết kiệm)
app.get('/', (req, res) => res.render('index'));
app.get('/history', (req, res) => res.render('history'));
app.get('/charts', (req, res) => res.render('charts'));

app.listen(3000, () => console.log('Server chạy tại http://localhost:3000'));