
import { NextResponse } from 'next/server';
import { logger } from '@/utils/logger';

const AI_SERVER_URL = 'http://127.0.0.1:8000/v1/completions';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Log forwarding (server-side)
        console.log('AI-Proxy: Forwarding request to', AI_SERVER_URL);

        // Forward request from Next.js Server (Node.js) -> vLLM
        // Node.js fetch is NOT subject to CORS
        const response = await fetch(AI_SERVER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer local-ai'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('AI-Proxy: Upstream error', response.status, errorText);
            return NextResponse.json(
                { error: `Upstream error: ${response.status}`, details: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error('AI-Proxy: Internal Server Error', error);
        return NextResponse.json(
            { error: 'Internal Proxy Error', details: error.message },
            { status: 500 }
        );
    }
}
