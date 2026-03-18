import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// PUT /api/services/[id]  — edita serviço
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const service = await prisma.service.update({
    where: { id },
    data: {
      title:    body.title,
      url:      body.url    ?? null,
      numero:   body.numero ?? "1",
      icon:     body.icon   ?? "🔗",
      color:    body.color  ?? "#4CAF50",
      position: body.order  ?? 0,
    },
  });

  return NextResponse.json({ success: true, service });
}

// DELETE /api/services/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.service.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
