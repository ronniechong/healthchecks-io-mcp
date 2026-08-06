export const DEFAULT_BASE_URL = 'https://healthchecks.io/api/v3';
const DEFAULT_TIMEOUT_MS = 10_000;

export interface HealthchecksClientOptions {
    apiKey: string;
    baseUrl?: string;
    timeoutMs?: number;
}

export type ApiResult<T> =
    | { ok: true; data: T }
    | { ok: false; kind: 'unauthorized'; message: string }
    | { ok: false; kind: 'not_found'; message: string }
    | { ok: false; kind: 'network'; message: string }
    | { ok: false; kind: 'unexpected'; status: number; message: string };

export class HealthchecksClient {
    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly timeoutMs: number;

    constructor(options: HealthchecksClientOptions) {
        this.apiKey = options.apiKey;
        this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    }

    /**
     * `path` may be a path relative to baseUrl, or a full URL (e.g. a
     * `next` pagination link returned by a previous response).
     */
    async get<T>(path: string): Promise<ApiResult<T>> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const url = path.startsWith('http://') || path.startsWith('https://') ? path : `${this.baseUrl}${path}`;

        let response: Response;
        try {
            response = await fetch(url, {
                headers: { 'X-Api-Key': this.apiKey },
                signal: controller.signal
            });
        } catch (error) {
            return { ok: false, kind: 'network', message: describeNetworkError(error) };
        } finally {
            clearTimeout(timer);
        }

        const contentType = response.headers.get('content-type') ?? '';
        const isJson = contentType.includes('application/json');

        if (response.status === 401) {
            return {
                ok: false,
                kind: 'unauthorized',
                message: 'The API key does not have access to this endpoint (read-only keys cannot access this data, or the key is invalid).'
            };
        }
        if (response.status === 404) {
            return { ok: false, kind: 'not_found', message: 'Not found.' };
        }
        if (!response.ok) {
            return {
                ok: false,
                kind: 'unexpected',
                status: response.status,
                message: `Unexpected response (HTTP ${response.status}).`
            };
        }
        if (!isJson) {
            return {
                ok: false,
                kind: 'unexpected',
                status: response.status,
                message: 'Expected a JSON response but received a different content type.'
            };
        }

        const data = (await response.json()) as T;
        return { ok: true, data };
    }

    /**
     * Defensive cursor-following (decision #21): Healthchecks.io's list
     * endpoints showed no pagination at the scale tested in M01, but this
     * follows a Django-REST-Framework-style `next` URL in the response
     * body if one is ever present, rather than assuming a flat list.
     * Capped to avoid an unbounded loop against a misbehaving server.
     */
    async getAllPages<T, Item>(
        initialPath: string,
        itemsOf: (data: T) => Item[],
        nextOf: (data: T) => string | null | undefined,
        maxPages = 50
    ): Promise<ApiResult<Item[]>> {
        const items: Item[] = [];
        let path: string | null | undefined = initialPath;
        let pages = 0;

        while (path && pages < maxPages) {
            const result = await this.get<T>(path);
            if (!result.ok) return result;
            items.push(...itemsOf(result.data));
            path = nextOf(result.data);
            pages += 1;
        }

        return { ok: true, data: items };
    }
}

function describeNetworkError(error: unknown): string {
    if (error instanceof Error) {
        if (error.name === 'AbortError') {
            return 'The request timed out.';
        }
        return error.message;
    }
    return 'Unknown network error.';
}
