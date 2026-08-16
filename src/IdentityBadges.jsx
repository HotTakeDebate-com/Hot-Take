import './DebateNetwork.css';

export default function IdentityBadges({ verified = false, premium = false, role = 'user', compact = false }) {
  const staffRole = ['moderator', 'admin', 'owner'].includes(role) ? role : null;
  if (!premium && !verified && !staffRole) return null;
  return <span className={`identity-badges${compact ? ' identity-badges--compact' : ''}`} aria-label="Account badges">
    {premium && <span className="identity-badge identity-badge--premium" title="Premium member" aria-label="Premium member">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.2 7.1 7.7 11l4.3-7 4.3 7 4.5-3.9-1.7 11.2H4.9L3.2 7.1Z" /><path d="M5.2 20h13.6" /></svg>
    </span>}
    {verified && <span className="identity-badge identity-badge--verified" title="Verified debater" aria-label="Verified debater">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4.5 12.5 4.4 4.4L19.5 6.8" /></svg>
    </span>}
    {staffRole && <span className={`identity-badge identity-badge--staff identity-badge--${staffRole}`} title={staffRole[0].toUpperCase() + staffRole.slice(1)} aria-label={staffRole}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path className="badge-shield" d="M12 2.7 20 6v5.7c0 5.1-3.1 8.5-8 10.3-4.9-1.8-8-5.2-8-10.3V6l8-3.3Z" /><path className="badge-star" d="m12 7.1 1.35 2.72 3 .44-2.18 2.11.52 2.99L12 13.95l-2.69 1.41.52-2.99-2.18-2.11 3-.44L12 7.1Z" /></svg>
    </span>}
  </span>;
}

