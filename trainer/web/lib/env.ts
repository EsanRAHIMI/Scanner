export function getTrainerApiBase() {
  const v = process.env.NEXT_PUBLIC_TRAINER_API_BASE;
  if (!v) return 'http://localhost:8010';
  return v;
}
