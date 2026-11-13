CREATE TYPE "MeasurementStatus" AS ENUM ('success', 'failed');
CREATE TYPE "ConnectivityStatus" AS ENUM ('connected', 'degraded', 'internet_down', 'unknown');
CREATE TYPE "AgentCommandStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'expired');

CREATE TABLE "NetworkMeasurement" (
  "id" TEXT NOT NULL, "deviceId" TEXT NOT NULL, "commandId" TEXT, "requestId" TEXT, "downloadMbps" DOUBLE PRECISION, "uploadMbps" DOUBLE PRECISION,
  "latencyMs" DOUBLE PRECISION, "jitterMs" DOUBLE PRECISION, "packetLossPercent" DOUBLE PRECISION,
  "serverId" TEXT, "serverName" TEXT, "publicIp" TEXT, "ooklaVersion" TEXT,
  "status" "MeasurementStatus" NOT NULL, "errorMessage" TEXT, "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NetworkMeasurement_pkey" PRIMARY KEY ("id"), CONSTRAINT "NetworkMeasurement_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "NetworkMeasurement_deviceId_completedAt_idx" ON "NetworkMeasurement"("deviceId", "completedAt");
CREATE INDEX "NetworkMeasurement_status_completedAt_idx" ON "NetworkMeasurement"("status", "completedAt");
CREATE UNIQUE INDEX "NetworkMeasurement_commandId_key" ON "NetworkMeasurement"("commandId");
CREATE UNIQUE INDEX "NetworkMeasurement_requestId_key" ON "NetworkMeasurement"("requestId");

CREATE TABLE "ConnectivityCheck" (
  "id" TEXT NOT NULL, "deviceId" TEXT NOT NULL, "gatewayReachable" BOOLEAN, "internetReachable" BOOLEAN NOT NULL,
  "apiReachable" BOOLEAN NOT NULL, "latencyMs" DOUBLE PRECISION, "packetLossPercent" DOUBLE PRECISION,
  "failedChecks" INTEGER NOT NULL DEFAULT 0, "status" "ConnectivityStatus" NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConnectivityCheck_pkey" PRIMARY KEY ("id"), CONSTRAINT "ConnectivityCheck_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ConnectivityCheck_deviceId_checkedAt_idx" ON "ConnectivityCheck"("deviceId", "checkedAt");
CREATE INDEX "ConnectivityCheck_status_checkedAt_idx" ON "ConnectivityCheck"("status", "checkedAt");

CREATE TABLE "NetworkSettings" (
  "id" TEXT NOT NULL, "deviceId" TEXT, "connectivityIntervalSeconds" INTEGER NOT NULL DEFAULT 60,
  "speedTestIntervalMinutes" INTEGER NOT NULL DEFAULT 30, "speedTestEnabled" BOOLEAN NOT NULL DEFAULT true,
  "slowDownloadThresholdMbps" DOUBLE PRECISION NOT NULL DEFAULT 5, "slowUploadThresholdMbps" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "highLatencyThresholdMs" DOUBLE PRECISION NOT NULL DEFAULT 150, "highJitterThresholdMs" DOUBLE PRECISION NOT NULL DEFAULT 30,
  "highPacketLossThresholdPercent" DOUBLE PRECISION NOT NULL DEFAULT 3, "consecutiveFailuresBeforeDown" INTEGER NOT NULL DEFAULT 3,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "NetworkSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NetworkSettings_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NetworkSettings_deviceId_key" ON "NetworkSettings"("deviceId");

CREATE TABLE "AgentCommand" (
  "id" TEXT NOT NULL, "deviceId" TEXT NOT NULL, "commandType" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "status" "AgentCommandStatus" NOT NULL DEFAULT 'queued', "requestedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3), "result" JSONB, CONSTRAINT "AgentCommand_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AgentCommand_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AgentCommand_deviceId_status_createdAt_idx" ON "AgentCommand"("deviceId", "status", "createdAt");

CREATE TABLE "NetworkIncident" (
  "id" TEXT NOT NULL, "deviceId" TEXT NOT NULL, "category" TEXT NOT NULL, "summary" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "recoveredAt" TIMESTAMP(3),
  "durationSeconds" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NetworkIncident_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NetworkIncident_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "NetworkIncident_deviceId_startedAt_idx" ON "NetworkIncident"("deviceId", "startedAt");
CREATE INDEX "NetworkIncident_recoveredAt_startedAt_idx" ON "NetworkIncident"("recoveredAt", "startedAt");
