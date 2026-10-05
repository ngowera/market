import {NextResponse,type NextRequest} from 'next/server';
export function middleware(request:NextRequest){const admin=process.env.ADMIN_HOST;if(admin&&request.nextUrl.hostname===admin&&request.nextUrl.pathname==='/'){const u=request.nextUrl.clone();u.pathname='/admin';return NextResponse.rewrite(u)}return NextResponse.next()}
export const config={matcher:['/']};
