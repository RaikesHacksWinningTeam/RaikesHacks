import secrets
from firebase_admin import firestore
from extensions import db

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

    def update_org_color(self, org_id, color):
        """Update the brand color of an organization."""
        self.orgs_coll.document(org_id).update({'color': color})

    def delete_organization(self, org_id):
        """Delete an organization and remove it from all members.
        
        Warning: This is a destructive operation.
        """
        org_doc = self.orgs_coll.document(org_id).get()
        if not org_doc.exists:
            return

        org_data = org_doc.to_dict()
        member_uids = org_data.get('members', {}).keys()

        # Remove org_id from all users' organizations array
        for uid in member_uids:
            self.users_coll.document(uid).update({
                'organizations': firestore.ArrayRemove([org_id])
            })

        # Delete the organization document itself
        self.orgs_coll.document(org_id).delete()

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

    def get_calendar_token(self, uid):
        """Retrieve or generate a unique 16-char token for the user."""
        user_ref = self.users_coll.document(uid)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return None
            
        user_data = user_doc.to_dict()
        if 'calendar_token' in user_data:
            return user_data['calendar_token']
            
        # Generate new if missing
        new_token = secrets.token_urlsafe(16)
        # We use merge=True or update
        user_ref.update({'calendar_token': new_token})
        return new_token

    def set_synced_orgs(self, uid, org_ids):
        """Save selected organizations for the personal calendar feed."""
        # Allow syncing any org they choose, not just ones they are a member of
        self.users_coll.document(uid).update({'synced_orgs': org_ids})
        return org_ids
        
    def get_synced_orgs(self, uid):
        """Get the user's selected synced organizations."""
        user_data = self.get_user(uid)
        if user_data:
            return user_data.get('synced_orgs', [])
        return []
