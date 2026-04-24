import axios from 'axios';

const API_URL = '/api/v1';

const client = axios.create({ baseURL: API_URL, timeout: 10000 });

function unwrap<T>(body: unknown): T {
  const r = body as Record<string, unknown>;
  if (r.status === 'Success' && r.data != null) return r.data as T;
  if (r.success === true && r.data != null) return r.data as T;
  const msg =
    typeof r.message === 'string' ? r.message : 'Request failed';
  throw new Error(msg);
}

// -- Types ------------------------------------------------------------------

export interface Election {
  id: number;
  title: string;
  description: string;
  creator: string;
  status: 'Draft' | 'Open' | 'Closed' | 'Tallied';
  options: string[];
  eligible_voters: string[];
  created_at: number;
  opens_at: number;
  closes_at: number;
}

export interface Vote {
  election_id: number;
  voter: string;
  option_index: number;
  timestamp: number;
}

export interface ElectionResult {
  election_id: number;
  title: string;
  total_votes: number;
  total_eligible: number;
  participation: number;
  results: OptionResult[];
  quorum_reached: boolean;
}

export interface OptionResult {
  option: string;
  votes: number;
  percentage: number;
}

export interface VoterCredential {
  did: string;
  name: string;
  credential_id?: string;
}

// -- Governance API (existing backend) --------------------------------------

export interface Proposal {
  id: number;
  proposer: string;
  description: string;
  status: string;
  deposit: number;
  action: unknown;
  created_at: number;
  voting_end: number;
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

export interface ProtocolParam {
  key: string;
  value: number;
}

export async function getGovernanceParams(): Promise<ProtocolParam[]> {
  const { data } = await client.get('/governance/params');
  return unwrap<ProtocolParam[]>(data);
}

export async function getProposals(): Promise<Proposal[]> {
  const { data } = await client.get('/governance/proposals');
  return unwrap<Proposal[]>(data);
}

export async function getProposal(id: number): Promise<Proposal> {
  const { data } = await client.get(`/governance/proposals/${id}`);
  return unwrap<Proposal>(data);
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

export async function castVote(
  proposalId: number,
  body: { voter: string; option: 'Yes' | 'No' | 'Abstain'; power: number },
): Promise<void> {
  await client.post(`/governance/proposals/${proposalId}/vote`, body);
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

// -- Health -----------------------------------------------------------------

export async function getHealth(): Promise<{ status: string }> {
  const { data } = await client.get('/health');
  return data as { status: string };
}
