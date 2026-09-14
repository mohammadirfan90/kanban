-- CreateTable
CREATE TABLE "board_public_links" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "board_public_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "board_public_links_slug_key" ON "board_public_links"("slug");

-- CreateIndex
CREATE INDEX "board_public_links_boardId_idx" ON "board_public_links"("boardId");

-- AddForeignKey
ALTER TABLE "board_public_links" ADD CONSTRAINT "board_public_links_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
