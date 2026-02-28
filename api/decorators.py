from functools import wraps
from firebase_admin import auth
from flask import jsonify, redirect, request, g, abort
from extensions import db


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


# Role hierarchy shared by the decorator and any inline permission checks.
_ROLE_HIERARCHY = {'owner': 3, 'admin': 2, 'viewer': 1, 'member': 1}  # member kept for back-compat


def org_role_required(required_role):
    """Decorator that enforces an organization-scoped role.

    The wrapped route MUST have an ``org_id`` URL parameter, e.g.::

        @app.route("/org/<org_id>/settings")
        @org_role_required('admin')
        def org_settings(org_id):
            ...

    Role hierarchy (highest → lowest): owner > admin > member

    The decorator reads ``g.user`` which is populated by the
    ``load_logged_in_user`` before_request hook in app.py.  Global admins
    (``g.user['is_global_admin'] == True``) bypass the org membership check.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Must be authenticated
            if not g.user:
                return jsonify({'error': 'Authentication required'}), 401

            # Global admins bypass org-level checks
            if g.user.get('is_global_admin'):
                return f(*args, **kwargs)

            org_id = kwargs.get('org_id')
            if not org_id:
                return jsonify({'error': 'Organization context missing'}), 400

            # Fetch the org document to inspect membership
            org_doc = db.collection('organizations').document(org_id).get()
            if not org_doc.exists:
                return jsonify({'error': 'Organization not found'}), 404

            members = org_doc.to_dict().get('members', {})
            user_role = members.get(g.user['uid'])

            required_level = _ROLE_HIERARCHY.get(required_role, 0)
            user_level = _ROLE_HIERARCHY.get(user_role, 0)

            if user_level < required_level:
                return jsonify({'error': 'Insufficient permissions'}), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator