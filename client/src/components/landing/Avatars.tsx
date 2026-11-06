// Initials instead of photos: no real faces without consent.
export function Avatars() {
  return (
    <span className="flex -space-x-3" aria-hidden>
      {[['RS', '#2F6BF0'], ['AK', '#1E6B4E']].map(([i, c]) => (
        <span key={i} className="grid h-11 w-11 place-items-center rounded-full border-2 border-ink text-xs font-bold text-white" style={{ background: c }}>{i}</span>
      ))}
    </span>
  );
}
