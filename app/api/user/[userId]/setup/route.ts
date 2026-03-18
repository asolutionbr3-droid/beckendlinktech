import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// POST /api/user/[userId]/setup
// Chamado após cadastro via Better Auth para criar perfil + slug
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const { email } = await req.json();

  const name = email?.split("@")[0] ?? "usuario";

  // Gera slug único
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const slug = baseSlug + Math.random().toString(36).substring(2, 6);

  // Cria perfil (upsert) e slug (só cria se ainda não existe)
  const existing = await prisma.link.findFirst({ where: { userId } });

  const [profile, link] = await Promise.all([
    prisma.profile.upsert({
      where:  { userId },
      update: {},
      create: { userId, nome: name, display_name: name },
    }),
    existing
      ? Promise.resolve(existing)
      : prisma.link.create({ data: { userId, slug } }),
  ]);

  return NextResponse.json({ success: true, profile, slug: link.slug }, { status: 201 });
}
