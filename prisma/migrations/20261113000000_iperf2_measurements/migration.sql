ALTER TABLE "NetworkMeasurement"
  ADD COLUMN "serverRegion" TEXT,
  ADD COLUMN "protocol" TEXT NOT NULL DEFAULT 'TCP',
  ADD COLUMN "durationSeconds" INTEGER,
  ADD COLUMN "parallelStreams" INTEGER,
  ADD COLUMN "udpTargetMbps" DOUBLE PRECISION,
  ADD COLUMN "clientVersion" TEXT,
  ADD COLUMN "serverVersion" TEXT,
  ADD COLUMN "rawSummary" TEXT;

ALTER TABLE "NetworkSettings"
  ADD COLUMN "testDurationSeconds" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "parallelStreams" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "udpTestEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "udpTargetMbps" DOUBLE PRECISION,
  ADD COLUMN "iperfServerId" TEXT;

ALTER TABLE "ConnectivityCheck" ADD COLUMN "testServerReachable" BOOLEAN;
ALTER TYPE "ConnectivityStatus" ADD VALUE IF NOT EXISTS 'api_unreachable';
ALTER TYPE "ConnectivityStatus" ADD VALUE IF NOT EXISTS 'test_server_unreachable';

DROP INDEX IF EXISTS "NetworkMeasurement_serverId_completedAt_idx";
CREATE INDEX "NetworkMeasurement_serverId_completedAt_idx" ON "NetworkMeasurement"("serverId", "completedAt");
