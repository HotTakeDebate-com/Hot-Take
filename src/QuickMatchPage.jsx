import {
  HotTakeWordmark, IconInstagram, IconShield, IconReddit, IconUser,
  IconVideo, IconX, IconYouTube,
} from './LandingAssets.jsx';
import { SiteFooter, SiteHeader } from './SiteChrome.jsx';

function TopicIcon({ index }) {
  const icons = [
    <><path d="M16 3v28M10 7h12M7 9 2 20h10L7 9Zm18 0-5 11h10L25 9ZM10 31h12" /><path d="M1 20h12M19 20h12" /></>,
    <>
      <path d="M3.2 16.7c1.1-4.5 5.7-7.4 11.3-7.4 3.6 0 5.7 1.5 8.5 1.5 2 0 3.8-.8 5.5-.2 2.1.8 2.8 3.6 1.2 5.4-3.5 4-9.4 7.2-16.5 8-4.6.5-8.9-.7-10-3.4-.5-1.1-.4-2.6 0-3.9Z" />
      <path d="M6.4 18.4c3.3 1.9 7.3 2.1 11 .7 3.9-1.5 6.5-4.3 11.2-4.2" />
      <ellipse cx="10.3" cy="13.7" rx="2.5" ry="1.8" />
    </>,
    <><circle cx="10" cy="10" r="5" /><circle cx="23" cy="11" r="4" /><path d="M1 28c0-7 4-12 9-12s9 5 9 12M20 18c5 0 8 4 8 9M28 18v10M23 23h10" /></>,
    <path d="M4 17h26M17 4v26" />,
    <><path d="M17 2 29 7v9c0 8-5 13-12 17C10 29 5 24 5 16V7l12-5Z" /><path d="m17 9 2.2 4.4 4.8.7-3.5 3.4.8 4.8-4.3-2.2-4.3 2.2.8-4.8L10 14.1l4.8-.7L17 9Z" /></>,
  ];
  return <svg viewBox="0 0 34 34" aria-hidden="true">{icons[index]}</svg>;
}

function CheckIcon() {
  return <svg className="qm-control-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>;
}

function ChevronUpIcon() {
  return <svg className="qm-chevron-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 15 7-7 7 7" /></svg>;
}

function ArrowIcon({ direction = 'right' }) {
  return <svg className={`qm-arrow-icon qm-arrow-icon--${direction}`} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

function ThumbIcon({ down = false }) {
  return <svg className={`qm-thumb-icon ${down ? 'qm-thumb-icon--down' : ''}`} viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v10H3V10h4Zm0 9h9.2a2 2 0 0 0 1.9-1.4l2.1-6.4A2 2 0 0 0 18.3 8H14l.6-3a2 2 0 0 0-3.7-1.4L7 10v9Z" /></svg>;
}

function NextStep({ number, icon, title, children }) {
  return <div className="qm-next-step"><div className="qm-next-icon">{icon}</div><span className="qm-next-number">{number}</span><div><h3>{title}</h3><p>{children}</p></div></div>;
}

function WaitingPanel({ onCancel, topic, topicIndex, side }) {
  return (
    <section className="qm-waiting-panel" aria-live="polite">
      <p className="qm-eyebrow">Quick match</p>
      <h1>Finding your debater<span>...</span></h1>
      <p className="qm-waiting-lead">We're matching you with someone who has<br />an opposing take.</p>
      <div className="qm-search-orb">
        <svg className="qm-search-people" viewBox="0 0 110 70" aria-hidden="true">
          <circle cx="37" cy="19" r="14" /><path d="M13 64c0-18 10-30 24-30s24 12 24 30H13Z" />
          <circle cx="78" cy="20" r="13" /><path d="M62 64h39c0-18-9-29-23-29-7 0-13 3-17 8" />
        </svg>
        <strong>Searching for opponent</strong>
        <div className="qm-search-dots" aria-hidden="true"><i /><i /><i /></div>
      </div>
      <div className="qm-waiting-selection">
        <span className="qm-waiting-topic-icon"><TopicIcon index={topicIndex} /></span>
        <div><small>Your topic</small><p>{topic?.label}</p></div>
        <strong className={`qm-waiting-side qm-waiting-side--${side}`}>{side === 'agree' ? 'Agree' : 'Disagree'}</strong>
      </div>
      <button type="button" className="qm-waiting-cancel" onClick={onCancel}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg> Cancel matchmaking</button>
    </section>
  );
}

export default function QuickMatchPage({
  topics, selectedTopicId, selectedSide, waiting, error, onSelectTopic,
  onSelectSide, onFindMatch, onCancel, onBack, onSignOut, onProfile,
  onAbout, onSupport, onHelp, onPickLegal,
}) {
  const selected = topics.find((topic) => topic.id === selectedTopicId) ?? null;

  return (
    <div className="qm-page">
      <SiteHeader onHome={onBack} onAbout={onAbout} onTopics={() => {}} onFaq={onSupport} onSupport={onHelp} isSignedIn onSignOut={onSignOut} onProfile={onProfile} onPickLegal={onPickLegal} />

      <main className={`qm-main ${waiting ? 'qm-main--waiting' : ''}`}>
        {waiting ? <WaitingPanel onCancel={onCancel} topic={selected} topicIndex={topics.findIndex((topic) => topic.id === selected?.id)} side={selectedSide} /> : <section className="qm-picker">
          <button type="button" className="qm-back" onClick={onBack}><ArrowIcon direction="left" /> Back</button>
          <p className="qm-eyebrow">Quick match</p><h1>Choose a topic<span>.</span></h1>
          <p className="qm-lead">Pick a topic you want to debate. We’ll match<br className="qm-desktop-break" /> you with someone who has the opposite take.</p>

          <div className="qm-topic-list">
            {topics.map((topic, index) => {
              const isSelected = topic.id === selected?.id;
              return (
                <article key={topic.id} className={`qm-topic ${isSelected ? 'qm-topic--selected' : ''}`}>
                  <button type="button" className="qm-topic-summary" onClick={() => onSelectTopic(topic.id)}>
                    <span className="qm-topic-icon"><TopicIcon index={index} /></span><span className="qm-topic-label">{topic.label}</span>
                    <span className={`qm-radio ${isSelected ? 'qm-radio--checked' : ''}`}>{isSelected && <CheckIcon />}</span>
                    {isSelected && <span className="qm-chevron"><ChevronUpIcon /></span>}
                  </button>
                  {isSelected && <div className="qm-side-choice"><p>Do you agree or disagree with the statement?</p><div>
                    <button type="button" className={selectedSide === 'agree' ? 'selected' : ''} onClick={() => onSelectSide('agree')}><ThumbIcon /><span>Agree</span></button>
                    <button type="button" className={selectedSide === 'disagree' ? 'selected' : ''} onClick={() => onSelectSide('disagree')}><ThumbIcon down /><span>Disagree</span></button>
                  </div></div>}
                </article>
              );
            })}
          </div>

          {error && <div className="qm-error">{error}</div>}
          <button type="button" className="qm-submit" disabled={!selectedSide} onClick={() => onFindMatch(selectedSide)}><span>Find my match</span><span><ArrowIcon /></span></button>
        </section>}

        <aside className="qm-next"><h2>What happens next?</h2>
          <NextStep number="1" icon={<IconUser />} title="Get matched">We’ll find someone who chooses the opposite take.</NextStep>
          <NextStep number="2" icon={<IconVideo />} title="Debate face to face">You’ll join a private video call and make your case.</NextStep>
          <NextStep number="3" icon={<IconShield />} title="Respect the rules">Be respectful, listen, and keep it on topic.</NextStep>
          <div className="qm-promise"><IconShield /><div><h3>Our promise</h3><p>Real people. No filters.<br />Just real debates.</p></div></div>
        </aside>
      </main>

      <SiteFooter onHome={onBack} onAbout={onAbout} onFaq={onSupport} onSupport={onHelp} onPickLegal={onPickLegal} />
    </div>
  );
}
