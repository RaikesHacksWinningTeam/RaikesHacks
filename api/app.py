import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for
import firebase_admin
from firebase_admin import credentials, auth, firestore, db
import os
from dotenv import load_dotenv
load_dotenv()

cred = credentials.Certificate(".auth/raikeshacks.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

from src.user import User

# Load comma-separated admins from .env
admin_emails = os.getenv("ADMIN_EMAILS", "").split(",")
user_manager = User(db, admin_emails=[e.strip() for e in admin_emails if e.strip()])


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

@app.route("/")
def index():
    user_info = {} 
    session_cookie = request.cookies.get('session')
    
    if session_cookie:
        try:
            decoded_claims = auth.verify_session_cookie(session_cookie, check_revoked=True)
            uid = decoded_claims['uid']
            email = decoded_claims['email']
            role = user_manager.get_role(uid)
            user_info = {'uid': uid, 'email': email, 'role': role}
        except Exception:
            user_info = {}
            
    # Add firebase_config=firebase_config here
    return render_template(
        "index.html", 
        user_info=user_info, 
        firebase_config=firebase_config
    )

@app.route("/login")
def login():
    # Must pass firebase_config so the template can render it
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

        # Create or update user data in Firestore
        user_manager.save_user(uid, email)

        # Set session expiration to 5 days
        expires_in = datetime.timedelta(days=5)

        # Create the session cookie using the Firebase Admin SDK
        session_cookie = auth.create_session_cookie(id_token, expires_in=expires_in)

        # Create a Flask response
        response = jsonify({'status': 'success', 'message': 'Logged in successfully'})
        
        # Attach the secure cookie to the response
        # httponly=True prevents JavaScript from reading it (good for security)
        # secure=True ensures it only sends over HTTPS (required for Vercel)
# Change secure=True to os.getenv('FLASK_ENV') == 'production' 
# or a boolean based on your environment.
        response.set_cookie(
            'session', 
            session_cookie, 
            expires=datetime.datetime.now(datetime.timezone.utc) + expires_in, 
            httponly=True, 
            secure=False,  # Set to False for local dev
            samesite='Lax'
        )

        return response, 200

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 401
    

@app.route("/logout")
def logout():
    session_cookie = request.cookies.get('session')
    if session_cookie:
        try:
            decoded_claims = auth.verify_session_cookie(session_cookie)
            auth.revoke_refresh_tokens(decoded_claims['uid'])
        except Exception:
            pass
            
    response = redirect(url_for('index'))
    response.delete_cookie('session')
    return response

if __name__ == '__main__':
    app.run(debug=True, port=5000)
