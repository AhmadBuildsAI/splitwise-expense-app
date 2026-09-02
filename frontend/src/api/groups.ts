import { apiClient } from "./client";
import { Group, GroupDetails } from "../types";

export async function fetchGroups() {
  const res = await apiClient.get<{ data: { groups: Group[] } }>("/groups");
  return res.data.data.groups;
}

export async function fetchGroup(groupId: string) {
  const res = await apiClient.get<{ data: { group: GroupDetails } }>(`/groups/${groupId}`);
  return res.data.data.group;
}

export async function createGroupRequest(name: string) {
  const res = await apiClient.post<{ data: { group: Group } }>("/groups", { name });
  return res.data.data.group;
}

export async function addMemberRequest(groupId: string, usernameOrEmail: string) {
  await apiClient.post(`/groups/${groupId}/members`, { usernameOrEmail });
}

export async function removeMemberRequest(groupId: string, userId: string) {
  await apiClient.delete(`/groups/${groupId}/members/${userId}`);
}
