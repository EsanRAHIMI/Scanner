export function getTrainerApiBase() {
  const v = process.env.NEXT_PUBLIC_TRAINER_API_BASE;
  if (!v) {
    if (process.env.NODE_ENV === 'production') return '/trainer/api';
    return 'http://localhost:8010';
  }
  return v;
}
