import { toast } from "sonner";

interface RequestOptions<T> {
    url: string;
    method?: string;
    data?: T
    headers?: Record<string, string>
}

interface Response<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

export async function request<T, R>(options: RequestOptions<T>) {
    const { url,  data, headers } = options;
    let { method } = options;
    
    // 在 Server Components 中需要使用绝对 URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    let finalUrl = baseUrl + '/api' + url

    if (!method) method = "GET";
    else method = method.toUpperCase();

    if (method === "GET" && data) {
        const queryString = new URLSearchParams(data as Record<string, string>).toString();
        finalUrl += "?" + queryString;
    } 

    try {
        const response = await fetch(finalUrl, {
            method: method,
            body:  method !== "GET" && data ? JSON.stringify(data) : undefined,
            headers: {
                "Content-Type": "application/json",
                ...headers
            }
        })

        const PromiseResult = await (response.json() as Promise<Response>);

        if (!PromiseResult.success) {
            const error = PromiseResult.error;
            throw new Error(error);
        }

        return PromiseResult.data as R;
    }
    catch (err) {
        if (err instanceof Error) {
            throw err.message;
        }
        throw err;
    }
}