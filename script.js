console.log("Loading face-api.js...");

// Load models from the models directory
Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models')
])
    .then(() => {
        console.log("Model loaded successfully!");
        startVideo();
    })
    .catch(err => console.error("Error loading models: ", err));

// Start video from the webcam
function startVideo() {
    const video = document.getElementById('video');
    if (!video) {
        console.error("Video element not found in HTML!");
        return;
    }

    navigator.mediaDevices
        .getUserMedia({ video: true })
        .then(stream => {
            console.log("Webcam activated!");
            video.srcObject = stream;
        })
        .catch(err => console.error("Webcam error: ", err));
}

// Student data (sample images for comparison)
async function loadLabeledImages() {
    const labels = ['Le_Hoang_Tay', 'Ly_Anh_Thi', 'Nguyen_Thien_Quy']; // List of students
    console.log("Loading sample images...");
    
    try {
        const results = await Promise.all(
            labels.map(async label => {
                const descriptions = [];
                for (let i = 1; i <= 5; i++) { // Assume each student has 5 images
                    try {
                        const imgUrl = `/images/${label}/${i}.jpg`;
                        console.log(`Loading image: ${imgUrl}`);
                        const img = await faceapi.fetchImage(imgUrl);
                        const detections = await faceapi.detectSingleFace(img)
                            .withFaceLandmarks()
                            .withFaceDescriptor();
                        
                        if (!detections) {
                            console.warn(`No face detected in image: ${imgUrl}`);
                            continue;
                        }
                        
                        descriptions.push(detections.descriptor);
                        console.log(`Loaded face data from image ${i} of ${label}`);
                    } catch (err) {
                        console.error(`Error processing image ${i} of ${label}: `, err);
                    }
                }

                if (descriptions.length > 0) {
                    return new faceapi.LabeledFaceDescriptors(label, descriptions);
                }
                return null;
            })
        );

        const validResults = results.filter(result => result !== null);
        console.log(`Number of students loaded successfully: ${validResults.length}`);
        return validResults;
    } catch (err) {
        console.error("Error loading sample images: ", err);
        return [];
    }
}

// Manage attendance list
let attendanceRecords = [];

// Function to update the attendance table
function updateAttendanceTable(name, timestamp) {
    const formattedName = name.split("_").join(" ");

    const existingRecord = attendanceRecords.find(record => record.name === formattedName);
    const tbody = document.getElementById('attendanceBody');
    const resultDiv = document.getElementById('result');

    if (!existingRecord) {
        attendanceRecords.push({ name: formattedName, timestamp });
        const row = document.createElement('tr');
        row.innerHTML = `<td>${formattedName}</td><td>${timestamp}</td>`;
        tbody.appendChild(row);
        resultDiv.innerText = `Student: ${formattedName} - Attendance recorded successfully`;
        saveAttendance(formattedName, timestamp);
        console.log(`Added ${formattedName} to the attendance list`);
    } else {
        resultDiv.innerText = `Student: ${formattedName} - Already marked present`;
        console.log(`${formattedName} has already checked in`);
    }
}

// Send attendance data to the server
async function saveAttendance(name, timestamp) {
    try {
        const response = await fetch('/save-attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, timestamp })
        });
        const data = await response.json();
        console.log(`Sent: ${name} checked in at ${timestamp} - ${data.message}`);
    } catch (err) {
        console.error("Error sending attendance data: ", err);
    }
}

// Face recognition
const video = document.getElementById('video');
if (video) {
    video.addEventListener('play', async () => {
        console.log("Video started, initializing recognition...");
        const labeledFaceDescriptors = await loadLabeledImages();
        if (labeledFaceDescriptors.length === 0) {
            document.getElementById('result').innerText = "Error: No student data available!";
            console.error("No student data for recognition!");
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
                    console.error("Result element not found in HTML!");
                    return;
                }

                if (detections.length > 0) {
                    const results = detections.map(d => faceMatcher.findBestMatch(d.descriptor));
                    results.forEach((result) => {
                        const name = result.toString().includes('unknown') ? 'Unrecognized' : result.label;
                        if (name !== 'Unrecognized') {
                            const timestamp = new Date().toLocaleString();
                            updateAttendanceTable(name, timestamp);
                        } else {
                            resultDiv.innerText = 'Unrecognized face';
                        }
                    });
                } else {
                    resultDiv.innerText = 'No face detected';
                }
            } catch (err) {
                console.error("Error during face recognition: ", err);
            }
        }, 1000);
    });
} else {
    console.error("Video element not found to attach event!");
}

// Handle Export to Excel button
document.getElementById('exportExcel').addEventListener('click', async () => {
    try {
        const response = await fetch('/export-excel', {
            method: 'GET'
        });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'attendance.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Error exporting to Excel: ", err);
    }
});
