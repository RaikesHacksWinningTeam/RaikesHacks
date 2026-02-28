from functools import wraps
from firebase_admin import auth
from flask import jsonify, redirect, request, g, abort

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 1. Check if the browser sent the 'session' cookie
        session_cookie = request.cookies.get('session')
        
        if not session_cookie:

            return redirect("/login")

        try:
            # 2. Verify the cookie with Firebase
            decoded_claims = auth.verify_session_cookie(session_cookie, check_revoked=True)
            
            # 3. Attach the user's unique ID to the request so the route can use it
            request.user_id = decoded_claims['uid']
            return f(*args, **kwargs)
            
        except auth.InvalidSessionCookieError:
            return jsonify({'error': 'Session expired. Please log in again.'}), 401
            
    return decorated_function

def user_required(database):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get the session cookie from the request headers
            session_cookie = request.cookies.get('session')

            if not session_cookie:
                abort(401, 'Session cookie not found')

            try:
                # Verify the session cookie and decode the claims
                # Setting check_revoked=True adds an extra network request for security
                decoded_claims = auth.verify_session_cookie(session_cookie, check_revoked=True)
                
                # The UID is in the decoded claims
                uid = decoded_claims['uid']
                email = decoded_claims['email']

                # Use the UID to fetch user-specific data from Firestore
                user_doc_ref = database.collection('users').document(uid)
                user_doc = user_doc_ref.get()

                if user_doc.exists:
                    g.uid = uid
                    g.email = email
                    return f(*args, **kwargs)
                else:
                    return f"User document not found for UID: {uid}"
                
            except auth.InvalidSessionCookieError:
                # Cookie is invalid or revoked. Prompt user to sign in again.
                abort(401, 'Invalid or expired session cookie')
            except Exception as e:
                # Handle other potential errors
                abort(500, f'An error occurred: {str(e)}')
        return decorated_function
    return decorator