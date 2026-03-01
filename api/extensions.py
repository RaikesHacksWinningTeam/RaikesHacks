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