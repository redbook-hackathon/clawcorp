'use client'

import { COLUMNS } from '@/lib/kanban/types'
import type { KanbanTicket, TicketStatus } from '@/lib/kanban/types'
import type { KanbanStore } from '@/lib/kanban/store'
import { getTicketsByStatus } from '@/lib/kanban/store'
import type { Agent } from '@/lib/types'
import { KanbanColumn } from './KanbanColumn'
import { TicketCard } from './TicketCard'

interface KanbanBoardProps {
  tickets: KanbanStore
  agents: Agent[]
  onTicketClick: (ticket: KanbanTicket) => void
  onMoveTicket: (ticketId: string, status: TicketStatus) => void
  onCreateTicket: () => void
  isWorking?: (ticketId: string) => boolean
  filterAgentId?: string | null
}

export function KanbanBoard({
  tickets,
  agents,
  onTicketClick,
  onMoveTicket,
  onCreateTicket,
  isWorking,
  filterAgentId,
}: KanbanBoardProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        height: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: 'var(--space-2) 0',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {COLUMNS.map((column) => {
        const allColumnTickets = getTicketsByStatus(tickets, column.id)
        const columnTickets = filterAgentId
          ? allColumnTickets.filter((t) => t.assigneeId === filterAgentId)
          : allColumnTickets

        return (
          <KanbanColumn
            key={column.id}
            column={column}
            tickets={columnTickets}
            agents={agents}
            onTicketClick={onTicketClick}
            onDrop={onMoveTicket}
            onCreateTicket={column.id === 'backlog' ? onCreateTicket : undefined}
            renderTicket={(ticket) => (
              <TicketCard
                ticket={ticket}
                agent={agents.find((a) => a.id === ticket.assigneeId) ?? null}
                onClick={() => onTicketClick(ticket)}
                isWorking={isWorking?.(ticket.id)}
              />
            )}
          />
        )
      })}
    </div>
  )
}
