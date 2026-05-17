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

// Paths that don't require authentication
const PUBLIC_PATHS = ['/health', '/channels'];

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
  const { data } = await client.post('/store/scopes', scope);
  return unwrap<Scope>(data);
}

export async function apiUpdateScope(id: string, scope: Partial<Scope>): Promise<Scope> {
  const { data } = await client.put(`/store/scopes/${encodeURIComponent(id)}`, scope);
  return unwrap<Scope>(data);
}

export async function apiDeleteScope(id: string): Promise<void> {
  await client.delete(`/store/scopes/${encodeURIComponent(id)}`);
}

// -- Store: Assemblies ------------------------------------------------------

export async function apiGetAssemblies(scopeId?: string): Promise<Assembly[]> {
  const params = scopeId ? { scope_id: scopeId } : undefined;
  const { data } = await client.get('/store/assemblies', { params });
  return unwrap<Assembly[]>(data);
}

export async function apiGetAssembly(id: string): Promise<Assembly> {
  const { data } = await client.get(`/store/assemblies/${encodeURIComponent(id)}`);
  return unwrap<Assembly>(data);
}

export async function apiCreateAssembly(assembly: Omit<Assembly, 'id' | 'created_at' | 'folio'>): Promise<Assembly> {
  const { data } = await client.post('/store/assemblies', assembly);
  return unwrap<Assembly>(data);
}

export async function apiUpdateAssembly(id: string, assembly: Partial<Assembly>): Promise<Assembly> {
  const { data } = await client.put(`/store/assemblies/${encodeURIComponent(id)}`, assembly);
  return unwrap<Assembly>(data);
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
  const { data } = await client.post('/store/sessions', session);
  return unwrap<Session>(data);
}

export async function apiUpdateSession(id: string, session: Partial<Session>): Promise<Session> {
  const { data } = await client.put(`/store/sessions/${encodeURIComponent(id)}`, session);
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
  const { data } = await client.post('/store/actas', acta);
  return unwrap<Acta>(data);
}

export async function apiUpdateActa(id: string, acta: Partial<Acta>): Promise<Acta> {
  const { data } = await client.put(`/store/actas/${encodeURIComponent(id)}`, acta);
  return unwrap<Acta>(data);
}

export async function apiDeleteActa(id: string): Promise<void> {
  await client.delete(`/store/actas/${encodeURIComponent(id)}`);
}

// -- Health -----------------------------------------------------------------

export async function getHealth(): Promise<{ status: string }> {
  const { data } = await client.get('/health');
  return data as { status: string };
}
