import os
import json
import firebase_admin
from firebase_admin import credentials, firestore

def initialize_firebase():
    if not firebase_admin._apps:
        cred_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')
        if cred_json:
            cred = credentials.Certificate(json.loads(cred_json))
            firebase_admin.initialize_app(cred)
        elif os.path.exists(".auth/raikeshacks.json"):
            cred = credentials.Certificate(".auth/raikeshacks.json")
            firebase_admin.initialize_app(cred)
        else:
            # For GAE/Cloud Run, this uses the service's identity
            firebase_admin.initialize_app()
    return firestore.client()

db = initialize_firebase()
