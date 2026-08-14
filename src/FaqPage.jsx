import { HotTakeWordmark, IconInstagram, IconReddit, IconShield, IconUser, IconX, IconYouTube } from './LandingAssets.jsx';
import { contactEmailLabel, contactEmailMailto } from './legal/contactEmail.js';
import HeaderNavMenu from './HeaderNavMenu.jsx';
import { SiteFooter, SiteHeader } from './SiteChrome.jsx';
import './SupportPage.css';
import './FaqActiveTabFix.css';
import './FaqBubblyFix.css';

function FaqIcon({ type }) {
  const shapes = {
    bolt: <path d="m14 1-9 14h7l-2 12 10-16h-7l1-10Z" />,
    lock: <><rect x="5" y="12" width="18" height="14" rx="2" /><path d="M9 12V8a5 5 0 0 1 10 0v4M14 17v4" /></>,
    age: <><circle cx="14" cy="14" r="12" /><text x="14" y="17" textAnchor="middle">18+</text></>,
    crown: <path d="m3 10 6 5 5-11 5 11 6-5-2 14H5L3 10Z" />,
    headset: <><path d="M4 16v-3a10 10 0 0 1 20 0v3M4 16h4v8H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 1-2ZM24 16h-4v8h3a2 2 0 0 0 2-2v-4a2 2 0 0 0-1-2ZM20 24c0 2-2 3-5 3" /></>,
  };
  return <svg viewBox="0 0 28 29" aria-hidden="true">{shapes[type]}</svg>;
}

const faqs = [
  ['user', 'What is Hot Take?', 'Hot Take is a 1-on-1 live debate platform that connects you with someone who has an opposing viewpoint. You discuss, debate, and diverge—live.'],
  ['bolt', 'How does a debate work?', 'You’ll be matched with an opponent, join a private room, and debate in real time using our video and voice technology. After the debate, you can rate the experience and optionally continue the conversation.'],
  ['shield', 'How is safety enforced?', 'We enforce safety on our platform to ensure a secure environment for all users. All forms of free speech are protected.'],
  ['lock', 'Is my personal information safe?', 'Yes. We take your privacy seriously. We never share your personal information with third parties. For more details, please review our Privacy Policy.'],
  ['age', 'Do I have to be 18 or older?', 'Yes. You must be at least 18 years old to create an account and use Hot Take.'],
  ['crown', 'Is Hot Take free to use?', 'Yes, Hot Take is free to use! We also offer premium benefits for users who want even more out of their debate experience.'],
  ['headset', 'Need more help?', 'Reach out to our support team any time. We’re happy to help.'],
];

export default function FaqPage({ onBack, onSupport, onQuickMatch, isSignedIn, onSignIn, onSignUp, onSignOut, onProfile, onPickLegal, onPickMission }) {
  const email = contactEmailLabel();
  const mailto = contactEmailMailto();
  return <div className="faq-page"><SiteHeader onHome={onBack} onAbout={onPickMission} onTopics={onBack} onQuickMatch={onQuickMatch} onFaq={() => {}} onSupport={onSupport} isSignedIn={isSignedIn} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} onProfile={onProfile} onPickLegal={onPickLegal} /><main className="faq-content"><aside><p>FAQ</p><h1>Frequently<br />Asked Questions</h1><i /><span>Everything you need to know about Hot Take. Can&apos;t find what you&apos;re looking for?</span><section><FaqIcon type="headset" /><div><h2>Still have questions?</h2><p>Contact us at</p>{mailto ? <a href={mailto}>{email}</a> : <b>{email}</b>}<p>We&apos;re here to help.</p></div></section></aside><div className="faq-list">{faqs.map(([icon,title,copy]) => <article key={title}><span>{icon === 'user' ? <IconUser /> : icon === 'shield' ? <IconShield /> : <FaqIcon type={icon} />}</span><div><h2>{title}</h2><p>{copy}</p></div></article>)}</div></main><SiteFooter onHome={onBack} onAbout={onPickMission} onFaq={() => {}} onSupport={onSupport} onPickLegal={onPickLegal} /></div>;
}
