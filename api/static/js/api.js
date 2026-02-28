import { auth, getIdToken } from './firebase-config.js';

export async function ensureAuthSynced() {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) return false;

    try {
        const idToken = await getIdToken(firebaseUser, true);
        const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        });
        return res.ok;
    } catch (e) {
        console.error("Auth sync failed:", e);
        return false;
    }
}

export async function fetchUserOrgs() {
    try {
        let res = await fetch('/api/user/orgs');
        if (res.status === 401) {
            const synced = await ensureAuthSynced();
            if (synced) {
                res = await fetch('/api/user/orgs');
            }
        }
        if (!res.ok) return { orgs: [] };
        return await res.json();
    } catch (e) {
        console.error(e);
        return { orgs: [] };
    }
}

export async function setMemberRoleAPI(orgId, uid, role) {
    return fetch(`/api/orgs/${orgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, role })
    });
}

export async function createOrgAPI(name) {
    return fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
}

export async function joinOrgAPI(invite_code) {
    return fetch('/api/orgs/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code })
    });
}

export async function fetchOrgMembersAPI(orgId) {
    return fetch(`/api/orgs/${orgId}/members`);
}

export async function updateOrgMetadataAPI(orgId, data) {
    return fetch(`/api/orgs/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

export async function deleteOrgAPI(orgId) {
    return fetch(`/api/orgs/${orgId}`, {
        method: 'DELETE'
    });
}
