-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Exam_isPublic_idx" ON "Exam"("isPublic");
