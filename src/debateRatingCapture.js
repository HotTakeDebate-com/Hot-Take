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

      // Read the actual selected state from the review UI. aria-pressed is more reliable
      // than depending on a CSS class surviving a style change.
      const selectedStars = Array.from(
        document.querySelectorAll('.debate-rating-star[aria-pressed="true"]')
      );
      const rating = selectedStars.length;
      if (!context?.peerUid || !context?.roomId || rating < 1 || rating > 5) return;

      void submitDebateRating({
        ratedUid: context.peerUid,
        rating,
        roomId: context.roomId,
      })
        .then(() => {
          window.localStorage.removeItem('hottake:ratingContext');
          window.dispatchEvent(
            new CustomEvent('hot-take:rating-updated', {
              detail: { ratedUid: context.peerUid, rating },
            })
          );
        })
        .catch((error) => {
          console.error('[hot-take] rating capture failed', error);
          // Keep the context so a retry can submit the rating.
        });
    },
    true
  );
}
