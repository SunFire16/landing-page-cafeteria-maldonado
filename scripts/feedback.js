// Encuesta privada de satisfacción. Validación cliente + envío al backend.

import { sendFeedback } from './api.js?v=20260502-tv-bigger';
import { CONFIG } from './config.js?v=20260502-tv-bigger';
import { getCurrentLocation } from './location.js?v=20260502-tv-bigger';
import { track } from './analytics.js?v=20260502-tv-bigger';

const RATING_FIELDS = ['ratingGeneral', 'ratingSpeed', 'ratingAccuracy'];

export function bindFeedbackForm(form) {
  if (!form) return;
  const status = form.querySelector('[data-feedback-status]');
  const submitBtn = form.querySelector('button[type="submit"]');
  const commentField = form.querySelector('textarea[name="comment"]');
  const counter = form.querySelector('[data-feedback-counter]');

  if (commentField && counter) {
    const max = CONFIG.feedback.commentMaxLength;
    commentField.maxLength = max;
    const update = () => { counter.textContent = `${commentField.value.length}/${max}`; };
    commentField.addEventListener('input', update);
    update();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validate(form, status)) return;

    const data = collect(form);
    submitBtn.disabled = true;
    setStatus(status, 'Enviando…', 'info');

    try {
      await sendFeedback(data);
      track('feedback_submit', { rating: data.ratingGeneral });
      form.reset();
      if (counter) counter.textContent = `0/${CONFIG.feedback.commentMaxLength}`;
      setStatus(status, '¡Gracias por tu opinión! La recibimos correctamente.', 'success');
    } catch (err) {
      setStatus(status, `No se pudo enviar: ${err.message}`, 'error');
    } finally {
      setTimeout(() => { submitBtn.disabled = false; }, CONFIG.ui.feedbackCooldownMs);
    }
  });
}

function validate(form, status) {
  const data = collect(form);
  for (const field of RATING_FIELDS) {
    const v = data[field];
    if (!Number.isInteger(v) || v < 1 || v > 5) {
      setStatus(status, 'Por favor califica los 3 aspectos (1 a 5).', 'error');
      return false;
    }
  }
  if (data.comment && data.comment.length > CONFIG.feedback.commentMaxLength) {
    setStatus(status, 'El comentario es demasiado largo.', 'error');
    return false;
  }
  return true;
}

function collect(form) {
  const fd = new FormData(form);
  const num = (k) => {
    const v = fd.get(k);
    return v === null || v === '' ? null : Number(v);
  };
  return {
    locationId: getCurrentLocation().id,
    ratingGeneral: num('ratingGeneral'),
    ratingSpeed: num('ratingSpeed'),
    ratingAccuracy: num('ratingAccuracy'),
    comment: (fd.get('comment') || '').toString().trim() || undefined,
    origin: 'web',
  };
}

function setStatus(node, message, kind) {
  if (!node) return;
  node.textContent = message;
  node.dataset.kind = kind;
}
