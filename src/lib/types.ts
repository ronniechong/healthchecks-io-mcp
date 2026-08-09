export interface CheckSummary {
  name: string;
  slug?: string;
  tags?: string;
  desc?: string;
  grace?: number;
  n_pings?: number;
  status?: string;
  last_ping?: string | null;
  next_ping?: string | null;
  uuid?: string;
  unique_key?: string;
  [key: string]: unknown;
}

export interface ListChecksResponse {
  checks: CheckSummary[];
  next?: string | null;
}

export interface Ping {
  type?: string;
  date?: string;
  n?: number;
  [key: string]: unknown;
}

export interface ListPingsResponse {
  pings: Ping[];
  next?: string | null;
}

export interface Channel {
  id: string;
  name?: string;
  kind?: string;
  [key: string]: unknown;
}

export interface ListChannelsResponse {
  channels: Channel[];
}

export interface Flip {
  timestamp?: string;
  up?: number;
  [key: string]: unknown;
}

export interface ListFlipsResponse {
  flips: Flip[];
}

export interface BadgeUrls {
  svg?: string;
  svg3?: string;
  json?: string;
  json3?: string;
  shields?: string;
  shields3?: string;
  [key: string]: unknown;
}

export interface BadgesResponse {
  badges: Record<string, BadgeUrls>;
}
