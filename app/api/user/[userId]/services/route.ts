import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/user/[userId]/services
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const services = await prisma.service.findMany({
    where: { userId },
    orderBy: { position: "asc" },
  });

  return NextResponse.json({ success: true, services });
}

// POST /api/user/[userId]/services  — cria novo serviço
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const body = await req.json();

  const service = await prisma.service.create({
    data: {
      userId,
      title:    body.title,
      url:      body.url     ?? null,
      numero:   body.numero  ?? "1",
      icon:     body.icon    ?? "🔗",
      color:    body.color   ?? "#4CAF50",
      position: body.order   ?? 0,
    },
  });

  return NextResponse.json({ success: true, service }, { status: 201 });
}
