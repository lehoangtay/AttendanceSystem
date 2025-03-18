console.log("Đang tải face-api.js...");

// Tải mô hình từ thư mục models
Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models')
])
    .then(() => {
        console.log("Tải mô hình thành công!");
        startVideo();
    })
    .catch(err => console.error("Lỗi khi tải mô hình: ", err));

// Khởi động video từ webcam
function startVideo() {
    const video = document.getElementById('video');
    if (!video) {
        console.error("Không tìm thấy thẻ video trong HTML!");
        return;
    }

    navigator.mediaDevices
        .getUserMedia({ video: true })
        .then(stream => {
            console.log("Webcam đã được kích hoạt!");
            video.srcObject = stream;
        })
        .catch(err => console.error("Lỗi webcam: ", err));
}

// Dữ liệu sinh viên (ảnh mẫu để so sánh)
async function loadLabeledImages() {
    const labels = ['SinhVien1', 'SinhVien2']; // Thay bằng tên sinh viên thực tế
    console.log("Đang tải ảnh mẫu...");
    try {
        const results = await Promise.all(
            labels.map(async label => {
                const descriptions = [];
                try {
                    console.log(`Tải ảnh: /images/${label}.jpg`);
                    const img = await faceapi.fetchImage(`/images/${label}.jpg`);
                    const detections = await faceapi.detectSingleFace(img)
                        .withFaceLandmarks()
                        .withFaceDescriptor();

                    if (!detections) {
                        console.warn(`Không tìm thấy khuôn mặt trong ảnh: ${label}.jpg`);
                        return null;
                    }

                    descriptions.push(detections.descriptor);
                    console.log(`Đã tải dữ liệu khuôn mặt của ${label}`);
                    return new faceapi.LabeledFaceDescriptors(label, descriptions);
                } catch (err) {
                    console.error(`Lỗi khi xử lý ảnh ${label}: `, err);
                    return null;
                }
            })
        );
        const validResults = results.filter(result => result !== null);
        console.log(`Số sinh viên tải thành công: ${validResults.length}`);
        return validResults;
    } catch (err) {
        console.error("Lỗi khi tải ảnh mẫu: ", err);
        return [];
    }
}

// Quản lý danh sách điểm danh
let attendanceRecords = [];

function updateAttendanceTable(name, timestamp) {
    const existingRecord = attendanceRecords.find(record => record.name === name);
    const tbody = document.getElementById('attendanceBody');
    const resultDiv = document.getElementById('result');

    if (!existingRecord) {
        attendanceRecords.push({ name, timestamp });
        const row = document.createElement('tr');
        row.innerHTML = `<td>${name}</td><td>${timestamp}</td>`;
        tbody.appendChild(row);
        resultDiv.innerText = `Sinh viên: ${name} - Điểm danh thành công`;
        saveAttendance(name, timestamp);
        console.log(`Đã thêm ${name} vào danh sách điểm danh`);
    } else {
        resultDiv.innerText = `Sinh viên: ${name} - Đã được điểm danh`;
        console.log(`${name} đã điểm danh trước đó`);
    }
}

// Gửi dữ liệu điểm danh lên server
async function saveAttendance(name, timestamp) {
    try {
        const response = await fetch('/save-attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, timestamp })
        });
        console.log(`Đã gửi: ${name} điểm danh lúc ${timestamp}`);
    } catch (err) {
        console.error("Lỗi khi gửi dữ liệu điểm danh: ", err);
    }
}

// Nhận diện khuôn mặt
const video = document.getElementById('video');
if (video) {
    video.addEventListener('play', async () => {
        console.log("Video bắt đầu chạy, khởi tạo nhận diện...");
        const labeledFaceDescriptors = await loadLabeledImages();
        if (labeledFaceDescriptors.length === 0) {
            document.getElementById('result').innerText = "Lỗi: Không có dữ liệu sinh viên!";
            console.error("Không có dữ liệu sinh viên để nhận diện!");
            return;
        }

        const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

        setInterval(async () => {
            try {
                const detections = await faceapi.detectAllFaces(video)
                    .withFaceLandmarks()
                    .withFaceDescriptors();

                const resultDiv = document.getElementById('result');
                if (!resultDiv) {
                    console.error("Không tìm thấy phần tử result trong HTML!");
                    return;
                }

                if (detections.length > 0) {
                    const results = detections.map(d => faceMatcher.findBestMatch(d.descriptor));
                    results.forEach((result) => {
                        const name = result.toString().includes('unknown') ? 'Không nhận diện được' : result.label;
                        if (name !== 'Không nhận diện được') {
                            const timestamp = new Date().toLocaleString();
                            updateAttendanceTable(name, timestamp);
                        } else {
                            resultDiv.innerText = 'Không nhận diện được';
                        }
                    });
                } else {
                    resultDiv.innerText = 'Không phát hiện khuôn mặt';
                }
            } catch (err) {
                console.error("Lỗi khi nhận diện khuôn mặt: ", err);
            }
        }, 1000);
    });
} else {
    console.error("Không tìm thấy thẻ video để gắn sự kiện!");
}