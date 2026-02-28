import { auth, getIdToken } from './firebase-config.js';

export async function fetchUserOrgs() {
    try {
        let res = await fetch('/api/user/orgs');
        if (res.status === 401) {
            const firebaseUser = auth?.currentUser;
            if (!firebaseUser) return { orgs: [] };
            const idToken = await getIdToken(firebaseUser, true);
            await fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            });
            res = await fetch('/api/user/orgs');
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
