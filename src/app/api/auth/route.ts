import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const SITE_PASSWORD = process.env.SITE_PASSWORD || 'Marip0sa';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    let userId: string | null = null;
    let maxAge = 60 * 60 * 24 * 30; // default 30 days

    if (password === SITE_PASSWORD) {
      userId = 'admin';
    } else if (password === DEMO_PASSWORD) {
      userId = 'demo';
    } else if (password === 'stratgroup' || password === process.env.STRATGROUP_PASSWORD) {
      userId = 'stratgroup';
      maxAge = 60 * 60 * 24; // strictly 24 hours for cookie

      // Check 24-hour session expiry on the backend
      let session = await prisma.stratgroupSession.findUnique({ where: { id: 'stratgroup' } });

      if (!session) {
        // First login! Create session
        session = await prisma.stratgroupSession.create({ data: { id: 'stratgroup' } });

        // Seed properties from demo's view
        const adminProps = await prisma.savedProperty.findMany({ where: { userId: 'admin' } });
        const demoProps = await prisma.savedProperty.findMany({ where: { userId: 'demo' } });
        const hidden = await prisma.demoHiddenProperty.findMany();
        const hiddenIds = new Set(hidden.map(h => h.propertyId));

        const propertiesToSeed = [
          ...adminProps.filter(p => !hiddenIds.has(p.id)),
          ...demoProps
        ];

        if (propertiesToSeed.length > 0) {
          await prisma.savedProperty.createMany({
            data: propertiesToSeed.map(p => {
              const baseId = p.id.replace(/^(demo__|stratgroup__)/, '');
              return {
                id: `stratgroup__${baseId}`, // Ensure unique ID in the stratgroup namespace
                userId: 'stratgroup',
                url: p.url,
                timestamp: new Date(),
                propertyData: p.propertyData,
                schoolsData: p.schoolsData,
                aiAnalysis: p.aiAnalysis,
                aiModel: p.aiModel,
                ai2Analysis: p.ai2Analysis,
                ai2Model: p.ai2Model,
                commuteTimes: p.commuteTimes,
              };
            })
          });
        }
      } else {
        // Check if 24 hours have passed since the first login
        const hoursPassed = (new Date().getTime() - session.startedAt.getTime()) / (1000 * 60 * 60);
        if (hoursPassed >= 24) {
          return NextResponse.json(
            { success: false, error: 'Your 24-hour trial period has expired.' },
            { status: 403 }
          );
        }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true, userId });

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge,
      path: '/',
    };

    response.cookies.set('site_auth', 'authenticated', cookieOpts);
    response.cookies.set('user_id', userId, cookieOpts);

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}
