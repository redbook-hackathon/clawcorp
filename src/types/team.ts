/**
 * Team data types for multi-agent team management
 * Supports many-to-many relationships (agents can belong to multiple teams)
 */

/**
 * Team status based on member activity (per D-23)
 * - active: At least one member is working
 * - idle: All members are idle
 * - blocked: At least one member is blocked
 */
export type TeamStatus = 'active' | 'idle' | 'blocked';

/**
 * Core team data structure
 */
export interface Team {
  /** Unique team identifier (UUID) */
  id: string;

  /** Team name (auto-generated or user-provided, per D-15) */
  name: string;

  /** Leader agent ID (required) */
  leaderId: string;

  /** Member agent IDs (excluding leader) */
  memberIds: string[];

  /** Team responsibility description (optional) */
  description: string;

  /** Current team status */
  status: TeamStatus;

  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Team summary for card list display
 * Extends Team with computed display fields
 */
export interface TeamSummary extends Team {
  /** Total member count (including leader) */
  memberCount: number;

  /** Number of active tasks */
  activeTaskCount: number;

  /** Last activity timestamp (undefined if never active) */
  lastActiveTime: number | undefined;

  /** Leader display name */
  leaderName: string;

  /** Member avatar information (first 3-4 members for display) */
  memberAvatars: Array<{
    id: string;
    name: string;
    avatar?: string;
  }>;
}

/**
 * Request payload for creating a new team
 */
export interface CreateTeamRequest {
  /** Leader agent ID (required) */
  leaderId: string;

  /** Member agent IDs (required, can be empty array) */
  memberIds: string[];

  /** Team name (optional - auto-generated if not provided, per D-15) */
  name?: string;

  /** Team description (optional) */
  description?: string;
}

/**
 * Request payload for updating an existing team
 */
export interface UpdateTeamRequest {
  /** Updated team name */
  name?: string;

  /** Updated team description */
  description?: string;

  /** Updated member list (replaces existing members) */
  memberIds?: string[];
}

/**
 * Response from team API operations
 */
export interface TeamsSnapshot {
  /** List of all teams with summary information */
  teams: TeamSummary[];
}
