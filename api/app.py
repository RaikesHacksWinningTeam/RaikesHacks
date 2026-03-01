import datetime
import os
import json
import random
import string
from functools import wraps
from flask import Flask, render_template, request, jsonify, redirect, url_for, g, session
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, auth, firestore

from icalendar import Calendar, Event
from flask import Response
from datetime import datetime, timedelta, timezone

from user import User


# --- Initialization & Configuration ---
load_dotenv()

import os
import firebase_admin
from firebase_admin import credentials, firestore

def initialize_firebase():
    if not firebase_admin._apps:
        # Check for individual environment variables
        project_id = os.environ.get('FIREBASE_PROJECT_ID')
        private_key = os.environ.get('FIREBASE_PRIVATE_KEY')
        client_email = os.environ.get('FIREBASE_CLIENT_EMAIL')

        if project_id and private_key and client_email:
            # The critical fix: ensure newline characters are interpreted correctly
            formatted_key = private_key.replace('\\n', '\n')
            
            cred_dict = {
                "type": "service_account",
                "project_id": project_id,
                "private_key": formatted_key,
                "client_email": client_email,
                "token_uri": "https://oauth2.googleapis.com/token",
            }
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            
        elif os.path.exists(".auth/raikeshacks.json"):
            # Local development fallback
            cred = credentials.Certificate(".auth/raikeshacks.json")
            firebase_admin.initialize_app(cred)
        else:
            # Fallback for environments with Ambient Credentials (like Google Cloud)
            firebase_admin.initialize_app()
            
    return firestore.client()

db = initialize_firebase()


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
                email = user_data.get('email', '')
                g.user = {
                    'uid': uid,
                    'email': email,
                    'role': user_data.get('role', 'user'),
                    'last_login': user_data.get('last_login'),
                    # Org-based RBAC: list of org IDs this user belongs to
                    'organizations': user_data.get('organizations', []),
                    # Global admin still works via env var for super-user tasks
                    'is_global_admin': email.lower() in [e.lower() for e in admin_emails],
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

@app.route("/onboarding")
def onboarding():
    user_info = get_user_from_session()
    if not user_info:
        return redirect(url_for('login'))
    
    # If user already has orgs, they shouldn't be here
    if user_info.get('organizations'):
        return redirect(url_for('index'))
        
    return render_template("onboarding.html", user_info=user_info, firebase_config=firebase_config)

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

        user_data = user_manager.save_user(uid, email)
        orgs = user_data.get('organizations', [])

        expires_in = timedelta(days=5)
        session_cookie = auth.create_session_cookie(id_token, expires_in=expires_in)

        # If user has no organizations, redirect them to onboarding
        redirect_url = '/onboarding' if not orgs else '/'

        response = jsonify({
            'status': 'success', 
            'message': 'Logged in successfully',
            'redirect_url': redirect_url
        })
        
        # Determine if we should use secure=True.
        # Check if the request came over HTTPS directly or via an X-Forwarded-Proto header.
        is_https = request.is_secure or request.headers.get('X-Forwarded-Proto', 'http') == 'https'
        
        # In strictly localhost dev environments without HTTPS, we might set secure=False.
        is_localhost = request.host.startswith('localhost') or request.host.startswith('127.0.0.1')
        cookie_secure = is_https if not is_localhost else False

        response.set_cookie(
            'session', 
            session_cookie, 
            max_age=int(expires_in.total_seconds()),
            expires=datetime.now(timezone.utc) + expires_in, 
            httponly=True, 
            secure=cookie_secure,
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

# --- Organization API Routes ---

@app.route("/api/user/orgs", methods=["GET"])
def get_user_orgs():
    """Return details (name, role, invite_code) for all orgs the current user belongs to."""
    if not g.user:
        return jsonify({'error': 'Authentication required'}), 401

    org_ids = user_manager.get_user_orgs(g.user['uid'])
    orgs = []
    for org_id in org_ids:
        org = user_manager.get_org(org_id)
        if not org:
            continue
        members = org.get('members', {})
        role = members.get(g.user['uid'], 'member')
        orgs.append({
            'id': org_id,
            'name': org.get('name', ''),
            'role': role,
            'color': org.get('color'),
            'invite_code': org.get('invite_code') if role in ('owner', 'admin') else None,
        })

    return jsonify({'orgs': orgs}), 200


def _generate_invite_code(length=6):
    """Generate a random uppercase alphanumeric invite code."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))



@app.route("/api/orgs", methods=["POST"])
def create_org():
    """Create a new organization. The caller becomes the 'owner'."""
    if not g.user:
        return jsonify({'error': 'Authentication required'}), 401

    data = request.get_json() or {}
    org_name = (data.get('name') or '').strip()
    if not org_name:
        return jsonify({'error': 'Organization name is required'}), 400

    org_id = user_manager.create_organization(g.user['uid'], org_name)

    # Generate and persist invite code onto the org document
    invite_code = _generate_invite_code()
    db.collection('organizations').document(org_id).update({
        'invite_code': invite_code
    })

    return jsonify({
        'status': 'success',
        'org_id': org_id,
        'name': org_name,
        'invite_code': invite_code,
        'color': None
    }), 201


@app.route("/api/orgs/join", methods=["POST"])
def join_org():
    """Join an organization using an invite code. Caller becomes 'member'."""
    if not g.user:
        return jsonify({'error': 'Authentication required'}), 401

    data = request.get_json() or {}
    invite_code = (data.get('invite_code') or '').strip().upper()
    if not invite_code:
        return jsonify({'error': 'Invite code is required'}), 400

    # Search organizations collection for matching invite code
    matches = db.collection('organizations').where('invite_code', '==', invite_code).limit(1).stream()
    org_doc = next(matches, None)

    if not org_doc:
        return jsonify({'error': 'Invalid or expired invite code'}), 404

    org_id = org_doc.id
    org_data = org_doc.to_dict()

    # Don't downgrade existing members
    existing_role = org_data.get('members', {}).get(g.user['uid'])
    if existing_role:
        return jsonify({
            'status': 'already_member',
            'org_id': org_id,
            'name': org_data.get('name', ''),
            'role': existing_role
        }), 200

    user_manager.assign_org_role(org_id, g.user['uid'], 'viewer')
    return jsonify({
        'status': 'success',
        'org_id': org_id,
        'name': org_data.get('name', ''),
        'role': 'viewer',
        'color': org_data.get('color')
    }), 200



@app.route("/api/orgs/<org_id>", methods=["GET"])
def get_org(org_id):
    """Fetch public metadata for an organization."""
    if not g.user:
        return jsonify({'error': 'Authentication required'}), 401

    org = user_manager.get_org(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    # Only return member list to users who are actually in the org
    members = org.get('members', {})
    if g.user['uid'] not in members and not g.user.get('is_global_admin'):
        return jsonify({'error': 'Forbidden'}), 403

    return jsonify({'status': 'success', 'org': org}), 200


@app.route("/api/orgs/<org_id>/members", methods=["GET"])
def get_org_members(org_id):
    """Return the member list (email + role) for an org. Requires membership."""
    if not g.user:
        return jsonify({'error': 'Authentication required'}), 401

    org = user_manager.get_org(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    members_map = org.get('members', {})
    if g.user['uid'] not in members_map and not g.user.get('is_global_admin'):
        return jsonify({'error': 'Forbidden'}), 403

    members = []
    for uid, role in members_map.items():
        user_doc = user_manager.get_user(uid)
        email = user_doc.get('email', uid) if user_doc else uid
        members.append({'uid': uid, 'email': email, 'role': role})

    # Sort: owner first, then admin, then viewer, then alphabetically by email
    role_order = {'owner': 0, 'admin': 1, 'viewer': 2, 'member': 3}
    members.sort(key=lambda m: (role_order.get(m['role'], 9), m['email']))

    return jsonify({'members': members}), 200


@app.route("/api/orgs/<org_id>/members", methods=["POST"])
def assign_org_member(org_id):
    """Assign (or update) a role for a user within an org.

    Requires the caller to be at least 'admin' in the target org,
    or a global admin.
    """
    if not g.user:
        return jsonify({'error': 'Authentication required'}), 401

    org = user_manager.get_org(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    members = org.get('members', {})
    caller_role = members.get(g.user['uid'])
    # Roles: owner > admin > viewer  (member kept for back-compat)
    role_hierarchy = {'owner': 3, 'admin': 2, 'viewer': 1, 'member': 1}

    if role_hierarchy.get(caller_role, 0) < role_hierarchy['admin'] and not g.user.get('is_global_admin'):
        return jsonify({'error': 'Insufficient permissions'}), 403

    data = request.get_json() or {}
    target_uid = data.get('uid', '').strip()
    role = data.get('role', '').strip()
    valid_roles = {'owner', 'admin', 'viewer'}

    if not target_uid or role not in valid_roles:
        return jsonify({'error': f'Valid uid and role ({"/".join(sorted(valid_roles))}) are required'}), 400

    # Non-owners cannot promote someone to owner or change another owner's role
    target_current_role = members.get(target_uid)
    if target_current_role == 'owner' and caller_role != 'owner' and not g.user.get('is_global_admin'):
        return jsonify({'error': 'Only org owners can modify another owner\'s role'}), 403
    if role == 'owner' and caller_role != 'owner' and not g.user.get('is_global_admin'):
        return jsonify({'error': 'Only org owners can grant the owner role'}), 403

    # Non-owners cannot promote someone to admin or change another admin's role
    if target_current_role == 'admin' and caller_role != 'owner' and not g.user.get('is_global_admin'):
        return jsonify({'error': 'Only org owners can modify an admin\'s role'}), 403
    if role == 'admin' and caller_role != 'owner' and not g.user.get('is_global_admin'):
        return jsonify({'error': 'Only org owners can grant the admin role'}), 403

    user_manager.assign_org_role(org_id, target_uid, role)
    return jsonify({'status': 'success', 'org_id': org_id, 'uid': target_uid, 'role': role}), 200



@app.route("/api/orgs/<org_id>", methods=["PATCH"])
def update_org_metadata(org_id):
    """Update organization metadata like color. Requires caller to be owner/admin."""
    if not g.user:
        return jsonify({'error': 'Authentication required'}), 401

    org = user_manager.get_org(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    members = org.get('members', {})
    caller_role = members.get(g.user['uid'])
    if caller_role not in ('owner', 'admin') and not g.user.get('is_global_admin'):
        return jsonify({'error': 'Insufficient permissions'}), 403

    data = request.get_json() or {}
    color = data.get('color')
    if color:
        user_manager.update_org_color(org_id, color)

    return jsonify({'status': 'success', 'org_id': org_id}), 200


@app.route("/api/orgs/<org_id>", methods=["DELETE"])
def delete_org(org_id):
    """Delete an organization. Requires caller to be the 'owner'."""
    if not g.user:
        return jsonify({'error': 'Authentication required'}), 401

    org = user_manager.get_org(org_id)
    if not org:
        return jsonify({'error': 'Organization not found'}), 404

    members = org.get('members', {})
    if members.get(g.user['uid']) != 'owner' and not g.user.get('is_global_admin'):
        return jsonify({'error': 'Only the organization owner can delete it'}), 403

    user_manager.delete_organization(org_id)
    return jsonify({'status': 'success', 'org_id': org_id}), 200



@app.route("/api/orgs/<org_id>/calendar.ics", methods=["GET"])
def get_org_calendar_feed(org_id):
    # 1. Verify the organization exists
    org = user_manager.get_org(org_id)
    if not org:
        return "Organization not found", 404

    # 2. Fetch events for this org from Firestore
    # Note: Ensure you have a 'events' collection where each doc has 'org_id'
    events_ref = db.collection('events').where('org_id', '==', org_id).stream()

    cal = Calendar()
    cal.add('prodid', f'-//{org.get("name")}//BuildingEvents//EN')
    cal.add('version', '2.0')
    cal.add('x-wr-calname', f"{org.get('name')} Events") # Shows as name in Google Cal

    for doc in events_ref:
        e_data = doc.to_dict()
        event = Event()
        
        event.add('summary', e_data.get('title', 'Untitled Event'))
        
        # Convert ISO strings from Firestore to datetime objects
        start = datetime.fromisoformat(e_data['start'].replace('Z', '+00:00'))
        end = datetime.fromisoformat(e_data['end'].replace('Z', '+00:00'))
        
        event.add('dtstart', start)
        event.add('dtend', end)
        event.add('dtstamp', datetime.utcnow())
        event.add('uid', f"{doc.id}@raikeshacks.com")
        event.add('description', f"Organized by {e_data.get('organizer', 'Staff')}")
        
        # Fetch room name if needed, or just use room_id
        event.add('location', f"Room: {e_data.get('room_id')}")
        
        cal.add_component(event)

    return Response(
        cal.to_ical(),
        mimetype="text/calendar",
        headers={"Content-Disposition": f"attachment; filename={org_id}.ics"}
    )
    
@app.route("/api/calendar/multi.ics", methods=["GET"])
def get_multi_org_calendar_feed():
    org_ids_str = request.args.get('orgs', '')
    if not org_ids_str:
        return "No organizations provided", 400
        
    org_ids = [oid.strip() for oid in org_ids_str.split(',') if oid.strip()]
    if not org_ids:
        return "No valid organizations provided", 400
        
    cal = Calendar()
    cal.add('prodid', '-//Multiple Orgs//BuildingEvents//EN')
    cal.add('version', '2.0')
    cal.add('x-wr-calname', 'Combined Events')
    
    for org_id in org_ids:
        org = user_manager.get_org(org_id)
        if not org:
            continue
            
        events_ref = db.collection('events').where('org_id', '==', org_id).stream()
        for doc in events_ref:
            e_data = doc.to_dict()
            event = Event()
            
            event.add('summary', e_data.get('title', 'Untitled Event'))
            
            try:
                start = datetime.fromisoformat(e_data['start'].replace('Z', '+00:00'))
                end = datetime.fromisoformat(e_data['end'].replace('Z', '+00:00'))
            except Exception:
                continue
                
            event.add('dtstart', start)
            event.add('dtend', end)
            event.add('dtstamp', datetime.utcnow())
            event.add('uid', f"{doc.id}@raikeshacks.com")
            event.add('description', f"Organized by {e_data.get('organizer', 'Staff')} - Org: {org.get('name')}")
            event.add('location', f"Room: {e_data.get('room_id')}")
            cal.add_component(event)

    return Response(
        cal.to_ical(),
        mimetype="text/calendar",
        headers={"Content-Disposition": "attachment; filename=combined_calendar.ics"}
    )


@app.route("/api/user/sync-prefs", methods=["GET", "POST"])
def manage_sync_prefs():
    """Returns or updates the synced organizations and token for the user."""
    if not g.user:
        return jsonify({'error': 'Authentication required'}), 401
    
    uid = g.user['uid']
    token = user_manager.get_calendar_token(uid)
    
    if request.method == "POST":
        data = request.get_json() or {}
        org_ids = data.get('orgs', [])
        synced_orgs = user_manager.set_synced_orgs(uid, org_ids)
    else:
        synced_orgs = user_manager.get_synced_orgs(uid)
        
    return jsonify({
        'token': token,
        'synced_orgs': synced_orgs
    }), 200


@app.route("/api/feeds/<token>.ics")
def personal_calendar_feed(token):
    # 1. Authenticate via token
    user_query = db.collection('users').where('calendar_token', '==', token).limit(1).stream()
    user_doc = next(user_query, None)
    
    if not user_doc:
        return "Invalid Calendar Feed Token", 401
        
    user_data = user_doc.to_dict()
    synced_orgs = user_data.get('synced_orgs', [])
    
    # We allow them to sync ANY organization they opted into
    valid_org_ids = synced_orgs
    
    # 2. Query events (limit to valid_org_ids)
    events = []
    if valid_org_ids:
        # Fetching events that match any of the user's valid synced org IDs
        # Firestore 'in' queries are limited to 10 elements.
        chunks = [valid_org_ids[i:i + 10] for i in range(0, len(valid_org_ids), 10)]
        for chunk in chunks:
            chunk_events = db.collection('events').where('org_id', 'in', chunk).stream()
            events.extend(chunk_events)

    # 3. Build the ICS String
    # \r\n is required by the iCalendar spec
    ics_body = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//RaikesHacks//PersonalFeed//EN",
        "X-WR-CALNAME:My Building Events",
        "X-PUBLISHED-TTL:PT1H",  # Tell Outlook/Apple to refresh every hour
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH"
    ]

    for doc in events:
        e = doc.to_dict()
        start_str = e.get('start', '')
        end_str = e.get('end', '')
        if not start_str or not end_str:
            continue
            
        # Format timestamps: 2026-02-28T18:00:00 -> 20260228T180000Z
        try:
            start_fmt = start_str.replace('-', '').replace(':', '').split('.')[0].replace('Z', '') + "Z"
            end_fmt = end_str.replace('-', '').replace(':', '').split('.')[0].replace('Z', '') + "Z"
        except Exception:
            continue
        
        ics_body.extend([
            "BEGIN:VEVENT",
            f"UID:{doc.id}@raikeshacks.com",
            f"DTSTAMP:{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
            f"DTSTART:{start_fmt}",
            f"DTEND:{end_fmt}",
            f"SUMMARY:{e.get('title', 'Untitled Event')}",
            f"LOCATION:Room {e.get('room_id', 'TBD')}",
            f"DESCRIPTION:Org: {e.get('org_id')} | Organizer: {e.get('organizer')}",
            "END:VEVENT"
        ])

    ics_body.append("END:VCALENDAR")
    
    return Response(
        "\r\n".join(ics_body),
        mimetype="text/calendar",
        headers={"Content-Disposition": "attachment; filename=my_calendar.ics"}
    )


# --- Error Handlers ---
@app.errorhandler(404)
def page_not_found(e):
    return render_template("index.html", user_info=get_user_from_session(), firebase_config=firebase_config), 404

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    app.run(debug=True, port=port)
