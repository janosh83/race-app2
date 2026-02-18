import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';

export default function CheckpointVisits({ checkpointId }) {
  const { t } = useTranslation();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVisits = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await adminApi.getVisitsByCheckpoint(checkpointId); // Ensure this endpoint exists
        setVisits(data);
      } catch (err) {
        logger.error('ADMIN', 'Failed to load visits for checkpoint', err);
        setError(t('admin.checkpointVisits.errorLoad'));
      } finally {
        setLoading(false);
      }
    };

    fetchVisits();
  }, [checkpointId]);

  const handleDelete = async (visitId) => {
    if (window.confirm(t('admin.checkpointVisits.confirmDelete'))) {
      try {
        await adminApi.deleteVisit(visitId);
        setVisits(visits.filter(visit => visit.id !== visitId));
      } catch (err) {
        logger.error('ADMIN', 'Failed to delete visit', err);
        setError(t('admin.checkpointVisits.errorDelete'));
      }
    }
  };

  if (loading) return <div>{t('admin.checkpointVisits.loading')}</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div>
      <h3>{t('admin.checkpointVisits.title')}</h3>
      <ul>
        {visits.map(visit => (
          <li key={visit.id}>
            <span>{visit.time} - {visit.image && <img src={visit.image} alt={t('admin.visits.imageAltCheckpointVisit')} width="50" />}</span>
            <button onClick={() => handleDelete(visit.id)}>{t('admin.checkpointVisits.delete')}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}