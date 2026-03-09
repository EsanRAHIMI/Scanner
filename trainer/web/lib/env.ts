export function getTrainerApiBase() {
  const v = process.env.NEXT_PUBLIC_TRAINER_API_BASE;
  if (!v) {
    return '/trainer/api';
  }
  return v;
}
