import { submitDebateRating } from './chitChatFirestore.js';

if (typeof document !== 'undefined' && !window.__hotTakeRatingCaptureInstalled) {
  window.__hotTakeRatingCaptureInstalled = true;
  document.addEventListener(
    'click',
    (event) => {
      const button = event.target instanceof Element ? event.target.closest('button') : null;
      if (!button || button.textContent?.trim() !== 'Submit rating') return;
      const raw = window.localStorage?.getItem('hottake:ratingContext');
      if (!raw) return;
      let context;
      try {
        context = JSON.parse(raw);
      } catch {
        return;
      }
      const rating = Array.from(document.querySelectorAll('.debate-rating-star--active')).length;
      if (!context?.peerUid || !context?.roomId || rating < 1 || rating > 5) return;
      void submitDebateRating({ ratedUid: context.peerUid, rating, roomId: context.roomId })
        .catch((error) => console.error('[hot-take] rating capture failed', error));
      window.localStorage.removeItem('hottake:ratingContext');
    },
    true
  );
}
