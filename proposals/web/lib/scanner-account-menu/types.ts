export type AuthMe = {
  email: string;
  username: string;
  is_admin: boolean;
  permissions: string[];
};

export type ScannerServiceUrls = {
  trainerWeb: string;
  trainerAdminUsers: string;
  hubWeb: string;
  productsWeb?: string;
  marketingWeb?: string;
  imageWeb?: string;
  proposalsWeb?: string;
};

export type AccountMenuItem =
  | {
      kind: 'link';
      id: string;
      label: string;
      href: string;
      variant?: 'default' | 'accent' | 'primary';
      adminOnly?: boolean;
    }
  | {
      kind: 'action';
      id: string;
      label: string;
      onClick: () => void;
      adminOnly?: boolean;
    };

export type ScannerAccountMenuApp =
  | 'products'
  | 'marketing'
  | 'image'
  | 'proposals'
  | 'frontend'
  | 'trainer';

export type ScannerAccountMenuProps = {
  /** Trainer auth proxy prefix, e.g. `/api/trainer` */
  authApiPrefix?: string;
  /** Runtime URL config endpoint */
  serviceUrlsPath?: string;
  /** Which app shell — drives default admin links */
  app?: ScannerAccountMenuApp;
  /** Extra menu items (appended after defaults for signed-in users) */
  extraMenuItems?: AccountMenuItem[];
  /** Replace default admin items entirely */
  menuItems?: AccountMenuItem[];
  onAuthChange?: () => void;
  /** Called after successful logout (e.g. redirect to login page) */
  onLoggedOut?: () => void;
  onActivityLogs?: () => void;
  /** Force light or dark palette (dashboard uses dark on black header) */
  surface?: 'light' | 'dark';
  className?: string;
  align?: 'left' | 'right';
};
