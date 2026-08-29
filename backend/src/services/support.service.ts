import type { Role, SupportTicketStatus } from "@prisma/client";
import { prisma } from "@/database/db";
import { AppError } from "@/utils/errors";

/** null tenantId means "no restriction" — only valid for a super_admin caller. */
async function assertTicketAccess(ticketId: string, tenantId: string | null) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket || (tenantId !== null && ticket.tenantId !== tenantId)) {
    throw AppError.notFound("Support ticket not found");
  }
  return ticket;
}

export async function createTicket(tenantId: string, createdBy: string, senderRole: Role, subject: string, firstMessage: string) {
  return prisma.supportTicket.create({
    data: {
      tenantId,
      createdBy,
      subject,
      messages: { create: [{ senderId: createdBy, senderRole, body: firstMessage }] },
    },
    include: { messages: true },
  });
}

export async function listTickets(tenantId: string | null, status?: SupportTicketStatus) {
  return prisma.supportTicket.findMany({
    where: { ...(tenantId ? { tenantId } : {}), ...(status ? { status } : {}) },
    include: {
      tenant: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getTicket(ticketId: string, tenantId: string | null) {
  await assertTicketAccess(ticketId, tenantId);
  return prisma.supportTicket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { tenant: { select: { name: true } }, messages: { orderBy: { createdAt: "asc" } } },
  });
}

export async function addMessage(ticketId: string, tenantId: string | null, senderId: string, senderRole: Role, body: string) {
  await assertTicketAccess(ticketId, tenantId);
  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({ data: { ticketId, senderId, senderRole, body } }),
    prisma.supportTicket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } }),
  ]);
  return message;
}

export async function setTicketStatus(ticketId: string, tenantId: string | null, status: SupportTicketStatus) {
  await assertTicketAccess(ticketId, tenantId);
  return prisma.supportTicket.update({ where: { id: ticketId }, data: { status } });
}
