import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { getGroupActivity } from "../services/activity.service";

export async function listActivity(req: AuthedRequest, res: Response) {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
  const activity = await getGroupActivity(req.params.groupId, limit);
  res.status(200).json({
    success: true,
    data: {
      activity: activity.map((a: any) => ({
        id: a.id,
        eventType: a.eventType,
        actorUsername: a.actor.username,
        entityId: a.entityId,
        metadata: a.metadata,
        createdAt: a.createdAt,
      })),
    },
  });
}
