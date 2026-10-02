interface RequestOptions<T> {
    url: string;
    method?: string;
    data?: T
    headers?: Record<string, string>
    // 以 multipart/form-data 发送（此时 data 必须是 FormData，Content-Type 交给浏览器生成 boundary）
    formData?: boolean
}

interface Response<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

export async function request<T, R>(options: RequestOptions<T>) {
    const { url,  data, headers, formData: isFormData = false } = options;
    let { method } = options;

    // 浏览器端用同源相对路径；服务端（Server Component）没有 origin 概念，才需要绝对地址
    const isServer = typeof window === "undefined";
    const baseUrl = isServer ? process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000" : "";
    let finalUrl = `${baseUrl}/api${url}`;

    if (!method) method = "GET";
    else method = method.toUpperCase();

    if (method === "GET" && data) {
        const queryString = new URLSearchParams(data as Record<string, string>).toString();
        finalUrl += "?" + queryString;
    } 

    try {
        const response = await fetch(finalUrl, {
            method: method,
            body:  method !== "GET" && data
                ? (isFormData ? (data as unknown as BodyInit) : JSON.stringify(data))
                : undefined,
            // FormData 不能手动设 Content-Type，否则会丢失浏览器生成的 boundary
            headers: isFormData
                ? { ...headers }
                : {
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