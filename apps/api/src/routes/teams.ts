import type { FastifyInstance } from 'fastify';
import { db } from '../db/pool.js';
import '../types.js';

interface CreateTeamBody {
  name: string;
}

interface AddMemberBody {
  customer_id: string;
  role?: 'owner' | 'member';
}

export async function teamsRoutes(app: FastifyInstance) {
  // POST /v1/teams — create a new team owned by the authenticated customer
  app.post<{ Body: CreateTeamBody }>('/v1/teams', async (req, reply) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return reply.status(400).send({ error: 'name is required' });
    }

    const customer = await db.query(
      `SELECT customer_id FROM api_keys WHERE id = $1`,
      [req.apiKey.id],
    );
    const customerId = customer.rows[0]?.customer_id;
    if (!customerId) return reply.status(400).send({ error: 'customer not found' });

    const team = await db.query<{ id: string; name: string; created_at: string }>(
      `INSERT INTO teams (name, owner_customer_id) VALUES ($1, $2)
       RETURNING id, name, created_at`,
      [name, customerId],
    );
    const { id: teamId } = team.rows[0];

    // Owner is also a member
    await db.query(
      `INSERT INTO team_members (team_id, customer_id, role) VALUES ($1, $2, 'owner')`,
      [teamId, customerId],
    );

    // Associate the current API key with the new team
    await db.query(
      `UPDATE api_keys SET team_id = $1, tier = 'team' WHERE id = $2`,
      [teamId, req.apiKey.id],
    );

    return reply.status(201).send(team.rows[0]);
  });

  // GET /v1/teams — list teams the authenticated customer belongs to
  app.get('/v1/teams', async (req, reply) => {
    const customer = await db.query(
      `SELECT customer_id FROM api_keys WHERE id = $1`,
      [req.apiKey.id],
    );
    const customerId = customer.rows[0]?.customer_id;
    if (!customerId) return reply.send({ teams: [] });

    const rows = await db.query<{ id: string; name: string; role: string; created_at: string }>(
      `SELECT t.id, t.name, tm.role, t.created_at
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.customer_id = $1
       ORDER BY t.created_at DESC`,
      [customerId],
    );

    return reply.send({ teams: rows.rows });
  });

  // GET /v1/teams/:id/members — list members of a team
  app.get<{ Params: { id: string } }>('/v1/teams/:id/members', async (req, reply) => {
    const { id: teamId } = req.params;

    const customer = await db.query(
      `SELECT customer_id FROM api_keys WHERE id = $1`,
      [req.apiKey.id],
    );
    const customerId = customer.rows[0]?.customer_id;

    // Verify caller is a member of this team
    const membership = await db.query(
      `SELECT 1 FROM team_members WHERE team_id = $1 AND customer_id = $2`,
      [teamId, customerId],
    );
    if (membership.rowCount === 0) {
      return reply.status(403).send({ error: 'not a member of this team' });
    }

    const rows = await db.query<{ customer_id: string; email: string; role: string; joined_at: string }>(
      `SELECT tm.customer_id, c.email, tm.role, tm.joined_at
       FROM team_members tm
       JOIN customers c ON c.id = tm.customer_id
       WHERE tm.team_id = $1
       ORDER BY tm.joined_at ASC`,
      [teamId],
    );

    return reply.send({ members: rows.rows });
  });

  // POST /v1/teams/:id/members — add a member to a team (owner only)
  app.post<{ Params: { id: string }; Body: AddMemberBody }>('/v1/teams/:id/members', async (req, reply) => {
    const { id: teamId } = req.params;
    const { customer_id: newMemberId, role = 'member' } = req.body;

    if (!newMemberId) return reply.status(400).send({ error: 'customer_id is required' });

    const customer = await db.query(
      `SELECT customer_id FROM api_keys WHERE id = $1`,
      [req.apiKey.id],
    );
    const customerId = customer.rows[0]?.customer_id;

    const ownerCheck = await db.query(
      `SELECT 1 FROM team_members WHERE team_id = $1 AND customer_id = $2 AND role = 'owner'`,
      [teamId, customerId],
    );
    if (ownerCheck.rowCount === 0) {
      return reply.status(403).send({ error: 'only the team owner can add members' });
    }

    await db.query(
      `INSERT INTO team_members (team_id, customer_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, customer_id) DO UPDATE SET role = EXCLUDED.role`,
      [teamId, newMemberId, role],
    );

    return reply.status(201).send({ team_id: teamId, customer_id: newMemberId, role });
  });

  // DELETE /v1/teams/:id/members/:customerId — remove a member (owner only, can't remove self)
  app.delete<{ Params: { id: string; customerId: string } }>('/v1/teams/:id/members/:customerId', async (req, reply) => {
    const { id: teamId, customerId: targetId } = req.params;

    const customer = await db.query(
      `SELECT customer_id FROM api_keys WHERE id = $1`,
      [req.apiKey.id],
    );
    const callerId = customer.rows[0]?.customer_id;

    const ownerCheck = await db.query(
      `SELECT 1 FROM team_members WHERE team_id = $1 AND customer_id = $2 AND role = 'owner'`,
      [teamId, callerId],
    );
    if (ownerCheck.rowCount === 0) {
      return reply.status(403).send({ error: 'only the team owner can remove members' });
    }
    if (callerId === targetId) {
      return reply.status(400).send({ error: 'owner cannot remove themselves from the team' });
    }

    await db.query(
      `DELETE FROM team_members WHERE team_id = $1 AND customer_id = $2`,
      [teamId, targetId],
    );

    return reply.status(204).send();
  });
}
