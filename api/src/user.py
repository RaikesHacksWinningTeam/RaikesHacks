from firebase_admin import firestore
from extensions import db
import random

# Predefined professional palette
ORG_COLORS = ['#635bff', '#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899']

class User:
    def __init__(self, db_instance=None, admin_emails=None):
        self.db = db_instance or db
        self.users_coll = self.db.collection('users')
        # Keep legacy alias for back-compat with any code using self.collection
        self.collection = self.users_coll
        self.orgs_coll = self.db.collection('organizations')
        self.admin_emails = admin_emails or []

    # ------------------------------------------------------------------
    # User helpers
    # ------------------------------------------------------------------

    def get_user(self, uid):
        """Fetch user data from Firestore by UID."""
        doc = self.users_coll.document(uid).get()
        if doc.exists:
            return doc.to_dict()
        return None

    def save_user(self, uid, email):
        """Create or update user in Firestore. Only sets default role if not existing.
        
        Returns:
            dict: The updated user document data.
        """
        user_ref = self.users_coll.document(uid)
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
        
        # Return current state to help caller decide if onboarding is needed
        return user_ref.get().to_dict()

    def assign_role(self, uid, role):
        """Assign a global role to a user (legacy / super-admin use)."""
        self.users_coll.document(uid).update({'role': role})

    def get_role(self, uid):
        """Get the global role of a specific user."""
        user_data = self.get_user(uid)
        if user_data:
            return user_data.get('role', 'user')
        return 'user'

    def is_admin(self, uid):
        """Check if a user has the global admin role."""
        return self.get_role(uid) == 'admin'

    # ------------------------------------------------------------------
    # Organization helpers
    # ------------------------------------------------------------------

    def create_organization(self, creator_uid, org_name):
        """Creates an org and sets the creator as the 'owner'.

        Returns:
            str: The auto-generated organization ID.
        """
        org_ref = self.orgs_coll.document()  # Auto-ID
        org_id = org_ref.id

        org_data = {
            'name': org_name,
            'created_at': firestore.SERVER_TIMESTAMP,
            'color': random.choice(ORG_COLORS),
            'members': {
                creator_uid: 'owner'  # Roles: owner, admin, member
            }
        }
        org_ref.set(org_data)

        # Link org to user document for easy discovery
        self.users_coll.document(creator_uid).set({
            'organizations': firestore.ArrayUnion([org_id])
        }, merge=True)

        return org_id

    def assign_org_role(self, org_id, target_uid, role):
        """Assigns a role to a user within a specific organization.

        Args:
            org_id: Firestore document ID of the organization.
            target_uid: UID of the user to assign the role to.
            role: One of 'owner', 'admin', or 'member'.
        """
        # Update the org's member map
        self.orgs_coll.document(org_id).update({
            f'members.{target_uid}': role
        })
        # Ensure the user document knows they are in this org
        self.users_coll.document(target_uid).set({
            'organizations': firestore.ArrayUnion([org_id])
        }, merge=True)

    def get_org(self, org_id):
        """Fetch organization data from Firestore by org ID.

        Returns:
            dict | None: The org document as a dict, or None if not found.
        """
        doc = self.orgs_coll.document(org_id).get()
        if doc.exists:
            return {'id': doc.id, **doc.to_dict()}
        return None

    def get_user_orgs(self, uid):
        """Return a list of org IDs the user belongs to.

        Reads from the user document's 'organizations' array.
        """
        user_data = self.get_user(uid)
        if user_data:
            return user_data.get('organizations', [])
        return []

    def update_organization(self, org_id, data):
        """Updates organization metadata (e.g., name, color)."""
        self.orgs_coll.document(org_id).update(data)

    def delete_organization(self, org_id):
        """Deletes an organization and removes it from all members' lists."""
        org_doc = self.orgs_coll.document(org_id).get()
        if not org_doc.exists:
            return

        members = org_doc.to_dict().get('members', {})
        
        # 1. Remove org reference from all users
        for uid in members.keys():
            self.users_coll.document(uid).update({
                'organizations': firestore.ArrayRemove([org_id])
            })

        # 2. Delete the organization document
        self.orgs_coll.document(org_id).delete()
        
        # 3. Cleanup events associated with this org
        events = self.db.collection('events').where('org_id', '==', org_id).stream()
        for event in events:
            event.reference.delete()
