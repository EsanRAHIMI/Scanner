export function getTrainerApiBase() {
  const v = process.env.NEXT_PUBLIC_TRAINER_API_BASE;
  if (!v) return 'http://127.0.0.1:8010';
  return v;
}
