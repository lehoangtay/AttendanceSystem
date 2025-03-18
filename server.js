const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    if (req.url === '/save-attendance' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            const { name, timestamp } = JSON.parse(body);
            const attendanceFile = 'attendance.json';
            let attendanceData = [];

            if (fs.existsSync(attendanceFile)) {
                const rawData = fs.readFileSync(attendanceFile);
                attendanceData = JSON.parse(rawData);
            }

            if (!attendanceData.some(record => record.name === name)) {
                attendanceData.push({ name, timestamp });
                fs.writeFileSync(attendanceFile, JSON.stringify(attendanceData, null, 2));
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Điểm danh đã được lưu' }));
        });
    } else {
        let filePath = '.' + req.url;
        if (filePath === './') filePath = './index.html';

        const extname = path.extname(filePath);
        let contentType = 'text/html'; // Mặc định
        switch (extname) {
            case '.js':
                contentType = 'text/javascript';
                break;
            case '.json':
                contentType = 'application/json';
                break;
            case '.jpg': // Thêm hỗ trợ ảnh JPEG
                contentType = 'image/jpeg';
                break;
            case '.png': // Thêm nếu dùng PNG
                contentType = 'image/png';
                break;
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'binary'); // Gửi dữ liệu ảnh dưới dạng binary
            }
        });
    }
});

server.listen(8080, () => console.log('Server running at http://localhost:8080'));