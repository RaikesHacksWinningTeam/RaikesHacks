import os
import json
import firebase_admin
from firebase_admin import credentials, firestore, storage
from dotenv import load_dotenv
from pathlib import Path

# Load .env from absolute path
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

def initialize_firebase():
    # Check for individual environment variables (Production/Vercel)
    project_id = os.environ.get('FIREBASE_PROJECT_ID')
    private_key = os.environ.get('FIREBASE_PRIVATE_KEY')
    client_email = os.environ.get('FIREBASE_CLIENT_EMAIL')
    storage_bucket_name = os.environ.get('FIREBASE_STORAGE_BUCKET')

    if not firebase_admin._apps:
        options = {
            'projectId': project_id,
            'storageBucket': storage_bucket_name
        }
        
        if project_id and private_key and client_email:
            print("DEBUG: Initializing Firebase with individual environment variables")
            # Ensure newline characters in the private key are interpreted correctly
            formatted_key = private_key.replace('\\n', '\n')
            
            cred_dict = {
                "type": "service_account",
                "project_id": project_id,
                "private_key": formatted_key,
                "client_email": client_email,
                "token_uri": "https://oauth2.googleapis.com/token",
            }
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred, options)
            
        elif os.path.exists(".auth/raikeshacks.json"):
            # Local development fallback
            print("DEBUG: Initializing Firebase with local cert: .auth/raikeshacks.json")
            cred = credentials.Certificate(".auth/raikeshacks.json")
            firebase_admin.initialize_app(cred, options)
        else:
            # Fallback for environments with Ambient Credentials (like Google Cloud)
            print("DEBUG: Initializing Firebase with default credentials")
            firebase_admin.initialize_app(options=options)
            
    return firestore.client(), storage.bucket(name=storage_bucket_name)

db, storage_bucket = initialize_firebase()
