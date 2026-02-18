import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../services/adminApi';

export default function RegistrationImporter({ 
  raceId, 
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

  const parseDelimited = (text) => {
    const hasTabs = text.includes('\t');
    const delim = hasTabs ? '\t' : ',';
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];
    const headers = lines[0].split(delim).map(h => h.trim());
    const idxOf = (names) => headers.findIndex(h => names.includes(h));
    const idxEmail = idxOf(['E-mailová adresa', 'E-mail', 'Email', 'email']);
    const idxName = idxOf(['Tvoje jméno', 'Jméno', 'Name', 'name']);
    const idxTeam = idxOf(['Jméno posádky', 'Team', 'Tým', 'team', 'posádka']);
    const idxCat = idxOf(['kategorie', 'Kategorie', 'category', 'race_category']);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(delim);
      const email = (parts[idxEmail] || '').trim();
      const name = (parts[idxName] || '').trim();
      const team = (parts[idxTeam] || '').trim();
      const category = (parts[idxCat] || '').trim();
      if (!email || !team) continue;
      rows.push({ email, name, team, category });
    }
    return rows;
  };

  const handleImportFile = async (file) => {
    setImportReport(null);
    if (!file) { setImportRows([]); return; }
    const text = await file.text();
    const rows = parseDelimited(text);
    setImportRows(rows);
  };

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

    try {
      for (const [, g] of grouped) {
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
        const alreadyReg = regByTeamId.has(teamId);
        if (!alreadyReg && cat) {
          try {
            await adminApi.addRegistration(raceId, { team_id: teamId, race_category_id: cat.id });
            report.createdRegistrations.push({ team: g.team, category: cat.name });
            regByTeamId.set(teamId, { team_id: teamId, category: cat.name });
          } catch (e) {
            report.errors.push(t('admin.registrationImporter.errorRegisterTeam', { team: g.team, category: cat?.name || g.category, message: e?.message || e }));
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
      }
      if (onImportComplete) onImportComplete();
    } finally {
      setImportReport(report);
      setImporting(false);
    }
  };

  return (
    <div>
      <h6 className="mb-2">{t('admin.registrationImporter.title')}</h6>
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
      </div>
      {importReport && (
        <div className="mt-3">
          <h6>{t('admin.registrationImporter.reportTitle')}</h6>
          <ul className="small">
            <li><strong>{t('admin.registrationImporter.teamsCreated')}:</strong> {importReport.createdTeams.length}</li>
            <li><strong>{t('admin.registrationImporter.registrationsCreated')}:</strong> {importReport.createdRegistrations.length}</li>
            <li><strong>{t('admin.registrationImporter.usersCreated')}:</strong> {importReport.createdUsers.length}</li>
            <li><strong>{t('admin.registrationImporter.existingUsers')}:</strong> {importReport.existingUsers.length}</li>
            <li><strong>{t('admin.registrationImporter.membersAdded')}:</strong> {importReport.addedMembers.reduce((a,b)=>a+b.count,0)}</li>
            {importReport.missingCategories.length > 0 && (
              <li className="text-warning"><strong>{t('admin.registrationImporter.missingCategories')}:</strong> {importReport.missingCategories.map(m => `${m.team} (${m.category})`).join('; ')}</li>
            )}
            {importReport.errors.length > 0 && (
              <li className="text-danger"><strong>{t('admin.registrationImporter.errors')}:</strong> {importReport.errors.join(' | ')}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
