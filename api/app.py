import datetime
from flask import Flask, render_template, request, jsonify
import firebase_admin
from firebase_admin import credentials, auth, firestore, db
import os
from dotenv import load_dotenv
load_dotenv()

cred = credentials.Certificate(".auth/raikeshacks.json")
firebase_admin.initialize_app(cred)
db = firestore.client()


# python3 -m venv venv
# source venv/bin/activate
# Flask run --debug     or     flask --app app/path.py run --debug
# deactivate
app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/login")
def login():
    firebase_config = {
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.getenv("FIREBASE_APP_ID")
    }
    return render_template("login.html", firebase_config=firebase_config)

@app.route('/api/auth/google', methods=['POST'])
def verify_google_token():
    # 2. Get the token sent from the frontend
    data = request.get_json()
    id_token = data.get('idToken')

    try:
        # 3. Verify the token is legitimate
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid'] # The user's unique Firebase ID
        email = decoded_token.get('email', '')

        user_ref = db.collection('users').document(uid)
        user_ref.set({
            'email': email,
            'last_login': firestore.SERVER_TIMESTAMP
        }, merge=True)

        # Set session expiration to 5 days
        expires_in = datetime.timedelta(days=5)

        # Create the session cookie using the Firebase Admin SDK
        session_cookie = auth.create_session_cookie(id_token, expires_in=expires_in)

        # Create a Flask response
        response = jsonify({'status': 'success', 'message': 'Logged in successfully'})
        
        # Attach the secure cookie to the response
        # httponly=True prevents JavaScript from reading it (good for security)
        # secure=True ensures it only sends over HTTPS (required for Vercel)
        response.set_cookie(
            'session', 
            session_cookie, 
            expires=datetime.datetime.now(datetime.timezone.utc) + expires_in, 
            httponly=True, 
            secure=True 
        )


        return response, 200

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 401
    
if __name__ == '__main__':
    app.run(debug=True)