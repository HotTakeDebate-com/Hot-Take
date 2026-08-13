import {
  HotTakeWordmark,
  IconInstagram,
  IconShield,
  IconTikTok,
  IconUser,
  IconVideo,
  IconX,
  IconYouTube,
} from './LandingAssets.jsx';

function TopicIcon({ index }) {
  const paths = [
    <><path d="M12 4v28M6 8h12M4 10l-4 10h8L4 10zm16 0-4 10h8l-4-10z"/><path d="M-1 20h10M15 20h10M7 32h10"/></>,
    <path d="M2 19c5-8 12-10 23-7-3 10-11 14-23 7zm6-1c5 0 9-1 13-4" />,
    <><circle cx="10" cy="10" r="5"/><circle cx="22" cy="11" r="4"/><path d="M1 27c0-7 4-11 9-11s9 4 9 11M19 18c5 0 8 3 8 8M27 17v9M23 22h8"/></>,
    <path d="M5 16h22M16 5v22" />,
    <path d="M16 2l11 5v8c0 8-5 13-11 16C10 28 5 23 5 15V7l11-5zm0 7 2 4 5 .7-3.5 3.4.8 4.9-4.3-2.3-4.3 2.3.8-4.9L9 13.7l5-.7 2-4z" />,
  ];
  return <svg viewBox="-2 0 36 34" aria-hidden="true">{paths[index]}</svg>;
}

function NextStep({ number, icon, title, children }) {
  return (
    <div className="qm-next-step">
      <div className="qm-next-icon">{icon}</div>
      <span className="qm-next-number">{number}</span>
      <div><h3>{title}</h3><p>{children}</p></div>
    </div>
  );
}

export default function QuickMatchPage({
  topics,
  selectedTopicId,
  selectedSide,
  waiting,
  error,
  onSelectTopic,
  onSelectSide,
  onFindMatch,
  onCancel,
  onBack,
  onSignOut,
  onProfile,
  onAbout,
  onSupport,
}) {
  const selected = topics.find((topic) => topic.id === selectedTopicId) ?? topics[0];

  return (
    <div className="qm-page">
      <header className="qm-nav">
        <button type="button" className="qm-logo-button" onClick={onBack}><HotTakeWordmark variant="nav" /></button>
        <nav aria-label="Primary">
          <button type="button" onClick={onBack}>How it works</button>
          <button type="button" onClick={onAbout}>About</button>
          <button type="button" className="active">Topics</button>
          <button type="button" onClick={onSupport}>FAQ</button>
        </nav>
        <div className="qm-nav-actions">
          <button type="button" className="qm-pill qm-pill--ghost" onClick={onSignOut}>Sign out</button>
          <button type="button" className="qm-pill qm-pill--red" onClick={onProfile}>Profile</button>
        </div>
      </header>

      <main className="qm-main">
        <section className="qm-picker">
          <button type="button" className="qm-back" onClick={onBack}>?&nbsp; Back</button>
          <p className="qm-eyebrow">Quick match</p>
          <h1>Choose a topic<span>.</span></h1>
          <p className="qm-lead">Pick a topic you want to debate. We?ll match<br className="qm-desktop-break" /> you with someone who has the opposite take.</p>

          <div className="qm-topic-list">
            {topics.map((topic, index) => {
              const isSelected = topic.id === selected.id;
              return (
                <article key={topic.id} className={`qm-topic ${isSelected ? 'qm-topic--selected' : ''}`}>
                  <button type="button" className="qm-topic-summary" onClick={() => onSelectTopic(topic.id)}>
                    <span className="qm-topic-icon"><TopicIcon index={index} /></span>
                    <span className="qm-topic-label">{topic.label}</span>
                    <span className={`qm-radio ${isSelected ? 'qm-radio--checked' : ''}`}>{isSelected ? '?' : ''}</span>
                    {isSelected && <span className="qm-chevron">?</span>}
                  </button>
                  {isSelected && (
                    <div className="qm-side-choice">
                      <p>Do you agree or disagree with the statement?</p>
                      <div>
                        <button type="button" className={selectedSide === 'agree' ? 'selected' : ''} onClick={() => onSelectSide('agree')}>?? <span>Agree</span></button>
                        <button type="button" className={selectedSide === 'disagree' ? 'selected' : ''} onClick={() => onSelectSide('disagree')}>?? <span>Disagree</span></button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {error && <div className="qm-error">{error}</div>}
          <button type="button" className="qm-submit" disabled={!selectedSide} onClick={() => onFindMatch(selectedSide)}>
            <span>{waiting ? 'Looking for your match?' : 'Find my match'}</span><span>{waiting ? '' : '?'}</span>
          </button>
          {waiting && <button type="button" className="qm-cancel" onClick={onCancel}>Cancel search</button>}
        </section>

        <aside className="qm-next">
          <h2>What happens next?</h2>
          <NextStep number="1" icon={<IconUser />} title="Get matched">We?ll find someone who chooses the opposite take.</NextStep>
          <NextStep number="2" icon={<IconVideo />} title="Debate face to face">You?ll join a private video call and make your case.</NextStep>
          <NextStep number="3" icon={<IconShield />} title="Respect the rules">Be respectful, listen, and keep it on topic.</NextStep>
          <div className="qm-promise"><IconShield /><div><h3>Our promise</h3><p>Real people. No filters.<br />Just real debates.</p></div></div>
        </aside>
      </main>

      <footer className="qm-footer">
        <HotTakeWordmark variant="footer" />
        <p>? 2025 Hot Take Debate. All rights reserved.</p>
        <div><span>Follow us</span><a href="https://x.com" aria-label="X"><IconX /></a><a href="https://instagram.com" aria-label="Instagram"><IconInstagram /></a><a href="https://tiktok.com" aria-label="TikTok"><IconTikTok /></a><a href="https://youtube.com" aria-label="YouTube"><IconYouTube /></a></div>
      </footer>
    </div>
  );
}
