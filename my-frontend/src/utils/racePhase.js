// Label and badge colours for a race phase (state from timeStateForRace).
export const getPhasePresentation = (t, phaseState) => ({
  value: t(`activeRace.phase.${phaseState || 'UNKNOWN'}`),
  toneClass: phaseState === 'LOGGING'
    ? 'bg-success-subtle text-success-emphasis'
    : phaseState === 'SHOW_ONLY' || phaseState === 'POST_LOG_SHOW'
      ? 'bg-info-subtle text-info-emphasis'
      : phaseState === 'BEFORE_SHOW'
        ? 'bg-warning-subtle text-warning-emphasis'
        : 'bg-secondary-subtle text-secondary-emphasis',
});
