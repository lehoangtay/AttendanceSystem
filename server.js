const http = require('http');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs'); // Add ExcelJS package

const server = http.createServer((req, res) => {
    // Handle attendance saving request
    if (req.url === '/save-attendance' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            const { name, timestamp } = JSON.parse(body);
            const now = new Date();
            const startHour = 8;  // 8:00 AM
            const endHour = 9;    // 9:00 AM

            if (now.getHours() < startHour || now.getHours() >= endHour) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Outside attendance time' }));
                return;
            }

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
            res.end(JSON.stringify({ message: 'Attendance has been recorded' }));
        });
    } 
    // Handle Excel export request
    else if (req.url === '/export-excel' && req.method === 'GET') {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance List');
        worksheet.columns = [
            { header: 'Student Name', key: 'name', width: 20 },
            { header: 'Timestamp', key: 'timestamp', width: 30 }
        ];

        const attendanceFile = 'attendance.json';
        if (fs.existsSync(attendanceFile)) {
            const attendanceData = JSON.parse(fs.readFileSync(attendanceFile));
            attendanceData.forEach(record => worksheet.addRow(record));
        }

        res.writeHead(200, {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename=attendance.xlsx'
        });
        workbook.xlsx.write(res).then(() => res.end());
    } 
    // Serve static files
    else {
        let filePath = '.' + req.url;
        if (filePath === './') filePath = './index.html';

        const extname = path.extname(filePath);
        let contentType = 'text/html';
        switch (extname) {
            case '.js': contentType = 'text/javascript'; break;
            case '.json': contentType = 'application/json'; break;
            case '.jpg': contentType = 'image/jpeg'; break;
            case '.png': contentType = 'image/png'; break;
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'binary');
            }
        });
    }
});

server.listen(8080, '0.0.0.0', () => console.log('Server running at http://localhost:8080'));
