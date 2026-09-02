import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { createGroupSchema, addMemberSchema } from "../validators/group.validators";
import * as groupService from "../services/group.service";
import { AppError } from "../utils/AppError";

export async function createGroup(req: AuthedRequest, res: Response) {
  const input = createGroupSchema.parse(req.body);
  const group = await groupService.createGroup(req.userId!, input);
  res.status(201).json({ success: true, data: { group } });
}

export async function listGroups(req: AuthedRequest, res: Response) {
  const groups = await groupService.listUserGroups(req.userId!);
  res.status(200).json({
    success: true,
    data: {
      groups: groups.map((g: any) => ({
        id: g.id,
        name: g.name,
        createdBy: g.createdBy,
        memberCount: g._count.members,
        createdAt: g.createdAt,
      })),
    },
  });
}

export async function getGroup(req: AuthedRequest, res: Response) {
  const group = await groupService.getGroupDetails(req.params.groupId);
  res.status(200).json({
    success: true,
    data: {
      group: {
        id: group.id,
        name: group.name,
        createdBy: group.createdBy,
        createdAt: group.createdAt,
        members: group.members.map((m: any) => ({
          userId: m.user.id,
          username: m.user.username,
          email: m.user.email,
          joinedAt: m.joinedAt,
        })),
      },
    },
  });
}

export async function addMember(req: AuthedRequest, res: Response) {
  const input = addMemberSchema.parse(req.body);
  const member = await groupService.addMember(req.params.groupId, req.userId!, input.usernameOrEmail);
  res.status(201).json({ success: true, data: { member } });
}

export async function removeMember(req: AuthedRequest, res: Response) {
  const { groupId, userId } = req.params;
  if (!req.userId) throw new AppError(401, "Authentication required.");
  await groupService.removeMember(groupId, req.userId, userId);
  res.status(200).json({ success: true, data: { message: "Member removed." } });
}
