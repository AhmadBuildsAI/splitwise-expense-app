import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().min(1, "Group name is required.").max(100),
});

export const addMemberSchema = z.object({
  usernameOrEmail: z.string().min(1, "Username or email is required."),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
