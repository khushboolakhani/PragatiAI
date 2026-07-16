import type { Ticket, TicketStatus } from "./types";

// Set VITE_API_BASE_URL in your .env once you deploy the backend
// (e.g. to Render). Falls back to localhost for local dev.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchTickets(department?: string): Promise<Ticket[]> {
  const url =
    department && department !== "ALL"
      ? `${API_BASE_URL}/api/tickets?department=${encodeURIComponent(department)}`
      : `${API_BASE_URL}/api/tickets`;
  const res = await fetch(url);
  return handleResponse<Ticket[]>(res);
}

export async function fetchTicketsByUser(email: string): Promise<Ticket[]> {
  const res = await fetch(`${API_BASE_URL}/api/tickets/user?email=${encodeURIComponent(email)}`);
  return handleResponse<Ticket[]>(res);
}

export async function searchTickets(query: string): Promise<Ticket[]> {
  const res = await fetch(`${API_BASE_URL}/api/tickets/search?q=${encodeURIComponent(query)}`);
  return handleResponse<Ticket[]>(res);
}

export interface SubmitResult {
  ticket: Ticket;
  isDuplicate: boolean;
}

export async function createTicketOrIncrement(input: {
  title: string;
  location: string;
  submitted_by: string;
}): Promise<SubmitResult> {
  const res = await fetch(`${API_BASE_URL}/api/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handleResponse<SubmitResult>(res);
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus
): Promise<{ message: string; ticketId: string; status: TicketStatus }> {
  const res = await fetch(`${API_BASE_URL}/api/tickets/${encodeURIComponent(ticketId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return handleResponse(res);
}