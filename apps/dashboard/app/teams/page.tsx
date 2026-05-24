'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '../../components/DashboardShell';
import { apiGet, apiPost, apiDelete, apiPatch, AuthError, type Team, type TeamMember } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const ROLE_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  owner:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
  member: { color: '#71717a', bg: 'rgba(113,113,122,0.1)',  border: 'rgba(113,113,122,0.25)' },
};

export default function TeamsPage() {
  useRequireAuth();
  const { toast } = useToast();

  const [teams, setTeams]           = useState<Team[]>([]);
  const [members, setMembers]       = useState<TeamMember[]>([]);
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [loading, setLoading]       = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState('');
  const [creating, setCreating]     = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteId, setInviteId]     = useState('');
  const [inviting, setInviting]     = useState(false);

  const loadTeams = useCallback(async () => {
    try {
      const data = await apiGet<{ teams: Team[] }>('/v1/teams');
      setTeams(data.teams);
      if (data.teams.length > 0 && !activeTeam) {
        setActiveTeam(data.teams[0]);
      }
    } catch (e) {
      if (e instanceof AuthError) return;
    } finally {
      setLoading(false);
    }
  }, [activeTeam]);

  const loadMembers = useCallback(async (teamId: string) => {
    setMembersLoading(true);
    try {
      const data = await apiGet<{ members: TeamMember[] }>(`/v1/teams/${teamId}/members`);
      setMembers(data.members);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => { loadTeams(); }, []);
  useEffect(() => { if (activeTeam) loadMembers(activeTeam.id); }, [activeTeam]);

  async function createTeam() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await apiPost('/v1/teams', { name: newName.trim() });
      toast('Team created', 'success');
      setNewName('');
      setShowCreate(false);
      await loadTeams();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function addMember() {
    if (!inviteId.trim() || !activeTeam) return;
    setInviting(true);
    try {
      await apiPost(`/v1/teams/${activeTeam.id}/members`, { customer_id: inviteId.trim() });
      toast('Member added', 'success');
      setInviteId('');
      setShowInvite(false);
      await loadMembers(activeTeam.id);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(customerId: string) {
    if (!activeTeam) return;
    try {
      await apiDelete(`/v1/teams/${activeTeam.id}/members/${customerId}`);
      toast('Member removed', 'success');
      setMembers((prev) => prev.filter((m) => m.customer_id !== customerId));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <DashboardShell>
      <div className="p-6 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-[22px] font-bold text-white tracking-tight">Teams</h1>
            <p className="text-[13px] text-zinc-500 mt-1">Shared encrypted memory across your organization</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-bold tracking-[0.08em] uppercase transition-all hover:shadow-[0_0_20px_rgba(124,58,237,0.4)]"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            New Team
          </button>
        </div>

        {/* Create team modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-md rounded-xl p-6" style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h2 className="text-[16px] font-bold text-white mb-4">Create New Team</h2>
              <input
                autoFocus
                type="text"
                placeholder="Team name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createTeam()}
                className="w-full bg-white/[0.06] border border-white/[0.1] rounded-lg px-4 py-2.5 text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 mb-4"
              />
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setShowCreate(false); setNewName(''); }} className="px-4 py-2 text-[12px] font-semibold text-zinc-400 hover:text-white transition-colors">Cancel</button>
                <button
                  onClick={createTeam}
                  disabled={creating || !newName.trim()}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[12px] font-bold tracking-[0.06em] uppercase transition-colors"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40 text-zinc-600 text-[13px]">Loading…</div>
        ) : teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 rounded-xl text-center" style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="mb-4 text-zinc-700" aria-hidden="true">
              <circle cx="15" cy="14" r="6" stroke="currentColor" strokeWidth="2"/>
              <circle cx="30" cy="14" r="5" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M2 32c0-5.52 5.82-10 13-10s13 4.48 13 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M30 22c4.14 0 7.5 3.36 7.5 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <p className="text-[15px] font-semibold text-zinc-400">No teams yet</p>
            <p className="text-[13px] text-zinc-600 mt-1">Create a team to share encrypted memory quota across agents</p>
            <button onClick={() => setShowCreate(true)} className="mt-5 px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-bold tracking-[0.08em] uppercase transition-colors">
              Create Team
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[260px_1fr] gap-6">

            {/* Team list */}
            <div className="space-y-1.5">
              {teams.map((t) => {
                const active = activeTeam?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTeam(t)}
                    className="w-full text-left px-4 py-3 rounded-xl transition-colors"
                    style={{
                      background: active ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${active ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold" style={{ color: active ? '#fff' : 'rgba(161,161,170,0.9)' }}>{t.name}</p>
                      {t.role === 'owner' && (
                        <span className="text-[9px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 rounded"
                          style={{ color: ROLE_STYLE.owner.color, background: ROLE_STYLE.owner.bg, border: `1px solid ${ROLE_STYLE.owner.border}` }}>
                          Owner
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-0.5">{timeAgo(t.created_at)}</p>
                  </button>
                );
              })}
            </div>

            {/* Members panel */}
            {activeTeam && (
              <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-[15px] font-bold text-white">{activeTeam.name}</h2>
                    <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">{activeTeam.id}</p>
                  </div>
                  {activeTeam.role === 'owner' && (
                    <button
                      onClick={() => setShowInvite(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-[0.08em] uppercase text-violet-300 transition-colors hover:text-white"
                      style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}
                    >
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                        <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                      Add Member
                    </button>
                  )}
                </div>

                {/* Invite modal */}
                {showInvite && (
                  <div className="mb-4 p-4 rounded-lg" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                    <p className="text-[11px] font-semibold text-violet-300 mb-2">Add member by Customer ID</p>
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="customer_id (UUID)"
                        value={inviteId}
                        onChange={(e) => setInviteId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addMember()}
                        className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2 text-[12px] font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                      />
                      <button onClick={addMember} disabled={inviting || !inviteId.trim()} className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[11px] font-bold uppercase tracking-[0.06em] transition-colors">
                        {inviting ? '…' : 'Add'}
                      </button>
                      <button onClick={() => { setShowInvite(false); setInviteId(''); }} className="px-3 py-2 rounded-lg text-zinc-500 hover:text-white text-[11px] transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Members table */}
                {membersLoading ? (
                  <div className="text-[13px] text-zinc-600 py-4">Loading members…</div>
                ) : (
                  <div className="space-y-1">
                    {/* Header */}
                    <div className="grid text-[9px] font-bold tracking-[0.18em] uppercase text-zinc-600 px-3 pb-2"
                      style={{ gridTemplateColumns: '1fr 100px 120px 32px' }}>
                      <span>Email</span>
                      <span>Role</span>
                      <span>Joined</span>
                      <span />
                    </div>

                    {members.map((m) => (
                      <div
                        key={m.customer_id}
                        className="grid items-center px-3 py-2.5 rounded-lg group"
                        style={{ gridTemplateColumns: '1fr 100px 120px 32px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <span className="text-[13px] text-zinc-200 truncate">{m.email}</span>
                        <span className="text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded w-fit"
                          style={{ color: ROLE_STYLE[m.role]?.color ?? '#71717a', background: ROLE_STYLE[m.role]?.bg, border: `1px solid ${ROLE_STYLE[m.role]?.border}` }}>
                          {m.role}
                        </span>
                        <span className="text-[11px] text-zinc-600">{timeAgo(m.joined_at)}</span>
                        {activeTeam.role === 'owner' && m.role !== 'owner' && (
                          <button
                            onClick={() => removeMember(m.customer_id)}
                            className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded text-zinc-600 hover:text-red-400 transition-all"
                            title="Remove member"
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                              <path d="M1 1l10 10M11 1 1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}

                    {members.length === 0 && (
                      <p className="text-[13px] text-zinc-600 py-4 text-center">No members yet</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
