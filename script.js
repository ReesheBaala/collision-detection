const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

let model;
let isDetecting = false;
let voiceAlertPlaying = false;
const WARNING_DISTANCE = 0.8; // Distance threshold in meters
const FOCAL_LENGTH = 800;
const KNOWN_WIDTH = { "person": 0.5, "car": 1.8, "bus": 2.5, "motorcycle": 1.2, "truck": 2.8 };

// ✅ Open Camera with OTG Support & Mobile Back Camera
async function startVideo() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === "videoinput");

        console.log("🔍 Available Cameras:", videoDevices);

        if (videoDevices.length === 0) {
            alert("⚠️ No camera detected. Please connect an OTG webcam.");
            return;
        }

        // 🔹 Select External OTG Webcam (Prioritize USB Cameras)
        let otgCamera = videoDevices.find(device => 
            device.label.toLowerCase().includes("usb") || 
            device.label.toLowerCase().includes("otg") ||
            device.label.toLowerCase().includes("external") ||
            device.label.toLowerCase().includes("hd")
        );

        // 🔹 If no OTG camera found, fallback to last connected camera
        if (!otgCamera) {
            alert("⚠️ No OTG webcam detected! Selecting the last available camera.");
            otgCamera = videoDevices[videoDevices.length - 1];
        }

        console.log("🎥 Selected Camera:", otgCamera.label);

        // ✅ Open the Selected Camera
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: otgCamera.deviceId }
        });

        video.srcObject = stream;
    } catch (error) {
        console.error("❌ Error accessing OTG webcam:", error);
        alert("⚠️ Unable to access OTG webcam. Please check your connection.");
    }
}



// ✅ Load AI Model
async function loadModel() {
    model = await cocoSsd.load();
    console.log("✅ Model Loaded!");
}

// ✅ Estimate Distance
function estimateDistance(bboxWidth, objectType) {
    if (!KNOWN_WIDTH[objectType]) return Infinity;
    return (KNOWN_WIDTH[objectType] * FOCAL_LENGTH) / bboxWidth;
}

// ✅ Play Voice Alert
function playVoiceAlert(message) {
    if (!voiceAlertPlaying) {
        voiceAlertPlaying = true;
        const speech = new SpeechSynthesisUtterance(message);
        speech.onend = () => voiceAlertPlaying = false;
        window.speechSynthesis.speak(speech);
    }
}

// ✅ Draw Bounding Box
function drawBoundingBox(x, y, width, height, text, color = "red") {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = color;
    ctx.fillRect(x, y - 20, ctx.measureText(text).width + 10, 20);

    ctx.fillStyle = "white";
    ctx.fillText(text, x + 5, y - 5);
}

// ✅ Detect Objects
async function detectObjects() {
    if (!isDetecting) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const predictions = await model.detect(video);

    predictions.forEach(pred => {
        const [x, y, width, height] = pred.bbox;
        const label = pred.class.toLowerCase();
        const distance = estimateDistance(width, label);

        let boxColor = "green";
        if (distance < WARNING_DISTANCE) {
            boxColor = "red";
            playVoiceAlert(`Warning! ${label} too close!`);
            capturePhotoAndSendAlert(label, distance);
        }

        drawBoundingBox(x, y, width, height, `${label} - ${distance.toFixed(2)}m`, boxColor);
    });

    requestAnimationFrame(detectObjects);
}

// ✅ Capture Photo & Send Alert
function capturePhotoAndSendAlert(objectType, distance) {
    navigator.geolocation.getCurrentPosition(position => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        canvas.toBlob(blob => {
            let formData = new FormData();
            formData.append("message", `🚨 ALERT: ${objectType} detected too close!`);
            formData.append("latitude", latitude);
            formData.append("longitude", longitude);
            formData.append("photo", blob, "detected_object.png");

            fetch("http://localhost:5000/send-alert", {
                method: "POST",
                body: formData
            }).then(response => console.log("✅ Alert Sent!"))
            .catch(error => console.error("❌ Error:", error));
        }, "image/png");
    });
}

// ✅ Start & Stop Detection
startBtn.addEventListener("click", async () => {
    isDetecting = true;
    await startVideo();
    await loadModel();
    detectObjects();
});

stopBtn.addEventListener("click", () => {
    isDetecting = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});
