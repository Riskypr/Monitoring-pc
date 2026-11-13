-- Keep the Ookla measurement field and core throughput history. Remove only iPerf2-specific metadata.
ALTER TABLE "NetworkMeasurement"
  DROP COLUMN IF EXISTS "serverRegion",
  DROP COLUMN IF EXISTS "protocol",
  DROP COLUMN IF EXISTS "durationSeconds",
  DROP COLUMN IF EXISTS "parallelStreams",
  DROP COLUMN IF EXISTS "udpTargetMbps",
  DROP COLUMN IF EXISTS "clientVersion",
  DROP COLUMN IF EXISTS "serverVersion",
  DROP COLUMN IF EXISTS "rawSummary";

ALTER TABLE "NetworkSettings"
  DROP COLUMN IF EXISTS "testDurationSeconds",
  DROP COLUMN IF EXISTS "parallelStreams",
  DROP COLUMN IF EXISTS "udpTestEnabled",
  DROP COLUMN IF EXISTS "udpTargetMbps",
  DROP COLUMN IF EXISTS "iperfServerId";

ALTER TABLE "ConnectivityCheck"
  DROP COLUMN IF EXISTS "testServerReachable";

DROP INDEX IF EXISTS "NetworkMeasurement_serverId_completedAt_idx";

UPDATE "ConnectivityCheck"
SET "status" = 'connected'
WHERE "status"::text = 'test_server_unreachable';

CREATE TYPE "ConnectivityStatus_ookla" AS ENUM ('connected', 'degraded', 'internet_down', 'unknown', 'api_unreachable');
ALTER TABLE "ConnectivityCheck"
  ALTER COLUMN "status" TYPE "ConnectivityStatus_ookla"
  USING "status"::text::"ConnectivityStatus_ookla";
DROP TYPE "ConnectivityStatus";
ALTER TYPE "ConnectivityStatus_ookla" RENAME TO "ConnectivityStatus";
