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
  cdnLink: string | null;
  cdnUrl: string | null;
  startTime: string;
  endTime: string;
  assetDone: boolean;
  cdnUploaded: boolean;
  placement: CanonicalPlacement;
  rowState: RowState;
  subWeekLabel: string;
}

export interface WeekDetailResponse {
  week: SubWeek;
  sections: Record<CanonicalPlacement, BannerRow[]>;
  days: string[];
}

export interface WeeksResponse {
  weeks: SubWeek[];
}

export interface ConfirmedBug {
  id: string;
  eventName: string;
  placement: CanonicalPlacement;
  cdnUrl: string | null;
  date: string;
}

export const CRAFTLAND_PLACEMENT: CanonicalPlacement = 'Craftland';

export const BANNER_PLACEMENTS: CanonicalPlacement[] = [
  'Overview',
  'Shopping Mall',
  'Slide Banner',
  'Gacha / Luck Royale',
  'Background / Icon',
  'Event',
  'Esports',
];

export const PLACEMENTS: CanonicalPlacement[] = [
  ...BANNER_PLACEMENTS,
  CRAFTLAND_PLACEMENT,
];

export type SplashAssetType = 'splash' | 'anno';

export type SplashStatus =
  | 'TRELLO DONE'
  | 'NEED TO UPDATE TRELLO'
  | 'SCHEDULED'
  | 'DONE'
  | 'unknown';

export interface SplashRecord {
  recordId: string;
  sourceRowIndex: number;
  assetType: SplashAssetType;
  desc: string;
  start: string;
  end: string;
  sortId: number | null;
  uniqueId: string;
  cdnUrl: string | null;
  status: SplashStatus;
  goPos: string | null;
  subGoPos: string | null;
}

export interface SplashUploadSections {
  ready: SplashRecord[];
  blocked: SplashRecord[];
  needsReview: SplashRecord[];
  scheduled: SplashRecord[];
}

export interface SplashChecklistGroups {
  appear: SplashRecord[];
  disappear: SplashRecord[];
  active: SplashRecord[];
}

export interface SplashConfirmedBug {
  id: string;
  eventName: string;
  assetType: SplashAssetType;
  cdnUrl: string | null;
  date: string;
}
