from firebase_admin import firestore

class User:
    def __init__(self, db, admin_emails=None):
        self.db = db
        self.collection = self.db.collection('users')
        self.admin_emails = admin_emails or []

    def get_user(self, uid):
        """Fetch user data from Firestore by UID."""
        doc = self.collection.document(uid).get()
        if doc.exists:
            return doc.to_dict()
        return None

    def save_user(self, uid, email):
        """Create or update user in Firestore. Only sets default role if not existing."""
        user_ref = self.collection.document(uid)
        doc = user_ref.get()
        
        # Determine current role or default
        is_admin_email = email.lower() in [e.lower() for e in self.admin_emails]
        new_role = 'admin' if is_admin_email else 'user'

        data = {
            'email': email,
            'last_login': firestore.SERVER_TIMESTAMP
        }
        
        if not doc.exists:
            data['role'] = new_role
        elif is_admin_email:
            # Upgrade existing user if their email is now an admin
            data['role'] = 'admin'

        user_ref.set(data, merge=True)

    def assign_role(self, uid, role):
        """Assign a specific role to a user."""
        user_ref = self.collection.document(uid)
        user_ref.update({
            'role': role
        })

    def get_role(self, uid):
        """Get the role of a specific user."""
        user_data = self.get_user(uid)
        if user_data:
            return user_data.get('role', 'user')
        return 'user'

    def is_admin(self, uid):
        """Check if a user is an admin."""
        return self.get_role(uid) == 'admin'
