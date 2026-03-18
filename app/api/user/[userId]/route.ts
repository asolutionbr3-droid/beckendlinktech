import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/user/[userId]  — retorna perfil + slug
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const [profile, link] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.link.findFirst({ where: { userId } }),
  ]);

  if (!profile) {
    return NextResponse.json({ success: false, error: "Perfil não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ success: true, profile: { ...profile, slug: link?.slug ?? null } });
}

// PUT /api/user/[userId]  — cria ou atualiza perfil (upsert)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const body = await req.json();

  const data = {
    nome:         body.nome         ?? "",
    display_name: body.display_name ?? null,
    uber:         body.uber         ?? false,
    app99:        body.app99        ?? false,
    eletrico:     body.eletrico     ?? false,
    cidade:       body.cidade       ?? null,
    whatsapp:     body.whatsapp     ?? null,
    pix:          body.pix          ?? null,
    foto:         body.foto         ?? null,
    instagram:    body.instagram    ?? null,
  };

  const profile = await prisma.profile.upsert({
    where:  { userId },
    update: data,
    create: { userId, ...data },
  });

  return NextResponse.json({ success: true, profile });
}
