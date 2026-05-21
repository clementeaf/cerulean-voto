import axios from 'axios';
import type { Scope, Assembly, Session, Acta } from './store';
import { getAuth, getActiveChannel } from './auth';

const API_URL = '/api/v1';

const client = axios.create({ baseURL: API_URL, timeout: 10000 });

// Read local config directly from localStorage to avoid circular dependency with store.ts
function readLocalConfig(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(`cv_${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Paths that don't require authentication (bootstrap: identity, vault, health, channels)
const PUBLIC_PATHS = ['/health', '/channels', '/store/identities', '/vault'];

// Inject X-Org-Id, X-Msp-Role, X-Channel-Id on every request
// Block non-public requests when not authenticated
client.interceptors.request.use((config) => {
  const auth = getAuth();
  const path = config.url || '';
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // Block unauthenticated requests to protected endpoints
  if (!auth && !isPublic) {
    return Promise.reject(new Error('No autenticado — conecta tu wallet primero'));
  }

  const settings = readLocalConfig('org_settings') as { channel_id?: string } | null;
  const orgChannel = settings?.channel_id || '';

  // X-Org-Id
  if (orgChannel) {
    config.headers['X-Org-Id'] = orgChannel;
  }

  // X-Msp-Role: derived from authenticated user's actual role
  if (auth) {
    config.headers['X-Msp-Role'] = auth.role;
  }

  // X-Channel-Id: active scope channel (in-memory) > org channel > omit
  const activeChannel = getActiveChannel();
  if (activeChannel) {
    config.headers['X-Channel-Id'] = activeChannel;
  } else if (orgChannel) {
    config.headers['X-Channel-Id'] = orgChannel;
  }

  return config;
});

function unwrap<T>(body: unknown): T {
  const r = body as Record<string, unknown>;
  if (r.status === 'Success' && r.data != null) return r.data as T;
  if (r.success === true && r.data != null) return r.data as T;
  const msg =
    typeof r.message === 'string' ? r.message : 'Request failed';
  throw new Error(msg);
}

// -- Channel management -----------------------------------------------------

export async function createChannel(name: string): Promise<{ channel_id: string }> {
  const { data } = await client.post('/channels', { name });
  const result = unwrap<Record<string, unknown>>(data);
  return { channel_id: (result.channel_id as string) || (result.id as string) || name };
}

// -- Governance API (existing backend) --------------------------------------

export interface Proposal {
  id: number;
  proposer: string;
  description: string;
  status: string;
  deposit: number;
  action: unknown;
  submitted_at: number;
  voting_ends_at: number;
}

export interface TallyResult {
  proposal_id: number;
  yes_power: number;
  no_power: number;
  abstain_power: number;
  total_voted_power: number;
  quorum_reached: boolean;
  passed: boolean;
}

export async function getProposals(): Promise<Proposal[]> {
  const { data } = await client.get('/governance/proposals');
  return unwrap<Proposal[]>(data);
}

export async function submitProposal(body: {
  proposer: string;
  description: string;
  deposit: number;
  action: unknown;
}): Promise<Proposal> {
  const { data } = await client.post('/governance/proposals', body);
  return unwrap<Proposal>(data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function castVote(
  proposalId: number,
  body: {
    voter: string;
    option: 'Yes' | 'No' | 'Abstain';
    power: number;
    signature?: string;
    public_key?: string;
    nonce?: string;
  },
): Promise<any> {
  const { data } = await client.post(`/governance/proposals/${proposalId}/vote`, body);
  return data;
}

export async function tallyVotes(proposalId: number): Promise<TallyResult> {
  const { data } = await client.get(`/governance/proposals/${proposalId}/tally`);
  return unwrap<TallyResult>(data);
}

// -- Identity API (existing backend) ----------------------------------------

export async function registerIdentity(body: {
  did: string;
  public_key: string;
  metadata?: Record<string, string>;
}): Promise<unknown> {
  const now = Math.floor(Date.now() / 1000);
  const { data } = await client.post('/store/identities', {
    did: body.did,
    created_at: now,
    updated_at: now,
    status: 'active',
  });
  return unwrap(data);
}

export async function getIdentity(did: string): Promise<unknown> {
  const { data } = await client.get(`/store/identities/${encodeURIComponent(did)}`);
  return unwrap(data);
}

// -- Acta anchoring ---------------------------------------------------------

export async function anchorActaHash(acta: {
  folio: number;
  integrity_hash: string;
  session_number: number;
  assembly_name: string;
}): Promise<{ did: string; trace_id: string }> {
  const did = `did:cerulean:acta:${acta.folio}`;
  const { data } = await client.post('/store/identities', {
    did,
    public_key: acta.integrity_hash,
    metadata: {
      type: 'acta',
      folio: String(acta.folio),
      integrity_hash: acta.integrity_hash,
      session_number: String(acta.session_number),
      assembly_name: acta.assembly_name,
      anchored_at: new Date().toISOString(),
    },
  });
  const result = data as Record<string, unknown>;
  return {
    did,
    trace_id: (result.trace_id as string) || '',
  };
}

// -- Vault (wallet backup on-chain) -----------------------------------------

export async function vaultStore(did: string, encryptedWallet: unknown): Promise<void> {
  await client.post('/vault/store', { did, encrypted_wallet: encryptedWallet });
}

export async function vaultGet(did: string): Promise<{ did: string; encrypted_wallet: unknown } | null> {
  try {
    const { data } = await client.get(`/vault/${encodeURIComponent(did)}`);
    return unwrap<{ did: string; encrypted_wallet: unknown }>(data);
  } catch {
    return null;
  }
}

// -- Helpers ----------------------------------------------------------------

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// -- Store: Scopes ----------------------------------------------------------

export async function apiGetScopes(): Promise<Scope[]> {
  const { data } = await client.get('/store/scopes');
  return unwrap<Scope[]>(data);
}

export async function apiGetScope(id: string): Promise<Scope> {
  const { data } = await client.get(`/store/scopes/${encodeURIComponent(id)}`);
  return unwrap<Scope>(data);
}

export async function apiCreateScope(scope: Omit<Scope, 'id' | 'created_at'>): Promise<Scope> {
  const body = { ...scope, id: uid(), created_at: Date.now() };
  const { data } = await client.post('/store/scopes', body);
  return unwrap<Scope>(data);
}

export async function apiUpdateScope(id: string, patch: Partial<Scope>): Promise<Scope> {
  const current = await apiGetScope(id);
  const merged = { ...current, ...patch };
  const { data } = await client.put(`/store/scopes/${encodeURIComponent(id)}`, merged);
  return unwrap<Scope>(data);
}

export async function apiDeleteScope(id: string): Promise<void> {
  await client.delete(`/store/scopes/${encodeURIComponent(id)}`);
}

// -- Store: Assemblies ------------------------------------------------------
// Backend uses `assembly_type`, frontend uses `type` — map at boundary

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromApiAssembly(raw: any): Assembly {
  const { assembly_type, ...rest } = raw;
  return { ...rest, type: assembly_type ?? rest.type };
}

function toApiAssembly(a: Record<string, unknown>): Record<string, unknown> {
  const { type, ...rest } = a;
  return { ...rest, assembly_type: type };
}

export async function apiGetAssemblies(scopeId?: string): Promise<Assembly[]> {
  const params = scopeId ? { scope_id: scopeId } : undefined;
  const { data } = await client.get('/store/assemblies', { params });
  return unwrap<unknown[]>(data).map(fromApiAssembly);
}

export async function apiGetAssembly(id: string): Promise<Assembly> {
  const { data } = await client.get(`/store/assemblies/${encodeURIComponent(id)}`);
  return fromApiAssembly(unwrap(data));
}

export async function apiCreateAssembly(assembly: Omit<Assembly, 'id' | 'created_at' | 'folio'>): Promise<Assembly> {
  const body = toApiAssembly({ ...assembly, id: uid(), folio: Date.now() % 100000, created_at: Date.now() } as unknown as Record<string, unknown>);
  const { data } = await client.post('/store/assemblies', body);
  return fromApiAssembly(unwrap(data));
}

export async function apiUpdateAssembly(id: string, patch: Partial<Assembly>): Promise<Assembly> {
  const current = await apiGetAssembly(id);
  const merged = { ...current, ...patch };
  const { data } = await client.put(`/store/assemblies/${encodeURIComponent(id)}`, toApiAssembly(merged as unknown as Record<string, unknown>));
  return fromApiAssembly(unwrap(data));
}

export async function apiDeleteAssembly(id: string): Promise<void> {
  await client.delete(`/store/assemblies/${encodeURIComponent(id)}`);
}

// -- Store: Sessions --------------------------------------------------------

export async function apiGetSessions(assemblyId?: string): Promise<Session[]> {
  const params = assemblyId ? { assembly_id: assemblyId } : undefined;
  const { data } = await client.get('/store/sessions', { params });
  return unwrap<Session[]>(data);
}

export async function apiGetSession(id: string): Promise<Session> {
  const { data } = await client.get(`/store/sessions/${encodeURIComponent(id)}`);
  return unwrap<Session>(data);
}

export async function apiCreateSession(session: Omit<Session, 'id'>): Promise<Session> {
  const body = { ...session, id: uid() };
  const { data } = await client.post('/store/sessions', body);
  return unwrap<Session>(data);
}

export async function apiUpdateSession(id: string, patch: Partial<Session>): Promise<Session> {
  // Backend PUT requires full object — fetch current, merge, then put
  const current = await apiGetSession(id);
  const merged = { ...current, ...patch };
  const { data } = await client.put(`/store/sessions/${encodeURIComponent(id)}`, merged);
  return unwrap<Session>(data);
}

export async function apiDeleteSession(id: string): Promise<void> {
  await client.delete(`/store/sessions/${encodeURIComponent(id)}`);
}

// -- Store: Actas -----------------------------------------------------------

export async function apiGetActas(): Promise<Acta[]> {
  const { data } = await client.get('/store/actas');
  return unwrap<Acta[]>(data);
}

export async function apiGetActa(id: string): Promise<Acta> {
  const { data } = await client.get(`/store/actas/${encodeURIComponent(id)}`);
  return unwrap<Acta>(data);
}

export async function apiCreateActa(acta: Omit<Acta, 'id' | 'generated_at' | 'folio' | 'integrity_hash'>): Promise<Acta> {
  const contentJson = JSON.stringify(acta.content);
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(contentJson));
  const integrity_hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const body = { ...acta, id: uid(), folio: Date.now() % 100000, generated_at: Date.now(), integrity_hash };
  const { data } = await client.post('/store/actas', body);
  return unwrap<Acta>(data);
}

export async function apiUpdateActa(id: string, patch: Partial<Acta>): Promise<Acta> {
  const current = await apiGetActa(id);
  const merged = { ...current, ...patch };
  const { data } = await client.put(`/store/actas/${encodeURIComponent(id)}`, merged);
  return unwrap<Acta>(data);
}

export async function apiDeleteActa(id: string): Promise<void> {
  await client.delete(`/store/actas/${encodeURIComponent(id)}`);
}

// -- Alias resolution (Phase 3 — ALIAS_DESIGN.md) --------------------------

export interface AliasResolution {
  did: string
  address: string
}

export async function apiResolveAlias(commitment: string): Promise<AliasResolution | null> {
  try {
    const { data } = await client.post('/alias/resolve', { commitment })
    const result = unwrap<AliasResolution>(data)
    return result
  } catch {
    return null
  }
}

// -- Invitations (governance proposal invitations via alias) ----------------

export interface Invitation {
  invitation_id: string
  from_did: string
  to_commitment: string
  proposal_ids: number[]
  signature: string
  created_at: number
  responded: boolean
  accepted: boolean
}

export async function apiCreateInvitation(body: {
  from_did: string
  public_key: string
  to_commitment: string
  proposal_ids: number[]
  signature: string
}): Promise<{ invitation_id: string; from_did: string; to_commitment: string; proposal_ids: number[] }> {
  const { data } = await client.post('/governance/invitations', body)
  return unwrap(data)
}

export async function apiListInvitations(voterCommitment: string): Promise<Invitation[]> {
  const { data } = await client.get('/governance/invitations', { params: { voter: voterCommitment } })
  const result = unwrap<{ invitations: Invitation[] }>(data)
  return result.invitations
}

export async function apiRespondInvitation(body: {
  invitation_id: string
  public_key: string
  accepted: boolean
  signature: string
}): Promise<{ invitation_id: string; accepted: boolean }> {
  const { data } = await client.post('/governance/invitations/respond', body)
  return unwrap(data)
}

// -- Health -----------------------------------------------------------------

export async function getHealth(): Promise<{ status: string }> {
  const { data } = await client.get('/health');
  return data as { status: string };
}
