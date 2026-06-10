import type { SplashStatus } from '../types';

export function splashStatusLabel(status: SplashStatus, raw: string): string {
  switch (status) {
    case 'need_to_update_trello':
      return 'Asset not ready';
    case 'trello_done':
      return 'uploaded';
    case 'scheduled':
      return 'Scheduled';
    case 'done':
      return 'DONE';
    default:
      return raw || 'Unknown';
  }
}

export function splashStatusVariant(
  status: SplashStatus,
): 'ok' | 'warn' | 'error' | 'neutral' {
  switch (status) {
    case 'scheduled':
    case 'done':
      return 'ok';
    case 'trello_done':
      return 'warn';
    case 'need_to_update_trello':
      return 'error';
    default:
      return 'neutral';
  }
}
