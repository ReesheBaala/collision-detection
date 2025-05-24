import requests
import time
import os
from flask import Flask, request, jsonify
from flask_cors import CORS  

app = Flask(__name__)
CORS(app)

TOKEN = "7595715162:AAEzx3zpJfuhEW5ZdDSGyC8OSxB4v5ScSpo"
CHAT_ID = "1114449056"

TELEGRAM_TEXT_URL = f"https://api.telegram.org/bot{TOKEN}/sendMessage"
TELEGRAM_PHOTO_URL = f"https://api.telegram.org/bot{TOKEN}/sendPhoto"
TELEGRAM_LOCATION_URL = f"https://api.telegram.org/bot{TOKEN}/sendLocation"

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)  

# ✅ Cooldown to prevent spam
last_alert_time = 0  
COOLDOWN_SECONDS = 10  

def send_telegram_message(message):
    data = {"chat_id": CHAT_ID, "text": message}
    return requests.post(TELEGRAM_TEXT_URL, data=data).json()

def send_telegram_photo(photo_path):
    with open(photo_path, "rb") as photo:
        files = {"photo": photo}
        data = {"chat_id": CHAT_ID, "caption": "🚨 Object Detected!"}
        return requests.post(TELEGRAM_PHOTO_URL, data=data, files=files).json()

def send_telegram_location(latitude, longitude):
    data = {"chat_id": CHAT_ID, "latitude": latitude, "longitude": longitude}
    return requests.post(TELEGRAM_LOCATION_URL, data=data).json()

@app.route("/send-alert", methods=["POST"])
def send_alert():
    global last_alert_time
    current_time = time.time()
    
    if current_time - last_alert_time < COOLDOWN_SECONDS:
        return jsonify({"status": "error", "message": "Alert cooldown active"})

    data = request.form
    message = data.get("message", "🚨 Object detected!")
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    
    file = request.files.get("photo")
    photo_path = None
    if file:
        photo_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(photo_path)
    
    send_telegram_message(message)

    if photo_path:
        send_telegram_photo(photo_path)
    
    if latitude and longitude:
        send_telegram_location(latitude, longitude)

    last_alert_time = current_time
    return jsonify({"status": "success", "message": "Alert sent!"})

if __name__ == "__main__":
    app.run(debug=True, port=5000)
