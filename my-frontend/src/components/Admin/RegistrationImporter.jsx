import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../services/adminApi';
import { parseRegistrationImportText } from '../../utils/registrationImport';

export default function RegistrationImporter({
  raceId,
  race,
  teams,
  users,
  registrations,
  raceCategories,
  onImportComplete
}) {
  const { t } = useTranslation();
  const [importRows, setImportRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [markImportedAsPaid, setMarkImportedAsPaid] = useState(false);
  const [importProgress, setImportProgress] = useState(null);

  const slugify = (s) => {
    if (!s) return '';
    return s
      .toString()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleImportFile = async (file) => {
    setImportReport(null);
    setParseErrors([]);
    setImportProgress(null);
    if (!file) {
      setImportRows([]);
      return;
    }
    const text = await file.text();
    const parsed = parseRegistrationImportText(text);
    setImportRows(parsed.rows);
    setParseErrors(parsed.errors);
  };

  const importPaymentType = race?.allow_individual_registration && !race?.allow_team_registration
    ? 'driver'
    : 'team';

  const runImport = async () => {
    if (!raceId) return;
    if (importRows.length === 0) {
      return;
    }
    setImporting(true);
    const report = {
      createdUsers: [],
      existingUsers: [],
      createdTeams: [],
      existingTeams: [],
      createdRegistrations: [],
      markedPayments: [],
      existingPayments: [],
      addedMembers: [],
      missingCategories: [],
      errors: [],
    };

    // Build maps for quick lookups
    const usersByEmail = new Map((users || []).map(u => [String(u.email).toLowerCase(), u]));
    const teamByName = new Map((teams || []).map(t => [String(t.name).toLowerCase(), t]));
    const regByTeamId = new Map();
    (registrations || []).forEach(r => {
      const id = r.team_id || r.id;
      if (id) regByTeamId.set(id, r);
    });
    const catBySlug = new Map((raceCategories || []).map(c => [slugify(c.name), c]));
    const catByNameLower = new Map((raceCategories || []).map(c => [String(c.name).toLowerCase(), c]));

    // Group rows by team name
    const grouped = new Map();
    for (const row of importRows) {
      const key = row.team.toLowerCase();
      if (!grouped.has(key)) grouped.set(key, { team: row.team, category: row.category, members: [] });
      grouped.get(key).members.push({ email: row.email, name: row.name });
      const g = grouped.get(key);
      if (!g.category && row.category) g.category = row.category;
      if (g.category && row.category && g.category !== row.category) {
        report.errors.push(t('admin.registrationImporter.errorTeamMultipleCategories', { team: row.team, first: g.category, second: row.category }));
      }
    }

    const groupedEntries = Array.from(grouped.entries());
    const totalTeams = groupedEntries.length;
    setImportProgress({ current: 0, total: totalTeams, team: '' });

    try {
      for (let index = 0; index < groupedEntries.length; index += 1) {
        const [, g] = groupedEntries[index];
        setImportProgress({ current: index, total: totalTeams, team: g.team });

        // ensure team
        let team = teamByName.get(g.team.toLowerCase());
        if (!team) {
          try {
            const created = await adminApi.createTeam({ name: g.team });
            team = created;
            teamByName.set(g.team.toLowerCase(), created);
            report.createdTeams.push(g.team);
          } catch (e) {
            report.errors.push(t('admin.registrationImporter.errorCreateTeam', { team: g.team, message: e?.message || e }));
            continue;
          }
        } else {
          report.existingTeams.push(g.team);
        }

        // ensure registration (category)
        let cat = null;
        if (g.category) {
          cat = catBySlug.get(slugify(g.category)) || catByNameLower.get(g.category.toLowerCase()) || null;
          if (!cat) {
            report.missingCategories.push({ team: g.team, category: g.category });
          }
        }
        const teamId = team.id;
        const existingRegistration = regByTeamId.get(teamId) || null;
        const alreadyReg = Boolean(existingRegistration);
        if (!alreadyReg && cat) {
          try {
            const createdRegistration = await adminApi.addRegistration(raceId, { team_id: teamId, race_category_id: cat.id });
            report.createdRegistrations.push({ team: g.team, category: cat.name });
            regByTeamId.set(teamId, {
              ...(createdRegistration || {}),
              team_id: teamId,
              category: cat.name,
              payment_confirmed: Boolean(createdRegistration?.payment_confirmed),
            });
          } catch (e) {
            report.errors.push(t('admin.registrationImporter.errorRegisterTeam', { team: g.team, category: cat?.name || g.category, message: e?.message || e }));
          }
        }

        const registrationForPayment = regByTeamId.get(teamId) || existingRegistration;
        if (markImportedAsPaid && registrationForPayment) {
          if (registrationForPayment.payment_confirmed) {
            report.existingPayments.push(g.team);
          } else {
            try {
              await adminApi.markRegistrationPayment(raceId, teamId, importPaymentType, true);
              report.markedPayments.push(g.team);
              regByTeamId.set(teamId, {
                ...registrationForPayment,
                payment_confirmed: true,
              });
            } catch (e) {
              report.errors.push(t('admin.registrationImporter.errorMarkPayment', { team: g.team, message: e?.message || e }));
            }
          }
        }

        // ensure users and add to team
        const memberIds = [];
        for (const m of g.members) {
          const emailKey = String(m.email).toLowerCase();
          let u = usersByEmail.get(emailKey);
          if (!u) {
            const tempPwd = Math.random().toString(36).slice(-8) + 'A!9';
            try {
              const createdU = await adminApi.createUser({ name: m.name || '', email: m.email, password: tempPwd, is_administrator: false });
              u = createdU;
              usersByEmail.set(emailKey, createdU);
              report.createdUsers.push(m.email);
            } catch (e) {
              report.errors.push(t('admin.registrationImporter.errorCreateUser', { email: m.email, message: e?.message || e }));
              continue;
            }
          } else {
            report.existingUsers.push(m.email);
          }
          if (u?.id) memberIds.push(u.id);
        }
        const uniqueIds = Array.from(new Set(memberIds));
        if (uniqueIds.length > 0) {
          try {
            await adminApi.addTeamMembers(teamId, { user_ids: uniqueIds });
            report.addedMembers.push({ team: g.team, count: uniqueIds.length });
          } catch (e) {
            report.errors.push(t('admin.registrationImporter.errorAddMembers', { team: g.team, message: e?.message || e }));
          }
        }

        setImportProgress({ current: index + 1, total: totalTeams, team: g.team });
      }
      if (onImportComplete) onImportComplete();
    } finally {
      setImportReport(report);
      setImportProgress(null);
      setImporting(false);
    }
  };

  const progressCurrent = importProgress?.current || 0;
  const progressTotal = importProgress?.total || 0;
  const progressPercent = progressTotal > 0
    ? Math.round((progressCurrent / progressTotal) * 100)
    : 0;

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-2">
        <h6 className="mb-0">{t('admin.registrationImporter.title')}</h6>
        <button
          type="button"
          className="btn btn-sm btn-link p-0"
          onClick={() => setShowHelpModal(true)}
          title={t('admin.registrationImporter.importHelpTitle')}
        >
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
          </svg>
        </button>
      </div>
      <div className="mb-2">
        <div className="input-group">
          <input
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            className="form-control"
            onChange={(e) => handleImportFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className="btn btn-success"
            disabled={importing || importRows.length === 0}
            onClick={runImport}
          >
            {importing ? t('admin.registrationImporter.importing') : t('admin.registrationImporter.import') }
          </button>
        </div>
        <div className="form-check mt-2">
          <input
            id="registration-importer-mark-paid"
            type="checkbox"
            className="form-check-input"
            checked={markImportedAsPaid}
            onChange={(e) => setMarkImportedAsPaid(e.target.checked)}
            disabled={importing}
          />
          <label className="form-check-label" htmlFor="registration-importer-mark-paid">
            {t('admin.registrationImporter.markImportedAsPaid')}
          </label>
        </div>
        <div className="small text-muted mt-2">
          {t('admin.registrationImporter.importHelp')}
        </div>
      </div>
      {importing && importProgress && (
        <div className="mb-3">
          <div className="d-flex justify-content-between small text-muted mb-1">
            <span>
              {importProgress.team
                ? t('admin.registrationImporter.progressCurrentTeam', { team: importProgress.team })
                : t('admin.registrationImporter.progressPreparing')}
            </span>
            <span>{t('admin.registrationImporter.progressCount', { current: progressCurrent, total: progressTotal })}</span>
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-label={t('admin.registrationImporter.progressBarLabel')}
            aria-valuenow={progressPercent}
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              className="progress-bar progress-bar-striped progress-bar-animated"
              style={{ width: `${progressPercent}%` }}
            >
              {progressPercent}%
            </div>
          </div>
        </div>
      )}
      {parseErrors.length > 0 && (
        <div className="alert alert-warning small">
          <strong>Parser:</strong> {parseErrors.join(' | ')}
        </div>
      )}
      {importReport && (
        <div className="mt-3">
          <h6>{t('admin.registrationImporter.reportTitle')}</h6>
          <ul className="small">
            <li><strong>{t('admin.registrationImporter.teamsCreated')}:</strong> {importReport.createdTeams.length}</li>
            <li><strong>{t('admin.registrationImporter.registrationsCreated')}:</strong> {importReport.createdRegistrations.length}</li>
            <li><strong>{t('admin.registrationImporter.markedPayments')}:</strong> {importReport.markedPayments.length}</li>
            <li><strong>{t('admin.registrationImporter.usersCreated')}:</strong> {importReport.createdUsers.length}</li>
            <li><strong>{t('admin.registrationImporter.existingUsers')}:</strong> {importReport.existingUsers.length}</li>
            <li><strong>{t('admin.registrationImporter.membersAdded')}:</strong> {importReport.addedMembers.reduce((a,b)=>a+b.count,0)}</li>
            {importReport.existingPayments.length > 0 && (
              <li><strong>{t('admin.registrationImporter.existingPayments')}:</strong> {importReport.existingPayments.length}</li>
            )}
            {importReport.missingCategories.length > 0 && (
              <li className="text-warning"><strong>{t('admin.registrationImporter.missingCategories')}:</strong> {importReport.missingCategories.map(m => `${m.team} (${m.category})`).join('; ')}</li>
            )}
            {importReport.errors.length > 0 && (
              <li className="text-danger"><strong>{t('admin.registrationImporter.errors')}:</strong> {importReport.errors.join(' | ')}</li>
            )}
          </ul>
        </div>
      )}

      {showHelpModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t('admin.registrationImporter.importHelpTitle')}</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowHelpModal(false)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body">
                <h6>{t('admin.registrationImporter.importHelpFormat')}</h6>
                <p className="text-muted">{t('admin.registrationImporter.importHelpDescription')}</p>

                <h6 className="mt-3">{t('admin.registrationImporter.importHelpFields')}</h6>
                <ul>
                  <li><strong>Email</strong> {t('admin.registrationImporter.importHelpFieldEmail')}</li>
                  <li><strong>Name</strong> {t('admin.registrationImporter.importHelpFieldName')}</li>
                  <li><strong>Team</strong> {t('admin.registrationImporter.importHelpFieldTeam')}</li>
                  <li><strong>Category</strong> {t('admin.registrationImporter.importHelpFieldCategory')}</li>
                </ul>

                <h6 className="mt-3">{t('admin.registrationImporter.importHelpAcceptedHeaders')}</h6>
                <ul>
                  <li><strong>Email:</strong> Email, E-mail, E-mailová adresa</li>
                  <li><strong>Name:</strong> Name, Jméno, Tvoje jméno</li>
                  <li><strong>Team:</strong> Team, Tým, Jméno posádky, posádka</li>
                  <li><strong>Category:</strong> Category, Kategorie, kategorie, race_category</li>
                </ul>

                <h6 className="mt-3">{t('admin.registrationImporter.importHelpNotes')}</h6>
                <ul>
                  <li>{t('admin.registrationImporter.importHelpNoteOneRow')}</li>
                  <li>{t('admin.registrationImporter.importHelpNoteTeamRepeat')}</li>
                  <li>{t('admin.registrationImporter.importHelpNoteRequired')}</li>
                  <li>{t('admin.registrationImporter.importHelpNoteCategory')}</li>
                  <li>{t('admin.registrationImporter.importHelpNotePaid')}</li>
                </ul>

                <h6 className="mt-3">{t('admin.registrationImporter.importHelpExample')}</h6>
                <pre className="bg-light p-3 rounded border" style={{ fontSize: '12px', overflow: 'auto' }}>{`Email,Name,Team,Category
alice@example.com,Alice,Thunder Crew,Adventure
bob@example.com,Bob,Thunder Crew,Adventure
carol@example.com,Carol,Night Riders,Classic`}</pre>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowHelpModal(false)}>
                  {t('admin.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
