import axios from 'axios';
import { getOrgSettings, getActiveScope, getScope } from './store';

const API_URL = '/api/v1';

const client = axios.create({ baseURL: API_URL, timeout: 10000 });

// Inject X-Channel-Id: active scope's channel > org channel > none
client.interceptors.request.use((config) => {
  const activeScopeId = getActiveScope();
  if (activeScopeId) {
    const scope = getScope(activeScopeId);
    if (scope?.channel_id) {
      config.headers['X-Channel-Id'] = scope.channel_id;
      return config;
    }
  }
  const settings = getOrgSettings();
  if (settings.channel_id) {
    config.headers['X-Channel-Id'] = settings.channel_id;
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
  const { data } = await client.post('/store/identities', body);
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

// -- Health -----------------------------------------------------------------

export async function getHealth(): Promise<{ status: string }> {
  const { data } = await client.get('/health');
  return data as { status: string };
}
