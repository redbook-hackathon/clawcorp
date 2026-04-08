import type { IncomingMessage, ServerResponse } from 'http';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';
import {
  listTeamsSnapshot,
  createTeam,
  updateTeam,
  deleteTeam,
} from '../../utils/team-config';
import { clearChannelOwnerBindingsForTeam } from '../../utils/channel-owner-binding';
import type { CreateTeamRequest, UpdateTeamRequest } from '../../src/types/team';
import { logger } from '../../utils/logger';

/**
 * Handle team-related API routes
 *
 * Routes:
 * - GET /api/teams - List all teams
 * - POST /api/teams - Create a new team
 * - PUT /api/teams/:teamId - Update a team
 * - DELETE /api/teams/:teamId - Delete a team
 */
export async function handleTeamRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  _ctx: HostApiContext,
): Promise<boolean> {
  // GET /api/teams - List all teams
  if (url.pathname === '/api/teams' && req.method === 'GET') {
    try {
      const teams = await listTeamsSnapshot();
      sendJson(res, 200, { success: true, teams });
    } catch (error) {
      logger.error('[teams] Failed to list teams:', error);
      sendJson(res, 500, { success: false, error: String(error), teams: [] });
    }
    return true;
  }

  // POST /api/teams - Create a new team
  if (url.pathname === '/api/teams' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<CreateTeamRequest>(req);

      // Validate required fields
      if (!body.leaderId) {
        sendJson(res, 400, { success: false, error: 'leaderId is required' });
        return true;
      }

      if (!Array.isArray(body.memberIds)) {
        sendJson(res, 400, { success: false, error: 'memberIds must be an array' });
        return true;
      }

      await createTeam(body);

      // Return all teams after creation (following agents.ts pattern)
      const teams = await listTeamsSnapshot();
      sendJson(res, 200, { success: true, teams });
    } catch (error) {
      logger.error('[teams] Failed to create team:', error);
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  // PUT /api/teams/:teamId - Update a team
  if (url.pathname.startsWith('/api/teams/') && req.method === 'PUT') {
    try {
      const teamId = decodeURIComponent(url.pathname.slice('/api/teams/'.length));

      if (!teamId) {
        sendJson(res, 400, { success: false, error: 'teamId is required' });
        return true;
      }

      const body = await parseJsonBody<UpdateTeamRequest>(req);

      await updateTeam(teamId, body);

      // Return all teams after update (following agents.ts pattern)
      const teams = await listTeamsSnapshot();
      sendJson(res, 200, { success: true, teams });
    } catch (error) {
      logger.error('[teams] Failed to update team:', error);

      // Return 404 if team not found
      if (String(error).includes('not found')) {
        sendJson(res, 404, { success: false, error: String(error) });
      } else {
        sendJson(res, 500, { success: false, error: String(error) });
      }
    }
    return true;
  }

  // DELETE /api/teams/:teamId - Delete a team
  if (url.pathname.startsWith('/api/teams/') && req.method === 'DELETE') {
    try {
      const teamId = decodeURIComponent(url.pathname.slice('/api/teams/'.length));

      if (!teamId) {
        sendJson(res, 400, { success: false, error: 'teamId is required' });
        return true;
      }

      await deleteTeam(teamId);
      await clearChannelOwnerBindingsForTeam(teamId);

      // Return all teams after deletion (following agents.ts pattern)
      const teams = await listTeamsSnapshot();
      sendJson(res, 200, { success: true, teams });
    } catch (error) {
      logger.error('[teams] Failed to delete team:', error);

      // Return 404 if team not found
      if (String(error).includes('not found')) {
        sendJson(res, 404, { success: false, error: String(error) });
      } else {
        sendJson(res, 500, { success: false, error: String(error) });
      }
    }
    return true;
  }

  // Route not handled
  return false;
}
