export type TicketStatus = "pending" | "in_review" | "resolved";
export type Priority = "Low" | "Medium" | "High" | "Critical";

export interface Ticket {
  id: string;
  ticket_id: string;
  title: string;
  category: string;
  location: string;
  status: TicketStatus;
  submitted_by: string;
  report_count: number;
  priority: Priority;
  ai_department: string | null;
  ai_confidence: number | null;
  ai_summary: string | null;
  created_at: string;
}

export const STATUS_META: Record<TicketStatus, { label: string; chip: string; dot: string }> = {
  pending: { label: "Pending", chip: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  in_review: { label: "In Review", chip: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  resolved: { label: "Resolved", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
};

export const PRIORITY_META: Record<Priority, { label: string; badge: string; pulse: boolean }> = {
  Low: { label: "Low", badge: "bg-emerald-100 text-emerald-800 ring-emerald-300", pulse: false },
  Medium: { label: "Medium", badge: "bg-yellow-100 text-yellow-800 ring-yellow-300", pulse: false },
  High: { label: "HIGH", badge: "bg-orange-100 text-orange-800 ring-orange-300", pulse: false },
  Critical: { label: "CRITICAL", badge: "bg-red-600 text-white ring-red-700", pulse: true },
};
