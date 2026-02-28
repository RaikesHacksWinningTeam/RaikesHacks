import datetime
import os
import json
from functools import wraps
from flask import Flask, render_template, request, jsonify, redirect, url_for, g
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, auth, firestore

from extensions import db
from src.user import User

# --- Initialization & Configuration ---
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-key-123")

# Frontend Firebase Configuration
firebase_config = {
    "apiKey": os.getenv("FIREBASE_API_KEY"),
    "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
    "projectId": os.getenv("FIREBASE_PROJECT_ID"),
    "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
    "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
    "appId": os.getenv("FIREBASE_APP_ID")
}

admin_emails = [e.strip() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()]
user_manager = User(db, admin_emails=admin_emails)

# --- Middleware ---
@app.before_request
def load_logged_in_user():
    """Verify session once per request and cache in flask.g"""
    session_cookie = request.cookies.get('session')
    g.user = None
    g.clear_dead_session = False
    
    if session_cookie:
        try:
            # check_revoked=False improves speed.
            # Set to True only for sensitive paths if needed.
            decoded_claims = auth.verify_session_cookie(session_cookie, check_revoked=False)
            uid = decoded_claims['uid']
            
            # Optimization: Fetch full user doc once and cache in g.user
            user_data = user_manager.get_user(uid)
            if user_data:
                g.user = {
                    'uid': uid,
                    'email': user_data.get('email'),
                    'role': user_data.get('role', 'user'),
                    'last_login': user_data.get('last_login')
                }
            else:
                # If cookie is valid but user document is gone
                g.clear_dead_session = True
        except Exception:
            g.user = None
            g.clear_dead_session = True

@app.after_request
def clear_dead_session(response):
    """Automatically clear the session cookie if verification failed."""
    if getattr(g, 'clear_dead_session', False):
        response.delete_cookie('session')
    return response

def get_user_from_session():
    """Return the cached user from g instead of re-verifying."""
    return g.user or {}

# --- Routes ---
@app.route("/")
def index():
    user_info = get_user_from_session()
    return render_template(
        "index.html", 
        user_info=user_info, 
        firebase_config=firebase_config
    )

@app.route("/login")
def login():
    # If user is already logged in, redirect to index
    if get_user_from_session():
        return redirect(url_for('index'))
    return render_template("login.html", firebase_config=firebase_config)

@app.route('/api/auth/google', methods=['POST'])
def verify_google_token():
    data = request.get_json() or {}
    id_token = data.get('idToken')

    if not id_token:
        return jsonify({'status': 'error', 'message': 'Missing token'}), 400

    try:
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        email = decoded_token.get('email', '')

        user_manager.save_user(uid, email)

        expires_in = datetime.timedelta(days=5)
        session_cookie = auth.create_session_cookie(id_token, expires_in=expires_in)

        response = jsonify({'status': 'success', 'message': 'Logged in successfully'})
        
        # Determine if we should use secure=True (HTTPS)
        is_prod = os.getenv('FLASK_ENV') == 'production'
        
        response.set_cookie(
            'session', 
            session_cookie, 
            max_age=int(expires_in.total_seconds()),
            expires=datetime.datetime.now(datetime.timezone.utc) + expires_in, 
            httponly=True, 
            secure=is_prod,
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

# --- Error Handlers ---
@app.errorhandler(404)
def page_not_found(e):
    return render_template("index.html", user_info=get_user_from_session(), firebase_config=firebase_config), 404

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    app.run(debug=True, port=port)
