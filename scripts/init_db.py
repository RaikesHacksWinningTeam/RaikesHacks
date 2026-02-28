import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv

# Load .env to get project info
load_dotenv()

def init_firestore():
    # Initialize with Default Credentials (requires GOOGLE_APPLICATION_CREDENTIALS env var)
    # OR if you have FIREBASE_SERVICE_ACCOUNT_JSON set in .env
    
    if not firebase_admin._apps:
        cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            # Fallback to project ID from .env
            project_id = os.getenv('FIREBASE_PROJECT_ID')
            firebase_admin.initialize_app(options={'projectId': project_id})
    
    db = firestore.client()

    # Room data with coordinates for the D3 map
    rooms = [
      { 'id': '101', 'name': 'Study Lounge', 'capacity': 20, 'tags': ['study', 'quiet'], 'x': 50, 'y': 50, 'width': 120, 'height': 80, 'floor': 1 },
      { 'id': '102', 'name': 'Conference Room A', 'capacity': 10, 'tags': ['meeting', 'media'], 'x': 180, 'y': 50, 'width': 100, 'height': 80, 'floor': 1 },
      { 'id': '103', 'name': 'Open Workspace', 'capacity': 40, 'tags': ['collab'], 'x': 290, 'y': 50, 'width': 200, 'height': 150, 'floor': 1 },
      { 'id': '104', 'name': 'Storage', 'capacity': 0, 'tags': ['storage'], 'x': 50, 'y': 140, 'width': 80, 'height': 60, 'floor': 1 },
      { 'id': '105', 'name': 'Kitchenette', 'capacity': 5, 'tags': ['food'], 'x': 140, 'y': 140, 'width': 60, 'height': 60, 'floor': 1 },
      { 'id': '106', 'name': 'Security Office', 'capacity': 3, 'tags': ['staff'], 'x': 210, 'y': 140, 'width': 70, 'height': 60, 'floor': 1 },
    ]

    print(f"Starting upload to Firestore project: {os.getenv('FIREBASE_PROJECT_ID')}...")

    for room in rooms:
        # We use the 'id' field from our dict as the Document ID
        room_id = room.pop('id') 
        db.collection('rooms').document(room_id).set(room)
        print(f"✅ Added room: {room['name']} (ID: {room_id})")

    print("Success! Your 'rooms' collection is now populated.")

if __name__ == "__main__":
    try:
        init_firestore()
    except Exception as e:
        print(f"❌ Error: {e}")
        print("Tip: To use firebase-admin locally, you usually need a Service Account JSON file.")
        print("1. Go to Firebase Console > Project Settings > Service Accounts")
        print("2. Click 'Generate new private key'")
        print("3. Save the file and set its path in your .env: GOOGLE_APPLICATION_CREDENTIALS=path/to/file.json")
