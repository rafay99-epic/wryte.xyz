import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import type { ActionCtx, MutationCtx } from "../_generated/server";

export async function getRateLimitKey(
  ctx: MutationCtx | ActionCtx,
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.tokenIdentifier ?? "anonymous";
}

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  "users:getOrCreate": {
    kind: "token bucket",
    rate: 10,
    period: MINUTE,
    capacity: 5,
  },
  "profiles:sync": {
    kind: "token bucket",
    rate: 10,
    period: MINUTE,
    capacity: 5,
  },
  "profiles:update": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 8,
  },
  "users:updateGithubToken": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "users:updateDefaultCompressionSettings": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "users:selfDestruct": {
    kind: "fixed window",
    rate: 3,
    period: HOUR,
  },

  "projects:create": {
    kind: "fixed window",
    rate: 10,
    period: HOUR,
  },
  "projects:update": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },
  "projects:remove": {
    kind: "fixed window",
    rate: 5,
    period: HOUR,
  },

  "documents:create": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "documents:update": {
    kind: "token bucket",
    rate: 120,
    period: MINUTE,
    capacity: 30,
  },
  "documents:duplicate": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "documents:updateStatus": {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 5,
  },
  "documents:remove": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "documents:startBulkImport": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "documents:startBulkDelete": {
    kind: "fixed window",
    rate: 5,
    period: MINUTE,
  },
  "documents:toggleBookmark": {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 5,
  },
  "documents:moveCard": {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 10,
  },
  "documents:updateTags": {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 5,
  },
  "documents:rollbackToVersion": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "documentDrafts:create": {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 10,
  },
  "documentDrafts:update": {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 10,
  },
  "documentDrafts:remove": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "documentDrafts:updateContent": {
    kind: "token bucket",
    rate: 120,
    period: MINUTE,
    capacity: 30,
  },
  "documentDrafts:autosaveContent": {
    kind: "token bucket",
    rate: 120,
    period: MINUTE,
    capacity: 30,
  },
  "documentDrafts:promote": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "snapshots:create": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 6,
  },
  "snapshots:restore": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "shareLinks:create": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "shareLinks:revoke": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "ideas:create": {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 10,
  },
  "ideas:remove": {
    kind: "fixed window",
    rate: 30,
    period: MINUTE,
  },
  "documentResearch:create": {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 15,
  },
  "documentResearch:update": {
    kind: "token bucket",
    rate: 120,
    period: MINUTE,
    capacity: 30,
  },
  "documentResearch:remove": {
    kind: "fixed window",
    rate: 30,
    period: MINUTE,
  },
  "conflicts:resolve": {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 10,
  },
  "documents:restoreFromTrash": {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 10,
  },
  "documents:permanentDelete": {
    kind: "fixed window",
    rate: 30,
    period: MINUTE,
  },
  "documents:emptyTrash": {
    kind: "fixed window",
    rate: 5,
    period: HOUR,
  },

  "boardColumns:updateColumns": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },

  "promptTemplates:updateTemplates": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "promptTemplates:addTemplate": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "promptTemplates:removeTemplate": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },

  "snippets:create": {
    kind: "fixed window",
    rate: 30,
    period: MINUTE,
  },
  "snippets:update": {
    kind: "fixed window",
    rate: 60,
    period: MINUTE,
  },
  "snippets:remove": {
    kind: "fixed window",
    rate: 30,
    period: MINUTE,
  },

  "animations:create": {
    kind: "fixed window",
    rate: 30,
    period: MINUTE,
  },
  "animations:update": {
    kind: "fixed window",
    rate: 60,
    period: MINUTE,
  },
  "animations:remove": {
    kind: "fixed window",
    rate: 30,
    period: MINUTE,
  },

  "media:upload": {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 10,
  },
  "media:list": {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 20,
  },
  "media:delete": {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 5,
  },
  "media:uploadConcurrency": {
    kind: "token bucket",
    rate: 180,
    period: MINUTE,
    capacity: 3,
  },
  "media:globalUpload": {
    kind: "fixed window",
    rate: 5000,
    period: MINUTE,
  },
  "mediaCredentials:set": {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 2,
  },
  "mediaCredentials:rotate": {
    kind: "fixed window",
    rate: 10,
    period: HOUR,
  },
  "mediaCredentials:test": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },
  "mediaCredentials:delete": {
    kind: "fixed window",
    rate: 5,
    period: HOUR,
  },
  "vault:read": {
    kind: "token bucket",
    rate: 240,
    period: MINUTE,
    capacity: 30,
  },
  "vault:write": {
    kind: "token bucket",
    rate: 10,
    period: MINUTE,
    capacity: 3,
  },

  "tools:linkCheck": {
    kind: "fixed window",
    rate: 6,
    period: HOUR,
  },
  "tools:oembed": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },

  "scheduling:schedule": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "scheduling:cancel": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },

  "ai:global": {
    kind: "token bucket",
    rate: 3000,
    period: MINUTE,
    capacity: 600,
  },
  "ai:provider": {
    kind: "token bucket",
    rate: 1500,
    period: MINUTE,
    capacity: 400,
  },
  "ai:createEnhanceStream": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "ai:createInlineEnhanceStream": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "ai:createFrontmatterStream": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "ai:createFinalDraftStream": {
    kind: "fixed window",
    rate: 8,
    period: MINUTE,
  },
  "aiCredentials:set": {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 2,
  },
  "aiCredentials:rotate": {
    kind: "fixed window",
    rate: 10,
    period: HOUR,
  },
  "aiCredentials:test": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },
  "aiCredentials:delete": {
    kind: "fixed window",
    rate: 5,
    period: HOUR,
  },

  "socialCredentials:set": {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 2,
  },
  "socialCredentials:rotate": {
    kind: "fixed window",
    rate: 10,
    period: HOUR,
  },
  "socialCredentials:test": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },
  "socialCredentials:delete": {
    kind: "fixed window",
    rate: 5,
    period: HOUR,
  },
  "socialCredentials:updateConfig": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "socialPost:test": {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 3,
  },

  "syndicationCredentials:set": {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 2,
  },
  "syndicationCredentials:test": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },
  "syndicationCredentials:delete": {
    kind: "fixed window",
    rate: 5,
    period: HOUR,
  },
  "syndicationCredentials:updateConfig": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "syndicationPost:test": {
    kind: "token bucket",
    rate: 3,
    period: MINUTE,
    capacity: 2,
  },
  "syndicationPost:retry": {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 3,
  },

  "maintenance:retireExternalAnalytics": {
    kind: "fixed window",
    rate: 3,
    period: HOUR,
  },

  "github:publish": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "github:bulkPublish": {
    kind: "fixed window",
    rate: 5,
    period: MINUTE,
  },
  "github:importFile": {
    kind: "token bucket",
    rate: 120,
    period: MINUTE,
    capacity: 60,
  },
  "github:verifyRepoAccess": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "github:deleteFile": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },

  "clerk:getOauthToken": {
    kind: "token bucket",
    rate: 120,
    period: MINUTE,
    capacity: 30,
  },

  "featureRequests:create": {
    kind: "fixed window",
    rate: 10,
    period: HOUR,
  },
  "featureRequests:toggleUpvote": {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 15,
  },
  "featureRequests:updateStatus": {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 10,
  },
  "featureRequests:remove": {
    kind: "fixed window",
    rate: 30,
    period: HOUR,
  },

  "writingStats:setGoal": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },

  "seed:run": {
    kind: "fixed window",
    rate: 5,
    period: MINUTE,
  },

  "support:submitFromDashboard": {
    kind: "fixed window",
    rate: 10,
    period: HOUR,
  },
  "support:submitFromMarketing": {
    kind: "fixed window",
    rate: 5,
    period: HOUR,
  },

  "mcp:request": {
    kind: "token bucket",
    rate: 600,
    period: MINUTE,
    capacity: 120,
    shards: 8,
  },
  "mcp:initialize": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "mcp:setGrant": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },

  "mcp:global": {
    kind: "token bucket",
    rate: 20000,
    period: MINUTE,
    capacity: 4000,
    shards: 64,
  },
});
