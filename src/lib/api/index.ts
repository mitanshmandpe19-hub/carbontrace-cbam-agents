import type { CarbonTraceApi } from './client';
import { mockApi } from './mockApi';
import { realApi } from './realApi';

export const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';

export const api: CarbonTraceApi = USE_MOCK_API ? mockApi : realApi;

export type { CarbonTraceApi, UploadDocumentPayload } from './client';

