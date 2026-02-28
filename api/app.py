from flask import Flask, render_template, jsonify, request
import firebase_admin
from firebase_admin import credentials, firestore
import os
import json
from dotenv import load_dotenv

# Load .env file
load_dotenv()

app = Flask(__name__)

# Firebase Config to pass to frontend
firebase_config = {
    "apiKey": os.getenv("FIREBASE_API_KEY"),
    "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
    "projectId": os.getenv("FIREBASE_PROJECT_ID"),
    "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
    "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
    "appId": os.getenv("FIREBASE_APP_ID")
}

# Initialize Firebase Admin (Backend tasks)
db = None
try:
    cred_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')
    if cred_json:
        cred_dict = json.loads(cred_json)
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()
    
    db = firestore.client()
    print("Firebase Admin: Successfully connected to Firestore.")
except Exception as e:
    print(f"Firebase Admin Warning: {e}")

@app.route('/')
def index():
    return render_template('index.html', firebase_config=firebase_config)

@app.route('/login')
def login():
    return render_template('login.html', firebase_config=firebase_config)

@app.route('/api/status')
def status():
    return jsonify({
        "status": "online",
        "firebase_admin": db is not None
    })

@app.route('/api/audit', methods=['POST'])
def log_audit():
    if not db:
        return jsonify({"error": "DB not initialized"}), 500
    
    data = request.json
    db.collection('audit_logs').add({
        **data,
        'timestamp': firestore.SERVER_TIMESTAMP
    })
    return jsonify({"success": True}), 201

if __name__ == '__main__':
    app.run(debug=True, port=5000)
