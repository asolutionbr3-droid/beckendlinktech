import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/user/public/[slug]  — página pública do motorista
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const link = await prisma.link.findUnique({
    where: { slug },
    include: {
      user: {
        include: {
          profile:  true,
          services: { orderBy: { position: "asc" } },
        },
      },
    },
  });

  if (!link || !link.user.profile) {
    return NextResponse.json({ success: false, error: "Página não encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    success:  true,
    plan:     "free",
    profile:  link.user.profile,
    services: link.user.services,
  });
}
