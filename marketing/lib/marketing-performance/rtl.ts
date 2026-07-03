const PERSIAN_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

export function hasPersianText(text: string | null | undefined): boolean {
  if (!text) return false;
  return PERSIAN_RE.test(text);
}

export function rtlClass(text: string | null | undefined): string {
  return hasPersianText(text) ? 'text-right' : '';
}

export function rtlDir(text: string | null | undefined): 'rtl' | 'ltr' | undefined {
  if (!text) return undefined;
  return hasPersianText(text) ? 'rtl' : 'ltr';
}

export function rtlProps(text: string | null | undefined): {
  dir?: 'rtl' | 'ltr';
  className: string;
} {
  const rtl = hasPersianText(text);
  return {
    dir: text ? (rtl ? 'rtl' : 'ltr') : undefined,
    className: rtl ? 'text-right' : '',
  };
}
