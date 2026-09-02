import { apiClient } from "./client";
import { MemberBalance, SimplifiedDebt, Settlement, ActivityEntry, DashboardData } from "../types";

export async function fetchBalances(groupId: string) {
  const res = await apiClient.get<{
    data: { balances: MemberBalance[]; simplifiedDebts: SimplifiedDebt[] };
  }>(`/groups/${groupId}/balances`);
  return res.data.data;
}

export async function fetchSettlements(groupId: string) {
  const res = await apiClient.get<{ data: { settlements: Settlement[] } }>(
    `/groups/${groupId}/settlements`
  );
  return res.data.data.settlements;
}

export async function createSettlementRequest(
  groupId: string,
  payload: { paidByUserId: string; paidToUserId: string; amount: string; date: string }
) {
  const res = await apiClient.post<{ data: { settlement: Settlement } }>(
    `/groups/${groupId}/settlements`,
    payload
  );
  return res.data.data.settlement;
}

export async function fetchActivity(groupId: string, limit = 10) {
  const res = await apiClient.get<{ data: { activity: ActivityEntry[] } }>(
    `/groups/${groupId}/activity?limit=${limit}`
  );
  return res.data.data.activity;
}

export async function fetchDashboard() {
  const res = await apiClient.get<{ data: DashboardData }>("/dashboard");
  return res.data.data;
}
