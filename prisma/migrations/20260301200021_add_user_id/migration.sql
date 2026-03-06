-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SavedProperty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'admin',
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
INSERT INTO "new_SavedProperty" ("ai2Analysis", "ai2Model", "aiAnalysis", "aiModel", "commuteTimes", "createdAt", "id", "propertyData", "schoolsData", "timestamp", "updatedAt", "url") SELECT "ai2Analysis", "ai2Model", "aiAnalysis", "aiModel", "commuteTimes", "createdAt", "id", "propertyData", "schoolsData", "timestamp", "updatedAt", "url" FROM "SavedProperty";
DROP TABLE "SavedProperty";
ALTER TABLE "new_SavedProperty" RENAME TO "SavedProperty";
CREATE INDEX "SavedProperty_timestamp_idx" ON "SavedProperty"("timestamp");
CREATE INDEX "SavedProperty_userId_idx" ON "SavedProperty"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
