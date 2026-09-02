export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  createdBy: string;
  memberCount: number;
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  username: string;
  email: string;
  joinedAt: string;
}

export interface GroupDetails {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  members: GroupMember[];
}

export type SplitType = "EQUAL" | "EXACT";

export interface ExpenseSplit {
  userId: string;
  amountOwed: string; // decimal string, e.g. "25.00"
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  totalAmount: string;
  paidByUserId: string;
  splitType: SplitType;
  date: string;
  splits: ExpenseSplit[];
}

export interface MemberBalance {
  userId: string;
  username: string;
  netBalance: string;
}

export interface SimplifiedDebt {
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  amount: string;
}

export interface Settlement {
  id: string;
  groupId: string;
  paidByUserId: string;
  paidToUserId: string;
  paidByUsername?: string;
  paidToUsername?: string;
  amount: string;
  date: string;
}

export interface ActivityEntry {
  id: string;
  eventType: string;
  actorUsername: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DashboardGroup {
  id: string;
  name: string;
  memberCount: number;
  yourBalance: string;
}

export interface DashboardData {
  groups: DashboardGroup[];
  summary: {
    totalOwedToUser: string;
    totalUserOwes: string;
  };
  recentActivity: {
    type: "EXPENSE" | "SETTLEMENT";
    id: string;
    groupName: string;
    description: string;
    paidBy: string;
    amount: string;
    date: string;
  }[];
}

export interface ApiError {
  success: false;
  message: string;
  errors: unknown[];
}
