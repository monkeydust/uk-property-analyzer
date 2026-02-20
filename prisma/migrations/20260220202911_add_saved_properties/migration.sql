-- CreateTable
CREATE TABLE "SavedProperty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "propertyData" TEXT NOT NULL,
    "schoolsData" TEXT,
    "aiAnalysis" TEXT,
    "aiModel" TEXT,
    "ai2Analysis" TEXT,
    "ai2Model" TEXT,
    "commuteTimes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "SavedProperty_timestamp_idx" ON "SavedProperty"("timestamp");
