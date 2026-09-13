-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "announcementEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "announcementText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "announcementLinkUrl" TEXT,
ADD COLUMN     "announcementLinkLabel" TEXT;
