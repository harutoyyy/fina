import { prisma } from "@/lib/prisma"
import { getServerSession } from "@/lib/auth-server"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const companies = await prisma.company.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      shortName: true,
      industryType: true,
    },
    orderBy: { displayOrder: "asc" },
  })
  return NextResponse.json(companies)
}
