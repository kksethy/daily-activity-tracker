export const uid = () => crypto.randomUUID();
export const percent = (current, target) => target ? Math.min(100, Math.round((current / target) * 100)) : 0;
export const clock = (seconds) => `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
