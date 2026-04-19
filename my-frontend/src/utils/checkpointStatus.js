export function getCheckpointReadOnlyMessage(t, checkpoint) {
  return checkpoint?.visited
    ? t('map.visitLoggedReadOnly')
    : t('map.loggingNotOpen');
}