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
  last_escalated_at: string | null;
}

export interface Reminder {
  id: number;
  ticket_id: string;
  department: string;
  days_open: number;
  old_priority: Priority;
  new_priority: Priority;
  created_at: string;
}

// Read-only, no-login-required aggregate stats — see GET /api/stats/public
export interface DepartmentStats {
  department: string;
  total: number;
  pending: number;
  inReview: number;
  resolved: number;
  avgResolutionDays: number | null;
}

export interface PublicStats {
  generatedAt: string;
  totalTickets: number;
  totalResolved: number;
  resolvedThisMonth: number;
  avgResolutionDays: number | null;
  byDepartment: DepartmentStats[];
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

// These values must match the exact department labels the AI model was
// trained on (see ai/data/complaints.csv / ai/train.py) — that CSV lists
// 8 departments: Electricity, Others, Parks, Public Transport,
// Roads & Infrastructure, Sanitation, Waste Management, Water Supply.
export type AdminScope =
  | "ALL"
  | "Water Supply"
  | "Electricity"
  | "Roads & Infrastructure"
  | "Sanitation"
  | "Waste Management"
  | "Public Transport"
  | "Parks"
  | "Others";

export interface DepartmentOption {
  value: AdminScope;
  label: string;
}

// "value" must match the exact category string stored in the tickets
// table (i.e. the AI's department label). "label" is what the dropdown shows.
export const DEPARTMENT_OPTIONS: DepartmentOption[] = [
  { value: "ALL", label: "Master Admin" },
  { value: "Water Supply", label: "Water Supply" },
  { value: "Electricity", label: "Electricity" },
  { value: "Roads & Infrastructure", label: "Road Hazards" },
  { value: "Sanitation", label: "Sanitation" },
  { value: "Waste Management", label: "Waste Management" },
  { value: "Public Transport", label: "Public Transport" },
  { value: "Parks", label: "Parks" },
  { value: "Others", label: "Others" },
];