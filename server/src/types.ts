export type CanonicalPlacement =
  | 'Overview'
  | 'Shopping Mall'
  | 'Slide Banner'
  | 'Gacha / Luck Royale'
  | 'Background / Icon'
  | 'Event'
  | 'Esports'
  | 'Craftland';

export type RowState =
  | 'asset_not_ready'
  | 'ready_to_upload'
  | 'uploaded'
  | 'inconsistent';

export type ChecklistGroup = 'appear' | 'disappear' | 'active';

export interface DateRange {
  start: string;
  end: string;
}

export interface ParsedTab {
  name: string;
  range: DateRange;
}

export interface SubWeek {
  id: string;
  label: string;
  tabName: string;
  start: string;
  end: string;
}

export interface BannerRow {
  id: string;
  namaTab: string;
  displayName: string;
  assetTag: string | null;
  cdnLink: string | null;
  cdnUrl: string | null;
  startTime: string;
  endTime: string;
  assetDone: boolean;
  cdnUploaded: boolean;
  placement: CanonicalPlacement;
  rowState: RowState;
  subWeekLabel: string;
  gopos: string | null;
  subGopos: string | null;
}

export type SplashAssetType = 'splash' | 'anno';

export type SplashStatus =
  | 'need_to_update_trello'
  | 'trello_done'
  | 'scheduled'
  | 'done'
  | 'unknown';

export type SplashToolCSection =
  | 'ready'
  | 'asset_not_ready'
  | 'needs_review'
  | 'uploaded';

export type GoposLookupResult =
  | {
      status: 'suggested';
      gopos: string;
      subGopos: string;
      matchCount: number;
    }
  | { status: 'not_found' };

export interface SplashRecord {
  id: string;
  assetType: SplashAssetType;
  desc: string;
  descDisplay: string;
  start: string | null;
  end: string | null;
  sortId: number | null;
  uniqueId: string;
  status: SplashStatus;
  statusRaw: string;
  statusHint: string | null;
  cdnUrl: string | null;
  trelloCard: string | null;
  sheetGopos: string | null;
  sheetSubGopos: string | null;
  goposLookup: GoposLookupResult;
  scheduledWithoutUrl: boolean;
  toolCSection: SplashToolCSection;
  monthId: string | null;
}

export interface SplashMonthSummary {
  monthId: string;
  label: string;
  total: number;
  trelloDone: number;
  needToUpdate: number;
  scheduled: number;
}

export interface SplashMonthsResponse {
  months: SplashMonthSummary[];
}

export interface SplashMonthDetailResponse {
  monthId: string;
  label: string;
  days: string[];
  records: SplashRecord[];
  summary: SplashWeekSummary;
}

export interface SplashWeekSummary {
  total: number;
  trelloDone: number;
  needToUpdate: number;
  scheduled: number;
  ready: number;
  assetNotReady: number;
  needsReview: number;
}

export interface SplashWeekDetailResponse {
  week: SubWeek;
  days: string[];
  records: SplashRecord[];
  summary: SplashWeekSummary;
}

export interface WeekData {
  week: SubWeek;
  sections: Record<CanonicalPlacement, BannerRow[]>;
  allRows: BannerRow[];
}

export interface WeeksResponse {
  weeks: SubWeek[];
}

export interface WeekDetailResponse {
  week: SubWeek;
  sections: Record<CanonicalPlacement, BannerRow[]>;
  days: string[];
}

export interface CdnCheckResponse {
  status: 'ok' | 'broken';
  url: string;
}

export interface ConfirmedBug {
  id: string;
  eventName: string;
  placement: CanonicalPlacement;
  cdnUrl: string | null;
  date: string;
}
