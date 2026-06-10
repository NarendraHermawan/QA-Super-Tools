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
