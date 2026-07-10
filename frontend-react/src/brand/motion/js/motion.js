// ============================================
// VITRAS · motion.js · Web Animations API helpers
// Same eight animations, JS-driven for advanced sequencing.
// ============================================

export const VT_EASE = {
  expoOut:    'cubic-bezier(0.16, 1, 0.30, 1)',
  inOutSine:  'cubic-bezier(0.45, 0, 0.55, 1)',
  inOutQuart: 'cubic-bezier(0.65, 0, 0.35, 1)',
};

export const VT_TIME = {
  instant: 80, snap: 220, calm: 440,
  reveal: 880, cycle: 1600, breath: 3200,
};

/**
 * 01 · Logo reveal
 * @param {HTMLElement} markEl - the symbol element
 * @param {HTMLElement[]} letterEls - wordmark letter elements (incl. accent dot)
 */
export function vtRevealLogo(markEl, letterEls){
  markEl.animate(
    [{ opacity:0, transform:'scale(0.4)' }, { opacity:1, transform:'scale(1)' }],
    { duration: VT_TIME.reveal, easing: VT_EASE.expoOut, fill:'both' }
  );
  letterEls.forEach((el, i) => {
    el.animate(
      [{ opacity:0, transform:'translateY(8px)' }, { opacity:1, transform:'translateY(0)' }],
      { duration: 600, delay: 340 + i*80, easing: VT_EASE.expoOut, fill:'both' }
    );
  });
}

/**
 * 04 · Pulse operational (loops)
 * @param {HTMLElement[]} ringEls - 3 ring elements absolutely positioned
 */
export function vtPulseOperational(ringEls){
  ringEls.forEach((el, i) => {
    el.animate(
      [
        { transform:'scale(1)',   opacity:0.7 },
        { transform:'scale(2.4)', opacity:0,   offset:0.8 },
        { transform:'scale(2.4)', opacity:0 },
      ],
      { duration: VT_TIME.breath, delay: i*1067, easing: VT_EASE.expoOut, iterations: Infinity }
    );
  });
}

/**
 * 07 · Notification
 */
export function vtNotify(dotEl){
  dotEl.animate(
    [
      { transform:'scale(0.6)', opacity:0,  offset:0 },
      { transform:'scale(1.1)', opacity:1,  offset:0.14 },
      { transform:'scale(1)',   opacity:1,  offset:0.22 },
      { transform:'scale(1)',   opacity:1,  offset:1 },
    ],
    { duration: 2400, easing: VT_EASE.inOutQuart, iterations: Infinity }
  );
}

/**
 * 03 · Loading bar — apply as decoration on a 2px container
 */
export function vtLoading(barInnerEl){
  return barInnerEl.animate(
    [{ left:'-40%' }, { left:'100%' }],
    { duration: VT_TIME.cycle, easing: VT_EASE.inOutQuart, iterations: Infinity }
  );
}
